// Reconnection drafts. Combines event context, the author's own memories and the unfinished intent
// into an editable message. It is only ever a draft: nothing here sends anything.
import { z } from "zod";
import { DATA_RULES, dataPart, getLlm } from "./client.js";

export const PROMPT_VERSION = "reconnect.v1";

const Draft = z.object({
  whyNow: z.string().max(200).describe("One line shown to the author: why reconnecting now makes sense"),
  message: z.string().max(800).describe("The draft message to the other person, ready to edit"),
});
export type ReconnectDraft = z.infer<typeof Draft>;

export async function draftReconnection(input: {
  authorName: string;
  otherName: string;
  eventTitle: string | null;
  followUpReason: string;
  memories: Array<{ summary: string; createdAt: string }>;
  language: string;
  simpleLanguage: boolean;
}): Promise<ReconnectDraft> {
  return getLlm().generateJson({
    task: "reconnect.draft",
    promptVersion: PROMPT_VERSION,
    schema: Draft,
    system:
      "Write a short, warm, specific follow-up message from the author to someone they met at an event. " +
      "Mention where they met and the concrete thing the author wanted to follow up on. No flattery, no sales tone, under 90 words. " +
      `Write in language code "${input.language}".` +
      (input.simpleLanguage ? " Use plain, simple sentences." : "") +
      " The author will edit and send it themselves. " +
      DATA_RULES,
    parts: [
      dataPart("people", { author: input.authorName, other: input.otherName }),
      dataPart("event", { title: input.eventTitle }),
      dataPart("followUp", { reason: input.followUpReason }),
      dataPart("authorPrivateMemories", input.memories),
    ],
  });
}
