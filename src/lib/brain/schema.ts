import { z } from "zod";
import { TEMPLATE_KINDS } from "@/lib/types";

export const MAX_CAPACITY = 12;
const label = z.string().trim().min(1).max(80);
const id = z.string().trim().min(1).max(40);
const sources = z.array(z.string().max(40)).max(20).optional().default([]);

export const OpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("start_section"),
    id,
    title: label,
    kind: z.enum(["question", "topic"]).default("topic"),
  }),
  z.object({
    op: z.literal("create_visual"),
    id,
    section: id.optional(),
    template: z.enum(TEMPLATE_KINDS),
    title: label.optional(),
    capacity: z.number().int().min(1).max(MAX_CAPACITY).optional(),
    columns: z.tuple([label, label]).optional(),
    why: z.string().trim().max(120).optional(),
  }),
  z.object({
    op: z.literal("fill_slot"),
    visual: id,
    index: z.number().int().min(0).max(MAX_CAPACITY - 1).optional(),
    label,
    detail: z.string().trim().max(120).optional(),
    column: z.union([z.literal(0), z.literal(1)]).optional(),
    source: sources,
  }),
  z.object({
    op: z.literal("update_slot"),
    visual: id,
    index: z.number().int().min(0).max(MAX_CAPACITY - 1),
    label: label.optional(),
    detail: z.string().trim().max(120).optional(),
  }),
  z.object({
    op: z.literal("resize_visual"),
    visual: id,
    capacity: z.number().int().min(1).max(MAX_CAPACITY),
  }),
  z.object({
    op: z.literal("convert_visual"),
    visual: id,
    template: z.enum(TEMPLATE_KINDS),
    why: z.string().trim().max(120).optional(),
  }),
  z.object({ op: z.literal("set_columns"), visual: id, columns: z.tuple([label, label]) }),
  z.object({ op: z.literal("set_active"), visual: id }),
]);
export type Op = z.infer<typeof OpSchema>;

export const NoteSchema = z.object({
  kind: z.enum(["point", "followup", "quote", "action"]),
  text: z.string().trim().min(1).max(200),
  source: sources,
});
export type BrainNote = z.infer<typeof NoteSchema>;

export type BrainResult = {
  notes: BrainNote[];
  ops: Op[];
  resolvedFollowups: string[];
  /** Items the model returned that failed validation (for diagnostics only). */
  dropped: number;
};

/**
 * Lenient parse: a single malformed op or note is dropped instead of
 * rejecting the whole response, so one bad item never blanks a tick.
 */
export function parseBrainOutput(raw: unknown): BrainResult {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  let dropped = 0;

  const ops: Op[] = [];
  for (const item of Array.isArray(obj.ops) ? obj.ops : []) {
    const r = OpSchema.safeParse(item);
    if (r.success) ops.push(r.data);
    else dropped++;
  }

  const notes: BrainNote[] = [];
  for (const item of Array.isArray(obj.notes) ? obj.notes : []) {
    const r = NoteSchema.safeParse(item);
    if (r.success) notes.push(r.data);
    else dropped++;
  }

  const resolvedFollowups = (Array.isArray(obj.resolved_followups) ? obj.resolved_followups : [])
    .filter((x): x is string => typeof x === "string")
    .slice(0, 20);

  return { notes, ops, resolvedFollowups, dropped };
}

/** Extract the first JSON object from model text (handles ```json fences and chatter). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in model output");
  return JSON.parse(text.slice(start, end + 1));
}

/** Request body sent from the browser to /api/brain. */
export const BrainRequestSchema = z.object({
  segments: z
    .array(
      z.object({
        id: z.string().max(40),
        speaker: z.string().max(40),
        text: z.string().max(4000),
        isNew: z.boolean(),
      }),
    )
    .max(80),
  board: z.string().max(12000),
  openFollowups: z.array(z.object({ id: z.string().max(40), text: z.string().max(200) })).max(20),
  recentNotes: z.array(z.string().max(200)).max(30),
  nextIds: z.object({ section: z.string().max(20), visual: z.string().max(20) }),
  mapLanguage: z.string().max(40),
  spokenLanguages: z.array(z.string().max(40)).max(6),
});
export type BrainRequest = z.infer<typeof BrainRequestSchema>;
