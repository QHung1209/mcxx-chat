import DefaultEntity from 'src/support/entities/default.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { Message } from './message.entity';
import { User } from 'src/identity/entities/user.entity';

@Entity('chat__reactions')
@Index('idx_reaction_messageId_userId', ['messageId', 'createdAt'])
@Unique('uq_reaction_messageId_userId', ['messageId', 'userId'])
export class Reaction extends DefaultEntity {
  @Column('uuid')
  messageId: string;

  @ManyToOne(() => Message, (message) => message.reactions)
  @JoinColumn({ name: 'messageId' })
  message: Message;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (user) => user.reactions)
  user: User;

  @Column({ length: 20, nullable: false })
  emoji: string;
}
