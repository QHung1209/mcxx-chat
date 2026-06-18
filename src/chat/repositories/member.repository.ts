import { Injectable } from '@nestjs/common';
import { ChatMember } from '../entities/member.entity';
import { EntityManager, Repository } from 'typeorm';

@Injectable()
export class ChatMemberRepository extends Repository<ChatMember> {
  constructor(private readonly entityManager: EntityManager) {
    super(ChatMember, entityManager);
  }
}
