import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatRepository } from '../repositories/chat.repository';
import { ChatMemberRepository } from '../repositories/member.repository';
import { MessageRepository } from '../repositories/message.repository';
import { UserRepository } from 'src/identity/repositories/user.repository';
import {
  CreateGroupChatDto,
  StartChatDto,
  UpdateChatDto,
} from '../dto/chat.dto';
import { ChatRole, ChatType } from '../enums/chat.enum';
import { MediaService } from 'src/media/services/media.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly chatRepository: ChatRepository,
    private readonly chatMemberRepository: ChatMemberRepository,
    private readonly messageRepository: MessageRepository,
    private readonly userRepository: UserRepository,
    private readonly mediaService: MediaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createGroup(user, dto: CreateGroupChatDto) {
    const chat = await this.chatRepository.save({
      type: ChatType.GROUP,
      name: dto.name,
      avatarMediaId: dto.avatar ?? null,
    });

    const members = dto.userIds.map((userId) => ({
      chatId: chat.id,
      userId,
      role: ChatRole.MEMBER,
    }));
    await this.chatMemberRepository.save([
      {
        chatId: chat.id,
        userId: user.id,
        role: ChatRole.OWNER,
      },
      ...members,
    ]);

    this.eventEmitter.emit('chat.group.created', {
      chatId: chat.id,
      actorId: user.id,
    });

    return chat;
  }

  async updateChat(chatId: number, dto: UpdateChatDto) {
    const dataUpdate: any = {};
    if (dto.name) dataUpdate.name = dto.name;
    if (dto.avatar) dataUpdate.avatarMediaId = dto.avatar;
    if (Object.keys(dataUpdate).length)
      await this.chatRepository.update(chatId, dataUpdate);
  }

  async startChat(user, dto: StartChatDto) {
    const existing = await this.chatRepository
      .createQueryBuilder('chat')
      .innerJoin('chat.members', 'a', 'a.userId = :userId', {
        userId: user.id,
      })
      .innerJoin('chat.members', 'b', 'b.userId = :otherUserId', {
        otherUserId: dto.userId,
      })
      .where('chat.type = :type', { type: ChatType.DIRECT })
      .leftJoin('b.user', 'user')
      .select([
        'chat.id as id',
        'chat.type as type',
        'user.id as "userId"',
        'user.name as name',
      ])
      .getRawOne<{
        id: number;
        type: ChatType;
        userId: number;
        name: string;
      }>();

    if (existing) {
      return this.withOtherUserAvatar(
        { id: existing.id, type: existing.type, name: existing.name },
        existing.userId,
      );
    }

    const chat = await this.chatRepository.save({
      type: ChatType.DIRECT,
    });

    await this.chatMemberRepository.save([
      { chatId: chat.id, userId: user.id, role: ChatRole.MEMBER },
      { chatId: chat.id, userId: dto.userId, role: ChatRole.MEMBER },
    ]);

    const member = await this.chatMemberRepository.findOne({
      where: { chatId: chat.id, userId: dto.userId },
      relations: ['user'],
    });

    return this.withOtherUserAvatar(
      { id: chat.id, type: chat.type, name: member?.user?.name },
      dto.userId,
    );
  }

  private async withOtherUserAvatar<T extends object>(
    result: T,
    otherUserId?: number,
  ): Promise<T & { avatar: any }> {
    if (!otherUserId) return { ...result, avatar: null };
    const other = await this.userRepository.findOne({
      where: { id: otherUserId },
      select: ['id', 'avatarMediaId'],
    });
    const holder = [{ id: otherUserId, avatarMediaId: other?.avatarMediaId }];
    await this.mediaService.attachAvatar(holder);
    return { ...result, avatar: holder[0]['avatar'] ?? null };
  }

  async getMyChats(user, updatedAt?: Date, q?: string) {
    const qb = this.chatRepository
      .createQueryBuilder('chat')
      .withDeleted()
      .innerJoin(
        'chat.members',
        'member',
        'member.userId = :userId AND member.deletedAt IS NULL',
        { userId: user.id },
      )
      .leftJoinAndSelect(
        'chat.members',
        'otherMember',
        'chat.type = :directType AND otherMember.userId != :userId',
        { directType: ChatType.DIRECT, userId: user.id },
      )
      .leftJoinAndSelect('otherMember.user', 'otherUser')
      .leftJoinAndSelect('chat.lastMessage', 'lastMessage')
      .leftJoinAndSelect('lastMessage.sender', 'lastMessageSender')
      .where('chat.deletedAt IS NULL')
      .andWhere('(chat.type = :groupType OR chat.lastMessageId IS NOT NULL)', {
        groupType: ChatType.GROUP,
      })
      .andWhere(
        '(member.hiddenAtMessageId IS NULL OR chat.lastMessageId > member.hiddenAtMessageId)',
      )
      .select([
        'chat.id',
        'chat.type',
        'chat.name',
        'chat.avatarMediaId',
        'chat.lastMessageId',
        'chat.updatedAt',

        'otherMember.id',
        'otherUser.id',
        'otherUser.name',
        'otherUser.avatarMediaId',

        'lastMessage.id',
        'lastMessage.content',
        'lastMessage.type',
        'lastMessage.createdAt',
        'lastMessage.deletedAt',
        'lastMessage.metadata',

        'lastMessageSender.id',
        'lastMessageSender.name',
      ])
      .orderBy('chat.updatedAt', 'DESC')
      .limit(10);

    if (updatedAt) {
      qb.andWhere('chat.updatedAt < :updatedAt', { updatedAt });
    }

    if (q) {
      qb.andWhere(
        '(chat.type = :groupType AND chat.name ILIKE :q) OR (chat.type = :directType AND otherUser.name ILIKE :q)',
        { groupType: ChatType.GROUP, directType: ChatType.DIRECT, q: `%${q}%` },
      );
    }

    const allChats = await qb.getMany();
    if (!allChats.length) return [];

    const users: any[] = [];
    for (const c of allChats) {
      const otherUser = c.members?.[0]?.user;
      if (otherUser) users.push(otherUser);
      if (c.lastMessage?.sender) users.push(c.lastMessage.sender);
    }
    if (users.length) {
      await this.mediaService.attachAvatar(users);
    }
    await this.mediaService.attachAvatar(allChats);

    const chatIds = allChats.map((c) => c.id);
    const [unreadRows, mentionRows] = await Promise.all([
      this.getUnreadRows(user, chatIds),
      this.getMentionRows(user, chatIds),
    ]);

    const unreadMap = new Map(
      unreadRows.map((r) => [r.chatId, Number(r.unread)]),
    );
    const mentionMap = new Map(mentionRows.map((r) => [Number(r.chatId), r]));

    return allChats.map((chat) => {
      const otherUser = chat.members?.[0]?.user ?? null;
      const mention = mentionMap.get(chat.id);

      return {
        id: chat.id,
        type: chat.type,
        name: chat.type === ChatType.GROUP ? chat.name : otherUser?.name,
        avatar:
          chat.type === ChatType.GROUP
            ? (chat as any).avatar
            : (otherUser as any)?.avatar,
        lastMessage: chat.lastMessage ?? null,
        unread: unreadMap.get(chat.id) ?? 0,
        mention: mention
          ? {
              messageId: Number(mention.messageId),
              senderId: Number(mention.senderId),
            }
          : null,
        updatedAt: chat.updatedAt,
      };
    });
  }

  async getUnreadCount(user): Promise<number> {
    return this.chatRepository
      .createQueryBuilder('chat')
      .innerJoin(
        'chat.members',
        'member',
        'member.userId = :userId AND member.deletedAt IS NULL',
        { userId: user.id },
      )
      .where('chat.lastMessageId IS NOT NULL')
      .andWhere(
        'GREATEST(COALESCE(member.lastSeenMessageId, 0), COALESCE(member.hiddenAtMessageId, 0)) < chat.lastMessageId',
      )
      .getCount();
  }

  private async getUnreadRows(user, chatIds: number[]) {
    return this.messageRepository
      .createQueryBuilder('message')
      .select(['message."chatId" as "chatId"', 'COUNT(message.id) as unread'])
      .leftJoin(
        'chat__members',
        'member',
        'member."chatId" = message."chatId" AND member."userId" = :userId AND member."deletedAt" IS NULL',
        { userId: user.id },
      )
      .where('message."chatId" IN (:...chatIds)', { chatIds })
      .andWhere(
        'message.id > GREATEST(COALESCE(member."lastSeenMessageId", 0), COALESCE(member."hiddenAtMessageId", 0))',
      )
      .andWhere('message."deletedAt" IS NULL')
      .groupBy('message."chatId"')
      .getRawMany();
  }

  private async getMentionRows(user, chatIds: number[]) {
    return this.messageRepository
      .createQueryBuilder('message')
      .select([
        'DISTINCT ON (message."chatId") message."chatId" as "chatId"',
        'message.id as "messageId"',
        'message."senderId" as "senderId"',
      ])
      .leftJoin(
        'chat__members',
        'member',
        'member."chatId" = message."chatId" AND member."userId" = :userId AND member."deletedAt" IS NULL',
        { userId: user.id },
      )
      .where('message."chatId" IN (:...chatIds)', { chatIds })
      .andWhere(
        'message.id > GREATEST(COALESCE(member."lastSeenMessageId", 0), COALESCE(member."hiddenAtMessageId", 0))',
      )
      .andWhere('message."deletedAt" IS NULL')
      .andWhere(
        '(message."mentionAll" = true OR :userId = ANY(message."mentionIds"))',
        { userId: user.id },
      )
      .orderBy('message."chatId"')
      .addOrderBy('message.id', 'DESC')
      .getRawMany<{
        chatId: number;
        messageId: number;
        senderId: number;
      }>();
  }
}
