import { Dog } from 'lucide-react-native';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useTheme } from '@/theme';

/** The Den — daily landing. Bulldog + today's check-ins land here (M2). */
export default function DenScreen() {
  const { colors } = useTheme();
  return (
    <Screen center>
      <Dog color={colors.primary} size={72} strokeWidth={2} />
      <Text variant="display">The Den</Text>
      <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
        This is where our little bulldog will live.{'\n'}Home of your daily check-ins.
      </Text>
    </Screen>
  );
}
