import { SHARE_CODE_LENGTH } from "./domain";

/** No 0/O, 1/I so a code read aloud or typed from a photo never misfires. */
export const SHARE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_RE = new RegExp(`^[${SHARE_CODE_ALPHABET}]{${SHARE_CODE_LENGTH}}$`);
const STRIP_RE = /[\s-]/g;

export function normalizeShareCode(input: string): string {
  return input.replace(STRIP_RE, "").toUpperCase();
}

export function isValidShareCode(code: string): boolean {
  return CODE_RE.test(code);
}
