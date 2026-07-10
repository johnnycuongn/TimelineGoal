import { ListChecks } from 'lucide-react-native';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useTheme } from '@/theme';

/** The Timeline — weekly → quarterly → yearly goal ladder (M2/M3). */
export default function TimelineScreen() {
  const { colors } = useTheme();
  return (
    <Screen center>
      <ListChecks color={colors.primary} size={72} strokeWidth={2} />
      <Text variant="display">Timeline</Text>
      <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
        Week, quarter, year — every small paw print{'\n'}climbs toward the big dream.
      </Text>
    </Screen>
  );
}
