import { afterEach, describe, expect, it, vi } from "vitest";
import { companyHint, parseResult, rankMatches, searchLinkedInProfiles } from "../../src/lib/profileSearch.js";

describe("LinkedIn profile search", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BRAVE_SEARCH_API_KEY;
  });

  it("takes a company hint from work email only", () => {
    expect(companyHint("diya@execora.in")).toBe("execora");
    expect(companyHint("diya@gmail.com")).toBeNull();
    expect(companyHint(undefined)).toBeNull();
  });

  it("keeps only public profile pages and splits the title", () => {
    expect(
      parseResult({
        url: "https://in.linkedin.com/in/Diya-K?trk=x",
        title: "Diya Karmakar - Founder - Execora | LinkedIn",
        description: "Building <strong>Execora</strong> &amp; Klick.",
      }),
    ).toEqual({
      url: "https://www.linkedin.com/in/diya-k",
      name: "Diya Karmakar",
      headline: "Founder · Execora",
      snippet: "Building Execora & Klick.",
    });
    expect(parseResult({ url: "https://www.linkedin.com/company/execora", title: "Execora | LinkedIn" })).toBeNull();
    expect(parseResult({ url: "https://www.linkedin.com/posts/diya_abc", title: "Diya on LinkedIn" })).toBeNull();
  });

  it("puts the name and company match first and drops other names", () => {
    const p = (url: string, name: string, headline = "") => ({ url, name, headline, snippet: "" });
    const ranked = rankMatches(
      [p("a", "Diya Karmakar", "Student"), p("b", "Diya Karmakar", "Founder at Execora"), p("c", "Rahul Shah"), p("a", "Diya Karmakar")],
      "Diya Karmakar",
      "execora",
    );
    expect(ranked.map((r) => r.url)).toEqual(["b", "a"]);
  });

  it("says it isn't set up without a key", async () => {
    await expect(searchLinkedInProfiles("Diya Karmakar", "diya@gmail.com")).rejects.toThrow("profile_search_not_configured");
  });

  it("falls back to the name alone when the company search finds nothing", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "k";
    const queries: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      const q = new URL(url).searchParams.get("q")!;
      queries.push(q);
      const results = q.includes("execora")
        ? []
        : [{ url: "https://www.linkedin.com/in/diya-k", title: "Diya Karmakar - Founder | LinkedIn" }];
      return new Response(JSON.stringify({ web: { results } }));
    });
    const matches = await searchLinkedInProfiles("Diya Karmakar", "diya@execora.in");
    expect(queries).toEqual(['site:linkedin.com/in "Diya Karmakar" execora', 'site:linkedin.com/in "Diya Karmakar"']);
    expect(matches.map((m) => m.url)).toEqual(["https://www.linkedin.com/in/diya-k"]);
  });
});
