export const LINK_PREVIEW_QUEUE = 'link-preview-queue';
export const LINK_PREVIEW_JOB = 'link-preview';

export interface LinkPreviewJobData {
  messageId: number;
  chatId: number;
  url: string;
  memberIds: number[];
}
