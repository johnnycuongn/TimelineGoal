// What the service worker shows for a push. Pure and DOM-free so it compiles for both
// the app and the worker, and so a malformed or hostile payload is tested here.

export interface NotificationView {
  title: string;
  body: string;
  url: string;
  tag: string | undefined;
}

const TITLE = "CoupleGoal";
const FALLBACK_BODY = "Something happened in your den.";
const HOME = "/den";

/**
 * Only ever a path inside the app. Parsed rather than pattern-matched: the URL parser
 * drops tab/CR/LF and reads `\\` as `/`, so `/\t/evil.com` is really `//evil.com`.
 */
export function safePath(url: unknown, origin = "https://app.invalid"): string {
  if (typeof url !== "string" || !url.startsWith("/")) {
    return HOME;
  }
  try {
    const u = new URL(url, origin);
    return u.origin === origin ? u.pathname + u.search + u.hash : HOME;
  } catch {
    return HOME;
  }
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function notificationFromPush(raw: string | null): NotificationView {
  if (!raw) {
    return { title: TITLE, body: FALLBACK_BODY, url: HOME, tag: undefined };
  }
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("not an object");
    }
    data = parsed as Record<string, unknown>;
  } catch {
    return { title: TITLE, body: raw, url: HOME, tag: undefined };
  }
  return {
    title: text(data.title) ?? TITLE,
    body: text(data.body) ?? FALLBACK_BODY,
    url: safePath(data.url),
    tag: text(data.tag),
  };
}
