/**
 * Centralized color tokens for the ProjectMeats mobile app.
 *
 * All screens must import from this module instead of using
 * hardcoded hex / rgb values in StyleSheet definitions.
 */

export const colors = {
  // Brand / primary
  primary: '#3498db',
  primaryDark: '#2471a3',
  secondary: '#2c3e50',

  // Semantic status
  success: '#27ae60',
  successDark: '#1e8449',
  successLight: '#eafaf1',
  successLighter: '#d5f5e3',
  warning: '#f39c12',
  error: '#e74c3c',
  errorDark: '#c0392b',
  errorDarker: '#922b21',
  errorLight: '#fdecea',
  errorLightBorder: '#f5c6cb',
  info: '#3498db',
  infoLight: '#e8eefc',
  purple: '#9b59b6',

  // Surfaces
  background: '#f5f5f5',
  backgroundAlt: '#f0f2f5',
  surface: '#fff',
  surfaceAlt: '#f2f3f4',
  surfaceMuted: '#ecf0f1',
  infoBanner: '#eaf4fb',

  // Text
  textPrimary: '#2c3e50',
  textSecondary: '#7f8c8d',
  textMuted: '#95a5a6',
  textHint: '#5d6d7e',
  textOnPrimary: '#fff',
  textDark: '#0b1020',

  // Borders
  border: '#e1e5e9',
  borderLight: '#d5d8dc',
  borderMuted: '#bdc3c7',

  // Shadows
  shadow: '#000',

  // Transparent / disabled
  disabled: 'rgba(0,0,0,0.38)',
} as const;

export type ColorToken = keyof typeof colors;
