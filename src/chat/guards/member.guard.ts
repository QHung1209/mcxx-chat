import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ChatMemberService } from '../services/member.service';

@Injectable()
export class IsMemberGuard implements CanActivate {
  constructor(private readonly chatMemberService: ChatMemberService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const chatId = Number(request.params.id);
    const userId = request.user?.id;

    if (!chatId || !userId) return false;

    const member = await this.chatMemberService.isMember(chatId, userId);
    if (!member) throw new ForbiddenException('You are not a member of this chat');
    return true;
  }
}
