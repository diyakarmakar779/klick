// Contextual match ranking. Eligibility (opted in, confirmed, not blocked) is decided before this runs;
// Gemini only orders the eligible people and explains why, citing facts it was given.
import { z } from "zod";
import { AiError, DATA_RULES, dataPart, getLlm } from "./client.js";

export const PROMPT_VERSION = "match.v1";

export interface MatchFacts {
  memberId: string;
  name: string;
  headline: string;
  role: string;
  company: string;
  interests: string[];
  eventGoal: string | null;
  lookingFor: string[];
  offering: string[];
  topics: string[];
}

const Evidence = z.object({
  mine: z.string().describe("Exact phrase from the seeker's facts"),
  theirs: z.string().describe("Exact phrase from the candidate's facts"),
});
const Ranked = z.object({
  matches: z
    .array(
      z.object({
        memberId: z.string(),
        score: z.number().min(0).max(100),
        reason: z.string().max(300).describe("One or two sentences, addressed to the seeker"),
        evidence: z.array(Evidence).min(1).max(3),
        starter: z.string().max(200).describe("A friendly, low-pressure opening line"),
      }),
    )
    .max(10),
});

export interface Match {
  memberId: string;
  score: number;
  reason: string;
  evidence: Array<{ mine: string; theirs: string }>;
  starter: string;
  source: "gemini" | "overlap";
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const factText = (f: MatchFacts) =>
  norm([f.name, f.headline, f.role, f.company, f.eventGoal ?? "", ...f.interests, ...f.lookingFor, ...f.offering, ...f.topics].join(" | "));

// Deterministic overlap: used to cap what Gemini sees and as the fallback when Gemini is down.
export function overlapRank(me: MatchFacts, candidates: MatchFacts[]): Match[] {
  const mine = new Set([...me.interests, ...me.topics, ...me.lookingFor].map(norm));
  return candidates
    .map((c) => {
      const theirs = [...c.interests, ...c.topics, ...c.offering].map(norm);
      const shared = theirs.filter((t) => mine.has(t));
      return {
        memberId: c.memberId,
        score: Math.min(100, shared.length * 25),
        reason: shared.length ? `You both listed ${shared.slice(0, 2).join(" and ")}.` : `${c.name} is also attending.`,
        evidence: shared.slice(0, 3).map((s) => ({ mine: s, theirs: s })),
        starter: `Hi ${c.name.split(" ")[0]}, I saw we're both at this event. Would you like to chat?`,
        source: "overlap" as const,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export async function rankMatches(
  me: MatchFacts,
  eventTitle: string,
  candidates: MatchFacts[],
): Promise<{ matches: Match[]; ai: boolean }> {
  if (candidates.length === 0) return { matches: [], ai: true };
  const pool = overlapRank(me, candidates).slice(0, 20).map((m) => candidates.find((c) => c.memberId === m.memberId)!);
  try {
    const out = await getLlm().generateJson({
      task: "match.rank",
      promptVersion: PROMPT_VERSION,
      schema: Ranked,
      system:
        "You help one person at an event decide who to meet. Rank the candidates by how well they fit the seeker's goal for this event " +
        "and what they are looking for, favouring complementary needs (one seeks what the other offers) over mere shared interests. " +
        "For each match give a short reason addressed to the seeker, 1-3 evidence pairs quoting exact phrases from both sides, and a warm opening line. " +
        "Return at most 5 matches; omit weak ones. Never comment on protected traits. " +
        DATA_RULES,
      parts: [dataPart("event", { title: eventTitle }), dataPart("seeker", me), dataPart("candidates", pool)],
    });
    const byId = new Map(pool.map((c) => [c.memberId, c]));
    const myText = factText(me);
    const matches = out.matches
      .filter((m) => byId.has(m.memberId)) // drop invented people
      .map((m) => ({
        ...m,
        // Keep only evidence that really appears in the supplied facts.
        evidence: m.evidence.filter((e) => myText.includes(norm(e.mine)) && factText(byId.get(m.memberId)!).includes(norm(e.theirs))),
        source: "gemini" as const,
      }))
      .filter((m) => m.evidence.length > 0)
      .sort((a, b) => b.score - a.score);
    return { matches, ai: true };
  } catch (e) {
    if (!(e instanceof AiError)) throw e;
    return { matches: overlapRank(me, candidates).slice(0, 5), ai: false };
  }
}
