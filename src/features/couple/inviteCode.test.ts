import {
  INVITE_CODE_LENGTH,
  generateInviteCode,
  isValidInviteCodeShape,
  normalizeInviteCode,
} from './inviteCode';

/** Build a byte source that yields a fixed repeating sequence (for determinism). */
const bytesFrom = (values: number[]) => (n: number) =>
  Uint8Array.from({ length: n }, (_, i) => values[i % values.length]);

describe('generateInviteCode', () => {
  it('produces an 8-char code from the unambiguous alphabet', () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(INVITE_CODE_LENGTH);
    expect(isValidInviteCodeShape(code)).toBe(true);
  });

  it('never emits ambiguous characters (0 O 1 I L) across the full byte range', () => {
    for (let start = 0; start < 240; start += 7) {
      const code = generateInviteCode(bytesFrom([start, start + 1, start + 2, start + 3]));
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it('is deterministic given a fixed byte source', () => {
    expect(generateInviteCode(bytesFrom([0]))).toBe('AAAAAAAA'); // byte 0 → ALPHABET[0]
  });

  it('rejects biased tail bytes (>= 248) to keep symbols uniform', () => {
    // 31-symbol alphabet → largest unbiased multiple of 31 ≤ 256 is 248; bytes ≥ 248 are dropped.
    const source = bytesFrom([250, 255, 248, 5]); // only 5 survives → ALPHABET[5] = 'F'
    expect(generateInviteCode(source)).toBe('FFFFFFFF');
  });
});

describe('normalizeInviteCode', () => {
  it('trims and uppercases', () => {
    expect(normalizeInviteCode('  ab3d9k2m ')).toBe('AB3D9K2M');
  });
});

describe('isValidInviteCodeShape', () => {
  it('rejects wrong length and ambiguous chars', () => {
    expect(isValidInviteCodeShape('ABC')).toBe(false);
    expect(isValidInviteCodeShape('ABCDEFG0')).toBe(false); // 0 not in alphabet
    expect(isValidInviteCodeShape('ABCDEFGH')).toBe(true); // 8 valid chars
  });
});
