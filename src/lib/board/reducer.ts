import type { Op } from "@/lib/brain/schema";
import { MAX_CAPACITY } from "@/lib/brain/schema";
import type { Board, Section, Slot, Visual } from "@/lib/types";

const FALLBACK_SECTION_ID = "s_general";

function ensureSection(board: Board, preferredId?: string): { board: Board; sectionId: string } {
  if (preferredId && board.sections.some((s) => s.id === preferredId)) {
    return { board, sectionId: preferredId };
  }
  if (board.activeSectionId && board.sections.some((s) => s.id === board.activeSectionId)) {
    return { board, sectionId: board.activeSectionId };
  }
  const last = board.sections[board.sections.length - 1];
  if (last) return { board, sectionId: last.id };
  const section: Section = { id: FALLBACK_SECTION_ID, title: "Conversation", kind: "topic", visualIds: [] };
  return { board: { ...board, sections: [section] }, sectionId: section.id };
}

/** Keep slots index-aligned with capacity; never drop a filled slot. */
function withCapacity(slots: (Slot | null)[], capacity: number): (Slot | null)[] {
  let lastFilled = -1;
  slots.forEach((s, i) => {
    if (s) lastFilled = i;
  });
  const size = Math.min(MAX_CAPACITY, Math.max(capacity, lastFilled + 1));
  const next = slots.slice(0, size);
  while (next.length < size) next.push(null);
  return next;
}

function updateVisual(board: Board, visual: Visual): Board {
  return { ...board, visuals: { ...board.visuals, [visual.id]: visual } };
}

function activate(board: Board, visual: Visual): Board {
  return { ...board, activeVisualId: visual.id, activeSectionId: visual.sectionId };
}

export function applyOp(board: Board, op: Op): Board {
  switch (op.op) {
    case "start_section": {
      if (board.sections.some((s) => s.id === op.id)) {
        return { ...board, activeSectionId: op.id };
      }
      const section: Section = { id: op.id, title: op.title, kind: op.kind, visualIds: [] };
      return { ...board, sections: [...board.sections, section], activeSectionId: op.id };
    }

    case "create_visual": {
      const existing = board.visuals[op.id];
      if (existing) return activate(board, existing);
      const ensured = ensureSection(board, op.section);
      const visual: Visual = {
        id: op.id,
        sectionId: ensured.sectionId,
        template: op.template,
        title: op.title,
        capacity: op.capacity ?? 0,
        slots: withCapacity([], op.capacity ?? 0),
        columns: op.columns,
        why: op.why,
      };
      const sections = ensured.board.sections.map((s) =>
        s.id === ensured.sectionId ? { ...s, visualIds: [...s.visualIds, visual.id] } : s,
      );
      return activate(updateVisual({ ...ensured.board, sections }, visual), visual);
    }

    case "fill_slot": {
      const visual = board.visuals[op.visual];
      if (!visual) return board;
      let index = op.index;
      if (index === undefined) {
        const firstEmpty = visual.slots.findIndex((s) => s === null);
        index = firstEmpty === -1 ? visual.slots.length : firstEmpty;
      }
      if (index >= MAX_CAPACITY) return board;
      const slots = withCapacity(visual.slots, Math.max(visual.capacity, index + 1));
      slots[index] = { label: op.label, detail: op.detail, column: op.column };
      const next: Visual = { ...visual, slots, capacity: Math.max(visual.capacity, index + 1) };
      return { ...activate(updateVisual(board, next), next), lastTouched: { visualId: next.id, index } };
    }

    case "update_slot": {
      const visual = board.visuals[op.visual];
      if (!visual) return board;
      const current = visual.slots[op.index];
      if (!current) {
        if (!op.label) return board;
        return applyOp(board, { op: "fill_slot", visual: op.visual, index: op.index, label: op.label, detail: op.detail, source: [] });
      }
      const slots = [...visual.slots];
      slots[op.index] = { ...current, label: op.label ?? current.label, detail: op.detail ?? current.detail };
      const next: Visual = { ...visual, slots };
      return { ...activate(updateVisual(board, next), next), lastTouched: { visualId: next.id, index: op.index } };
    }

    case "resize_visual": {
      const visual = board.visuals[op.visual];
      if (!visual) return board;
      const slots = withCapacity(visual.slots, op.capacity);
      return updateVisual(board, { ...visual, slots, capacity: slots.length });
    }

    case "convert_visual": {
      const visual = board.visuals[op.visual];
      if (!visual || visual.locked || visual.template === op.template) return board;
      return updateVisual(board, convertTemplate(visual, op.template, op.why));
    }

    case "set_columns": {
      const visual = board.visuals[op.visual];
      return visual ? updateVisual(board, { ...visual, columns: op.columns }) : board;
    }

    case "set_active": {
      const visual = board.visuals[op.visual];
      return visual ? activate(board, visual) : board;
    }
  }
}

function convertTemplate(visual: Visual, template: Visual["template"], why?: string): Visual {
  return { ...visual, template, why: why ?? visual.why };
}

/** The host picks a shape by hand; it sticks, and the AI can no longer convert it. */
export function overrideTemplate(board: Board, visualId: string, template: Visual["template"]): Board {
  const visual = board.visuals[visualId];
  if (!visual) return board;
  return updateVisual(board, { ...convertTemplate(visual, template, "chosen by host"), locked: true });
}

export function applyOps(board: Board, ops: Op[]): Board {
  return ops.reduce(applyOp, board);
}

/** Compact text form of the board for the LLM prompt. */
export function summarizeBoard(board: Board): string {
  if (board.sections.length === 0) return "(empty board)";
  const lines: string[] = [];
  for (const section of board.sections) {
    const active = section.id === board.activeSectionId ? " [ACTIVE]" : "";
    lines.push(`section ${section.id} (${section.kind}): "${section.title}"${active}`);
    for (const vid of section.visualIds) {
      const v = board.visuals[vid];
      if (!v) continue;
      const slots = v.slots
        .map((s, i) => (s ? `${i}:"${s.label}"${s.column !== undefined ? `(col ${s.column})` : ""}` : `${i}:EMPTY`))
        .join(", ");
      const cols = v.columns ? ` columns=["${v.columns[0]}","${v.columns[1]}"]` : v.template === "comparison" ? " columns=MISSING" : "";
      const lock = v.locked ? " LOCKED" : "";
      const why = v.why && !v.locked ? ` why="${v.why}"` : "";
      lines.push(`  visual ${v.id} ${v.template}${lock}${v.title ? ` "${v.title}"` : ""}${cols}${why} capacity=${v.capacity} slots=[${slots}]`);
    }
  }
  return lines.join("\n");
}
