import { ChatRole } from '../enums/chat.enum';
import { DeletedAtEntity } from 'src/support/entities/default.entity';
import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { Chat } from './chat.entity';
import { User } from 'src/identity/entities/user.entity';

@Entity('chat__members')
@Index('idx_member_chatId_userId', ['chatId', 'userId'])
export class ChatMember extends DeletedAtEntity {
  static TABLE_NAME = 'chat__members';

  @Column('uuid')
  chatId: string;

  @ManyToOne(() => Chat, (chat) => chat.members, { onDelete: 'CASCADE' })
  chat: Chat;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (user) => user.chatMembers, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'enum', enum: ChatRole, default: ChatRole.MEMBER })
  role: ChatRole;

  @Column({ nullable: true, type: 'uuid' })
  lastSeenMessageId: string | null;

  @Column({ nullable: true, type: 'uuid' })
  hiddenAtMessageId: string | null;
}
