import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReactionRepository } from '../repositories/reaction.repository';
import { RedisService } from 'src/support/services/redis.service';

@Injectable()
export class ReactionService {
  constructor(
    private readonly reactionRepository: ReactionRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly redisService: RedisService,
  ) {}

  private readonly REACTION_TTL = 3600; // 1 hour

  private reactionKey(messageId: string) {
    return `reaction:counts:${messageId}`;
  }

  private async initReactionCache(messageId: string, key: string) {
    const counts: { emoji: string; count: string }[] =
      await this.reactionRepository
        .createQueryBuilder('reaction')
        .select('reaction.emoji', 'emoji')
        .addSelect('COUNT(*)', 'count')
        .where('reaction.messageId = :messageId', { messageId })
        .groupBy('reaction.emoji')
        .getRawMany();

    if (counts.length === 0) return;

    const data: Record<string, string> = {};
    counts.forEach((r) => {
      data[r.emoji] = r.count;
    });
    await this.redisService.hmset(key, data);
    await this.redisService.expire(key, this.REACTION_TTL);
  }

  private async updateReactionCache(
    messageId: string,
    key: string,
    emoji: string,
    delta: number,
  ) {
    const exists = await this.redisService.exists(key);
    if (!exists) {
      await this.initReactionCache(messageId, key);
      return;
    }

    const newVal = await this.redisService.hIncrBy(key, emoji, delta);
    if (newVal <= 0) {
      await this.redisService.hdel(key, emoji);
    }
    await this.redisService.expire(key, this.REACTION_TTL);
  }

  async upsert(
    userId: string,
    chatId: string,
    messageId: string,
    emoji: string,
  ) {
    const key = this.reactionKey(messageId);
    const existing = await this.reactionRepository.findOne({
      where: { messageId, userId },
    });

    if (existing) {
      if (existing.emoji === emoji) {
        await this.reactionRepository.delete({ id: existing.id });
        await this.updateReactionCache(messageId, key, emoji, -1);
      } else {
        const oldEmoji = existing.emoji;
        existing.emoji = emoji;
        await this.reactionRepository.save(existing);
        await this.updateReactionCache(messageId, key, oldEmoji, -1);
        await this.updateReactionCache(messageId, key, emoji, 1);
      }
    } else {
      await this.reactionRepository.save({ messageId, userId, emoji });
      await this.updateReactionCache(messageId, key, emoji, 1);
    }

    const reactions = await this.countReaction(messageId);

    this.eventEmitter.emit('message.reaction.updated', {
      chatId,
      messageId,
      reactions,
    });
  }

  async countReaction(messageId: string) {
    const key = this.reactionKey(messageId);
    const exists = await this.redisService.exists(key);

    if (!exists) {
      await this.initReactionCache(messageId, key);
    }

    const hash = await this.redisService.hGetAll(key);
    return Object.entries(hash ?? {}).map(([emoji, count]) => ({
      emoji,
      count: Math.max(0, Number(count)),
    }));
  }

  async detailEmoji(messageId: string, emoji: string, createdAt?: Date) {
    const qb = this.reactionRepository
      .createQueryBuilder('reaction')
      .where('reaction.messageId = :messageId', { messageId })
      .andWhere('reaction.emoji = :emoji', { emoji })
      .limit(20)
      .select(['reaction.createdAt', 'reaction.userId']);

    if (createdAt) {
      qb.andWhere('reaction.createdAt < :createdAt', { createdAt });
    }

    qb.orderBy('reaction.createdAt', 'DESC');

    return qb.getMany();
  }
}
