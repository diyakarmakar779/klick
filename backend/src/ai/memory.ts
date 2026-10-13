// Memory structuring: a note or voice recording becomes a reviewable summary, topics, promises and an
// optional follow-up. The member reviews and edits before anything is saved as final.
import { z } from "zod";
import type { Part } from "@google/genai";
import { DATA_RULES, dataPart, getLlm } from "./client.js";

export const PROMPT_VERSION = "memory.v1";

export const MemoryExtraction = z.object({
  transcript: z.string().max(5000).nullable().describe("Verbatim transcript if audio was given, else null"),
  summary: z.string().max(400).describe("2-3 sentences in the author's voice: who, what was discussed, why it mattered"),
  topics: z.array(z.string().max(40)).max(6),
  promises: z
    .array(
      z.object({
        text: z.string().max(200),
        owner: z.enum(["me", "them"]).describe("Who promised: the note's author (me) or the other person (them)"),
      }),
    )
    .max(5),
  followUp: z
    .object({
      reason: z.string().max(200).describe("Why to reconnect, in the author's words"),
      dueInDays: z.number().int().min(0).max(180).describe("Days from today, from phrases like 'next week' (7); default 7"),
    })
    .nullable(),
});
export type MemoryExtraction = z.infer<typeof MemoryExtraction>;

export async function extractMemory(input: {
  text: string | null;
  audio: { gcsUri: string; mimeType: string } | null;
  otherName: string | null;
  eventTitle: string | null;
  language: string;
}): Promise<MemoryExtraction> {
  const parts: Part[] = [dataPart("context", { otherPerson: input.otherName, event: input.eventTitle, authorLanguage: input.language })];
  if (input.text) parts.push(dataPart("note", input.text));
  if (input.audio) parts.push({ fileData: { fileUri: input.audio.gcsUri, mimeType: input.audio.mimeType } });
  return getLlm().generateJson({
    task: "memory.extract",
    promptVersion: PROMPT_VERSION,
    schema: MemoryExtraction,
    system:
      "You turn a person's quick note or voice memo about someone they just met into a private memory card. " +
      "Transcribe audio faithfully. Summarise only what was said. List promises exactly as stated. " +
      "Propose a follow-up only if the note implies one. Write in the author's language. " +
      DATA_RULES,
    parts,
  });
}
