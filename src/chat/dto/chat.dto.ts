import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateGroupChatDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsUUID()
  avatar?: string;

  @IsArray()
  @IsUUID('all', { each: true })
  userIds: string[];
}

export class StartChatDto {
  @IsUUID()
  userId: string;
}

export class UpdateChatDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsUUID()
  avatar?: string;
}
