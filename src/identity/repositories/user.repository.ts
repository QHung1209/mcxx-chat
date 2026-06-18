import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EntityManager } from 'typeorm/entity-manager/EntityManager';
import { User } from '../entities/user.entity';

@Injectable()
export class UserRepository extends Repository<User> {
  constructor(entityManager: EntityManager) {
    super(User, entityManager);
  }
}
