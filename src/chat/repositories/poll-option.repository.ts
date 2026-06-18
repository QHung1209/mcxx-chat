import { Injectable } from '@nestjs/common';
import { PollOption } from '../entities/poll-option.entity';
import { EntityManager, Repository } from 'typeorm';

@Injectable()
export class PollOptionRepository extends Repository<PollOption> {
  constructor(private readonly entityManager: EntityManager) {
    super(PollOption, entityManager);
  }
}
