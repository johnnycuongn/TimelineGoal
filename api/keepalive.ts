import type { VercelRequest, VercelResponse } from "@vercel/node";

const TIMEOUT_MS = 5000;
const OK = 200;
const UNAUTHORIZED = 401;
const SERVER_ERROR = 500;
const BAD_GATEWAY = 502;

/**
 * Supabase pauses free projects after 7 idle days. One REST read every few days counts
 * as activity. Public values only: the publishable key and the URL.
 *
 * Gated on CRON_SECRET, which Vercel Cron sends as `Authorization: Bearer …` on its own.
 * Without the gate the production URL is a free way for anyone to spend Hobby invocations
 * and Supabase egress in a loop. Nothing is parsed out of the upstream body either: a
 * paused project answers with an HTML error page, which is precisely the case this
 * endpoint exists for and precisely what would have crashed it.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(SERVER_ERROR).json({ ok: false, error: "CRON_SECRET is not set" });
    return;
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.status(UNAUTHORIZED).json({ ok: false, error: "Not for you." });
    return;
  }
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!(url && key)) {
    res
      .status(SERVER_ERROR)
      .json({ ok: false, error: "Supabase env vars are not set on this deployment." });
    return;
  }
  try {
    const upstream = await fetch(`${url}/rest/v1/keepalive?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    res.status(upstream.ok ? OK : BAD_GATEWAY).json({ ok: upstream.ok, status: upstream.status });
  } catch (error) {
    // A DNS failure, a TLS error or the 5 s timeout. Reported, not thrown: an unhandled
    // rejection here is an opaque Vercel 500 with nothing in the body to act on.
    res.status(BAD_GATEWAY).json({ ok: false, status: 0, error: String(error) });
  }
}
