/**
 * Type system — Fredoka (headings, chunky & friendly) / Nunito (body, soft & readable).
 * Font families are loaded in the root layout via @expo-google-fonts.
 * Base 16px, line-height ≥1.5. See .claude/skills/cuteness.
 */

/** Font family names as registered by @expo-google-fonts loaders. */
export const fontFamily = {
  headingRegular: 'Fredoka_400Regular',
  headingMedium: 'Fredoka_500Medium',
  headingSemiBold: 'Fredoka_600SemiBold',
  headingBold: 'Fredoka_700Bold',
  bodyRegular: 'Nunito_400Regular',
  bodyMedium: 'Nunito_500Medium',
  bodySemiBold: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
} as const;

/** Consistent type scale (12 14 16 18 24 32). */
export const fontSize = {
  caption: 12,
  small: 14,
  body: 16,
  bodyLarge: 18,
  title: 24,
  display: 32,
} as const;

export const lineHeight = {
  caption: 18,
  small: 21,
  body: 24,
  bodyLarge: 27,
  title: 30,
  display: 38,
} as const;

/**
 * Named text roles used across the app. Pair a family with a size/line-height.
 * Consume these via the <Text> component rather than restyling ad hoc.
 */
export const textRole = {
  display: {
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.display,
    lineHeight: lineHeight.display,
  },
  title: {
    fontFamily: fontFamily.headingSemiBold,
    fontSize: fontSize.title,
    lineHeight: lineHeight.title,
  },
  bodyLarge: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize.bodyLarge,
    lineHeight: lineHeight.bodyLarge,
  },
  body: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
  },
  label: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.small,
    lineHeight: lineHeight.small,
  },
  caption: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.caption,
    lineHeight: lineHeight.caption,
  },
} as const;

export type TextRole = keyof typeof textRole;
