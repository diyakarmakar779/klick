import { AiError, type JsonRequest, type LlmClient } from "../src/ai/client.js";

// Returns canned JSON per task, validated through the same Zod schema as production.
export class FakeLlm implements LlmClient {
  responses: Record<string, unknown> = {};
  fail = false;
  calls: JsonRequest<unknown>[] = [];
  async generateJson<T>(req: JsonRequest<T>): Promise<T> {
    this.calls.push(req as JsonRequest<unknown>);
    if (this.fail) throw new AiError("down", "unavailable");
    const parsed = req.schema.safeParse(this.responses[req.task]);
    if (!parsed.success) throw new AiError("bad output", "invalid_output");
    return parsed.data;
  }
}
