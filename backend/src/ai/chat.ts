// Klick AI: answers a member's questions about one of their events. The server gathers what the member is
// allowed to see (their Klicks going, people who chose to be found, their own memories and goals, events their
// Klicks are going to) and the model only picks from it by id. It can draft messages; it never sends anything.
import { z } from "zod";
import { DATA_RULES, dataPart, getLlm } from "./client.js";

export const PROMPT_VERSION = "chat.v1";

const Answer = z.object({
  text: z.string().max(1500).describe("The answer, addressed to the member, in plain sentences. Drafts go here too."),
  people: z
    .array(z.object({ id: z.string().describe("An id from klicksGoing or worthMeeting"), reason: z.string().max(300).describe("Why this person, one sentence") }))
    .max(6)
    .describe("People the answer is about, in the order to show them. Empty if none."),
  eventIds: z.array(z.string()).max(5).describe("Ids from otherEvents the answer recommends. Empty if none."),
  sources: z.array(z.string()).max(4).describe("Keys from the sources list for the data the answer used"),
  suggestions: z.array(z.string().max(60)).max(3).describe("Short follow-up questions the member might ask next"),
});
export type ChatAnswer = z.infer<typeof Answer>;

export interface ChatContext {
  event: unknown;
  me: unknown;
  klicksGoing: unknown[];
  worthMeeting: unknown[];
  otherEvents: unknown[];
  sources: Array<{ key: string; label: string }>;
  history: Array<{ role: "me" | "ai"; text: string }>;
  language: string;
  simpleLanguage: boolean;
}

export async function answerChat(question: string, ctx: ChatContext): Promise<ChatAnswer> {
  return getLlm().generateJson({
    task: "chat.answer",
    promptVersion: PROMPT_VERSION,
    schema: Answer,
    system:
      "You are Klick AI, helping a member get the most out of one event they are going to. " +
      "Answer their question in under 90 words, warmly and specifically, using only the data given. " +
      "klicksGoing are people the member already Klicked with who are going; their memories are the member's own private notes. " +
      "worthMeeting are other people at the event who chose to be found; suggest them by what they listed, never guess anything else about them. " +
      "otherEvents are upcoming events the member isn't part of, where their Klicks are going. " +
      "Only list people and events by the ids given. If the data can't answer the question, say so briefly. " +
      "If asked to draft a message, write it in the text for the member to copy and send themselves; never say you sent anything. " +
      `Write in language code "${ctx.language}".` +
      (ctx.simpleLanguage ? " Use plain, simple sentences." : "") +
      " " +
      DATA_RULES,
    parts: [
      dataPart("event", ctx.event),
      dataPart("me", ctx.me),
      dataPart("klicksGoing", ctx.klicksGoing),
      dataPart("worthMeeting", ctx.worthMeeting),
      dataPart("otherEvents", ctx.otherEvents),
      dataPart("sources", ctx.sources),
      dataPart("earlierInThisChat", ctx.history),
      dataPart("question", question),
    ],
  });
}
