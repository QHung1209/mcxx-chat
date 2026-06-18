import { IsIn, IsNumber, IsOptional } from 'class-validator';
import { MessageType } from '../enums/chat.enum';

const SENDABLE_MESSAGE_TYPES = [
  MessageType.TEXT,
  MessageType.MEDIA,
  MessageType.FILE,
] as const;

export class CreateMessageDto {
  content?: string;

  @IsIn(SENDABLE_MESSAGE_TYPES, {
    message: `type must be one of: ${SENDABLE_MESSAGE_TYPES.join(', ')}`,
  })
  @IsOptional()
  type?: MessageType;

  replyToMessageId?: number;

  mediaIds?: number[];

  mentionIds?: number[];

  mentionAll?: boolean;
}

export class ForwardMessageDto {
  @IsNumber()
  toChatId: number;
}
