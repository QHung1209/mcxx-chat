import DefaultEntity from 'src/support/entities/default.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { PollOption } from './poll-option.entity';
import { User } from 'src/identity/entities/user.entity';

@Entity('chat__poll_vote')
@Index('idx_pollvote_optionId_userId', ['optionId', 'userId'])
export class PollVote extends DefaultEntity {
  @Column()
  optionId: number;

  @ManyToOne(() => PollOption, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'optionId' })
  option: PollOption;

  @Column()
  pollId: number;

  @Column()
  userId: number;

  @ManyToOne(() => User)
  user: User;
}
