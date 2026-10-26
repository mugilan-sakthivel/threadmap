import type { Slot, Visual } from "@/lib/types";
import { COLORS, charsThatFit, lineCount, wrapText, type Shape } from "./shapes";

export const CONTENT_W = 520;
const TITLE_H = 30;
const LABEL_SIZE = 18;
const DETAIL_SIZE = 14;
const LINE_H = 1.3;

export type RenderContext = {
  /** Index of the slot written most recently in this visual, if any. */
  activeIndex?: number;
};

export type Rendered = { shapes: Shape[]; height: number };

type SlotState = "filled" | "active" | "empty";

function slotState(slot: Slot | null, index: number, ctx: RenderContext): SlotState {
  if (!slot) return "empty";
  return ctx.activeIndex === index ? "active" : "filled";
}

function boxStyle(state: SlotState) {
  if (state === "empty") return { stroke: COLORS.empty, fill: undefined, dashed: true };
  if (state === "active") return { stroke: COLORS.ink, fill: COLORS.activeFill, dashed: false };
  return { stroke: COLORS.ink, fill: COLORS.paper, dashed: false };
}

function textH(lines: number, size: number) {
  return lines * size * LINE_H;
}

/**
 * A labelled card: label (+ optional detail) inside a rounded box.
 * Height is fixed by the caller so rows/grids stay aligned.
 */
function card(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  slot: Slot | null,
  state: SlotState,
  prefix = "",
): Shape[] {
  const style = boxStyle(state);
  const shapes: Shape[] = [{ id: `${id}|box`, kind: "rect", x, y, w, h, rounded: true, ...style }];
  if (!slot) {
    shapes.push({ id: `${id}|label`, kind: "text", text: `${prefix}…`, size: LABEL_SIZE, color: COLORS.empty, font: "hand", align: "center", x: x + w / 2, y: y + h / 2 });
    return shapes;
  }
  const inner = w - 24;
  const label = wrapText(`${prefix}${slot.label}`, charsThatFit(inner, LABEL_SIZE), 2);
  const detail = slot.detail ? wrapText(slot.detail, charsThatFit(inner, DETAIL_SIZE), h >= 96 ? 2 : 1) : "";
  const labelH = textH(lineCount(label), LABEL_SIZE);
  const detailH = detail ? textH(lineCount(detail), DETAIL_SIZE) + 4 : 0;
  const top = y + (h - labelH - detailH) / 2;
  shapes.push({ id: `${id}|label`, kind: "text", text: label, size: LABEL_SIZE, color: COLORS.ink, font: "hand", align: "center", x: x + w / 2, y: top + labelH / 2 });
  if (detail) {
    shapes.push({ id: `${id}|detail`, kind: "text", text: detail, size: DETAIL_SIZE, color: COLORS.text, font: "hand", align: "center", x: x + w / 2, y: top + labelH + 4 + textH(lineCount(detail), DETAIL_SIZE) / 2 });
  }
  // Only tall cards have room for the label; smaller ones rely on the pink fill.
  if (state === "active" && h >= 96) {
    shapes.push({ id: `${id}|live`, kind: "text", text: "● drawing live", size: 11, color: COLORS.activeStroke, font: "ui", align: "left", x: x + 10, y: y + h - 18 });
  }
  return shapes;
}

/** Slots to draw: at least one placeholder so a freshly announced visual is visible. */
function slotsOf(v: Visual): (Slot | null)[] {
  return v.slots.length > 0 ? v.slots : [null];
}

function renderList(v: Visual, base: string, x: number, y: number, ctx: RenderContext): Rendered {
  const shapes: Shape[] = [];
  let cy = y;
  slotsOf(v).forEach((slot, i) => {
    const hasDetail = Boolean(slot?.detail);
    const h = hasDetail ? 76 : 52;
    shapes.push(...card(`${base}|s${i}`, x, cy, CONTENT_W, h, slot, slotState(slot, i, ctx)));
    cy += h + 10;
  });
  return { shapes, height: cy - y - 10 };
}

function renderGrid(v: Visual, base: string, x: number, y: number, ctx: RenderContext): Rendered {
  const slots = slotsOf(v);
  const n = slots.length;
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
  const gap = 14;
  const cellW = (CONTENT_W - gap * (cols - 1)) / cols;
  const cellH = 100;
  const shapes: Shape[] = [];
  slots.forEach((slot, i) => {
    const cx = x + (i % cols) * (cellW + gap);
    const cy = y + Math.floor(i / cols) * (cellH + gap);
    shapes.push(...card(`${base}|s${i}`, cx, cy, cellW, cellH, slot, slotState(slot, i, ctx), `${i + 1} · `));
  });
  const rows = Math.ceil(n / cols);
  return { shapes, height: rows * cellH + (rows - 1) * gap };
}

/** Pyramid: slot 0 is the base (foundation); the last slot is the tip. */
function renderPyramid(v: Visual, base: string, x: number, y: number, ctx: RenderContext): Rendered {
  const slots = slotsOf(v);
  const n = slots.length;
  const pyrW = 360;
  const levelH = 62;
  const gap = 4;
  const H = n * levelH + (n - 1) * gap;
  const apexX = x + pyrW / 2;
  const widthAt = (dy: number) => (pyrW * dy) / H;
  const shapes: Shape[] = [];
  for (let k = 0; k < n; k++) {
    const index = n - 1 - k; // k counts from the top
    const slot = slots[index];
    const state = slotState(slot, index, ctx);
    const style = boxStyle(state);
    const y0 = k * (levelH + gap);
    const y1 = y0 + levelH;
    const w0 = widthAt(y0);
    const w1 = widthAt(y1);
    const points: [number, number][] =
      k === 0
        ? [[0, 0], [w1 / 2, levelH], [-w1 / 2, levelH], [0, 0]]
        : [[-w0 / 2, 0], [w0 / 2, 0], [w1 / 2, levelH], [-w1 / 2, levelH], [-w0 / 2, 0]];
    shapes.push({ id: `${base}|s${index}|shape`, kind: "poly", x: apexX, y: y + y0, points, ...style });
    // Text sits in the lower half of the tip triangle, where it is widest.
    const textW = k === 0 ? w1 * 0.6 : (w0 + w1) / 2 - 24;
    const ty = y + y0 + (k === 0 ? levelH * 0.68 : levelH / 2);
    const label = slot ? wrapText(slot.label, charsThatFit(textW, LABEL_SIZE - 2), 2) : "…";
    shapes.push({ id: `${base}|s${index}|label`, kind: "text", text: label, size: LABEL_SIZE - 2, color: slot ? COLORS.ink : COLORS.empty, font: "hand", align: "center", x: apexX, y: ty });
    if (slot?.detail) {
      shapes.push({
        id: `${base}|s${index}|detail`,
        kind: "text",
        text: wrapText(slot.detail, charsThatFit(CONTENT_W - pyrW - 20, DETAIL_SIZE), 2),
        size: DETAIL_SIZE,
        color: COLORS.text,
        font: "hand",
        align: "left",
        x: x + pyrW + 16,
        y: y + y0 + levelH / 2 - 12,
      });
    }
  }
  return { shapes, height: H };
}

/** Funnel: slot 0 is the widest stage at the top. */
function renderFunnel(v: Visual, base: string, x: number, y: number, ctx: RenderContext): Rendered {
  const slots = slotsOf(v);
  const n = slots.length;
  const levelH = 58;
  const gap = 4;
  const topW = CONTENT_W;
  const bottomW = 170;
  const widthAtLevel = (k: number) => topW - ((topW - bottomW) * k) / n;
  const cx = x + CONTENT_W / 2;
  const shapes: Shape[] = [];
  slots.forEach((slot, k) => {
    const state = slotState(slot, k, ctx);
    const w0 = widthAtLevel(k);
    const w1 = widthAtLevel(k + 1);
    const y0 = k * (levelH + gap);
    const points: [number, number][] = [[-w0 / 2, 0], [w0 / 2, 0], [w1 / 2, levelH], [-w1 / 2, levelH], [-w0 / 2, 0]];
    shapes.push({ id: `${base}|s${k}|shape`, kind: "poly", x: cx, y: y + y0, points, ...boxStyle(state) });
    const text = slot ? wrapText(slot.detail ? `${slot.label}: ${slot.detail}` : slot.label, charsThatFit(w1 - 20, LABEL_SIZE - 2), 2) : "…";
    shapes.push({ id: `${base}|s${k}|label`, kind: "text", text, size: LABEL_SIZE - 2, color: slot ? COLORS.ink : COLORS.empty, font: "hand", align: "center", x: cx, y: y + y0 + levelH / 2 });
  });
  return { shapes, height: n * levelH + (n - 1) * gap };
}

function renderSteps(v: Visual, base: string, x: number, y: number, ctx: RenderContext): Rendered {
  const slots = slotsOf(v);
  const perRow = 3;
  const boxW = 150;
  const boxH = 88;
  const hGap = (CONTENT_W - perRow * boxW) / (perRow - 1);
  const vGap = 40;
  const shapes: Shape[] = [];
  const pos = (i: number) => ({
    bx: x + (i % perRow) * (boxW + hGap),
    by: y + Math.floor(i / perRow) * (boxH + vGap),
  });
  slots.forEach((slot, i) => {
    const { bx, by } = pos(i);
    shapes.push(...card(`${base}|s${i}`, bx, by, boxW, boxH, slot, slotState(slot, i, ctx), `${i + 1}. `));
    if (i > 0) {
      const prev = pos(i - 1);
      const sameRow = Math.floor(i / perRow) === Math.floor((i - 1) / perRow);
      const ax = sameRow ? prev.bx + boxW + 4 : prev.bx + boxW / 2;
      const ay = sameRow ? prev.by + boxH / 2 : prev.by + boxH + 4;
      const tx = sameRow ? bx - 4 : bx + boxW / 2;
      const ty = sameRow ? by + boxH / 2 : by - 4;
      shapes.push({ id: `${base}|a${i}`, kind: "arrow", x: ax, y: ay, points: [[0, 0], [tx - ax, ty - ay]], stroke: slot ? COLORS.ink : COLORS.empty, dashed: !slot });
    }
  });
  const rows = Math.ceil(slots.length / perRow);
  return { shapes, height: rows * boxH + (rows - 1) * vGap };
}

const MAX_CYCLE_NODES = 6;

function renderCycle(v: Visual, base: string, x: number, y: number, ctx: RenderContext): Rendered {
  const slots = slotsOf(v);
  const n = slots.length;
  // A ring of more than 6 boxes cannot fit the column without overlaps; draw a
  // step flow that visibly loops back instead.
  if (n > MAX_CYCLE_NODES) {
    const flow = renderSteps(v, base, x, y, ctx);
    const noteY = y + flow.height + 12;
    return {
      shapes: [...flow.shapes, { id: `${base}|loop`, kind: "text", text: "↺ repeats from step 1", size: 15, color: COLORS.muted, font: "hand", align: "left", x, y: noteY }],
      height: flow.height + 32,
    };
  }
  const boxW = 150;
  const boxH = 64;
  const R = n <= 3 ? 110 : n <= 6 ? 150 : 185;
  const cx = x + CONTENT_W / 2;
  const cy = y + R + boxH / 2;
  const shapes: Shape[] = [];
  // Stretch horizontally (boxes are wide) but stay inside the content column.
  const Rx = Math.min(R * 1.15, CONTENT_W / 2 - boxW / 2);
  const centers = slots.map((_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { px: cx + Rx * Math.cos(a), py: cy + R * Math.sin(a) };
  });
  slots.forEach((slot, i) => {
    const { px, py } = centers[i];
    shapes.push(...card(`${base}|s${i}`, px - boxW / 2, py - boxH / 2, boxW, boxH, slot, slotState(slot, i, ctx)));
  });
  if (n >= 2) {
    centers.forEach((from, i) => {
      const to = centers[(i + 1) % n];
      const dx = to.px - from.px;
      const dy = to.py - from.py;
      const len = Math.hypot(dx, dy) || 1;
      // Trim the arrow so it starts and ends outside the boxes.
      const trim = Math.min(len * 0.35, 70);
      const sx = from.px + (dx / len) * trim;
      const sy = from.py + (dy / len) * trim;
      const ex = to.px - (dx / len) * trim;
      const ey = to.py - (dy / len) * trim;
      const filled = Boolean(slots[i] && slots[(i + 1) % n]);
      shapes.push({ id: `${base}|a${i}`, kind: "arrow", x: sx, y: sy, points: [[0, 0], [ex - sx, ey - sy]], stroke: filled ? COLORS.ink : COLORS.empty, dashed: !filled });
    });
  }
  return { shapes, height: 2 * R + boxH };
}

function renderComparison(v: Visual, base: string, x: number, y: number, ctx: RenderContext): Rendered {
  const gap = 20;
  const colW = (CONTENT_W - gap) / 2;
  const headH = 44;
  const cardH = 72;
  const shapes: Shape[] = [];
  // Header row only once the two sides are named; never show placeholder labels.
  v.columns?.forEach((name, c) => {
    const hx = x + c * (colW + gap);
    shapes.push({ id: `${base}|h${c}|box`, kind: "rect", x: hx, y, w: colW, h: headH, stroke: COLORS.ink, fill: COLORS.chip, rounded: true });
    shapes.push({ id: `${base}|h${c}|label`, kind: "text", text: wrapText(name, charsThatFit(colW - 20, LABEL_SIZE), 1), size: LABEL_SIZE, color: COLORS.ink, font: "hand", align: "center", x: hx + colW / 2, y: y + headH / 2 });
  });
  const top = v.columns ? y + headH + 12 : y;
  const cursor = [top, top];
  slotsOf(v).forEach((slot, i) => {
    const c = slot?.column ?? ((i % 2) as 0 | 1);
    const cx = x + c * (colW + gap);
    shapes.push(...card(`${base}|s${i}`, cx, cursor[c], colW, cardH, slot, slotState(slot, i, ctx)));
    cursor[c] += cardH + 10;
  });
  return { shapes, height: Math.max(cursor[0], cursor[1]) - y - 10 };
}

function renderTimeline(v: Visual, base: string, x: number, y: number, ctx: RenderContext): Rendered {
  const slots = slotsOf(v);
  const itemH = 66;
  const lineX = x + 14;
  const shapes: Shape[] = [];
  const total = slots.length * itemH - 20;
  shapes.push({ id: `${base}|spine`, kind: "line", x: lineX, y: y + 8, points: [[0, 0], [0, Math.max(total - 8, 10)]], stroke: COLORS.ink });
  slots.forEach((slot, i) => {
    const iy = y + i * itemH;
    const state = slotState(slot, i, ctx);
    const style = boxStyle(state);
    shapes.push({ id: `${base}|s${i}|dot`, kind: "ellipse", x: lineX - 8, y: iy + 4, w: 16, h: 16, stroke: style.stroke, fill: state === "empty" ? COLORS.paper : state === "active" ? COLORS.activeStroke : COLORS.ink, dashed: style.dashed });
    shapes.push({ id: `${base}|s${i}|label`, kind: "text", text: slot ? wrapText(slot.label, charsThatFit(CONTENT_W - 50, LABEL_SIZE), 1) : "…", size: LABEL_SIZE, color: slot ? COLORS.ink : COLORS.empty, font: "hand", align: "left", x: x + 40, y: iy });
    if (slot?.detail) {
      shapes.push({ id: `${base}|s${i}|detail`, kind: "text", text: wrapText(slot.detail, charsThatFit(CONTENT_W - 50, DETAIL_SIZE), 1), size: DETAIL_SIZE, color: COLORS.text, font: "hand", align: "left", x: x + 40, y: iy + 26 });
    }
  });
  return { shapes, height: total };
}

const RENDERERS = {
  list: renderList,
  grid: renderGrid,
  pyramid: renderPyramid,
  funnel: renderFunnel,
  steps: renderSteps,
  cycle: renderCycle,
  comparison: renderComparison,
  timeline: renderTimeline,
} satisfies Record<Visual["template"], unknown>;

/** Draw one visual at (x, y). Height is deterministic so layout can rely on it. */
export function renderVisual(v: Visual, x: number, y: number, ctx: RenderContext = {}): Rendered {
  // The template is part of every id so converting a visual never reuses an element of another type.
  const base = `${v.sectionId}|${v.id}|${v.template}`;
  const shapes: Shape[] = [];
  let top = y;
  if (v.title) {
    shapes.push({ id: `${base}|title`, kind: "text", text: wrapText(v.title, charsThatFit(CONTENT_W, 15, "ui"), 1), size: 15, color: COLORS.muted, font: "ui", align: "left", x, y });
    top += TITLE_H;
  }
  const body = RENDERERS[v.template](v, base, x, top, ctx);
  shapes.push(...body.shapes);
  return { shapes, height: top - y + body.height };
}
