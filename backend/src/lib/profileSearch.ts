// Find the member's own public LinkedIn profile from their Google name and email, for "Is this you?".
// LinkedIn has no lookup API and scraping it breaks its terms, so this asks a web search API (Brave Search)
// for public linkedin.com/in pages and keeps only what the search result itself shows: link, title, snippet.
// LinkedIn is never fetched, and results are not stored unless the member picks one as theirs.

export interface ProfileMatch {
  url: string; // https://www.linkedin.com/in/<slug>
  name: string;
  headline: string;
  snippet: string;
}

interface SearchResult {
  url: string;
  title: string;
  description?: string;
}

// Mail providers whose domain says nothing about where someone works.
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "yahoo.co.in",
  "icloud.com", "me.com", "proton.me", "protonmail.com", "rediffmail.com", "aol.com", "zoho.com",
]);

// "diya@execora.in" -> "execora". Free mail gives no hint.
export function companyHint(email: string | null | undefined): string | null {
  const domain = email?.split("@")[1]?.toLowerCase();
  if (!domain || FREE_MAIL.has(domain)) return null;
  const label = domain.split(".")[0];
  return label && label.length > 1 ? label : null;
}

const PROFILE_URL = /^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([^/?#]+)/i;

const clean = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

// Search titles look like "Diya Karmakar - Founder - Execora | LinkedIn".
export function parseResult(r: SearchResult): ProfileMatch | null {
  const m = PROFILE_URL.exec(r.url);
  if (!m) return null;
  const parts = clean(r.title).replace(/\s*\|\s*LinkedIn.*$/i, "").split(/\s+[-–—]\s+/);
  const name = parts[0]?.trim();
  if (!name) return null;
  return {
    url: `https://www.linkedin.com/in/${decodeURIComponent(m[1]).toLowerCase()}`,
    name,
    headline: parts.slice(1).join(" · ").slice(0, 140),
    snippet: clean(r.description ?? "").slice(0, 240),
  };
}

const tokens = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);

// Best guess first: the name matches, then the email's company shows up in the result.
export function rankMatches(matches: ProfileMatch[], name: string, hint: string | null): ProfileMatch[] {
  const want = tokens(name);
  const score = (p: ProfileMatch) => {
    const have = new Set(tokens(p.name));
    const nameHits = want.filter((t) => have.has(t)).length / Math.max(want.length, 1);
    const text = `${p.headline} ${p.snippet} ${p.url}`.toLowerCase();
    return nameHits * 2 + (hint && text.includes(hint) ? 1 : 0);
  };
  const seen = new Set<string>();
  return matches
    .filter((p) => !seen.has(p.url) && seen.add(p.url))
    .map((p, i) => ({ p, s: score(p), i }))
    .filter(({ s }) => s >= 1) // at least half the name matches
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ p }) => p);
}

async function braveSearch(query: string): Promise<SearchResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) throw new Error("profile_search_not_configured");
  const q = new URLSearchParams({ q: query, count: "10", safesearch: "strict" });
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${q}`, {
    headers: { accept: "application/json", "x-subscription-token": key },
  });
  if (res.status === 429) throw new Error("profile_search_rate_limited");
  if (!res.ok) throw new Error("profile_search_failed");
  const data = (await res.json()) as { web?: { results?: SearchResult[] } };
  return data.web?.results ?? [];
}

export async function searchLinkedInProfiles(name: string, email: string | null | undefined, limit = 6): Promise<ProfileMatch[]> {
  const hint = companyHint(email);
  const base = `site:linkedin.com/in "${name.replace(/"/g, "")}"`;
  let results = await braveSearch(hint ? `${base} ${hint}` : base);
  // The company hint can be too narrow (a side project, an old job); fall back to the name alone.
  if (hint && !results.some((r) => PROFILE_URL.test(r.url))) results = await braveSearch(base);
  const parsed = results.map(parseResult).filter((p): p is ProfileMatch => p !== null);
  return rankMatches(parsed, name, hint).slice(0, limit);
}
