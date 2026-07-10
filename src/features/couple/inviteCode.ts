/**
 * Pairing invite codes.
 *
 * An invite code is a security-sensitive capability: whoever presents a valid, outstanding
 * code can join a couple's private world. So codes are generated from a CSPRNG (never
 * Math.random) and are long enough to resist brute force (there is no server-side rate
 * limiting on the Spark plan). Codes stay single-use and short-lived (24h) as well.
 *
 * Alphabet excludes ambiguous glyphs (no 0/O, 1/I/L) so codes are still easy to share.
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 31 symbols (letters minus I/L/O, digits minus 0/1)
export const INVITE_CODE_LENGTH = 8; // 31^8 ≈ 8.5e11 — infeasible to guess

/** How long an invite stays valid (24h). */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * CSPRNG bytes. Uses expo-crypto's native secure RNG in the app; lazy-required so Node
 * test environments (which have no native module) fall back instead of failing at import.
 */
function secureRandomBytes(n: number): Uint8Array {
  try {
    const Crypto = require('expo-crypto') as { getRandomBytes: (len: number) => Uint8Array };
    return Crypto.getRandomBytes(n);
  } catch {
    // Non-RN environment (e.g. Node during emulator/unit tests). Not security-sensitive here.
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
    return out;
  }
}

/**
 * Generate a random invite code. `randomBytes` is injectable for deterministic tests only;
 * production callers use the secure default. Rejects bytes in the biased tail so every
 * symbol is equally likely (no modulo bias).
 */
export function generateInviteCode(
  randomBytes: (n: number) => Uint8Array = secureRandomBytes,
): string {
  const n = ALPHABET.length;
  const maxUnbiased = Math.floor(256 / n) * n; // largest multiple of n ≤ 256
  let code = '';
  while (code.length < INVITE_CODE_LENGTH) {
    const buf = randomBytes(INVITE_CODE_LENGTH);
    for (let i = 0; i < buf.length && code.length < INVITE_CODE_LENGTH; i++) {
      const b = buf[i];
      if (b < maxUnbiased) code += ALPHABET[b % n];
    }
  }
  return code;
}

/** Normalize user input (trim, uppercase) before lookup. */
export function normalizeInviteCode(input: string): string {
  return input.trim().toUpperCase();
}

/** True if a string is shaped like a valid invite code. */
export function isValidInviteCodeShape(code: string): boolean {
  if (code.length !== INVITE_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}
