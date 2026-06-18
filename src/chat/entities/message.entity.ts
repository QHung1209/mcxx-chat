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

  @Column()
  chatId: number;

  @ManyToOne(() => Chat, (chat) => chat.messages, { onDelete: 'CASCADE' })
  chat: Chat;

  @Column()
  senderId: number;

  @ManyToOne(() => User, (user) => user.messages)
  sender: User;

  @Column({ nullable: true, type: 'text' })
  content: string | null;

  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Column({ nullable: true })
  replyToMessageId: number;

  @ManyToOne(() => Message, (message) => message.replyToMessage, {
    onDelete: 'SET NULL',
  })
  replyToMessage: Message;

  @Column({ nullable: true })
  forwardFromMessageId: number;

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
    actorId: number;
    actorName: string;
    targetId?: number;
    targetName?: string;
    targetIds?: number[];
    targetNames?: string[];
    role?: string;
  };

  @Column('int', { array: true, nullable: true })
  mentionIds: number[] | null;

  @Column({ default: false, type: 'boolean' })
  mentionAll: boolean;

  @OneToMany(() => Reaction, (reaction) => reaction.message)
  reactions: Reaction[];

  @OneToOne(() => Poll, (poll) => poll.message)
  poll: Poll;

}
