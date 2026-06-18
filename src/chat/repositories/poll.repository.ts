import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Poll } from '../entities/poll.entity';

@Injectable()
export class PollRepository extends Repository<Poll> {
  constructor(private readonly entityManager: EntityManager) {
    super(Poll, entityManager);
  }
}
