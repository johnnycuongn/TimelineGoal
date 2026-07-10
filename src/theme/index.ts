/**
 * TimelineGoal design system — single import surface.
 *
 *   import { useTheme, spacing, radius, textRole, spring, haptics } from '@/theme';
 *
 * Consume SEMANTIC color tokens from useTheme().colors — never raw hex in components.
 */

import { useColorScheme } from 'react-native';

import { palettes, type ColorScheme, type Palette } from './colors';

export * from './colors';
export * from './spacing';
export * from './typography';
export * from './motion';
export { haptics } from './haptics';

export interface Theme {
  scheme: ColorScheme;
  isDark: boolean;
  colors: Palette;
}

/** Active theme, reactive to the system light/dark setting. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const resolved: ColorScheme = scheme === 'dark' ? 'dark' : 'light';
  return {
    scheme: resolved,
    isDark: resolved === 'dark',
    colors: palettes[resolved],
  };
}
