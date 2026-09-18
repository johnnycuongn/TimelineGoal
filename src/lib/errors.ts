const NETWORK_COPY = "We couldn't reach the den. Check your connection and try again.";
const DEFAULT_COPY = "That didn't land. Try again?";
const DUPLICATE_CODE = "23505";
const CHECK_VIOLATION = "23514";

interface ErrorLike {
  message?: unknown;
  code?: unknown;
  status?: unknown;
}

/** Turns a Supabase/Postgres/auth error into copy the app can show as-is. */
export function friendlyError(error: unknown): string {
  if (error instanceof TypeError) {
    return NETWORK_COPY;
  }
  const e = (error ?? {}) as ErrorLike;
  if (e.code === DUPLICATE_CODE) {
    return "Already stamped.";
  }
  // A check constraint tripped. Never show Postgres' own wording for these.
  if (e.code === CHECK_VIOLATION) {
    return "That didn't fit. Have another look and try again?";
  }
  if (typeof e.message === "string" && e.message.length > 0) {
    if (e.message === "Failed to fetch") {
      return NETWORK_COPY;
    }
    if (e.message === "Invalid login credentials") {
      return "That email and password don't match. Try again?";
    }
    if (e.message.startsWith("Password should be")) {
      return "Pick a password with at least 6 characters.";
    }
    return e.message;
  }
  return DEFAULT_COPY;
}

export function isDuplicate(error: unknown): boolean {
  return (error as ErrorLike | null)?.code === DUPLICATE_CODE;
}
