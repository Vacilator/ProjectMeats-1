/**
 * Lightweight i18n module for the ProjectMeats mobile app.
 *
 * Mirrors the API of the frontend i18n module so that mobile
 * screens can adopt the same translation patterns. Uses React
 * Context + AsyncStorage for language persistence.
 *
 * **Architectural note – function-based interpolation**
 * The frontend (web) uses i18next with JSON locale files and runtime
 * interpolation (`t('key', { variable })`).  The mobile app intentionally
 * avoids adding the full i18next runtime and instead uses typed TypeScript
 * locale objects where dynamic strings are represented as plain arrow functions
 * (e.g. `nextUpdate: (entity: string) => \`...\``).  This keeps the mobile
 * bundle light while preserving full type-safety and a comparable ergonomics.
 * If the mobile app ever adopts i18next the locale files in this directory
 * can be migrated to standard JSON without touching component code.
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { en, MobileTranslations } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';

// ============================================================================
// Types
// ============================================================================

export type SupportedLanguage = 'en' | 'es' | 'fr';

export const supportedLanguages: SupportedLanguage[] = ['en', 'es', 'fr'];

export const languageNames: Record<SupportedLanguage, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
};

/** RTL locales (none currently, but ready for Arabic/Hebrew expansion). */
const RTL_LOCALES: SupportedLanguage[] = [];

const STORAGE_KEY = 'pm_mobile_language';

// ============================================================================
// Locale map
// ============================================================================

const locales: Record<SupportedLanguage, MobileTranslations> = { en, es, fr };

// ============================================================================
// Context
// ============================================================================

interface I18nContextValue {
  t: MobileTranslations;
  currentLanguage: SupportedLanguage;
  changeLanguage: (lang: SupportedLanguage) => Promise<void>;
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextValue>({
  t: en,
  currentLanguage: 'en',
  changeLanguage: async () => {},
  isRTL: false,
});

// ============================================================================
// Provider
// ============================================================================

export function I18nProvider({ children }: { children: ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('en');

  // Restore persisted language on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored && supportedLanguages.includes(stored as SupportedLanguage)) {
          setCurrentLanguage(stored as SupportedLanguage);
        }
      })
      .catch(() => {
        // Non-critical: language preference will use default
      });
  }, []);

  const changeLanguage = useCallback(async (lang: SupportedLanguage) => {
    setCurrentLanguage(lang);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Non-critical: language preference will reset on next launch
    }
  }, []);

  const value: I18nContextValue = {
    t: locales[currentLanguage],
    currentLanguage,
    changeLanguage,
    isRTL: RTL_LOCALES.includes(currentLanguage),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Returns typed translation strings and language utilities.
 *
 * Usage:
 *   const { t, currentLanguage, changeLanguage } = useMobileTranslation();
 *   <Text>{t.login.signIn}</Text>
 */
export function useMobileTranslation(): I18nContextValue {
  return useContext(I18nContext);
}

export default locales;
