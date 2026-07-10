import { Heart } from 'lucide-react-native';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useTheme } from '@/theme';

/** Us — couple profile, bulldog customization, pairing & settings (M1/M5). */
export default function UsScreen() {
  const { colors } = useTheme();
  return (
    <Screen center>
      <Heart color={colors.primary} size={72} strokeWidth={2} fill={colors.secondary} />
      <Text variant="display">Us</Text>
      <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
        Our profile, our bulldog, our little{'\n'}world's settings — all right here.
      </Text>
    </Screen>
  );
}
