import { describe, expect, it } from "vitest";
import { EMPTY_BOARD, TEMPLATE_KINDS, type Board } from "@/lib/types";
import type { Op } from "@/lib/brain/schema";
import { applyOps, overrideTemplate, summarizeBoard } from "./reducer";
import { LAYOUT, layoutBoard } from "./layout";
import type { RectShape, Shape } from "./shapes";
import { renderVisual } from "./templates";

const fourMethods: Op[] = [
  { op: "start_section", id: "s1", title: "How do you get customers?", kind: "question" },
  { op: "create_visual", id: "v1", template: "grid", title: "4 methods", capacity: 4 },
  { op: "fill_slot", visual: "v1", label: "Instagram reels", detail: "3 a day", source: [] },
  { op: "fill_slot", visual: "v1", label: "WhatsApp community", source: [] },
];

describe("reducer", () => {
  it("announces slots, then fills them in order", () => {
    const b = applyOps(EMPTY_BOARD, fourMethods);
    const v = b.visuals.v1;
    expect(v.capacity).toBe(4);
    expect(v.slots.map((s) => s?.label ?? null)).toEqual(["Instagram reels", "WhatsApp community", null, null]);
    expect(b.lastTouched).toEqual({ visualId: "v1", index: 1 });
    expect(b.activeSectionId).toBe("s1");
  });

  it("grows when more items arrive than were announced", () => {
    const b = applyOps(EMPTY_BOARD, [
      ...fourMethods,
      { op: "fill_slot", visual: "v1", label: "c", source: [] },
      { op: "fill_slot", visual: "v1", label: "d", source: [] },
      { op: "fill_slot", visual: "v1", label: "e", source: [] },
    ]);
    expect(b.visuals.v1.capacity).toBe(5);
    expect(b.visuals.v1.slots).toHaveLength(5);
  });

  it("resize never drops filled slots", () => {
    const b = applyOps(EMPTY_BOARD, [...fourMethods, { op: "resize_visual", visual: "v1", capacity: 1 }]);
    expect(b.visuals.v1.slots.filter(Boolean)).toHaveLength(2);
    expect(b.visuals.v1.capacity).toBe(2);
  });

  it("convert keeps labels", () => {
    const b = applyOps(EMPTY_BOARD, [...fourMethods, { op: "convert_visual", visual: "v1", template: "cycle" }]);
    expect(b.visuals.v1.template).toBe("cycle");
    expect(b.visuals.v1.slots[0]?.label).toBe("Instagram reels");
  });

  it("ignores ops that reference unknown visuals", () => {
    const b = applyOps(EMPTY_BOARD, [{ op: "fill_slot", visual: "nope", label: "x", source: [] }]);
    expect(b).toEqual(EMPTY_BOARD);
  });

  it("creates a fallback section when a visual arrives first", () => {
    const b = applyOps(EMPTY_BOARD, [{ op: "create_visual", id: "v1", template: "list" }]);
    expect(b.sections).toHaveLength(1);
    expect(b.sections[0].visualIds).toEqual(["v1"]);
  });

  it("does not duplicate a visual created twice", () => {
    const b = applyOps(EMPTY_BOARD, [...fourMethods, { op: "create_visual", id: "v1", template: "list" }]);
    expect(b.sections[0].visualIds).toEqual(["v1"]);
    expect(b.visuals.v1.template).toBe("grid");
  });

  it("update_slot on an empty slot fills it", () => {
    const b = applyOps(EMPTY_BOARD, [...fourMethods, { op: "update_slot", visual: "v1", index: 3, label: "Offline pop-ups" }]);
    expect(b.visuals.v1.slots[3]?.label).toBe("Offline pop-ups");
  });

  it("summarizes the board for the prompt", () => {
    const text = summarizeBoard(applyOps(EMPTY_BOARD, fourMethods));
    expect(text).toContain('visual v1 grid "4 methods" capacity=4');
    expect(text).toContain("2:EMPTY");
  });
});

describe("templates", () => {
  it.each(TEMPLATE_KINDS)("%s renders deterministically with stable ids", (template) => {
    const b = applyOps(EMPTY_BOARD, [
      { op: "start_section", id: "s1", title: "t", kind: "topic" },
      { op: "create_visual", id: "v1", template, capacity: 4, columns: template === "comparison" ? ["A", "B"] : undefined },
      { op: "fill_slot", visual: "v1", label: "First item with a fairly long label", detail: "detail", source: [] },
    ]);
    const a = renderVisual(b.visuals.v1, 0, 0, { activeIndex: 0 });
    const again = renderVisual(b.visuals.v1, 0, 0, { activeIndex: 0 });
    expect(a).toEqual(again);
    expect(a.height).toBeGreaterThan(0);
    const ids = a.shapes.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(a.shapes.some((s) => s.kind === "text" && s.text.includes("…"))).toBe(true); // empty slots visible
  });

  it("renders a placeholder for a visual with no announced count", () => {
    const b = applyOps(EMPTY_BOARD, [{ op: "create_visual", id: "v1", template: "pyramid" }]);
    expect(renderVisual(b.visuals.v1, 0, 0).shapes.length).toBeGreaterThan(0);
  });
});

function manySections(count: number): Board {
  const ops: Op[] = [];
  for (let i = 0; i < count; i++) {
    ops.push({ op: "start_section", id: `s${i}`, title: `Question ${i}`, kind: "question" });
    ops.push({ op: "create_visual", id: `v${i}`, template: "grid", capacity: 4 });
  }
  return applyOps(EMPTY_BOARD, ops);
}

describe("layout", () => {
  it("flows top to bottom, then to a new column on the right", () => {
    const scene = layoutBoard(manySections(8));
    const bounds = Object.values(scene.sectionBounds);
    expect(scene.columns).toBeGreaterThan(1);
    for (const b of bounds) {
      expect(b.y + b.h).toBeLessThanOrEqual(LAYOUT.columnHeight);
    }
    // Within a column, sections never overlap.
    const byColumn = new Map<number, typeof bounds>();
    for (const b of bounds) byColumn.set(b.x, [...(byColumn.get(b.x) ?? []), b]);
    for (const col of byColumn.values()) {
      col.sort((p, q) => p.y - q.y);
      for (let i = 1; i < col.length; i++) expect(col[i].y).toBeGreaterThanOrEqual(col[i - 1].y + col[i - 1].h);
    }
  });

  it("keeps earlier sections in place when new ones are added", () => {
    const before = layoutBoard(manySections(3)).sectionBounds;
    const after = layoutBoard(manySections(6)).sectionBounds;
    for (const id of Object.keys(before)) expect(after[id]).toEqual(before[id]);
  });

  it("produces unique shape ids across the whole scene", () => {
    const ids = layoutBoard(manySections(8)).shapes.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("handles an empty board", () => {
    expect(layoutBoard(EMPTY_BOARD)).toEqual({ shapes: [], sectionBounds: {}, columns: 1 });
  });
});

const boxesOf = (shapes: Shape[]) => shapes.filter((x): x is RectShape => x.kind === "rect");
const overlaps = (a: RectShape, b: RectShape) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function expectNoOverlaps(shapes: Shape[]) {
  const boxes = boxesOf(shapes);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j])).toBe(false);
}

describe("cycle overflow", () => {
  it("draws a large cycle as a looping flow without overlapping boxes", () => {
    const ops: Op[] = [{ op: "create_visual", id: "v1", template: "cycle", capacity: 11 }];
    for (let i = 0; i < 11; i++) ops.push({ op: "fill_slot", visual: "v1", label: `Node ${i}`, source: [] });
    const r = renderVisual(applyOps(EMPTY_BOARD, ops).visuals.v1, 0, 0);
    expectNoOverlaps(r.shapes);
    expect(r.shapes.some((s) => s.kind === "text" && s.text.startsWith("↺"))).toBe(true);
  });

  it.each([2, 3, 4, 5, 6])("a %i-node cycle keeps boxes apart", (n) => {
    const r = renderVisual(applyOps(EMPTY_BOARD, [{ op: "create_visual", id: "v1", template: "cycle", capacity: n }]).visuals.v1, 0, 0);
    expectNoOverlaps(r.shapes);
  });

  it.each(["grid", "steps", "list", "comparison"] as const)("a full 12-slot %s has no overlapping boxes", (template) => {
    const r = renderVisual(applyOps(EMPTY_BOARD, [{ op: "create_visual", id: "v1", template, capacity: 12 }]).visuals.v1, 0, 0);
    expectNoOverlaps(r.shapes);
  });
});

describe("shape decisions", () => {
  const listThenPyramid: Op[] = [
    { op: "create_visual", id: "v1", template: "list", why: "unclear yet" },
    { op: "fill_slot", visual: "v1", label: "Product people love", source: [] },
    { op: "convert_visual", visual: "v1", template: "pyramid", why: "each layer needs the one below" },
    { op: "fill_slot", visual: "v1", label: "Repeat buyers", source: [] },
  ];

  it("starts neutral and converts once the relationship is clear, keeping items in order", () => {
    const v = applyOps(EMPTY_BOARD, listThenPyramid).visuals.v1;
    expect(v.template).toBe("pyramid");
    expect(v.why).toBe("each layer needs the one below");
    expect(v.slots.map((s) => s?.label)).toEqual(["Product people love", "Repeat buyers"]);
  });

  it("a host override locks the shape against later AI conversions", () => {
    const b = overrideTemplate(applyOps(EMPTY_BOARD, listThenPyramid), "v1", "steps");
    const after = applyOps(b, [{ op: "convert_visual", visual: "v1", template: "cycle" }]);
    expect(after.visuals.v1.template).toBe("steps");
    expect(after.visuals.v1.locked).toBe(true);
    expect(summarizeBoard(after)).toContain("steps LOCKED");
  });

  it("tells the AI why it chose the current shape", () => {
    expect(summarizeBoard(applyOps(EMPTY_BOARD, listThenPyramid))).toContain('why="each layer needs the one below"');
  });
});

describe("comparison headers", () => {
  it("never shows placeholder headers and shows real ones once named", () => {
    const b = applyOps(EMPTY_BOARD, [
      { op: "create_visual", id: "v1", template: "comparison" },
      { op: "fill_slot", visual: "v1", label: "Merchant account", column: 0, source: [] },
    ]);
    const texts = (bb: typeof b) => renderVisual(bb.visuals.v1, 0, 0).shapes.filter((s) => s.kind === "text").map((s) => (s as { text: string }).text);
    expect(texts(b).join(" ")).not.toContain("Option");
    expect(summarizeBoard(b)).toContain("columns=MISSING");
    const named = applyOps(b, [{ op: "set_columns", visual: "v1", columns: ["Before Stripe", "With Stripe"] }]);
    expect(texts(named)).toContain("Before Stripe");
  });
});
