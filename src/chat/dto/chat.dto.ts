import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateGroupChatDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  avatar?: number;

  @IsArray()
  userIds: number[];
}

export class StartChatDto {
  @IsNumber()
  userId: number;
}

export class UpdateChatDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsNumber()
  avatar?: number;
}
