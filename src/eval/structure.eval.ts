/**
 * Live-model evaluation: does the AI pick the right shape when nobody names it?
 * Run with keys in .env.local:  pnpm eval
 * Each case is fed one line per tick through the real prompt, schema and reducer,
 * exactly like a live session, and the final board is scored.
 */
import OpenAI from "openai";
import { afterAll, describe, expect, it } from "vitest";
import { applyOps, summarizeBoard } from "@/lib/board/reducer";
import { buildUserMessage, SYSTEM_PROMPT } from "@/lib/brain/prompt";
import { extractJson, parseBrainOutput, type BrainRequest } from "@/lib/brain/schema";
import { EMPTY_BOARD, type Board } from "@/lib/types";
import { STRUCTURE_CASES, type StructureCase } from "./cases";

const apiKey = process.env.LLM_API_KEY;
const model = process.env.LLM_MODEL;
const configured = Boolean(apiKey && model);
const client = configured ? new OpenAI({ apiKey, baseURL: process.env.LLM_BASE_URL || undefined, timeout: Number(process.env.LLM_TIMEOUT_MS) || 60_000 }) : null;
const jsonMode = (process.env.LLM_JSON_MODE ?? "on").toLowerCase() !== "off";
const PASS_RATE = 0.8;

type Outcome = { name: string; pass: boolean; got: string; why: string };
const outcomes: Outcome[] = [];

function nextId(prefix: string, ids: string[]): string {
  const max = ids.reduce((m, id) => (id.startsWith(prefix) && Number.isFinite(Number(id.slice(prefix.length))) ? Math.max(m, Number(id.slice(prefix.length))) : m), 0);
  return `${prefix}${max + 1}`;
}

async function runCase(c: StructureCase): Promise<Board> {
  let board = EMPTY_BOARD;
  const segments: BrainRequest["segments"] = [];
  for (const [i, line] of c.lines.entries()) {
    segments.forEach((s) => (s.isNew = false));
    segments.push({ id: `seg${i + 1}`, speaker: line.speaker, text: line.text, isNew: true });
    const req: BrainRequest = {
      segments,
      board: summarizeBoard(board),
      openFollowups: [],
      recentNotes: [],
      nextIds: { section: nextId("s", board.sections.map((s) => s.id)), visual: nextId("v", Object.keys(board.visuals)) },
      mapLanguage: "English",
      spokenLanguages: ["en", "ta", "hi"],
    };
    const res = await client!.chat.completions.create({
      model: model!,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(req) },
      ],
      ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    });
    const result = parseBrainOutput(extractJson(res.choices[0]?.message?.content ?? "{}"));
    board = applyOps(board, result.ops);
  }
  return board;
}

function score(c: StructureCase, board: Board): Outcome {
  const visuals = Object.values(board.visuals);
  const got = visuals.map((v) => `${v.template}[${v.slots.map((s) => s?.label ?? "_").join(", ")}]`).join(" ; ") || "(no visual)";
  const why = visuals.map((v) => v.why).filter(Boolean).join(" ; ");
  const forbidden = visuals.some((v) => c.forbid?.includes(v.template));
  let pass = !forbidden && (c.expect.length === 0 || visuals.some((v) => c.expect.includes(v.template)));
  if (pass && c.baseContains) {
    const layered = visuals.find((v) => v.template === "pyramid");
    pass = Boolean(layered?.slots[0]?.label.toLowerCase().includes(c.baseContains));
  }
  return { name: c.name, pass, got, why };
}

describe.skipIf(!configured)(`shape choice without keywords (${model})`, () => {
  it.each(STRUCTURE_CASES.map((c) => [c.name, c] as const))("%s", async (_name, c) => {
    const outcome = score(c, await runCase(c));
    outcomes.push(outcome);
    // Individual misses are reported, not thrown; the suite gate is the overall pass rate.
    expect(outcome.got).toBeTypeOf("string");
  });

  afterAll(() => {
    const passed = outcomes.filter((o) => o.pass).length;
    console.log(`\nShape accuracy: ${passed}/${outcomes.length}`);
    for (const o of outcomes) console.log(`${o.pass ? "PASS" : "FAIL"}  ${o.name}\n      got: ${o.got}${o.why ? `\n      why: ${o.why}` : ""}`);
    expect(passed / Math.max(outcomes.length, 1)).toBeGreaterThanOrEqual(PASS_RATE);
  });
});

describe.skipIf(configured)("shape choice eval", () => {
  it("is skipped: set LLM_API_KEY and LLM_MODEL in .env.local to run it", () => undefined);
});
