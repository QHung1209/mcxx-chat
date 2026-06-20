import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm/entity-manager/EntityManager';
import { User } from '../entities/user.entity';
import { BaseRepository } from 'src/support/repositories/base.repository';

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(entityManager: EntityManager) {
    super(User, entityManager);
  }
}
