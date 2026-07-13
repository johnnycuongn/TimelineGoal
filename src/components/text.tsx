import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { textRole, useTheme, type Palette, type TextRole } from '@/theme';

type ColorToken = keyof Pick<
  Palette,
  'text' | 'textSecondary' | 'primary' | 'secondary' | 'onPrimary' | 'destructive' | 'success'
>;

export interface TextProps extends RNTextProps {
  /** Type role from the scale (display, title, body, label, caption…). Defaults to body. */
  variant?: TextRole;
  /** Semantic color token. Defaults to `text`. */
  color?: ColorToken;
}

/**
 * The one text component. Binds a type role (Fredoka/Nunito + size/line-height)
 * to a semantic color token so components never restyle typography ad hoc.
 * (`variant`, not `role`, so React Native's accessibility `role` prop stays available.)
 */
export function Text({ variant = 'body', color = 'text', style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return <RNText style={[textRole[variant], { color: colors[color] }, style]} {...rest} />;
}
