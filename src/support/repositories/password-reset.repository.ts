import { Injectable } from '@nestjs/common';
import { PasswordResetEntity } from '../entities/password-reset.entity';
import { EntityManager } from 'typeorm/entity-manager/EntityManager';
import { BaseRepository } from './base.repository';

@Injectable()
export class PasswordResetRepository extends BaseRepository<PasswordResetEntity> {
  constructor(private readonly entityManager: EntityManager) {
    super(PasswordResetEntity, entityManager);
  }
}
