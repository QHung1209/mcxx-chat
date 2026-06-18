import { ForbiddenException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatMemberRepository } from '../repositories/member.repository';
import { ChatRepository } from '../repositories/chat.repository';
import { ChatRole, ChatType } from '../enums/chat.enum';
import { RedisService } from 'src/support/services/redis.service';
import { UserRepository } from 'src/identity/repositories/user.repository';
import { MediaService } from 'src/media/services/media.service';
import { In, IsNull } from 'typeorm';

@Injectable()
export class ChatMemberService {
  constructor(
    private readonly chatMemberRepository: ChatMemberRepository,
    private readonly chatRepository: ChatRepository,
    private readonly redisService: RedisService,
    private readonly userRepository: UserRepository,
    private readonly mediaService: MediaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async markSeen(userId: number, chatId: number, messageId: number) {
    const result = await this.chatMemberRepository
      .createQueryBuilder()
      .update()
      .set({ lastSeenMessageId: messageId })
      .where('chatId = :chatId AND userId = :userId', { chatId, userId })
      .andWhere(
        '(lastSeenMessageId IS NULL OR lastSeenMessageId < :messageId)',
        { messageId },
      )
      .execute();
    if (result.affected) {
      this.eventEmitter.emit('chat.seen', { userId, chatId, messageId });
    }
  }

  async addMembersToChat(
    user: { id: number },
    chatId: number,
    userIds: number[],
  ) {
    // Telegram-style: cho phép thêm bất kỳ user nào đang hoạt động.
    const users = await this.userRepository.find({
      where: { id: In(userIds), isActive: true },
      select: ['id'],
    });
    const validUserIds = users.map((u) => u.id);
    if (!validUserIds.length) return;

    const [existing, chat] = await Promise.all([
      this.chatMemberRepository.find({
        where: { chatId, userId: In(validUserIds) },
        withDeleted: true,
        select: ['userId'],
      }),
      this.chatRepository.findOne({
        where: { id: chatId },
        select: ['lastMessageId'],
      }),
    ]);
    const existingUserIds = new Set(existing.map((m) => m.userId));
    const currentLastMessageId = chat?.lastMessageId ?? null;

    const toRestore = validUserIds.filter((id) => existingUserIds.has(id));
    const toCreate = validUserIds.filter((id) => !existingUserIds.has(id));

    await Promise.all([
      toRestore.length
        ? this.chatMemberRepository
            .restore({ chatId, userId: In(toRestore) })
            .then(() =>
              this.chatMemberRepository.update(
                { chatId, userId: In(toRestore) },
                {
                  role: ChatRole.MEMBER,
                  lastSeenMessageId: currentLastMessageId,
                },
              ),
            )
        : Promise.resolve(),
      toCreate.length
        ? this.chatMemberRepository.save(
            toCreate.map((userId) => ({
              chatId,
              userId,
              role: ChatRole.MEMBER,
              lastSeenMessageId: currentLastMessageId,
            })),
          )
        : Promise.resolve(),
    ]);

    await this.redisService.delete(`chat:${chatId}:members`);
    this.eventEmitter.emit('chat.member.added', {
      chatId,
      actorId: user.id,
      targetIds: validUserIds,
    });
  }

  async leaveChat(userId: number, chatId: number) {
    const chat = await this.chatRepository.findOne({ where: { id: chatId } });
    if (!chat) return;

    if (chat.type === ChatType.DIRECT) {
      await this.chatMemberRepository.update(
        { chatId, userId },
        { hiddenAtMessageId: chat.lastMessageId ?? 0 },
      );
      return;
    }

    const allMembers = await this.chatMemberRepository.find({
      where: { chatId },
      select: ['userId', 'role'],
    });

    const others = allMembers.filter((m) => m.userId !== userId);

    if (others.length === 0) {
      // Last member — delete the group
      await Promise.all([
        this.chatMemberRepository.softDelete({ chatId, userId }),
        this.chatRepository.softDelete(chatId),
        this.redisService.delete(`chat:${chatId}:members`),
      ]);
      return;
    }

    const isOnlyOwner =
      allMembers.some(
        (m) => m.userId === userId && m.role === ChatRole.OWNER,
      ) && !others.some((m) => m.role === ChatRole.OWNER);

    if (isOnlyOwner) {
      throw new ForbiddenException({
        message: "You're the last owner. Transfer ownership first.",
        key: 'CANNOT_LEAVE_ONLY_OWNER',
      });
    }

    await this.removeMemberFromChat(chatId, userId, userId);
  }

  async getHiddenAtMessageId(
    chatId: number,
    userId: number,
  ): Promise<number | null> {
    const member = await this.chatMemberRepository.findOne({
      where: { chatId, userId },
      select: ['hiddenAtMessageId'],
    });
    return member?.hiddenAtMessageId ?? null;
  }

  async removeMemberFromChat(
    chatId: number,
    memberId: number,
    actorId?: number,
  ) {
    const key = `chat:${chatId}:members`;
    await Promise.all([
      this.chatMemberRepository.softDelete({ chatId, userId: memberId }),
      this.redisService.hdel(key, memberId.toString()),
    ]);
    if (actorId !== undefined) {
      const isSelf = actorId === memberId;
      this.eventEmitter.emit(
        isSelf ? 'chat.member.left' : 'chat.member.removed',
        { chatId, actorId, targetId: memberId },
      );
    }
  }

  async updateMemberRoleInChat(
    chatId: number,
    memberId: number,
    role: ChatRole,
    actorId?: number,
  ) {
    const key = `chat:${chatId}:members`;
    await Promise.all([
      this.chatMemberRepository.update({ chatId, userId: memberId }, { role }),
      this.redisService.hset(key, memberId.toString(), role),
    ]);
    if (actorId !== undefined) {
      this.eventEmitter.emit('chat.member.role.updated', {
        chatId,
        actorId,
        targetId: memberId,
        role,
      });
    }
  }

  async getSeenBy(chatId: number, messageId: number): Promise<number[]> {
    const rows = await this.chatMemberRepository
      .createQueryBuilder('member')
      .where('member.chatId = :chatId', { chatId })
      .andWhere('member.deletedAt IS NULL')
      .andWhere('member.lastSeenMessageId >= :messageId', { messageId })
      .select('member.userId', 'userId')
      .getRawMany<{ userId: number }>();
    return rows.map((r) => Number(r.userId));
  }

  async getMembers(chatId: number) {
    const members = await this.chatMemberRepository
      .createQueryBuilder('chatMember')
      .leftJoinAndSelect('chatMember.user', 'user')
      .where('chatMember.chatId = :chatId', { chatId })
      .andWhere('chatMember.deletedAt IS NULL')
      .select([
        'chatMember.id',
        'chatMember.userId',
        'chatMember.role',
        'chatMember.lastSeenMessageId',
        'chatMember.createdAt',
        'user.id',
        'user.name',
        'user.avatarMediaId',
      ])
      .getMany();

    const users = members.map((m) => m.user).filter(Boolean);
    if (users.length) {
      await this.mediaService.attachAvatar(users);
    }
    return members;
  }

  async getMemberRole(
    chatId: number,
    userId: number,
  ): Promise<ChatRole | null> {
    const key = `chat:${chatId}:members`;
    await this._loadMembersToCache(chatId, key);
    const role = await this.redisService.hget(key, userId.toString());
    return (role as ChatRole) ?? null;
  }

  async isMember(chatId: number, userId: number): Promise<boolean> {
    return (await this.getMemberRole(chatId, userId)) !== null;
  }

  async getMemberIds(chatId: number): Promise<number[]> {
    const key = `chat:${chatId}:members`;
    await this._loadMembersToCache(chatId, key);
    const ids = await this.redisService.hkeys(key);
    return ids.map(Number);
  }

  private async _loadMembersToCache(chatId: number, key: string) {
    const exists = await this.redisService.exists(key);
    if (exists) return;

    const members = await this.chatMemberRepository.find({
      where: { chatId, deletedAt: IsNull() },
      select: ['userId', 'role'],
    });

    if (members.length) {
      const data = Object.fromEntries(
        members.map((m) => [m.userId.toString(), m.role]),
      );
      await this.redisService.hmset(key, data);
      await this.redisService.expire(key, 60 * 60);
    }
  }
}
