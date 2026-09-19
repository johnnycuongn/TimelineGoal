const NETWORK_COPY = "We couldn't reach the den. Check your connection and try again.";
const DEFAULT_COPY = "That didn't land. Try again?";
const DUPLICATE_CODE = "23505";
const CHECK_VIOLATION = "23514";
// postgrest-js catches a failed fetch and re-shapes it as a plain object whose message is
// `${name}: ${message}` — "TypeError: Failed to fetch". Match on the fragment, not equality,
// or an offline phone shows the browser's own wording in a toast. Every browser's real
// fetch failure is in this list, which is why the *name* "TypeError" is deliberately not:
// it would dress every programming error ("x is not a function") up as an offline message
// and hide the bug from the developer entirely.
const NETWORK_FRAGMENTS = ["Failed to fetch", "fetch failed", "Load failed", "NetworkError"];
const NETWORK_NAMES = ["FetchError"];

interface ErrorLike {
  message?: unknown;
  name?: unknown;
  code?: unknown;
  status?: unknown;
}

function isNetwork(e: ErrorLike): boolean {
  if (typeof e.name === "string" && NETWORK_NAMES.includes(e.name)) {
    return true;
  }
  const { message } = e;
  return typeof message === "string" && NETWORK_FRAGMENTS.some((f) => message.includes(f));
}

/**
 * Turns a Supabase/Postgres/auth error into copy the app can show as-is.
 * `fallback` is the caller's own line for an error that carries no message at all,
 * so a toast can stay in the voice of what the tap was ("That paw didn't land").
 */
export function friendlyError(error: unknown, fallback: string = DEFAULT_COPY): string {
  const e = (error ?? {}) as ErrorLike;
  if (e.code === DUPLICATE_CODE) {
    return "Already stamped.";
  }
  // A check constraint tripped. Never show Postgres' own wording for these.
  if (e.code === CHECK_VIOLATION) {
    return "That didn't fit. Have another look and try again?";
  }
  if (isNetwork(e)) {
    return NETWORK_COPY;
  }
  if (typeof e.message === "string" && e.message.length > 0) {
    if (e.message === "Invalid login credentials") {
      return "That email and password don't match. Try again?";
    }
    if (e.message.startsWith("Password should be")) {
      return "Pick a password with at least 6 characters.";
    }
    return e.message;
  }
  return fallback;
}

export function isDuplicate(error: unknown): boolean {
  return (error as ErrorLike | null)?.code === DUPLICATE_CODE;
}
