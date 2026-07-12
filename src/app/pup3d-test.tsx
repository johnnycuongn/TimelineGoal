import { Canvas } from '@react-three/fiber/native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import Pup3DStage from '@/features/bulldog/pup3d/Pup3DStage';
import { useTheme } from '@/theme';

/**
 * DEV-ONLY test harness for the 3D pup — reachable without auth via deep link:
 *   exp://<host>/--/pup3d-test
 * Top: minimal sanity canvas (magenta bg + orange box — no assets, no suspense).
 * Bottom: the real Pup3DStage. Remove before ship (M5).
 */
export default function Pup3DTestScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text variant="title" style={styles.title}>
        3D pup test rig
      </Text>
      <View style={styles.sanity}>
        <Canvas camera={{ position: [0, 0, 3] }}>
          {/* eslint-disable-next-line react/no-unknown-property */}
          <color attach="background" args={['#ff00aa']} />
          {/* eslint-disable-next-line react/no-unknown-property */}
          <ambientLight intensity={1.5} />
          <mesh rotation={[0.6, 0.8, 0]}>
            {/* eslint-disable-next-line react/no-unknown-property */}
            <boxGeometry args={[1.2, 1.2, 1.2]} />
            {/* eslint-disable-next-line react/no-unknown-property */}
            <meshStandardMaterial color="#ff8800" />
          </mesh>
        </Canvas>
      </View>
      <Pup3DStage height={340} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  title: { textAlign: 'center', paddingBottom: 12 },
  sanity: { height: 160, alignSelf: 'stretch' },
});
