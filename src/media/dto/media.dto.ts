import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class AccessMediaDto {
  @IsString() key: string;
  @IsString() token: string;
}

export class UploadMediaDto {
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  acl: boolean;
}

export class MediaDto {
  limit: number;
  page: number;
  search: string;
  type: string;
  delete: number;
  active: number;
}

export class InitLargeMediaDto {
  @IsString() originalname: string;
  @IsNumber() size: number;
  @IsString() mimetype: string;
  @IsBoolean() acl: boolean;
}

export class LargeMediaDto {
  @IsString() mediaId: string;
  @IsNumber() partNumber: number;
}

export class ActiveMediaDto {
  @IsBoolean() isActive: boolean;
}
export class AclMediaDto {
  @IsBoolean() acl: boolean;
}
