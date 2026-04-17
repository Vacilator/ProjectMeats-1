/**
 * Ant Design overlay helpers.
 *
 * Prefer importing from this module when you want a semantically named helper.
 * Under the hood it reuses the canonical `getAntdPopupContainer` implementation.
 */

import { getAntdPopupContainer, type AntdGetPopupContainer } from './antdPopupContainer';

export type { AntdGetPopupContainer };

export const getSelectPopupContainer: AntdGetPopupContainer = getAntdPopupContainer;
