import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  /** Center content vertically & horizontally (handy for empty/placeholder states). */
  center?: boolean;
  /** Safe-area edges to inset. Defaults to top only (bottom is owned by the tab bar). */
  edges?: readonly Edge[];
  style?: ViewStyle;
}

/** Standard screen frame: themed background + safe-area insets + comfortable padding. */
export function Screen({ children, center = false, edges = ['top'], style }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.body, center && styles.centered, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.md },
});
