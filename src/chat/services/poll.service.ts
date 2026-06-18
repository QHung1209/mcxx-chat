import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PollOptionRepository } from '../repositories/poll-option.repository';
import { PollVoteRepository } from '../repositories/poll-vote.repository';
import { CreatePollDto } from '../dto/poll.dto';
import { MessageService } from './message.service';
import { MessageType, PollType } from '../enums/chat.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PollRepository } from '../repositories/poll.repository';
import { RedisService } from 'src/support/services/redis.service';

@Injectable()
export class PollService {
  constructor(
    private readonly pollOptionRepository: PollOptionRepository,
    private readonly pollVoteRepository: PollVoteRepository,
    private readonly messageService: MessageService,
    private readonly pollRepository: PollRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly redisService: RedisService,
  ) {}

  private pollVoteKey(pollId: string) {
    return `poll:votes:${pollId}`;
  }

  private async initVoteCache(pollId: string, key: string): Promise<void> {
    const [options, counts] = await Promise.all([
      this.pollOptionRepository.find({ where: { pollId } }),
      this.pollVoteRepository
        .createQueryBuilder('v')
        .select('v.optionId', 'optionId')
        .addSelect('COUNT(*)', 'count')
        .where('v.pollId = :pollId', { pollId })
        .groupBy('v.optionId')
        .getRawMany(),
    ]);

    const data: Record<string, string> = {};
    options.forEach((opt) => {
      data[String(opt.id)] = '0';
    });
    counts.forEach((r) => {
      data[String(r.optionId)] = String(r.count);
    });

    if (Object.keys(data).length > 0) {
      await this.redisService.hmset(key, data);
    }
  }

  private async updateVoteCache(
    pollId: string,
    key: string,
    optionId: string,
    delta: number,
  ): Promise<void> {
    const exists = await this.redisService.exists(key);
    if (!exists) {
      await this.initVoteCache(pollId, key);
      return;
    }

    await this.redisService.hIncrBy(key, String(optionId), delta);
  }

  async createPoll(senderId: string, chatId: string, dto: CreatePollDto) {
    const { message, memberIds } = await this.messageService.createMessage(
      senderId,
      { type: MessageType.POLL, content: dto.content },
      chatId,
      true,
    );

    if (!message) throw new BadRequestException('Failed to create message');

    const poll = await this.pollRepository.save({
      messageId: message.id,
      name: dto.content,
      type: dto.type,
    });

    const savedOptions = await Promise.all(
      dto.options.map((option) =>
        this.pollOptionRepository.save({
          pollId: poll.id,
          content: option.content,
          order: option.order,
        }),
      ),
    );

    const key = this.pollVoteKey(poll.id);
    const initial: Record<string, string> = {};
    savedOptions.forEach((opt) => {
      initial[String(opt.id)] = '0';
    });
    await this.redisService.hmset(key, initial);

    const fullMessage = {
      ...message,
      poll: {
        id: poll.id,
        name: poll.name,
        type: poll.type,
        closedAt: null,
        options: savedOptions
          .sort((a, b) => a.order - b.order)
          .map((o) => ({
            id: o.id,
            content: o.content,
            order: o.order,
            count: 0,
            isVoted: false,
            previewUserIds: [],
          })),
      },
    };

    this.eventEmitter.emit('message.new', {
      memberIds,
      message: fullMessage,
      senderId,
    });

    return fullMessage;
  }

  async vote(userId: string, pollId: string, optionId: string) {
    const poll = await this.pollRepository.findOne({
      where: { id: pollId },
      relations: ['message'],
    });

    if (!poll) throw new BadRequestException('Poll not found');
    if (poll.closedAt && poll.closedAt < new Date()) return;

    const key = this.pollVoteKey(pollId);
    await this.applyVoteChange(userId, pollId, optionId, poll.type, key);

    const options = await this.buildVoteResult(key);
    this.eventEmitter.emit('chat.poll.voted', {
      chatId: poll.message.chatId,
      messageId: poll.messageId,
      options,
    });
  }

  async closePoll(pollId: string, userId: string) {
    const poll = await this.pollRepository.findOne({
      where: { id: pollId },
      relations: ['message'],
    });
    if (!poll) throw new BadRequestException('Poll not found');
    await this.pollRepository.update(pollId, { closedAt: new Date() });
    this.eventEmitter.emit('chat.poll.closed', {
      userId,
      messageId: poll.messageId,
      chatId: poll.message.chatId,
    });
  }

  async deletePoll(userId: string, pollId: string) {
    const poll = await this.pollRepository.findOne({
      where: { id: pollId },
      relations: ['message'],
    });
    if (!poll) throw new NotFoundException('Poll not found');

    await this.messageService.deleteMessage(userId, poll.messageId);

    await this.pollOptionRepository.delete({ pollId });
    await this.pollRepository.delete(pollId);
    await this.redisService.delete(this.pollVoteKey(pollId));
  }

  async detailVotes(optionId: string, createdAt?: Date) {
    const qb = this.pollVoteRepository
      .createQueryBuilder('vote')
      .where('vote.optionId = :optionId', { optionId })
      .limit(20)
      .select(['vote.createdAt', 'vote.userId']);

    if (createdAt) {
      qb.andWhere('vote.createdAt < :createdAt', { createdAt });
    }

    qb.orderBy('vote.createdAt', 'DESC');

    return qb.getMany();
  }

  private async applyVoteChange(
    userId: string,
    pollId: string,
    optionId: string,
    pollType: PollType,
    key: string,
  ): Promise<void> {
    const existingVote = await this.pollVoteRepository.findOne({
      where: { userId, pollId, optionId },
    });

    if (existingVote) {
      await this.pollVoteRepository.delete(existingVote.id);
      await this.updateVoteCache(pollId, key, optionId, -1);
      return;
    }

    let oldOptionId: string | null = null;
    if (pollType === PollType.SINGLE) {
      const currentVote = await this.pollVoteRepository.findOne({
        where: { userId, pollId },
      });
      if (currentVote) {
        oldOptionId = currentVote.optionId;
        await this.pollVoteRepository.delete({ userId, pollId });
      }
    }

    await this.pollVoteRepository.save({ userId, optionId, pollId });
    await this.updateVoteCache(pollId, key, optionId, 1);
    if (oldOptionId !== null) {
      await this.updateVoteCache(pollId, key, oldOptionId, -1);
    }
  }

  private async buildVoteResult(key: string) {
    const hash = await this.redisService.hGetAll(key);

    const counts = Object.entries(hash ?? {}).map(([id, count]) => ({
      id,
      count: Math.max(0, Number(count)),
    }));

    const optionIds = counts.map((c) => c.id);

    const previewRows:
      | {
          optionId: string;
          userId: string;
        }[]
      | [] =
      optionIds.length > 0
        ? await this.pollVoteRepository.query(
            `SELECT v."optionId", v."userId"
           FROM (
             SELECT 
               pv."optionId",
               pv."userId",
               ROW_NUMBER() OVER (
                 PARTITION BY pv."optionId"
                 ORDER BY pv."createdAt"
               ) as rn
             FROM chat__poll_vote pv
             WHERE pv."optionId" = ANY($1)
           ) v
           WHERE v.rn <= 3`,
            [optionIds],
          )
        : [];

    const previewMap = new Map<string, string[]>();

    for (const row of previewRows) {
      const arr = previewMap.get(row.optionId) ?? [];
      arr.push(row.userId);
      previewMap.set(row.optionId, arr);
    }

    return counts.map((c) => ({
      ...c,
      previewUserIds: previewMap.get(c.id) ?? [],
    }));
  }
}
