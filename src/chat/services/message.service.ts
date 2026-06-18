import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MessageRepository } from '../repositories/message.repository';
import { ReactionRepository } from '../repositories/reaction.repository';
import { PollVoteRepository } from '../repositories/poll-vote.repository';
import { ChatMemberService } from './member.service';
import { CreateMessageDto, ForwardMessageDto } from '../dto/message.dto';
import { ChatRepository } from '../repositories/chat.repository';
import { ChatRole, MessageType } from '../enums/chat.enum';
import { LinkPreviewService } from './link-preview.service';
import { ChatMemberRepository } from '../repositories/member.repository';
import {
  LINK_PREVIEW_JOB,
  LINK_PREVIEW_QUEUE,
  LinkPreviewJobData,
} from '../constants/link-preview.constants';
import { MEDIA_SELECT, MESSAGE_SELECT, SEEN_PREVIEW_LIMIT } from '../constants/message.constants';

@Injectable()
export class MessageService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly reactionRepository: ReactionRepository,
    private readonly pollVoteRepository: PollVoteRepository,
    private readonly chatMemberService: ChatMemberService,
    private readonly chatRepository: ChatRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly linkPreviewService: LinkPreviewService,
    private readonly chatMemberRepository: ChatMemberRepository,
    @InjectQueue(LINK_PREVIEW_QUEUE)
    private readonly linkPreviewQueue: Queue<LinkPreviewJobData>,
  ) {}

  async createMessage(
    senderId: string,
    data: CreateMessageDto,
    chatId: string,
    suppressEvent = false,
  ) {
    const isMember = await this.chatMemberService.isMember(chatId, senderId);
    if (!isMember) {
      throw new BadRequestException('You are not a member of this chat');
    }

    const urls = this.linkPreviewService.extractUrls(data.content);

    const message = await this.messageRepository.save({
      chatId,
      senderId,
      content: data.content,
      type: data.type,
      replyToMessageId: data.replyToMessageId,
      hasLink: urls.length > 0,
      mentionIds: data.mentionIds ?? null,
      mentionAll: data.mentionAll ?? false,
    });

    await this.messageRepository.attachMedia(message.id, data.mediaIds);

    const [messageWithSender, memberIds] = await Promise.all([
      this.messageRepository
        .createQueryBuilder('message')
        .leftJoinAndSelect('message.sender', 'sender')
        .leftJoinAndSelect('message.replyToMessage', 'replyToMessage')
        .where('message.id = :id', { id: message.id })
        .select([
          'message.id',
          'message.chatId',
          'message.content',
          'message.type',
          'message.hasLink',
          'message.previewData',
          'message.createdAt',
          'message.mentionIds',
          'message.mentionAll',
          'message.senderId',
          'replyToMessage.id',
          'replyToMessage.content',
        ])
        .getOne(),
      this.chatMemberService.getMemberIds(chatId),
    ]);

    if (messageWithSender) {
      await this.messageRepository.loadMedia(
        messageWithSender,
        'medias',
        MEDIA_SELECT,
      );
    }

    await Promise.all([
      this.chatRepository.update(chatId, { lastMessageId: message.id }),
      this.chatMemberService.markSeen(senderId, chatId, message.id),
    ]);

    if (!suppressEvent) {
      this.eventEmitter.emit('message.new', {
        memberIds,
        message: messageWithSender,
        senderId,
      });

      if (urls.length > 0) {
        await this.enqueueLinkPreview(message.id, chatId, urls[0], memberIds);
      }
    }

    return { message: messageWithSender, memberIds };
  }

  private async enqueueLinkPreview(
    messageId: string,
    chatId: string,
    url: string,
    memberIds: string[],
  ) {
    await this.linkPreviewQueue.add(
      LINK_PREVIEW_JOB,
      { messageId, chatId, url, memberIds },
      {
        jobId: `${chatId}-${messageId}`,
        removeOnComplete: true,
        removeOnFail: 50,
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');

    const role = await this.chatMemberService.getMemberRole(
      message.chatId,
      userId,
    );
    const isSender = message.senderId === userId;
    const isOwner = role === ChatRole.OWNER;
    if (!isSender && !isOwner)
      throw new ForbiddenException(
        'Only the sender or chat owner can delete this message',
      );

    await this.messageRepository.update(messageId, {
      content: null,
      deletedAt: new Date(),
    });

    const memberIds = await this.chatMemberService.getMemberIds(message.chatId);
    this.eventEmitter.emit('message.deleted', {
      memberIds,
      chatId: message.chatId,
      messageId,
    });
  }

  async forwardMessage(
    senderId: string,
    messageId: string,
    dto: ForwardMessageDto,
  ) {
    const isMember = await this.chatMemberService.isMember(
      dto.toChatId,
      senderId,
    );
    if (!isMember)
      throw new ForbiddenException('You are not a member of the target chat');

    const source = await this.messageRepository.findOne({
      where: { id: messageId },
    });
    if (!source) throw new NotFoundException('Message not found');
    await this.messageRepository.loadMedia(source, 'medias', ['mediaId']);
    const forwardedMediaIds = (source.medias ?? []).map((m: any) => m.mediaId);

    const message = await this.messageRepository.save({
      chatId: dto.toChatId,
      senderId,
      content: source.content,
      type: source.type,
      hasLink: source.hasLink,
      previewData: source.previewData,
      forwardFromMessageId: source.forwardFromMessageId ?? messageId,
    });

    await this.messageRepository.attachMedia(message.id, forwardedMediaIds);

    const [messageWithSender] = await Promise.all([
      this.messageRepository
        .createQueryBuilder('message')
        .leftJoinAndSelect('message.sender', 'sender')
        .where('message.id = :id', { id: message.id })
        .select([
          'message.id',
          'message.chatId',
          'message.content',
          'message.type',
          'message.hasLink',
          'message.previewData',
          'message.forwardFromMessageId',
          'message.createdAt',
          'message.senderId',
        ])
        .getOne(),
      this.chatRepository.update(dto.toChatId, { lastMessageId: message.id }),
    ]);

    if (messageWithSender) {
      await this.messageRepository.loadMedia(
        messageWithSender,
        'medias',
        MEDIA_SELECT,
      );
    }

    const memberIds = await this.chatMemberService.getMemberIds(dto.toChatId);
    this.eventEmitter.emit('message.new', {
      memberIds,
      message: messageWithSender,
      senderId,
    });

    return messageWithSender;
  }

  async pinMessage(chatId: string, messageId: string) {
    await this.messageRepository.update(
      { id: messageId, chatId },
      { isPinned: true },
    );

    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    const memberIds = await this.chatMemberService.getMemberIds(chatId);
    this.eventEmitter.emit('message.pinned', { memberIds, chatId, messageId });

    return message;
  }

  async unpinMessage(chatId: string, messageId: string) {
    await this.messageRepository.update(
      { id: messageId, chatId },
      { isPinned: false },
    );

    const memberIds = await this.chatMemberService.getMemberIds(chatId);
    this.eventEmitter.emit('message.unpinned', {
      memberIds,
      chatId,
      messageId,
    });
  }

  async getPinnedMessages(chatId: string) {
    const messages = await this.messageRepository
      .createQueryBuilder('message')
      .where('message.chatId = :chatId', { chatId })
      .andWhere('message.isPinned = true')
      .andWhere('message.deletedAt IS NULL')
      .select([
        'message.id',
        'message.content',
        'message.type',
        'message.createdAt',
        'message.senderId',
      ])
      .orderBy('message.id', 'DESC')
      .getMany();
    if (messages.length) {
      await this.messageRepository.loadMedia(messages, 'medias', MEDIA_SELECT);
    }
    return messages;
  }


  private buildMessageQuery(chatId: string, userId: string) {
    return this.messageRepository
      .createQueryBuilder('message')
      .leftJoin('message.replyToMessage', 'replyToMessage')
      .leftJoin('message.poll', 'poll')
      .leftJoin('poll.options', 'option')
      .where('message.chatId = :chatId', { chatId })
      .andWhere(
        `message.id > COALESCE(
        (
          SELECT m."hiddenAtMessageId" 
          FROM chat__members m 
          WHERE m."chatId" = :chatId 
          AND m."userId" = :userId), 0)`,
        { userId },
      )
      .select(MESSAGE_SELECT)
      .withDeleted();
  }

  private async getMessagesAround(
    chatId: string,
    aroundId: string,
    limit: number,
    userId: string,
  ) {
    const half = Math.floor(limit / 2);

    const [before, after] = await Promise.all([
      this.buildMessageQuery(chatId, userId)
        .andWhere('message.id <= :aroundId', { aroundId })
        .orderBy('message.id', 'DESC')
        .limit(half + 1)
        .getMany(),
      this.buildMessageQuery(chatId, userId)
        .andWhere('message.id > :aroundId', { aroundId })
        .orderBy('message.id', 'ASC')
        .limit(half)
        .getMany(),
    ]);

    return [...before, ...after].sort((a, b) =>
      b.id > a.id ? 1 : b.id < a.id ? -1 : 0,
    );
  }

  private async getMessagesAfter(
    chatId: string,
    afterId: string,
    limit: number,
    userId: string,
  ) {
    const rows = await this.buildMessageQuery(chatId, userId)
      .andWhere('message.id > :afterId', { afterId })
      .orderBy('message.id', 'ASC')
      .limit(limit)
      .getMany();

    return rows.reverse();
  }

  private async getMessagesBefore(
    chatId: string,
    limit: number,
    userId: string,
    beforeId?: string,
  ) {
    const qb = this.buildMessageQuery(chatId, userId)
      .orderBy('message.id', 'DESC')
      .limit(limit);

    if (beforeId) {
      qb.andWhere('message.id < :beforeId', { beforeId });
    }

    return qb.getMany();
  }

  async getMessages(
    userId: string,
    chatId: string,
    beforeId?: string,
    limit = 20,
    aroundId?: string,
    afterId?: string,
  ) {
    let messages: any[];

    if (aroundId) {
      messages = await this.getMessagesAround(chatId, aroundId, limit, userId);
    } else if (afterId) {
      messages = await this.getMessagesAfter(chatId, afterId, limit, userId);
    } else {
      messages = await this.getMessagesBefore(chatId, limit, userId, beforeId);
    }

    const isLatestPage = !beforeId && !afterId && !aroundId;

    if (messages.length > 0) {
      const replies = messages.map((m) => m.replyToMessage).filter(Boolean);

      await Promise.all([
        this.attachReactions(messages, userId),
        this.attachPollVotes(messages, userId),
        this.messageRepository.loadMedia(
          [...messages, ...replies],
          'medias',
          MEDIA_SELECT,
        ),
        isLatestPage ? this.attachSeenBy(messages, chatId) : Promise.resolve(),
        this.chatMemberService.markSeen(userId, chatId, messages[0].id),
      ]);
    }

    return messages;
  }

  private async attachSeenBy(messages: any[], chatId: string) {
    const lastThree = messages.slice(0, 3);

    const cursors = await this.chatMemberRepository
      .createQueryBuilder('member')
      .where('member.chatId = :chatId', { chatId })
      .andWhere('member.deletedAt IS NULL')
      .andWhere('member.lastSeenMessageId IS NOT NULL')
      .select(['member.userId', 'member.lastSeenMessageId'])
      .getMany();

    const idsAsc = lastThree
      .map((m) => m.id)
      .sort((a: string, b: string) => (a > b ? 1 : a < b ? -1 : 0));
    const seenMap = new Map<string, string[]>();

    for (const c of cursors) {
      const seenId = c.lastSeenMessageId;
      if (seenId === null) continue;
      let target: string | null = null;
      for (const id of idsAsc) {
        if (id <= seenId) target = id;
        else break;
      }
      if (target === null) continue;
      if (!seenMap.has(target)) seenMap.set(target, []);
      seenMap.get(target)!.push(c.userId);
    }

    for (const m of lastThree) {
      const userIds = seenMap.get(m.id) ?? [];
      m.seenBy = {
        count: userIds.length,
        previewUserIds: userIds.slice(0, SEEN_PREVIEW_LIMIT),
      };
    }
  }

  private async attachReactions(messages: any[], userId: string) {
    const messageIds = messages.map((m) => m.id);
    // 1 query: vừa đếm count theo emoji, vừa biết user hiện tại đã react chưa
    // (BOOL_OR). Trước đây phải chạy 2 query (count + reaction của user).
    const rows = await this.reactionRepository
      .createQueryBuilder('r')
      .select('r.messageId', 'messageId')
      .addSelect('r.emoji', 'emoji')
      .addSelect('COUNT(*)', 'count')
      .addSelect('BOOL_OR(r.userId = :userId)', 'reacted')
      .where({ messageId: In(messageIds) })
      .setParameter('userId', userId)
      .groupBy('r.messageId, r.emoji')
      .getRawMany();

    const reactionMap = new Map<
      string,
      { emoji: string; count: number; reacted: boolean }[]
    >();
    for (const r of rows) {
      const mid = r.messageId;
      if (!reactionMap.has(mid)) reactionMap.set(mid, []);
      reactionMap.get(mid)!.push({
        emoji: r.emoji,
        count: Number(r.count),
        reacted: r.reacted === true || r.reacted === 't',
      });
    }
    messages.forEach((m) => {
      m.reactions = reactionMap.get(m.id) ?? [];
    });
  }

  private async attachPollVotes(messages: any[], userId: string) {
    const pollMessages = messages.filter((m) => m.poll?.options?.length);
    if (!pollMessages.length) return;

    const optionIds = pollMessages.flatMap((m) =>
      m.poll.options.map((o: any) => o.id),
    );

    const [voteCounts, userVotes, previewVotes] = await Promise.all([
      this.pollVoteRepository
        .createQueryBuilder('v')
        .select('v.optionId', 'optionId')
        .addSelect('COUNT(*)', 'count')
        .where('v.optionId IN (:...optionIds)', { optionIds })
        .groupBy('v.optionId')
        .getRawMany(),

      this.pollVoteRepository.find({
        where: { optionId: In(optionIds), userId },
        select: ['optionId'],
      }),

      this.pollVoteRepository.query(
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
      ),
    ]);

    const countMap = new Map(
      voteCounts.map((r) => [r.optionId, Number(r.count)]),
    );

    const votedSet = new Set(userVotes.map((v) => v.optionId));

    const previewMap = new Map<string, string[]>();

    for (const p of previewVotes) {
      const oid = p.optionId;

      if (!previewMap.has(oid)) {
        previewMap.set(oid, []);
      }

      previewMap.get(oid)!.push(p.userId);
    }

    pollMessages.forEach((m) => {
      m.poll.options.forEach((o: any) => {
        o.count = countMap.get(o.id) ?? 0;
        o.isVoted = votedSet.has(o.id);
        o.previewUserIds = previewMap.get(o.id) ?? [];
      });
    });
  }

  async getSharedContent(
    chatId: string,
    tab: 'media' | 'file' | 'link',
    beforeId?: string,
    limit = 20,
  ) {
    const qb = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.chatId = :chatId', { chatId })
      .andWhere('message.deletedAt IS NULL')
      .select([
        'message.id',
        'message.type',
        'message.content',
        'message.hasLink',
        'message.previewData',
        'message.createdAt',
      ])
      .orderBy('message.id', 'DESC')
      .limit(limit);

    if (tab === 'link') {
      qb.andWhere('message.hasLink = true');
    } else if (tab === 'media') {
      qb.andWhere('message.type = :type', { type: MessageType.MEDIA });
    } else {
      qb.andWhere('message.type = :type', { type: MessageType.FILE });
    }

    if (beforeId) {
      qb.andWhere('message.id < :beforeId', { beforeId });
    }

    const messages = await qb.getMany();
    if (messages.length) {
      await this.messageRepository.loadMedia(messages, 'medias', MEDIA_SELECT);
    }
    return messages;
  }

  async searchMessages(
    userId: string,
    chatId: string,
    q: string,
    beforeId?: string,
    limit = 20,
  ) {
    const keyword = q?.trim();
    if (!keyword) return [];

    const qb = this.messageRepository
      .createQueryBuilder('message')
      .leftJoin('message.sender', 'sender')
      .where('message.chatId = :chatId', { chatId })
      .andWhere('message.deletedAt IS NULL')
      .andWhere('message.content ILIKE :q', { q: `%${keyword}%` })
      .select([
        'message.id',
        'message.content',
        'message.type',
        'message.createdAt',
        'message.mentionIds',
        'message.mentionAll',
        'message.senderId',
      ])
      .orderBy('message.id', 'DESC')
      .limit(limit);

    const hiddenAtMessageId = await this.chatMemberService.getHiddenAtMessageId(
      chatId,
      userId,
    );
    if (hiddenAtMessageId !== null) {
      qb.andWhere('message.id > :hiddenAtMessageId', { hiddenAtMessageId });
    }

    if (beforeId) {
      qb.andWhere('message.id < :beforeId', { beforeId });
    }

    const messages = await qb.getMany();
    if (messages.length) {
      await this.messageRepository.loadMedia(messages, 'medias', MEDIA_SELECT);
    }
    return messages;
  }

  async findMessageById(id: string) {
    const message = await this.messageRepository.findOneBy({ id });
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }
}
