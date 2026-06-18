export const LINK_PREVIEW_QUEUE = 'link-preview-queue';
export const LINK_PREVIEW_JOB = 'link-preview';

export interface LinkPreviewJobData {
  messageId: string;
  chatId: string;
  url: string;
  memberIds: string[];
}
