import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EntityManager } from 'typeorm/entity-manager/EntityManager';
import { MediaEntity } from '../entities/media.entity';

@Injectable()
export class MediaRepository extends Repository<MediaEntity> {
  constructor(private readonly entityManager: EntityManager) {
    super(MediaEntity, entityManager);
  }
}
