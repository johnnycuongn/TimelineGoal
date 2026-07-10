import { Dog } from 'lucide-react-native';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useCouple } from '@/features/couple/CoupleProvider';
import { useTheme } from '@/theme';

/** The Den — daily landing. Bulldog + today's check-ins land here (M2). */
export default function DenScreen() {
  const { colors } = useTheme();
  const { couple } = useCouple();
  const bulldog = couple?.bulldog.name || 'your bulldog';
  const paired = (couple?.members.length ?? 1) >= 2;

  return (
    <Screen center>
      <Dog color={colors.primary} size={96} strokeWidth={2} />
      <Text variant="display" style={{ textAlign: 'center' }}>
        {bulldog}’s Den
      </Text>
      <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
        {paired
          ? 'Your daily check-ins will live here soon.\nFor now, give the pup a moment. 🐾'
          : 'Waiting for your partner to hop in —\nshare your invite code from the Us tab.'}
      </Text>
    </Screen>
  );
}
