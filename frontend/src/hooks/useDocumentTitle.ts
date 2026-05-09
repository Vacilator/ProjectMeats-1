import { useEffect, useRef } from 'react';

/**
 * Sets the browser document title for the current page.
 * Restores the previous title on unmount.
 *
 * @param title - Page-specific title (e.g. "Dashboard"). Will be suffixed with " | Meats Central".
 */
export function useDocumentTitle(title: string): void {
  const previousTitle = useRef(document.title);

  useEffect(() => {
    const prev = previousTitle.current;
    document.title = title ? `${title} | Meats Central` : 'Meats Central';
    return () => {
      document.title = prev;
    };
  }, [title]);
}
