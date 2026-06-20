import { Injectable } from '@nestjs/common';
import { ChatMember } from '../entities/member.entity';
import { EntityManager } from 'typeorm';
import { BaseRepository } from 'src/support/repositories/base.repository';

@Injectable()
export class ChatMemberRepository extends BaseRepository<ChatMember> {
  constructor(private readonly entityManager: EntityManager) {
    super(ChatMember, entityManager);
  }
}
