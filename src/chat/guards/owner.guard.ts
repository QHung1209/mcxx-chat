import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ChatMemberService } from '../services/member.service';
import { ChatRole } from '../enums/chat.enum';

@Injectable()
export class IsOwnerGuard implements CanActivate {
  constructor(private readonly chatMemberService: ChatMemberService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const chatId = Number(request.params.id);
    const userId = request.user?.id;

    const role = await this.chatMemberService.getMemberRole(chatId, userId);
    if (role !== ChatRole.OWNER) {
      throw new ForbiddenException('Only the owner can perform this action');
    }
    return true;
  }
}
