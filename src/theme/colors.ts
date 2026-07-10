/**
 * TimelineGoal color system — "romance rose".
 *
 * Rules (see .claude/skills/cuteness):
 *  - Components consume SEMANTIC tokens only (color.primary), never raw hex.
 *  - Light + dark are designed together; dark stays cozy (desaturated rose), not inverted.
 *  - All foreground/background pairs meet WCAG AA (≥4.5:1 for body text).
 *  - Partner A = rose; Partner B picks an accent at onboarding; shared = a gradient of both.
 */

export type ColorScheme = 'light' | 'dark';

export interface Palette {
  /** App background (the paper of the den) */
  background: string;
  /** Raised surface — cards, sheets */
  surface: string;
  /** Slightly recessed / muted fill */
  muted: string;
  /** Hairline borders & soft dividers */
  border: string;

  /** Primary text on background/surface */
  text: string;
  /** Secondary / supporting text (still ≥4.5:1 on background) */
  textSecondary: string;

  /** Brand primary (rose) — primary CTAs, active states */
  primary: string;
  /** Text/icon that sits ON primary */
  onPrimary: string;
  /** Softer brand accent (pink) — highlights, secondary emphasis */
  secondary: string;

  /** Destructive / error (used sparingly — never for "missed a goal") */
  destructive: string;
  /** Positive confirmation (check-ins, success) */
  success: string;

  /** Default partner-A color (rose family) */
  partnerA: string;
  /** Default partner-B color (overridden by their onboarding pick) */
  partnerB: string;

  /** Focus ring */
  ring: string;
}

const light: Palette = {
  background: '#FDF2F8',
  surface: '#FFFFFF',
  muted: '#FBF1F5',
  border: '#F7E3EB',

  text: '#0F172A',
  textSecondary: '#6B5561',

  primary: '#BE185D',
  onPrimary: '#FFFFFF',
  secondary: '#EC4899',

  destructive: '#DC2626',
  success: '#15803D',

  partnerA: '#BE185D',
  partnerB: '#0D9488',

  ring: '#BE185D',
};

const dark: Palette = {
  background: '#181015',
  surface: '#241820',
  muted: '#2E1F28',
  border: '#3D2A34',

  text: '#F6E9EF',
  textSecondary: '#C8AAB8',

  primary: '#F472B6',
  onPrimary: '#3B0A22',
  secondary: '#F9A8D4',

  destructive: '#F87171',
  success: '#4ADE80',

  partnerA: '#F472B6',
  partnerB: '#2DD4BF',

  ring: '#F472B6',
};

export const palettes: Record<ColorScheme, Palette> = { light, dark };

/**
 * Curated accent choices a partner can pick at onboarding (Partner B).
 * Chosen to read clearly against both the rose primary and each other,
 * and to stay cute rather than corporate.
 */
export const partnerAccentChoices = [
  { name: 'teal', light: '#0D9488', dark: '#2DD4BF' },
  { name: 'blueberry', light: '#4F46E5', dark: '#818CF8' },
  { name: 'tangerine', light: '#EA580C', dark: '#FB923C' },
  { name: 'grape', light: '#7C3AED', dark: '#A78BFA' },
  { name: 'lime', light: '#4D7C0F', dark: '#A3E635' },
  { name: 'sky', light: '#0284C7', dark: '#38BDF8' },
] as const;
