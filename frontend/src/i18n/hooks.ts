import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useCallback } from 'react';
import type { SupportedLanguage } from './config';

/**
 * Custom hook for translations with type safety.
 * Wraps react-i18next's useTranslation with additional utilities.
 */
export function useTranslation() {
  const { t, i18n } = useI18nTranslation();

  const changeLanguage = useCallback(
    (lang: SupportedLanguage) => {
      i18n.changeLanguage(lang);
    },
    [i18n]
  );

  const currentLanguage = i18n.language as SupportedLanguage;

  return {
    t,
    currentLanguage,
    changeLanguage,
    isRTL: i18n.dir() === 'rtl',
  };
}

/**
 * Hook for workflow editor specific translations.
 * Provides scoped translation function for workflow editor strings.
 */
export function useWorkflowTranslation() {
  const { t, ...rest } = useTranslation();

  const tw = useCallback(
    (key: string, options?: Record<string, unknown>) => {
      return t(`workflowEditor.${key}`, options);
    },
    [t]
  );

  return {
    tw,
    t,
    ...rest,
  };
}

/**
 * Utility function to format date/time according to locale.
 */
export function useLocalizedDate() {
  const { currentLanguage } = useTranslation();

  const formatDate = useCallback(
    (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return new Intl.DateTimeFormat(currentLanguage, options).format(dateObj);
    },
    [currentLanguage]
  );

  const formatRelativeTime = useCallback(
    (date: Date | string) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

      const rtf = new Intl.RelativeTimeFormat(currentLanguage, { numeric: 'auto' });

      if (diffInSeconds < 60) {
        return rtf.format(-diffInSeconds, 'second');
      } else if (diffInSeconds < 3600) {
        return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
      } else if (diffInSeconds < 86400) {
        return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
      } else if (diffInSeconds < 604800) {
        return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
      } else if (diffInSeconds < 2592000) {
        return rtf.format(-Math.floor(diffInSeconds / 604800), 'week');
      } else if (diffInSeconds < 31536000) {
        return rtf.format(-Math.floor(diffInSeconds / 2592000), 'month');
      } else {
        return rtf.format(-Math.floor(diffInSeconds / 31536000), 'year');
      }
    },
    [currentLanguage]
  );

  return {
    formatDate,
    formatRelativeTime,
  };
}

/**
 * Utility function to format numbers according to locale.
 */
export function useLocalizedNumber() {
  const { currentLanguage } = useTranslation();

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => {
      return new Intl.NumberFormat(currentLanguage, options).format(value);
    },
    [currentLanguage]
  );

  const formatCurrency = useCallback(
    (value: number, currency: string = 'USD') => {
      return new Intl.NumberFormat(currentLanguage, {
        style: 'currency',
        currency,
      }).format(value);
    },
    [currentLanguage]
  );

  const formatPercent = useCallback(
    (value: number, decimals: number = 0) => {
      return new Intl.NumberFormat(currentLanguage, {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    },
    [currentLanguage]
  );

  return {
    formatNumber,
    formatCurrency,
    formatPercent,
  };
}
