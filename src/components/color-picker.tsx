import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Text } from '@/components/text';
import { haptics, partnerAccentChoices, radius, spacing, useTheme } from '@/theme';

interface ColorPickerProps {
  /** Currently selected hex (resolved for the active scheme). */
  value: string | null;
  onChange: (hex: string) => void;
}

/** Grid of partner accent swatches. The selected swatch shows a check. */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const { isDark, colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text variant="label" color="textSecondary">
        Pick your color
      </Text>
      <View style={styles.grid}>
        {partnerAccentChoices.map((choice) => {
          const hex = isDark ? choice.dark : choice.light;
          const selected = value === hex;
          return (
            <Pressable
              key={choice.name}
              accessibilityRole="button"
              accessibilityLabel={choice.name}
              accessibilityState={{ selected }}
              onPress={() => {
                haptics.tick();
                onChange(hex);
              }}
              style={[
                styles.swatch,
                { backgroundColor: hex, borderColor: selected ? colors.text : 'transparent' },
              ]}>
              {selected ? <Check color="#FFFFFF" size={22} strokeWidth={3} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, alignSelf: 'stretch' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  swatch: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
