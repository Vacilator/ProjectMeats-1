import { renderHook, act } from '@testing-library/react';
import { useTranslation } from '../hooks';
import i18n from '../config';

describe('locale coverage – new keys', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
  });

  describe('common section additions', () => {
    it('provides common.cancel in English', () => {
      const { result } = renderHook(() => useTranslation());
      expect(result.current.t('common.cancel')).toBe('Cancel');
    });

    it('provides common.cancel in Spanish', () => {
      const { result } = renderHook(() => useTranslation());
      act(() => { result.current.changeLanguage('es'); });
      expect(result.current.t('common.cancel')).toBe('Cancelar');
    });

    it('provides common.cancel in French', () => {
      const { result } = renderHook(() => useTranslation());
      act(() => { result.current.changeLanguage('fr'); });
      expect(result.current.t('common.cancel')).toBe('Annuler');
    });

    it('provides common.noResults in English', () => {
      const { result } = renderHook(() => useTranslation());
      expect(result.current.t('common.noResults')).toBe('No results found');
    });

    it('provides common.retry in all languages', () => {
      const { result } = renderHook(() => useTranslation());
      expect(result.current.t('common.retry')).toBe('Retry');

      act(() => { result.current.changeLanguage('es'); });
      expect(result.current.t('common.retry')).toBe('Reintentar');

      act(() => { result.current.changeLanguage('fr'); });
      expect(result.current.t('common.retry')).toBe('Réessayer');
    });
  });

  describe('cockpit section', () => {
    it('provides cockpit.searchPlaceholder in English', () => {
      const { result } = renderHook(() => useTranslation());
      expect(result.current.t('cockpit.searchPlaceholder')).toBe('Search anything...');
    });

    it('provides cockpit.searchPlaceholder in Spanish', () => {
      const { result } = renderHook(() => useTranslation());
      act(() => { result.current.changeLanguage('es'); });
      expect(result.current.t('cockpit.searchPlaceholder')).toBe('Buscar cualquier cosa...');
    });

    it('provides cockpit.searchPlaceholder in French', () => {
      const { result } = renderHook(() => useTranslation());
      act(() => { result.current.changeLanguage('fr'); });
      expect(result.current.t('cockpit.searchPlaceholder')).toBe('Rechercher n\'importe quoi...');
    });

    it('provides cockpit.smartSearch.placeholder in all languages', () => {
      const { result } = renderHook(() => useTranslation());

      expect(result.current.t('cockpit.smartSearch.placeholder')).toBe(
        'Search customers, suppliers, orders...'
      );

      act(() => { result.current.changeLanguage('es'); });
      expect(result.current.t('cockpit.smartSearch.placeholder')).toBe(
        'Buscar clientes, proveedores, pedidos...'
      );

      act(() => { result.current.changeLanguage('fr'); });
      expect(result.current.t('cockpit.smartSearch.placeholder')).toBe(
        'Rechercher clients, fournisseurs, commandes...'
      );
    });

    it('provides cockpit.smartSearch.noResults in all languages', () => {
      const { result } = renderHook(() => useTranslation());
      expect(result.current.t('cockpit.smartSearch.noResults')).toBe('No results found');

      act(() => { result.current.changeLanguage('es'); });
      expect(result.current.t('cockpit.smartSearch.noResults')).toBe('No se encontraron resultados');

      act(() => { result.current.changeLanguage('fr'); });
      expect(result.current.t('cockpit.smartSearch.noResults')).toBe('Aucun résultat trouvé');
    });
  });

  describe('forms section', () => {
    it('provides forms.selectAForm in English', () => {
      const { result } = renderHook(() => useTranslation());
      expect(result.current.t('forms.selectAForm')).toBe('Select a Form');
    });

    it('provides forms.selectAForm in Spanish', () => {
      const { result } = renderHook(() => useTranslation());
      act(() => { result.current.changeLanguage('es'); });
      expect(result.current.t('forms.selectAForm')).toBe('Seleccionar un Formulario');
    });

    it('provides forms.selectAForm in French', () => {
      const { result } = renderHook(() => useTranslation());
      act(() => { result.current.changeLanguage('fr'); });
      expect(result.current.t('forms.selectAForm')).toBe('Sélectionner un Formulaire');
    });

    it('provides forms.loadingForms in all languages', () => {
      const { result } = renderHook(() => useTranslation());
      expect(result.current.t('forms.loadingForms')).toBe('Loading forms...');

      act(() => { result.current.changeLanguage('es'); });
      expect(result.current.t('forms.loadingForms')).toBe('Cargando formularios...');

      act(() => { result.current.changeLanguage('fr'); });
      expect(result.current.t('forms.loadingForms')).toBe('Chargement des formulaires...');
    });

    it('provides forms.submissions with interpolation', () => {
      const { result } = renderHook(() => useTranslation());
      const translated = result.current.t('forms.submissions', { count: 5 });
      expect(translated).toContain('5');
    });
  });

  describe('aiPanel section', () => {
    it('provides aiPanel.title in English', () => {
      const { result } = renderHook(() => useTranslation());
      expect(result.current.t('aiPanel.title')).toBe('AI Suggestions');
    });

    it('provides aiPanel.title in Spanish', () => {
      const { result } = renderHook(() => useTranslation());
      act(() => { result.current.changeLanguage('es'); });
      expect(result.current.t('aiPanel.title')).toBe('Sugerencias de IA');
    });

    it('provides aiPanel.title in French', () => {
      const { result } = renderHook(() => useTranslation());
      act(() => { result.current.changeLanguage('fr'); });
      expect(result.current.t('aiPanel.title')).toBe('Suggestions IA');
    });

    it('provides aiPanel.analyzing in all languages', () => {
      const { result } = renderHook(() => useTranslation());
      expect(result.current.t('aiPanel.analyzing')).toBe('Analyzing workflow...');

      act(() => { result.current.changeLanguage('es'); });
      expect(result.current.t('aiPanel.analyzing')).toBe('Analizando flujo...');

      act(() => { result.current.changeLanguage('fr'); });
      expect(result.current.t('aiPanel.analyzing')).toBe('Analyse du flux en cours...');
    });

    it('provides aiPanel.mode.ai in all languages', () => {
      const { result } = renderHook(() => useTranslation());
      expect(result.current.t('aiPanel.mode.ai')).toBe('AI');

      act(() => { result.current.changeLanguage('es'); });
      expect(result.current.t('aiPanel.mode.ai')).toBe('IA');

      act(() => { result.current.changeLanguage('fr'); });
      expect(result.current.t('aiPanel.mode.ai')).toBe('IA');
    });
  });

  describe('mobile section', () => {
    it('provides mobile.login.signIn in English', () => {
      const { result } = renderHook(() => useTranslation());
      expect(result.current.t('mobile.login.signIn')).toBe('Sign In');
    });

    it('provides mobile.login.signIn in Spanish', () => {
      const { result } = renderHook(() => useTranslation());
      act(() => { result.current.changeLanguage('es'); });
      expect(result.current.t('mobile.login.signIn')).toBe('Iniciar Sesión');
    });

    it('provides mobile.login.signIn in French', () => {
      const { result } = renderHook(() => useTranslation());
      act(() => { result.current.changeLanguage('fr'); });
      expect(result.current.t('mobile.login.signIn')).toBe('Se connecter');
    });

    it('provides mobile.home.dashboard in all languages', () => {
      const { result } = renderHook(() => useTranslation());
      expect(result.current.t('mobile.home.dashboard')).toBe('Dashboard');

      act(() => { result.current.changeLanguage('es'); });
      expect(result.current.t('mobile.home.dashboard')).toBe('Panel de Control');

      act(() => { result.current.changeLanguage('fr'); });
      expect(result.current.t('mobile.home.dashboard')).toBe('Tableau de bord');
    });
  });
});
