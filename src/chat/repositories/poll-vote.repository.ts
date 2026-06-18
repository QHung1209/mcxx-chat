import { Injectable } from '@nestjs/common';
import { PollVote } from '../entities/poll-vote.entity';
import { EntityManager, Repository } from 'typeorm';

@Injectable()
export class PollVoteRepository extends Repository<PollVote> {
  constructor(private readonly entityManager: EntityManager) {
    super(PollVote, entityManager);
  }
}
