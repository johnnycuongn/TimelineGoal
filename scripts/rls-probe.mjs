// Signed out, the publishable key must see nothing in any couple table and
// exactly one keepalive row. Rows back from a couple table means RLS is off.
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!(url && key)) {
  console.error("Missing env. Run: node --env-file=.env.local scripts/rls-probe.mjs");
  process.exit(2);
}
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const tables = ["couples", "members", "goals", "goal_seals", "checkins", "reactions"];
let failed = false;
for (const table of tables) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=5`, { headers });
  const body = await res.json();
  const ok = res.ok && Array.isArray(body) && body.length === 0;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${table}: ${res.status} ${Array.isArray(body) ? `${body.length} rows` : JSON.stringify(body)}`,
  );
  failed ||= !ok;
}
const ping = await fetch(`${url}/rest/v1/keepalive?select=id`, { headers });
const rows = await ping.json();
const pingOk = ping.ok && Array.isArray(rows) && rows.length === 1;
console.log(`${pingOk ? "ok  " : "FAIL"} keepalive: ${ping.status}`);
failed ||= !pingOk;
const rpc = await fetch(`${url}/rest/v1/rpc/mint_invite_code`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: "{}",
});
const rpcOk = !rpc.ok;
console.log(`${rpcOk ? "ok  " : "FAIL"} mint_invite_code refused signed-out: ${rpc.status}`);
failed ||= !rpcOk;
process.exit(failed ? 1 : 0);
