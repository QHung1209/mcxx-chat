import { Column, Entity } from 'typeorm';
import { DeletedAtEntity } from '../../support/entities/default.entity';

@Entity('medias')
export class MediaEntity extends DeletedAtEntity {
  static TABLE_NAME = 'medias';

  // Người upload (chủ sở hữu file). Nullable để hỗ trợ file hệ thống.
  @Column('uuid', { nullable: true })
  uploaderId: string | null;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 255 })
  fileName: string;

  @Column({ length: 255 })
  disk: string;

  @Column({ length: 255 })
  mimeType: string;

  @Column('bigint')
  size: number;

  @Column({ length: 255 })
  url: string;

  @Column({ length: 255 })
  key: string;

  @Column('boolean', { default: true })
  isActive: boolean;

  @Column('boolean', { default: true })
  acl: boolean;
}
