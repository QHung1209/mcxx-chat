import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/support/utils/jwt.guard';
import { ChatService } from '../services/chat.service';
import { MessageService } from '../services/message.service';
import { ChatMemberService } from '../services/member.service';
import { ReactionService } from '../services/reaction.service';
import { PollService } from '../services/poll.service';
import { CreatePollDto } from '../dto/poll.dto';
import {
  CreateGroupChatDto,
  StartChatDto,
  UpdateChatDto,
} from '../dto/chat.dto';
import { CreateMessageDto, ForwardMessageDto } from '../dto/message.dto';
import { ChatRole } from '../enums/chat.enum';
import { ChatMember, ChatOwner } from '../decorators/member.decorator';

@Controller('chat')
@UseGuards(new JwtAuthGuard('user'))
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly messageService: MessageService,
    private readonly chatMemberService: ChatMemberService,
    private readonly reactionService: ReactionService,
    private readonly pollService: PollService,
  ) {}

  @Get()
  async getMyChats(
    @Req() req: any,
    @Query('updatedAt') updatedAt?: string,
    @Query('q') q?: string,
  ) {
    const result = await this.chatService.getMyChats(
      req.user,
      updatedAt ? new Date(updatedAt) : undefined,
      q,
    );
    return { statusCode: 200, result };
  }

  @Get('unread')
  async getUnreadCount(@Req() req: any) {
    const result = await this.chatService.getUnreadCount(req.user);
    return { statusCode: 200, result };
  }

  @Post('group')
  async createGroup(@Req() req: any, @Body() dto: CreateGroupChatDto) {
    const result = await this.chatService.createGroup(req.user, dto);
    return { statusCode: 201, result };
  }

  @Put(':id')
  @ChatOwner()
  async updateChat(
    @Param('id', ParseIntPipe) chatId: number,
    @Body() dto: UpdateChatDto,
  ) {
    await this.chatService.updateChat(chatId, dto);
    return { statusCode: 200 };
  }

  @Post('start-chat')
  async startChat(@Req() req: any, @Body() dto: StartChatDto) {
    const result = await this.chatService.startChat(req.user, dto);
    return { statusCode: 201, result };
  }

  @Post(':id/poll')
  @ChatMember()
  async createPoll(
    @Req() req: any,
    @Param('id', ParseIntPipe) chatId: number,
    @Body() dto: CreatePollDto,
  ) {
    const result = await this.pollService.createPoll(req.user.id, chatId, dto);
    return { statusCode: 201, result };
  }

  @Post(':id/poll/:pollId/vote')
  @ChatMember()
  async votePoll(
    @Req() req: any,
    @Param('id', ParseIntPipe) _chatId: number,
    @Param('pollId', ParseIntPipe) pollId: number,
    @Body('optionId', ParseIntPipe) optionId: number,
  ) {
    await this.pollService.vote(req.user.id, pollId, optionId);
    return { statusCode: 200 };
  }

  @Post(':id/poll/:pollId/close')
  @ChatMember()
  async closePoll(
    @Req() req: any,
    @Param('id', ParseIntPipe) _chatId: number,
    @Param('pollId', ParseIntPipe) pollId: number,
  ) {
    await this.pollService.closePoll(pollId, req.user.id);
    return { statusCode: 200 };
  }

  @Delete(':id/poll/:pollId')
  @ChatMember()
  async deletePoll(
    @Req() req: any,
    @Param('id', ParseIntPipe) _chatId: number,
    @Param('pollId', ParseIntPipe) pollId: number,
  ) {
    await this.pollService.deletePoll(req.user.id, pollId);
    return { statusCode: 200 };
  }

  @Get(':id/poll/:pollId/option/:optionId/votes')
  @ChatMember()
  async getPollVotes(
    @Param('id', ParseIntPipe) _chatId: number,
    @Param('optionId', ParseIntPipe) optionId: number,
    @Query('createdAt') createdAt?: string,
  ) {
    const result = await this.pollService.detailVotes(
      optionId,
      createdAt ? new Date(createdAt) : undefined,
    );
    return { statusCode: 200, result };
  }

  @Get(':id/message/:messageId/reaction')
  @ChatMember()
  async getReactionDetail(
    @Param('id', ParseIntPipe) _chatId: number,
    @Param('messageId', ParseIntPipe) messageId: number,
    @Query('emoji') emoji: string,
    @Query('createdAt') createdAt?: string,
  ) {
    const result = await this.reactionService.detailEmoji(
      messageId,
      emoji,
      createdAt ? new Date(createdAt) : undefined,
    );
    return { statusCode: 200, result };
  }

  @Post(':id/message/:messageId/reaction')
  @ChatMember()
  async reactToMessage(
    @Req() req: any,
    @Param('id', ParseIntPipe) chatId: number,
    @Param('messageId', ParseIntPipe) messageId: number,
    @Body('emoji') emoji: string,
  ) {
    await this.reactionService.upsert(req.user.id, chatId, messageId, emoji);
    return { statusCode: 200 };
  }

  @Post(':id/seen')
  @ChatMember()
  async markSeen(
    @Req() req: any,
    @Param('id', ParseIntPipe) chatId: number,
    @Body('messageId') messageId: number,
  ) {
    await this.chatMemberService.markSeen(req.user.id, chatId, messageId);
    return { statusCode: 200 };
  }

  @Get(':id/message/search')
  @ChatMember()
  async searchMessages(
    @Req() req: any,
    @Param('id', ParseIntPipe) chatId: number,
    @Query('q') q: string,
    @Query('beforeId') beforeId?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.messageService.searchMessages(
      req.user.id,
      chatId,
      q,
      beforeId ? Number(beforeId) : undefined,
      limit ? Number(limit) : undefined,
    );
    return { statusCode: 200, result };
  }

  @Get(':id/message')
  @ChatMember()
  async getMessages(
    @Req() req: any,
    @Param('id', ParseIntPipe) chatId: number,
    @Query('beforeId') beforeId?: string,
    @Query('limit') limit?: string,
    @Query('aroundId') aroundId?: string,
    @Query('afterId') afterId?: string,
  ) {
    const result = await this.messageService.getMessages(
      req.user.id,
      chatId,
      beforeId ? Number(beforeId) : undefined,
      limit ? Number(limit) : undefined,
      aroundId ? Number(aroundId) : undefined,
      afterId ? Number(afterId) : undefined,
    );
    return { statusCode: 200, result };
  }

  @Post(':id/message')
  @ChatMember()
  async sendMessage(
    @Req() req: any,
    @Param('id', ParseIntPipe) chatId: number,
    @Body() dto: CreateMessageDto,
  ) {
    const { message: result } = await this.messageService.createMessage(
      req.user.id,
      dto,
      chatId,
    );
    return { statusCode: 201, result };
  }

  @Delete(':id/message/:messageId')
  @ChatMember()
  async deleteMessage(
    @Req() req: any,
    @Param('messageId', ParseIntPipe) messageId: number,
  ) {
    await this.messageService.deleteMessage(req.user.id, messageId);
    return { statusCode: 200 };
  }

  @Post(':id/message/:messageId/forward')
  @ChatMember()
  async forwardMessage(
    @Req() req: any,
    @Param('messageId', ParseIntPipe) messageId: number,
    @Body() dto: ForwardMessageDto,
  ) {
    const result = await this.messageService.forwardMessage(
      req.user.id,
      messageId,
      dto,
    );
    return { statusCode: 201, result };
  }

  @Get(':id/pin')
  @ChatMember()
  async getPinnedMessages(@Param('id', ParseIntPipe) chatId: number) {
    const result = await this.messageService.getPinnedMessages(chatId);
    return { statusCode: 200, result };
  }

  @Post(':id/pin/:messageId')
  @ChatMember()
  async pinMessage(
    @Param('id', ParseIntPipe) chatId: number,
    @Param('messageId', ParseIntPipe) messageId: number,
  ) {
    const result = await this.messageService.pinMessage(chatId, messageId);
    return { statusCode: 200, result };
  }

  @Delete(':id/pin/:messageId')
  @ChatMember()
  async unpinMessage(
    @Param('id', ParseIntPipe) chatId: number,
    @Param('messageId', ParseIntPipe) messageId: number,
  ) {
    await this.messageService.unpinMessage(chatId, messageId);
    return { statusCode: 200 };
  }

  @Get(':id/shared')
  @ChatMember()
  async getSharedContent(
    @Param('id', ParseIntPipe) chatId: number,
    @Query('tab') tab: 'media' | 'file' | 'link',
    @Query('beforeId') beforeId?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.messageService.getSharedContent(
      chatId,
      tab,
      beforeId ? Number(beforeId) : undefined,
      limit ? Number(limit) : undefined,
    );
    return { statusCode: 200, result };
  }

  @Get(':id/message/:messageId/seen')
  @ChatMember()
  async getSeenBy(
    @Param('id', ParseIntPipe) chatId: number,
    @Param('messageId', ParseIntPipe) messageId: number,
  ) {
    const result = await this.chatMemberService.getSeenBy(chatId, messageId);
    return { statusCode: 200, result };
  }

  @Get(':id/member')
  @ChatMember()
  async getMembers(@Param('id', ParseIntPipe) chatId: number) {
    const result = await this.chatMemberService.getMembers(chatId);
    return { statusCode: 200, result };
  }

  @Post(':id/member')
  @ChatMember()
  async addMembers(
    @Req() req: any,
    @Param('id', ParseIntPipe) chatId: number,
    @Body('userIds') userIds: number[],
  ) {
    await this.chatMemberService.addMembersToChat(req.user, chatId, userIds);
    return { statusCode: 201 };
  }

  @Put(':id/member/:userId')
  @ChatOwner()
  async updateMemberRole(
    @Req() req: any,
    @Param('id', ParseIntPipe) chatId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body('role') role: ChatRole,
  ) {
    await this.chatMemberService.updateMemberRoleInChat(
      chatId,
      userId,
      role,
      req.user.id,
    );
    return { statusCode: 200 };
  }

  @Delete(':id/member/me')
  @ChatMember()
  async leaveChat(@Req() req: any, @Param('id', ParseIntPipe) chatId: number) {
    await this.chatMemberService.leaveChat(req.user.id, chatId);
    return { statusCode: 200 };
  }

  @Delete(':id/member/:userId')
  @ChatOwner()
  async removeMember(
    @Req() req: any,
    @Param('id', ParseIntPipe) chatId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    await this.chatMemberService.removeMemberFromChat(
      chatId,
      userId,
      req.user.id,
    );
    return { statusCode: 200 };
  }
}
