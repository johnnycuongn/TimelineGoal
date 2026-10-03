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

/** Only ever a path inside the app: one leading slash, never `//host`. */
export function safePath(url: unknown): string {
  return typeof url === "string" && /^\/(?!\/)/.test(url) ? url : HOME;
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
