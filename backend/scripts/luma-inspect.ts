// See what Luma's MCP server really offers, from your own machine:
//   LUMA_CLIENT_ID=https://<your-api>/oauth/luma-client.json npm run luma:inspect
// Works on a laptop or in Cloud Shell (paste the callback address when asked).
// Signs you in to Luma in the browser, lists the tools, calls the one we'd use for "my events",
// and prints a sample of the raw output plus how we'd map it. Nothing is saved; the token is dropped at exit.
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";
import { argSets, fetchLumaEvents, finishLumaAuth, pickEventsTool, startLumaAuth, toolPayload, withLuma } from "../src/lib/lumaMcp.js";

const redirectUri = "http://localhost:8976/callback";
const state = randomBytes(16).toString("base64url");
const { url, codeVerifier } = await startLumaAuth(redirectUri, state);
console.log(`\nOpen this link and sign in to Luma:\n\n${url}\n`);
console.log("After you click Allow, your browser goes to a localhost:8976/callback address.");
console.log("On your own laptop this finishes by itself. In Cloud Shell the page won't load:");
console.log("copy the whole address from the browser bar and paste it here, then press Enter.\n");

// Accept the callback either in the browser (laptop) or pasted into the terminal (Cloud Shell).
const code = await new Promise<string>((resolve) => {
  const accept = (raw: string): string | null => {
    let u: URL;
    try {
      u = new URL(raw.trim().replace(/^["']|["']$/g, "").replace(/&amp;/g, "&"), redirectUri);
    } catch {
      return "That doesn't look like an address; paste the full localhost:8976/callback?... address.";
    }
    if (u.searchParams.get("error")) return `Luma said: ${u.searchParams.get("error")} ${u.searchParams.get("error_description") ?? ""}`;
    if (u.searchParams.get("state") !== state) return "That address is from a different sign-in. Use the link printed above, then paste the new address.";
    const c = u.searchParams.get("code");
    if (!c) return "No code in that address; paste the full address including ?code=...";
    done(c);
    return null;
  };
  const rl = createInterface({ input: process.stdin });
  const server = createServer((req, res) => {
    const u = new URL(req.url ?? "/", redirectUri);
    if (u.pathname !== "/callback") return void res.end();
    const problem = accept(u.toString());
    res.end(problem ?? "Done. You can close this tab.");
    if (problem) console.log(problem);
  }).listen(8976);
  rl.on("line", (line) => {
    if (!line.trim()) return;
    const problem = accept(line);
    if (problem) console.log(problem);
  });
  function done(c: string) {
    rl.close();
    server.close();
    resolve(c);
  }
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
