import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { Chat } from '../entities/chat.entity';

@Injectable()
export class ChatRepository extends Repository<Chat> {
  constructor(entityManager: EntityManager) {
    super(Chat, entityManager);
  }
}
