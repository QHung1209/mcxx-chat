export const SEEN_PREVIEW_LIMIT = 10;

// Các cột attachment được trả về khi load media của message.
export const MEDIA_SELECT = [
  'id',
  'mediaId',
  'name',
  'fileName',
  'mimeType',
  'size',
  'url',
  'acl',
];

export const MESSAGE_SELECT = [
  'message.id',
  'message.content',
  'message.type',
  'message.hasLink',
  'message.previewData',
  'message.createdAt',
  'message.isPinned',
  'message.metadata',
  'message.deletedAt',
  'message.mentionIds',
  'message.mentionAll',
  'message.senderId',
  'replyToMessage.id',
  'replyToMessage.content',
  'replyToMessage.type',
  'replyToMessage.hasLink',
  'replyToMessage.previewData',
  'replyToMessage.createdAt',
  'replyToMessage.deletedAt',
  'poll.id',
  'poll.closedAt',
  'poll.type',
  'poll.name',
  'option.id',
  'option.content',
  'option.order',
];
