import { renderHook } from '@testing-library/react';
import { useDocumentTitle } from '../useDocumentTitle';

describe('useDocumentTitle', () => {
  const originalTitle = document.title;

  afterEach(() => {
    document.title = originalTitle;
  });

  it('sets the document title with suffix', () => {
    renderHook(() => useDocumentTitle('Dashboard'));
    expect(document.title).toBe('Dashboard | Meats Central');
  });

  it('uses plain suffix when title is empty', () => {
    renderHook(() => useDocumentTitle(''));
    expect(document.title).toBe('Meats Central');
  });

  it('restores previous title on unmount', () => {
    document.title = 'Previous Title';
    const { unmount } = renderHook(() => useDocumentTitle('Test'));
    expect(document.title).toBe('Test | Meats Central');

    unmount();
    expect(document.title).toBe('Previous Title');
  });

  it('updates when title prop changes', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Page A' },
    });
    expect(document.title).toBe('Page A | Meats Central');

    rerender({ title: 'Page B' });
    expect(document.title).toBe('Page B | Meats Central');
  });
});
