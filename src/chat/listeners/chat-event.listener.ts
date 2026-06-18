import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { In } from 'typeorm';
import { EventGateway } from 'src/support/event.gateway';
import { UserRepository } from 'src/identity/repositories/user.repository';
import { MessageType } from '../enums/chat.enum';
import { MessageRepository } from '../repositories/message.repository';
import { ChatRepository } from '../repositories/chat.repository';
import { ChatMemberService } from '../services/member.service';

@Injectable()
export class ChatEventListener {
  constructor(
    private readonly eventGateway: EventGateway,
    private readonly messageRepository: MessageRepository,
    private readonly chatRepository: ChatRepository,
    private readonly chatMemberService: ChatMemberService,
    private readonly userRepository: UserRepository,
  ) {}

  private emitToMembers(
    memberIds: number[],
    event: string,
    data: any,
    excludeId?: number,
  ) {
    memberIds
      .filter((id) => id !== excludeId)
      .forEach((id) =>
        this.eventGateway.handleEmitSocket({ event, data, to: String(id) }),
      );
  }

  private async createSystemMessage(
    chatId: number,
    senderId: number,
    metadata: Record<string, any>,
    memberIds: number[],
  ) {
    const message = await this.messageRepository.save({
      chatId,
      senderId,
      type: MessageType.SYSTEM,
      content: null,
      metadata,
    });
    await this.chatMemberService.markSeen(senderId, chatId, message.id);
    await this.chatRepository.update(chatId, { lastMessageId: message.id });
    this.emitToMembers(memberIds, 'NEW_MESSAGE', message);
  }

  @OnEvent('chat.group.created')
  async onGroupCreated(payload: { chatId: number; actorId: number }) {
    const { chatId, actorId } = payload;
    const [actor, memberIds] = await Promise.all([
      this.userRepository.findOne({
        where: { id: actorId },
        select: ['id', 'name'],
      }),
      this.chatMemberService.getMemberIds(chatId),
    ]);

    await this.createSystemMessage(
      chatId,
      actorId,
      {
        event: 'GROUP_CREATED',
        actorId,
        actorName: actor?.name ?? '',
      },
      memberIds,
    );
  }

  @OnEvent('chat.seen')
  onSeen(payload: { userId: number; chatId: number; messageId: number }) {
    const { userId, chatId, messageId } = payload;
    this.eventGateway.handleEmitToChat(chatId, 'SEEN', {
      userId,
      chatId,
      messageId,
    });
  }

  @OnEvent('message.new')
  onNewMessage(payload: {
    memberIds: number[];
    message: any;
    senderId: number;
  }) {
    const { memberIds, message, senderId } = payload;
    this.emitToMembers(memberIds, 'NEW_MESSAGE', message, senderId);
  }

  @OnEvent('message.link.preview')
  onLinkPreview(payload: {
    memberIds: number[];
    messageId: number;
    chatId: number;
    previewData: any;
  }) {
    const { memberIds, messageId, chatId, previewData } = payload;
    this.emitToMembers(memberIds, 'LINK_PREVIEW_READY', {
      messageId,
      chatId,
      previewData,
    });
  }

  @OnEvent('message.deleted')
  onMessageDeleted(payload: {
    memberIds: number[];
    chatId: number;
    messageId: number;
  }) {
    const { memberIds, chatId, messageId } = payload;
    this.emitToMembers(memberIds, 'MESSAGE_DELETED', { chatId, messageId });
  }

  @OnEvent('message.pinned')
  onMessagePinned(payload: {
    memberIds: number[];
    chatId: number;
    messageId: number;
  }) {
    const { memberIds, chatId, messageId } = payload;
    this.emitToMembers(memberIds, 'MESSAGE_PINNED', { chatId, messageId });
  }

  @OnEvent('message.unpinned')
  onMessageUnpinned(payload: {
    memberIds: number[];
    chatId: number;
    messageId: number;
  }) {
    const { memberIds, chatId, messageId } = payload;
    this.emitToMembers(memberIds, 'MESSAGE_UNPINNED', { chatId, messageId });
  }

  @OnEvent('chat.member.added')
  async onMemberAdded(payload: {
    chatId: number;
    actorId: number;
    targetIds: number[];
  }) {
    const { chatId, actorId, targetIds } = payload;
    const [actor, targets, memberIds] = await Promise.all([
      this.userRepository.findOne({
        where: { id: actorId },
        select: ['id', 'name'],
      }),
      this.userRepository.find({
        where: { id: In(targetIds) },
        select: ['id', 'name'],
      }),
      this.chatMemberService.getMemberIds(chatId),
    ]);

    await this.createSystemMessage(
      chatId,
      actorId,
      {
        event: 'MEMBER_ADDED',
        actorId,
        actorName: actor?.name ?? '',
        targetIds,
        targetNames: targets.map((u) => u.name),
      },
      memberIds,
    );
  }

  @OnEvent('chat.member.removed')
  async onMemberRemoved(payload: {
    chatId: number;
    actorId: number;
    targetId: number;
  }) {
    const { chatId, actorId, targetId } = payload;
    const [actor, target, memberIds] = await Promise.all([
      this.userRepository.findOne({
        where: { id: actorId },
        select: ['id', 'name'],
      }),
      this.userRepository.findOne({
        where: { id: targetId },
        select: ['id', 'name'],
      }),
      this.chatMemberService.getMemberIds(chatId),
    ]);

    await this.createSystemMessage(
      chatId,
      actorId,
      {
        event: 'MEMBER_REMOVED',
        actorId,
        actorName: actor?.name ?? '',
        targetId,
        targetName: target?.name ?? '',
      },
      memberIds,
    );
  }

  @OnEvent('chat.member.left')
  async onMemberLeft(payload: { chatId: number; actorId: number }) {
    const { chatId, actorId } = payload;
    const [actor, memberIds] = await Promise.all([
      this.userRepository.findOne({
        where: { id: actorId },
        select: ['id', 'name'],
      }),
      this.chatMemberService.getMemberIds(chatId),
    ]);

    await this.createSystemMessage(
      chatId,
      actorId,
      {
        event: 'MEMBER_LEFT',
        actorId,
        actorName: actor?.name ?? '',
      },
      memberIds,
    );
  }

  @OnEvent('message.reaction.updated')
  onReactionUpdated(payload: {
    chatId: number;
    messageId: number;
    reactions: any[];
  }) {
    const { chatId, messageId, reactions } = payload;
    this.eventGateway.handleEmitToChat(chatId, 'MESSAGE_REACTION_UPDATED', {
      chatId,
      messageId,
      reactions,
    });
  }

  @OnEvent('chat.member.role.updated')
  async onMemberRoleUpdated(payload: {
    chatId: number;
    actorId: number;
    targetId: number;
    role: string;
  }) {
    const { chatId, actorId, targetId, role } = payload;
    const [actor, target, memberIds] = await Promise.all([
      this.userRepository.findOne({
        where: { id: actorId },
        select: ['id', 'name'],
      }),
      this.userRepository.findOne({
        where: { id: targetId },
        select: ['id', 'name'],
      }),
      this.chatMemberService.getMemberIds(chatId),
    ]);

    await this.createSystemMessage(
      chatId,
      actorId,
      {
        event: 'ROLE_UPDATED',
        actorId,
        actorName: actor?.name ?? '',
        targetId,
        targetName: target?.name ?? '',
        role,
      },
      memberIds,
    );
  }

  @OnEvent('chat.poll.voted')
  onPollVoted(payload: {
    chatId: number;
    messageId: number;
    options: { id: number; count: number; previewUserIds: number[] }[];
  }) {
    const { chatId, messageId, options } = payload;
    this.eventGateway.handleEmitToChat(chatId, 'POLL_UPDATED', {
      chatId,
      messageId,
      options,
    });
  }

  @OnEvent('chat.poll.closed')
  onPollClosed(payload: {
    chatId: number;
    messageId: number;
    userId: number;
  }) {
    const { chatId, messageId } = payload;
    this.eventGateway.handleEmitToChat(chatId, 'POLL_CLOSED', {
      chatId,
      messageId,
    });
  }
}
