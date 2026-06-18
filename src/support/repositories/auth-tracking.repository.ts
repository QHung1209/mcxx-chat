import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm/entity-manager/EntityManager';
import { AuthTrackingEntity } from '../entities/auth-tracking.entity';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class AuthTrackingRepository extends Repository<AuthTrackingEntity> {
  static TYPE_LOGIN = 'login';
  static TYPE_GOOGLE = 'google';

  constructor(@InjectEntityManager() em: EntityManager) {
    super(AuthTrackingEntity, em);
  }
}
