import {
  CHAT_UPLOAD_ACCEPT_ATTR,
  CHAT_UPLOAD_SUPPORTED_EXTENSIONS,
  getChatUploadEmoji,
  getChatUploadFileKind,
} from './fileUploadConfig';

describe('fileUploadConfig', () => {
  it('includes spreadsheet mime types and extensions in the accept attribute', () => {
    expect(CHAT_UPLOAD_SUPPORTED_EXTENSIONS).toContain('csv');
    expect(CHAT_UPLOAD_SUPPORTED_EXTENSIONS).toContain('xls');
    expect(CHAT_UPLOAD_SUPPORTED_EXTENSIONS).toContain('xlsx');

    expect(CHAT_UPLOAD_ACCEPT_ATTR).toContain('text/csv');
    expect(CHAT_UPLOAD_ACCEPT_ATTR).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(CHAT_UPLOAD_ACCEPT_ATTR).toContain('application/vnd.ms-excel');
    expect(CHAT_UPLOAD_ACCEPT_ATTR).toContain('.csv');
    expect(CHAT_UPLOAD_ACCEPT_ATTR).toContain('.xls');
    expect(CHAT_UPLOAD_ACCEPT_ATTR).toContain('.xlsx');
  });

  it('detects spreadsheet uploads from filenames and content types', () => {
    expect(getChatUploadFileKind('parts-list.xlsx')).toBe('spreadsheet');
    expect(getChatUploadFileKind('parts-list.csv', 'text/csv')).toBe(
      'spreadsheet'
    );
    expect(
      getChatUploadFileKind('parts-list', 'application/vnd.ms-excel')
    ).toBe('spreadsheet');
    expect(getChatUploadFileKind('quote.pdf', 'application/pdf')).toBe(
      'document'
    );
  });

  it('returns a spreadsheet emoji for tabular files', () => {
    expect(getChatUploadEmoji('inventory.xlsx')).toBe('📊');
    expect(getChatUploadEmoji('notes.pdf')).toBe('📄');
  });
});
