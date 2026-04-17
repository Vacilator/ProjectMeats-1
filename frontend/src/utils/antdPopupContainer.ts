/**
 * Ant Design popup container helper
 *
 * AntD components like Select render dropdowns in a portal (document.body) by default.
 * Inside our modals/drawers/overlays this can put the dropdown behind a mask/backdrop,
 * making it look greyed out and/or unclickable.
 *
 * This helper anchors the popup to the nearest AntD modal/drawer body when present,
 * otherwise falls back to the trigger's parent element.
 */

export type AntdGetPopupContainer = (triggerNode: HTMLElement) => HTMLElement;

export const getAntdPopupContainer: AntdGetPopupContainer = (triggerNode) => {
  const triggerEl = triggerNode as HTMLElement | null;

  const overlayContainer =
    triggerEl?.closest?.('.ant-modal-body') ??
    triggerEl?.closest?.('.ant-drawer-body') ??
    triggerEl?.parentElement;

  if (overlayContainer) return overlayContainer as HTMLElement;

  if (typeof document !== 'undefined') return document.body;

  // Extremely defensive fallback for non-DOM runtimes.
  return (triggerEl ?? ({} as HTMLElement));
};
