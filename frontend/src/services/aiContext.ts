import type { NavigationStep } from '@/contexts/CockpitNavigationContext';

export type AIPageContext = {
  currentPath: string;

  // Legacy keys (camelCase)
  activeEntityId: string | null;
  activeEntityType: string | null;

  // Canonical keys (snake_case) expected by the backend
  current_entity_id: string | null;
  current_entity_type: string | null;

  // Explicit active entity payload (requested by Omnibox/assistant tooling)
  activeEntity?: {
    id: string;
    type: string;
    label: string;
    subtitle?: string;
  } | null;

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

    // Legacy keys (camelCase)
    activeEntityId: active?.id ?? null,
    activeEntityType: active?.type ?? null,

    // Canonical keys (snake_case)
    current_entity_id: active?.id ?? null,
    current_entity_type: active?.type ?? null,

    activeEntity: active
      ? {
          id: String(active.id),
          type: String(active.type),
          label: String(active.label),
          subtitle: typeof active.subtitle === 'string' ? active.subtitle : undefined,
        }
      : null,

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
