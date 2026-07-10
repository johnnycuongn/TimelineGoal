import {
  INVITE_CODE_LENGTH,
  generateInviteCode,
  isValidInviteCodeShape,
  normalizeInviteCode,
} from './inviteCode';

describe('generateInviteCode', () => {
  it('produces a 6-char code from the unambiguous alphabet', () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(INVITE_CODE_LENGTH);
    expect(isValidInviteCodeShape(code)).toBe(true);
  });

  it('never emits ambiguous characters (0 O 1 I L)', () => {
    // Force each position to a different slice of the alphabet across many draws.
    for (let seed = 0; seed < 200; seed++) {
      const code = generateInviteCode(() => (seed % 30) / 30);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it('is deterministic given a fixed RNG', () => {
    const rand = () => 0; // always first char
    expect(generateInviteCode(rand)).toBe('AAAAAA');
  });
});

describe('normalizeInviteCode', () => {
  it('trims and uppercases', () => {
    expect(normalizeInviteCode('  ab3d9k ')).toBe('AB3D9K');
  });
});

describe('isValidInviteCodeShape', () => {
  it('rejects wrong length and ambiguous chars', () => {
    expect(isValidInviteCodeShape('ABC')).toBe(false);
    expect(isValidInviteCodeShape('ABCDE0')).toBe(false); // 0 not in alphabet
    expect(isValidInviteCodeShape('ABCDEF')).toBe(true);
  });
});
