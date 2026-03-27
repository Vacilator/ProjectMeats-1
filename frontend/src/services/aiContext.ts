import type { NavigationStep } from '@/contexts/CockpitNavigationContext';

export type AIPageContext = {
  currentPath: string;
  activeEntityId: string | null;
  activeEntityType: string | null;
  cockpitPath?: Array<{
    id: string;
    type: string;
    label: string;
    subtitle?: string;
  }>;
};

export function buildAIPageContext(
  location: { pathname: string; search?: string },
  cockpitPath: NavigationStep[] = []
): AIPageContext {
  const currentPath = `${location.pathname}${location.search || ''}`;
  const active = cockpitPath.length ? cockpitPath[cockpitPath.length - 1] : null;

  return {
    currentPath,
    activeEntityId: active?.id ?? null,
    activeEntityType: active?.type ?? null,
    cockpitPath: cockpitPath.length
      ? cockpitPath.map((s) => ({
          id: String(s.id),
          type: String(s.type),
          label: String(s.label),
          subtitle: typeof s.subtitle === 'string' ? s.subtitle : undefined,
        }))
      : undefined,
  };
}
