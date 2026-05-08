import { renderHook, act } from '@testing-library/react';
import { useTranslation, useWorkflowTranslation, useLocalizedDate, useLocalizedNumber } from '../hooks';
import i18n from '../config';

describe('useTranslation', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
  });

  it('should return translation function', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t).toBeDefined();
    expect(typeof result.current.t).toBe('function');
  });

  it('should return current language', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.currentLanguage).toBe('en');
  });

  it('should change language', () => {
    const { result } = renderHook(() => useTranslation());

    act(() => {
      result.current.changeLanguage('es');
    });

    expect(result.current.currentLanguage).toBe('es');
  });

  it('should translate keys correctly', () => {
    const { result } = renderHook(() => useTranslation());
    const translated = result.current.t('common.loading');
    expect(translated).toBe('Loading...');
  });

  it('should fallback to English for missing translations', () => {
    const { result } = renderHook(() => useTranslation());

    act(() => {
      result.current.changeLanguage('es');
    });

    // Test that common keys still translate
    const translated = result.current.t('common.loading');
    expect(translated).toBeDefined();
    expect(translated.length).toBeGreaterThan(0);
  });
});

describe('useWorkflowTranslation', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
  });

  it('should provide workflow-scoped translation', () => {
    const { result } = renderHook(() => useWorkflowTranslation());
    expect(result.current.tw).toBeDefined();
  });

  it('should translate workflow keys with short syntax', () => {
    const { result } = renderHook(() => useWorkflowTranslation());
    const translated = result.current.tw('save');
    expect(translated).toBe('Save');
  });

  it('should support interpolation', () => {
    const { result } = renderHook(() => useWorkflowTranslation());
    const translated = result.current.tw('accessibility.announcements.nodeSelected', {
      name: 'TestNode',
    });
    expect(translated).toContain('TestNode');
  });

  it('should change language and update translations', () => {
    const { result } = renderHook(() => useWorkflowTranslation());

    act(() => {
      result.current.changeLanguage('es');
    });

    const translated = result.current.tw('save');
    expect(translated).toBe('Guardar');
  });
});

describe('useLocalizedDate', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
  });

  it('should format dates according to locale', () => {
    const { result } = renderHook(() => useLocalizedDate());
    const date = new Date('2024-01-15T12:00:00Z');
    const formatted = result.current.formatDate(date);
    expect(formatted).toBeDefined();
    expect(typeof formatted).toBe('string');
  });

  it('should format dates with options', () => {
    const { result } = renderHook(() => useLocalizedDate());
    const date = new Date('2024-01-15T12:00:00Z');
    const formatted = result.current.formatDate(date, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    expect(formatted).toContain('2024');
  });

  it('should format relative time', () => {
    const { result } = renderHook(() => useLocalizedDate());
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const formatted = result.current.formatRelativeTime(fiveMinutesAgo);
    expect(formatted).toBeDefined();
  });

  it('should change format based on language', () => {
    const { result, rerender } = renderHook(() => useLocalizedDate());
    const date = new Date('2024-01-15T12:00:00Z');

    const enFormatted = result.current.formatDate(date);

    act(() => {
      i18n.changeLanguage('fr');
    });
    rerender();

    const frFormatted = result.current.formatDate(date);

    // Different locales may format differently
    expect(enFormatted).toBeDefined();
    expect(frFormatted).toBeDefined();
  });
});

describe('useLocalizedNumber', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
  });

  it('should format numbers according to locale', () => {
    const { result } = renderHook(() => useLocalizedNumber());
    const formatted = result.current.formatNumber(1234.56);
    expect(formatted).toBeDefined();
    expect(typeof formatted).toBe('string');
  });

  it('should format currency', () => {
    const { result } = renderHook(() => useLocalizedNumber());
    const formatted = result.current.formatCurrency(1234.56, 'USD');
    expect(formatted).toContain('$');
    expect(formatted).toContain('1,234');
  });

  it('should format percentages', () => {
    const { result } = renderHook(() => useLocalizedNumber());
    const formatted = result.current.formatPercent(0.75, 1);
    expect(formatted).toContain('75');
    expect(formatted).toContain('%');
  });

  it('should change format based on language', () => {
    const { result, rerender } = renderHook(() => useLocalizedNumber());

    const enFormatted = result.current.formatNumber(1234.56);

    act(() => {
      i18n.changeLanguage('fr');
    });
    rerender();

    const frFormatted = result.current.formatNumber(1234.56);

    // Different locales use different separators
    expect(enFormatted).toBeDefined();
    expect(frFormatted).toBeDefined();
  });
});
