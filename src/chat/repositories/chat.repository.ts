import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Chat } from '../entities/chat.entity';
import { BaseRepository } from 'src/support/repositories/base.repository';

@Injectable()
export class ChatRepository extends BaseRepository<Chat> {
  constructor(entityManager: EntityManager) {
    super(Chat, entityManager);
  }
}
