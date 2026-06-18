import { ChatType } from '../enums/chat.enum';
import { DeletedAtEntity } from 'src/support/entities/default.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { ChatMember } from './member.entity';
import { Message } from './message.entity';
import { MediaEntity } from 'src/media/entities/media.entity';

@Entity('chat__chats')
@Index('idx_chat_updatedAt', ['updatedAt'])
export class Chat extends DeletedAtEntity {
  static TABLE_NAME = 'chat__chats';

  @Column({ type: 'enum', enum: ChatType })
  type: ChatType;

  @Column({ nullable: true, type: 'varchar', length: 255 })
  name: string | null;

  @Column({ type: 'uuid', nullable: true })
  avatarMediaId: string | null;

  @ManyToOne(() => MediaEntity, { nullable: true })
  @JoinColumn({ name: 'avatarMediaId' })
  avatar: MediaEntity | null;

  @OneToMany(() => ChatMember, (chatMember) => chatMember.chat)
  members: ChatMember[];

  @OneToMany(() => Message, (message) => message.chat)
  messages: Message[];

  @Column({ nullable: true, type: 'uuid' })
  lastMessageId: string | null;

  @OneToOne(() => Message, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lastMessageId' })
  lastMessage: Message;
}
