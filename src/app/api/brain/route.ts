import OpenAI from "openai";
import { buildUserMessage, SYSTEM_PROMPT } from "@/lib/brain/prompt";
import { BrainRequestSchema, extractJson, parseBrainOutput } from "@/lib/brain/schema";
import { serverConfig } from "@/lib/server/config";
import { readJsonBody, rejectCrossSite } from "@/lib/server/guard";

type Message = { role: "system" | "user" | "assistant"; content: string };

/**
 * One "tick" of the live note-taker: newest transcript + board state in,
 * validated notes and drawing ops out. Works with any OpenAI-compatible API
 * (OpenAI, Gemini, Groq, OpenRouter, OpenCode Zen, ...).
 */
export async function POST(request: Request) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  const { llm } = serverConfig();
  if (!llm.configured) {
    return Response.json({ error: "llm_not_configured" }, { status: 503 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = BrainRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const client = new OpenAI({ apiKey: llm.apiKey, baseURL: llm.baseURL, timeout: llm.timeoutMs, maxRetries: 1 });
  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserMessage(parsed.data) },
  ];

  const complete = async (msgs: Message[]) => {
    const res = await client.chat.completions.create({
      model: llm.model,
      messages: msgs,
      temperature: 0.2,
      ...(llm.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    });
    return res.choices[0]?.message?.content ?? "";
  };

  const started = Date.now();
  try {
    let text = await complete(messages);
    let raw: unknown;
    try {
      raw = extractJson(text);
    } catch {
      // One repair attempt: some models wrap JSON in prose despite instructions.
      text = await complete([...messages, { role: "assistant", content: text }, { role: "user", content: "That was not valid JSON. Reply with only the JSON object." }]);
      raw = extractJson(text);
    }
    const result = parseBrainOutput(raw);
    return Response.json({ ...result, latencyMs: Date.now() - started });
  } catch (err) {
    const message = err instanceof OpenAI.APIError ? `${err.status ?? ""} ${err.message}`.trim() : err instanceof Error ? err.message : "unknown error";
    return Response.json({ error: `LLM call failed: ${message}` }, { status: 502 });
  }
}
