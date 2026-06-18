import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessageRepository } from '../repositories/message.repository';
import { LinkPreviewService } from '../services/link-preview.service';
import {
  LINK_PREVIEW_JOB,
  LINK_PREVIEW_QUEUE,
  LinkPreviewJobData,
} from '../constants/link-preview.constants';

@Processor(LINK_PREVIEW_QUEUE)
export class LinkPreviewConsumer extends WorkerHost {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly linkPreviewService: LinkPreviewService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<LinkPreviewJobData>) {
    if (job.name !== LINK_PREVIEW_JOB) return;

    const { messageId, chatId, url, memberIds } = job.data;

    const preview = await this.linkPreviewService.fetchPreview(url);
    if (!preview) return;

    await this.messageRepository.update(messageId, { previewData: preview });

    this.eventEmitter.emit('message.link.preview', {
      memberIds,
      messageId,
      chatId,
      previewData: preview,
    });
  }
}
