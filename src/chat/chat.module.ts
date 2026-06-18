import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Chat } from './entities/chat.entity';
import { ChatMember } from './entities/member.entity';
import { Message } from './entities/message.entity';
import { MessageMedia } from './entities/message-media.entity';
import { Reaction } from './entities/reaction.entity';
import { ChatRepository } from './repositories/chat.repository';
import { ChatMemberRepository } from './repositories/member.repository';
import { MessageRepository } from './repositories/message.repository';
import { ReactionRepository } from './repositories/reaction.repository';
import { ChatService } from './services/chat.service';
import { ChatMemberService } from './services/member.service';
import { MessageService } from './services/message.service';
import { LinkPreviewService } from './services/link-preview.service';
import { ReactionService } from './services/reaction.service';
import { LinkPreviewConsumer } from './consumers/link-preview.consumer';
import { LINK_PREVIEW_QUEUE } from './constants/link-preview.constants';
import { ChatController } from './controllers/chat.controller';
import { IsMemberGuard } from './guards/member.guard';
import { IsOwnerGuard } from './guards/owner.guard';
import { ChatEventListener } from './listeners/chat-event.listener';
import { UserRepository } from 'src/identity/repositories/user.repository';
import { PollOption } from './entities/poll-option.entity';
import { PollVote } from './entities/poll-vote.entity';
import { PollOptionRepository } from './repositories/poll-option.repository';
import { PollVoteRepository } from './repositories/poll-vote.repository';
import { PollService } from './services/poll.service';
import { Poll } from './entities/poll.entity';
import { PollRepository } from './repositories/poll.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Chat,
      ChatMember,
      Message,
      MessageMedia,
      Reaction,
      Poll,
      PollOption,
      PollVote,
    ]),
    HttpModule,
    BullModule.registerQueue({ name: LINK_PREVIEW_QUEUE }),
  ],
  providers: [
    ChatRepository,
    ChatMemberRepository,
    MessageRepository,
    ReactionRepository,
    UserRepository,
    PollOptionRepository,
    PollVoteRepository,
    PollRepository,

    ChatService,
    ChatMemberService,
    MessageService,
    LinkPreviewService,
    ReactionService,
    PollService,

    IsMemberGuard,
    IsOwnerGuard,

    ChatEventListener,
    LinkPreviewConsumer,
  ],
  controllers: [ChatController],
  exports: [ChatService, ChatMemberService, MessageService],
})
export class ChatModule {}
