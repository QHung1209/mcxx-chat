import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Poll } from '../entities/poll.entity';
import { BaseRepository } from 'src/support/repositories/base.repository';

@Injectable()
export class PollRepository extends BaseRepository<Poll> {
  constructor(private readonly entityManager: EntityManager) {
    super(Poll, entityManager);
  }
}
