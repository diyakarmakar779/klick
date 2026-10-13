// See what Luma's MCP server really offers, from your own machine:
//   LUMA_CLIENT_ID=https://<your-api>/oauth/luma-client.json npm run luma:inspect
// Signs you in to Luma in the browser, lists the tools, calls the one we'd use for "my events",
// and prints a sample of the raw output plus how we'd map it. Nothing is saved; the token is dropped at exit.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { argSets, fetchLumaEvents, finishLumaAuth, pickEventsTool, startLumaAuth, toolPayload, withLuma } from "../src/lib/lumaMcp.js";

const redirectUri = "http://localhost:8976/callback";
const state = randomBytes(16).toString("base64url");
const { url, codeVerifier } = await startLumaAuth(redirectUri, state);
console.log(`\nOpen this link and sign in to Luma:\n\n${url}\n`);

const code = await new Promise<string>((resolve, reject) => {
  const server = createServer((req, res) => {
    const u = new URL(req.url ?? "/", redirectUri);
    if (u.pathname !== "/callback") return void res.end();
    res.end("Done. You can close this tab.");
    server.close();
    if (u.searchParams.get("state") !== state) return reject(new Error("state mismatch"));
    const c = u.searchParams.get("code");
    c ? resolve(c) : reject(new Error(u.searchParams.get("error") ?? "no code"));
  }).listen(8976);
});

const token = await finishLumaAuth({ code, codeVerifier, redirectUri });
await withLuma(token, async (client) => {
  const { tools } = await client.listTools();
  console.log("Tools:");
  for (const t of tools) console.log(`- ${t.name}: ${(t.description ?? "").split("\n")[0].slice(0, 110)}`);
  const tool = pickEventsTool(tools as never);
  console.log(`\nPicked: ${tool?.name ?? "(none, set LUMA_EVENTS_TOOL)"}`);
  if (!tool) return;
  for (const args of argSets(tool)) {
    const raw = toolPayload(await client.callTool({ name: tool.name, arguments: args }));
    console.log(`\nRaw output for ${JSON.stringify(args)} (first 3000 chars):\n${JSON.stringify(raw, null, 2).slice(0, 3000)}`);
  }
});
const mapped = await fetchLumaEvents(token);
console.log(`\nMapped ${mapped.length} events:`);
for (const e of mapped) console.log(`- ${e.title} | ${e.startsAt.toISOString()} | state=${e.state} raw=${e.rawState ?? "-"} | ${e.url ?? ""}`);
