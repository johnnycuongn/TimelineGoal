import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Text } from '@/components/text';
import { haptics, pressScale, radius, spacing, spring, touchTarget, useTheme } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  /** Optional override for the fill (e.g. a partner color). */
  tint?: string;
  style?: ViewStyle;
}

/**
 * Pill button with springy press feedback (scale 0.96 + tick haptic) per motion-spec.
 * One primary CTA per screen; use `secondary`/`ghost` for subordinate actions.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  tint,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const isDisabled = disabled || loading;
  const fill =
    variant === 'primary' ? (tint ?? colors.primary) : variant === 'secondary' ? colors.muted : 'transparent';
  const textColor =
    variant === 'primary' ? 'onPrimary' : variant === 'ghost' ? 'primary' : 'text';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPressIn={() => {
        if (isDisabled) return;
        haptics.tick();
        scale.value = withSpring(pressScale, spring.press);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, spring.press);
      }}
      onPress={() => {
        if (!isDisabled) onPress();
      }}>
      <Animated.View
        style={[
          styles.base,
          {
            backgroundColor: fill,
            borderColor: variant === 'ghost' ? colors.border : 'transparent',
            opacity: isDisabled ? 0.5 : 1,
          },
          animatedStyle,
          style,
        ]}>
        {loading ? (
          <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.primary} />
        ) : (
          <Text variant="label" color={textColor}>
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
