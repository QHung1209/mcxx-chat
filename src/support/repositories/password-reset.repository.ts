import { Injectable } from '@nestjs/common';
import { PasswordResetEntity } from '../entities/password-reset.entity';
import { Repository } from 'typeorm';
import { EntityManager } from 'typeorm/entity-manager/EntityManager';

@Injectable()
export class PasswordResetRepository extends Repository<PasswordResetEntity> {
  constructor(private readonly entityManager: EntityManager) {
    super(PasswordResetEntity, entityManager);
  }
}
