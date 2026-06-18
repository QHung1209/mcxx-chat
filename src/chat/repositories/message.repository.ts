import { Injectable } from '@nestjs/common';
import { EntityManager, In, Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { MessageMedia } from '../entities/message-media.entity';
import { MediaEntity } from 'src/media/entities/media.entity';

@Injectable()
export class MessageRepository extends Repository<Message> {
  constructor(entityManager: EntityManager) {
    super(Message, entityManager);
  }

  // Gắn danh sách media (theo id) vào một message → tạo các bản ghi chat__message_media.
  async attachMedia(messageId: number, mediaIds?: number[]) {
    if (!mediaIds?.length) return;
    const medias = await this.manager.find(MediaEntity, {
      where: { id: In(mediaIds) },
    });
    const byId = new Map(medias.map((m) => [m.id, m]));
    const rows: Partial<MessageMedia>[] = [];
    mediaIds.forEach((id, idx) => {
      const m = byId.get(id);
      if (!m) return;
      rows.push({
        messageId,
        mediaId: m.id,
        name: m.name,
        fileName: m.fileName,
        mimeType: m.mimeType,
        size: m.size,
        url: m.url,
        acl: m.acl,
        order: idx,
      });
    });
    if (rows.length) {
      await this.manager.save(MessageMedia, rows);
    }
  }

  // Load attachment cho 1 hoặc nhiều message và gán vào thuộc tính `medias`.
  // Giữ nguyên chữ ký cũ (field/select) để các call-site không phải đổi.
  async loadMedia(
    records: Message | Message[] | any,
    _field?: string,
    _select?: string[],
  ) {
    const arr = Array.isArray(records) ? records : [records];
    const ids = arr.map((r) => r?.id).filter(Boolean);
    if (!ids.length) return records;

    const rows = await this.manager.find(MessageMedia, {
      where: { messageId: In(ids) },
      order: { order: 'ASC' },
    });
    const map = new Map<number, MessageMedia[]>();
    for (const r of rows) {
      const list = map.get(r.messageId) ?? [];
      list.push(r);
      map.set(r.messageId, list);
    }
    for (const rec of arr) {
      if (rec) rec.medias = map.get(rec.id) ?? [];
    }
    return records;
  }
}
