import { Injectable } from '@nestjs/common';
import { Reaction } from '../entities/reaction.entity';
import { EntityManager } from 'typeorm';
import { BaseRepository } from 'src/support/repositories/base.repository';

@Injectable()
export class ReactionRepository extends BaseRepository<Reaction> {
  constructor(private readonly entityManager: EntityManager) {
    super(Reaction, entityManager);
  }
}
