/**
 * 4/8pt spacing rhythm + rounded-everything radii + soft-shadow elevation.
 * See .claude/skills/cuteness (nothing sharp) and motion-spec.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Rounded everything — cards 20–24, buttons pill. */
export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

/** Minimum touch target (Apple HIG). Never smaller for interactive elements. */
export const touchTarget = 44;

/**
 * Soft-UI elevation. Softer than flat, clearer than neumorphism.
 * iOS reads shadow*, Android reads elevation — both supplied.
 */
export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  soft: {
    shadowColor: '#8B1E52',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  lifted: {
    shadowColor: '#8B1E52',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;
