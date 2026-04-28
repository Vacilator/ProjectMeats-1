export type ChatUploadFileKind = 'document' | 'spreadsheet';

export const CHAT_UPLOAD_SUPPORTED_EXTENSIONS = [
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'txt',
  'doc',
  'docx',
  'csv',
  'xls',
  'xlsx',
] as const;

export const CHAT_UPLOAD_ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'text/csv',
  'text/plain',
] as const;

export const CHAT_UPLOAD_ACCEPT_ATTR = [
  ...CHAT_UPLOAD_ACCEPTED_MIME_TYPES,
  ...CHAT_UPLOAD_SUPPORTED_EXTENSIONS.map((extension) => `.${extension}`),
].join(',');

const spreadsheetExtensions = new Set(['csv', 'xls', 'xlsx']);

export const getChatUploadFileKind = (
  filename?: string,
  contentType?: string
): ChatUploadFileKind => {
  const extension = filename?.split('.').pop()?.toLowerCase() ?? '';
  const normalizedContentType = contentType?.toLowerCase() ?? '';

  if (
    spreadsheetExtensions.has(extension) ||
    normalizedContentType === 'text/csv' ||
    normalizedContentType ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    normalizedContentType === 'application/vnd.ms-excel'
  ) {
    return 'spreadsheet';
  }

  return 'document';
};

export const getChatUploadEmoji = (
  filename?: string,
  contentType?: string
): string => {
  return getChatUploadFileKind(filename, contentType) === 'spreadsheet'
    ? '📊'
    : '📄';
};
