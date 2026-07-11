/**
 * Mochi the Marshmallow — pure SVG layers (no animation in here).
 *
 * Shapes/colors are the approved character sheet (docs/design/bulldog-concepts.html,
 * concept A; spec: docs/superpowers/specs/2026-07-11-mochi-bulldog-design.md).
 * Every layer shares the same 200×200 viewBox so stacked layers align pixel-perfectly.
 *
 * Character palette is deliberately Mochi-owned (not theme tokens): his cream coat is
 * designed to pop on both light and dark backgrounds.
 */

import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

export const MOCHI = {
  cream: '#FFF3E9',
  light: '#FFFDFB',
  jowl: '#FBE9DC',
  wrinkle: '#E8CDB9',
  ear: '#B08776',
  earInner: '#F4B8C9',
  eye: '#2E2436',
  nose: '#4A3B41',
  blush: '#F9C6D0',
  tongue: '#F2789F',
  whisker: '#D9B8A6',
} as const;

const VB = '0 0 200 200';

interface LayerProps {
  size: number;
}

/** Ears + tail — sits behind everything. */
export function BackLayer({ size }: LayerProps) {
  return (
    <Svg width={size} height={size} viewBox={VB}>
      <Ellipse cx={56} cy={44} rx={17} ry={24} fill={MOCHI.ear} transform="rotate(-24 56 44)" />
      <Ellipse cx={58} cy={47} rx={9} ry={14} fill={MOCHI.earInner} transform="rotate(-24 58 47)" />
      <Ellipse cx={144} cy={44} rx={17} ry={24} fill={MOCHI.ear} transform="rotate(24 144 44)" />
      <Ellipse cx={142} cy={47} rx={9} ry={14} fill={MOCHI.earInner} transform="rotate(24 142 47)" />
      <Circle cx={143} cy={158} r={8} fill={MOCHI.cream} />
      <Path
        d="M139,158 a5.5,5.5 0 1,1 8,4"
        fill="none"
        stroke={MOCHI.wrinkle}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Body + legs + chest — breathes. */
export function BodyLayer({ size }: LayerProps) {
  return (
    <Svg width={size} height={size} viewBox={VB}>
      <Ellipse cx={100} cy={160} rx={40} ry={28} fill={MOCHI.cream} />
      <Rect x={76} y={170} width={13} height={17} rx={6.5} fill={MOCHI.cream} />
      <Rect x={111} y={170} width={13} height={17} rx={6.5} fill={MOCHI.cream} />
      <Ellipse cx={100} cy={152} rx={20} ry={12} fill={MOCHI.light} />
    </Svg>
  );
}

/** Head base: skull, wrinkles, muzzle, blush, nose, mouth. */
export function HeadLayer({ size }: LayerProps) {
  return (
    <Svg width={size} height={size} viewBox={VB}>
      <Ellipse cx={100} cy={80} rx={58} ry={52} fill={MOCHI.cream} />
      <Path
        d="M80,50 Q100,42 120,50"
        fill="none"
        stroke={MOCHI.wrinkle}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d="M86,40 Q100,34 114,40"
        fill="none"
        stroke={MOCHI.wrinkle}
        strokeWidth={2.4}
        strokeLinecap="round"
        opacity={0.7}
      />
      <Ellipse cx={54} cy={98} rx={8.5} ry={5} fill={MOCHI.blush} opacity={0.8} />
      <Ellipse cx={146} cy={98} rx={8.5} ry={5} fill={MOCHI.blush} opacity={0.8} />
      <Ellipse cx={100} cy={102} rx={30} ry={22} fill={MOCHI.light} />
      <Rect x={92} y={87} width={16} height={11} rx={5.5} fill={MOCHI.nose} />
      <Circle cx={96.5} cy={90.5} r={1.7} fill="#fff" opacity={0.5} />
    </Svg>
  );
}

/** The two squishy jowls — jiggle with lag behind head movement. */
export function JowlsLayer({ size }: LayerProps) {
  return (
    <Svg width={size} height={size} viewBox={VB}>
      <Ellipse cx={81} cy={112} rx={15} ry={12} fill={MOCHI.jowl} />
      <Ellipse cx={119} cy={112} rx={15} ry={12} fill={MOCHI.jowl} />
      <Circle cx={76} cy={110} r={1.1} fill={MOCHI.whisker} />
      <Circle cx={82} cy={114} r={1.1} fill={MOCHI.whisker} />
      <Circle cx={88} cy={110} r={1.1} fill={MOCHI.whisker} />
      <Circle cx={112} cy={110} r={1.1} fill={MOCHI.whisker} />
      <Circle cx={118} cy={114} r={1.1} fill={MOCHI.whisker} />
      <Circle cx={124} cy={110} r={1.1} fill={MOCHI.whisker} />
    </Svg>
  );
}

/** Open glossy eyes (pupils + highlights). Blinks via scaleY on the wrapper. */
export function EyesLayer({ size }: LayerProps) {
  return (
    <Svg width={size} height={size} viewBox={VB}>
      <Circle cx={72} cy={80} r={10.5} fill={MOCHI.eye} />
      <Circle cx={75.5} cy={76.5} r={3.6} fill="#fff" />
      <Circle cx={69.5} cy={83.5} r={1.8} fill="#fff" opacity={0.85} />
      <Circle cx={128} cy={80} r={10.5} fill={MOCHI.eye} />
      <Circle cx={131.5} cy={76.5} r={3.6} fill="#fff" />
      <Circle cx={125.5} cy={83.5} r={1.8} fill="#fff" opacity={0.85} />
    </Svg>
  );
}

/** Happy ^^ arc eyes — crossfaded over the open eyes. */
export function HappyArcsLayer({ size }: LayerProps) {
  return (
    <Svg width={size} height={size} viewBox={VB}>
      {/* mask the open eyes with coat-colored patches, then draw the arcs */}
      <Ellipse cx={72} cy={80} rx={13} ry={13} fill={MOCHI.cream} />
      <Ellipse cx={128} cy={80} rx={13} ry={13} fill={MOCHI.cream} />
      <Path
        d="M62,82 Q72,72 82,82"
        fill="none"
        stroke={MOCHI.eye}
        strokeWidth={3.4}
        strokeLinecap="round"
      />
      <Path
        d="M118,82 Q128,72 138,82"
        fill="none"
        stroke={MOCHI.eye}
        strokeWidth={3.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Sleepy lids — heavy, 80% closed, with lash lines. */
export function SleepyLidsLayer({ size }: LayerProps) {
  return (
    <Svg width={size} height={size} viewBox={VB}>
      <Ellipse cx={72} cy={80} rx={13} ry={13} fill={MOCHI.cream} />
      <Ellipse cx={128} cy={80} rx={13} ry={13} fill={MOCHI.cream} />
      <Path
        d="M62,84 Q72,88 82,84"
        fill="none"
        stroke={MOCHI.eye}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d="M118,84 Q128,88 138,84"
        fill="none"
        stroke={MOCHI.eye}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Mouth: little w + tongue-peek. */
export function MouthLayer({ size }: LayerProps) {
  return (
    <Svg width={size} height={size} viewBox={VB}>
      <Path
        d="M100,98 Q100,104 94,105.5 M100,98 Q100,104 106,105.5"
        fill="none"
        stroke="#6B4E4E"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Ellipse cx={100} cy={110} rx={5.5} ry={4.5} fill={MOCHI.tongue} />
    </Svg>
  );
}

/** Open happy mouth — crossfaded over the resting mouth. */
export function OpenMouthLayer({ size }: LayerProps) {
  return (
    <Svg width={size} height={size} viewBox={VB}>
      {/* patch over the resting mouth */}
      <Ellipse cx={100} cy={104} rx={14} ry={11} fill={MOCHI.light} />
      <Path d="M88,100 Q100,118 112,100 Q100,106 88,100 Z" fill="#5C4348" />
      <Ellipse cx={100} cy={110} rx={6.5} ry={4.5} fill={MOCHI.tongue} />
    </Svg>
  );
}

/** Bandana in both partners' colors — band + knotted triangle. */
export function BandanaLayer({ size, colorA, colorB }: LayerProps & { colorA: string; colorB: string }) {
  return (
    <Svg width={size} height={size} viewBox={VB}>
      <Defs>
        <LinearGradient id="mochiBandana" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colorA} />
          <Stop offset="1" stopColor={colorB} />
        </LinearGradient>
      </Defs>
      <Path d="M70,127 L130,127 L100,151 Z" fill="url(#mochiBandana)" />
      <Rect x={67} y={121} width={66} height={9} rx={4.5} fill={colorA} />
    </Svg>
  );
}

/** Sleepy zzz — two little z-bubbles that drift (animated by the wrapper). */
export function ZzzLayer({ size }: LayerProps) {
  return (
    <Svg width={size} height={size} viewBox={VB}>
      <Path
        d="M150,52 h12 l-12,12 h12"
        fill="none"
        stroke={MOCHI.ear}
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M168,32 h8 l-8,8 h8"
        fill="none"
        stroke={MOCHI.ear}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.75}
      />
    </Svg>
  );
}
