import DefaultEntity from 'src/support/entities/default.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Message } from './message.entity';
import { Poll } from './poll.entity';

@Entity('chat__poll_option')
@Index('idx_polloption_pollId', ['pollId'])
export class PollOption extends DefaultEntity {
  @Column()
  pollId: number;

  @ManyToOne(() => Poll)
  @JoinColumn({ name: 'pollId' })
  poll: Poll;

  @Column()
  content: string;

  @Column()
  order: number;
}
