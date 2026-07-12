/** TEMPORARY debug screen for the charm-emoji tofu bug. Delete after diagnosis. */

import { ScrollView, Text as RNText, View } from 'react-native';

import { Text } from '@/components/text';

const SAMPLE = '🎯 🏃 🍳 💪';

export default function DevCharmsScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 20, paddingTop: 80 }}>
      <View>
        <RNText>1. Themed Text + fontSize 24 (production path)</RNText>
        <Text style={{ fontSize: 24 }}>{SAMPLE}</Text>
      </View>
      <View>
        <RNText>2. RNText Nunito + fontSize 24, no lineHeight</RNText>
        <RNText style={{ fontFamily: 'Nunito_400Regular', fontSize: 24 }}>{SAMPLE}</RNText>
      </View>
      <View>
        <RNText>3. RNText fontSize 24 only (no fontFamily)</RNText>
        <RNText style={{ fontSize: 24 }}>{SAMPLE}</RNText>
      </View>
      <View>
        <RNText>4. RNText no styles at all</RNText>
        <RNText>{SAMPLE}</RNText>
      </View>
      <View>
        <RNText>5. Mixed sentence, themed Text (Ticker path)</RNText>
        <Text>Duc checked in 🎯 morning run</Text>
      </View>
      <View>
        <RNText>6. Emoji in nested RNText child of Nunito parent</RNText>
        <RNText style={{ fontFamily: 'Nunito_400Regular', fontSize: 24 }}>
          run <RNText style={{ fontFamily: undefined }}>🎯</RNText> done
        </RNText>
      </View>
    </ScrollView>
  );
}
