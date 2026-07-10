/**
 * Pairing invite codes: 6 characters from an unambiguous alphabet
 * (no 0/O, 1/I/L) so they're easy to read aloud and type.
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;

/** How long an invite stays valid (24h). */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a random invite code. `rand` is injectable for deterministic tests
 * (defaults to Math.random).
 */
export function generateInviteCode(rand: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(rand() * ALPHABET.length)];
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
