import { applyDecorators, UseGuards } from '@nestjs/common';
import { IsMemberGuard } from '../guards/member.guard';
import { IsOwnerGuard } from '../guards/owner.guard';

export const ChatMember = () => applyDecorators(UseGuards(IsMemberGuard));
export const ChatOwner = () => applyDecorators(UseGuards(IsMemberGuard, IsOwnerGuard));
