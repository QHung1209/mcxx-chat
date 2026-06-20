import { Injectable } from '@nestjs/common';
import { PollOption } from '../entities/poll-option.entity';
import { EntityManager } from 'typeorm';
import { BaseRepository } from 'src/support/repositories/base.repository';

@Injectable()
export class PollOptionRepository extends BaseRepository<PollOption> {
  constructor(private readonly entityManager: EntityManager) {
    super(PollOption, entityManager);
  }
}
