import { Injectable } from '@nestjs/common';
import { PollVote } from '../entities/poll-vote.entity';
import { EntityManager } from 'typeorm';
import { BaseRepository } from 'src/support/repositories/base.repository';

@Injectable()
export class PollVoteRepository extends BaseRepository<PollVote> {
  constructor(private readonly entityManager: EntityManager) {
    super(PollVote, entityManager);
  }
}
