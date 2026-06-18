import { Injectable } from '@nestjs/common';
import { Reaction } from '../entities/reaction.entity';
import { EntityManager, Repository } from 'typeorm';

@Injectable()
export class ReactionRepository extends Repository<Reaction> {
  constructor(private readonly entityManager: EntityManager) {
    super(Reaction, entityManager);
  }
}
