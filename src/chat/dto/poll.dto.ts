import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNumber, IsString } from 'class-validator';
import { MessageType, PollType } from '../enums/chat.enum';

export class CreatePollOptionDto {
  @IsString()
  content: string;

  @IsNumber()
  order: number;
}

export class CreatePollDto {
  @IsString()
  content: string;

  @IsArray()
  @Type(() => CreatePollOptionDto)
  options: CreatePollOptionDto[];

  @IsEnum(PollType)
  type: PollType;
}
