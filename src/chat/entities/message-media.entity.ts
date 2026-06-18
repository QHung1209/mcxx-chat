import { CreatedAtEntity } from 'src/support/entities/default.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Message } from './message.entity';

// Đính kèm của tin nhắn — khóa ngoại trực tiếp tới message + media (không polymorphic).
// Các cột name/url/... được denormalize từ media để đọc nhanh.
@Entity('chat__message_media')
@Index('idx_message_media_messageId', ['messageId'])
export class MessageMedia extends CreatedAtEntity {
  static TABLE_NAME = 'chat__message_media';

  @Column('uuid')
  messageId: string;

  @ManyToOne(() => Message, (message) => message.medias, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: Message;

  @Column('uuid')
  mediaId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 255 })
  fileName: string;

  @Column({ length: 255 })
  mimeType: string;

  @Column('bigint')
  size: number;

  @Column({ length: 255 })
  url: string;

  @Column('boolean', { default: true })
  acl: boolean;

  @Column('int', { default: 0 })
  order: number;
}
