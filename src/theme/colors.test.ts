import { palettes, partnerAccentChoices, type Palette } from './colors';

/**
 * Guards the design-system invariants that components depend on:
 * both schemes are complete, and partner accents are distinct.
 */

const REQUIRED_KEYS: (keyof Palette)[] = [
  'background',
  'surface',
  'muted',
  'border',
  'text',
  'textSecondary',
  'primary',
  'onPrimary',
  'secondary',
  'destructive',
  'success',
  'partnerA',
  'partnerB',
  'ring',
];

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe('color palettes', () => {
  it.each(['light', 'dark'] as const)('%s defines every semantic token as a hex value', (scheme) => {
    const palette = palettes[scheme];
    for (const key of REQUIRED_KEYS) {
      expect(palette[key]).toMatch(HEX);
    }
  });

  it('keeps light and dark distinct (dark is not a copy of light)', () => {
    expect(palettes.dark.background).not.toBe(palettes.light.background);
  });
});

describe('partner accent choices', () => {
  it('offers unique names and hex values in both schemes', () => {
    const names = partnerAccentChoices.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const choice of partnerAccentChoices) {
      expect(choice.light).toMatch(HEX);
      expect(choice.dark).toMatch(HEX);
    }
  });
});
