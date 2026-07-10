import { MessagesSquare } from 'lucide-react-native';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useTheme } from '@/theme';

/** Corners — one cozy board per topic: chat, pins, polls, decisions (M4). */
export default function CornersScreen() {
  const { colors } = useTheme();
  return (
    <Screen center>
      <MessagesSquare color={colors.primary} size={72} strokeWidth={2} />
      <Text variant="display">Corners</Text>
      <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
        A little corner for every plan we're{'\n'}dreaming up together.
      </Text>
    </Screen>
  );
}
