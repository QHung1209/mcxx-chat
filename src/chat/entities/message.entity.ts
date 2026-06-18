import { DeletedAtEntity } from 'src/support/entities/default.entity';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Chat } from './chat.entity';
import { User } from 'src/identity/entities/user.entity';
import { MessageType } from '../enums/chat.enum';
import { Reaction } from './reaction.entity';
import { Poll } from './poll.entity';
import { MessageMedia } from './message-media.entity';

@Entity('chat__messages')
@Index('idx_message_chatId_id', ['chatId', 'id'])
@Index('idx_message_chatId_isPinned', ['chatId', 'isPinned'], {
  where: '"isPinned" = true',
})
export class Message extends DeletedAtEntity {
  static TABLE_NAME = 'chat__messages';

  @Column('uuid')
  chatId: string;

  @ManyToOne(() => Chat, (chat) => chat.messages, { onDelete: 'CASCADE' })
  chat: Chat;

  @Column('uuid')
  senderId: string;

  @ManyToOne(() => User, (user) => user.messages)
  sender: User;

  @Column({ nullable: true, type: 'text' })
  content: string | null;

  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Column({ type: 'uuid', nullable: true })
  replyToMessageId: string;

  @ManyToOne(() => Message, (message) => message.replyToMessage, {
    onDelete: 'SET NULL',
  })
  replyToMessage: Message;

  @Column({ type: 'uuid', nullable: true })
  forwardFromMessageId: string;

  @ManyToOne(() => Message, { nullable: true, onDelete: 'SET NULL' })
  forwardFromMessage: Message;

  @OneToMany(() => MessageMedia, (media) => media.message)
  medias: MessageMedia[];

  @Column({ default: false })
  isPinned: boolean;

  @Column({ default: false, type: 'boolean' })
  hasLink: boolean;

  @Column({ nullable: true, type: 'jsonb' })
  previewData: {
    title: string | null;
    description: string | null;
    image: string | null;
    link: string;
  };

  @Column({ nullable: true, type: 'jsonb' })
  metadata: {
    event: string;
    actorId: string;
    actorName: string;
    targetId?: string;
    targetName?: string;
    targetIds?: string[];
    targetNames?: string[];
    role?: string;
  };

  @Column('uuid', { array: true, nullable: true })
  mentionIds: string[] | null;

  @Column({ default: false, type: 'boolean' })
  mentionAll: boolean;

  @OneToMany(() => Reaction, (reaction) => reaction.message)
  reactions: Reaction[];

  @OneToOne(() => Poll, (poll) => poll.message)
  poll: Poll;

}
