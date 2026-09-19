import type { VercelRequest, VercelResponse } from "@vercel/node";

// Supabase pauses free projects after 7 idle days. One REST read every few days
// counts as activity. Public values only: the publishable key and the URL.
export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!(url && key)) {
    res.status(500).json({ ok: false, error: "Supabase env vars are not set on this deployment." });
    return;
  }
  const upstream = await fetch(`${url}/rest/v1/keepalive?select=id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const rows = (await upstream.json()) as unknown[];
  res
    .status(upstream.ok ? 200 : 502)
    .json({ ok: upstream.ok, rows: Array.isArray(rows) ? rows.length : 0 });
}
