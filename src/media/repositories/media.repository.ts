import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm/entity-manager/EntityManager';
import { MediaEntity } from '../entities/media.entity';
import { BaseRepository } from 'src/support/repositories/base.repository';

@Injectable()
export class MediaRepository extends BaseRepository<MediaEntity> {
  constructor(private readonly entityManager: EntityManager) {
    super(MediaEntity, entityManager);
  }
}
