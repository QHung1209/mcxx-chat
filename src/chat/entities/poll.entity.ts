import DefaultEntity from 'src/support/entities/default.entity';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { Message } from './message.entity';
import { PollOption } from './poll-option.entity';
import { PollType } from '../enums/chat.enum';

@Entity('chat__poll')
export class Poll extends DefaultEntity {
  @Column('uuid')
  messageId: string;

  @ManyToOne(() => Message)
  @JoinColumn({ name: 'messageId' })
  message: Message;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'enum', enum: PollType })
  type: PollType;

  @OneToMany(() => PollOption, (option) => option.poll)
  options: PollOption[];

  @Column({ nullable: true, type: 'timestamptz' })
  closedAt?: Date;
}
