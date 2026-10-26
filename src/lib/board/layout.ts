import type { Board, Section } from "@/lib/types";
import { COLORS, charsThatFit, wrapText, type Shape } from "./shapes";
import { CONTENT_W, renderVisual } from "./templates";

/**
 * Column flow: sections stack top to bottom; when the next section would
 * overflow the column, it starts a new column to the right.
 */
export const LAYOUT = {
  columnHeight: 1000,
  columnStride: CONTENT_W + 160,
  sectionGap: 64,
  headerH: 38,
  headerGap: 22,
  visualGap: 30,
} as const;

export type Bounds = { x: number; y: number; w: number; h: number };

export type Scene = {
  shapes: Shape[];
  sectionBounds: Record<string, Bounds>;
  columns: number;
};

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";

function sectionLabel(section: Section, n: number): string {
  const num = n <= CIRCLED.length ? CIRCLED[n - 1] : `#${n}`;
  const prefix = section.kind === "question" ? "Q · " : "";
  return `${num}  ${prefix}${section.title}`;
}

function renderSection(board: Board, section: Section, n: number, x: number, y: number): { shapes: Shape[]; height: number } {
  const shapes: Shape[] = [];
  const isActive = section.id === board.activeSectionId;
  const text = wrapText(sectionLabel(section, n), charsThatFit(CONTENT_W - 28, 16, "ui"), 1);
  const pillW = Math.min(CONTENT_W, Math.max(120, text.length * 16 * 0.52 + 32));
  shapes.push({
    id: `${section.id}|header|box`,
    kind: "rect",
    x,
    y,
    w: pillW,
    h: LAYOUT.headerH,
    rounded: true,
    stroke: isActive ? COLORS.activeStroke : COLORS.hair,
    fill: COLORS.paper,
  });
  shapes.push({ id: `${section.id}|header|label`, kind: "text", text, size: 16, color: COLORS.ink, font: "ui", align: "left", x: x + 16, y: y + 9 });

  let cursor = y + LAYOUT.headerH + LAYOUT.headerGap;
  section.visualIds.forEach((vid, i) => {
    const visual = board.visuals[vid];
    if (!visual) return;
    if (i > 0) cursor += LAYOUT.visualGap;
    const activeIndex = board.lastTouched?.visualId === vid ? board.lastTouched.index : undefined;
    const r = renderVisual(visual, x, cursor, { activeIndex });
    shapes.push(...r.shapes);
    cursor += r.height;
  });
  if (section.visualIds.length === 0) cursor -= LAYOUT.headerGap;
  return { shapes, height: cursor - y };
}

export function layoutBoard(board: Board): Scene {
  const shapes: Shape[] = [];
  const sectionBounds: Record<string, Bounds> = {};
  const columnHeights: number[] = [0];
  let col = 0;
  let y = 0;

  board.sections.forEach((section, i) => {
    // Measure at the origin first; rendering is deterministic, so we can re-render in place.
    const measured = renderSection(board, section, i + 1, 0, 0);
    if (y > 0 && y + measured.height > LAYOUT.columnHeight) {
      col += 1;
      y = 0;
      columnHeights[col] = 0;
    }
    const x = col * LAYOUT.columnStride;
    if (y > 0) {
      const lineY = y - LAYOUT.sectionGap / 2;
      shapes.push({ id: `${section.id}|divider`, kind: "line", x, y: lineY, points: [[0, 0], [CONTENT_W, 0]], stroke: COLORS.dash, dashed: true });
    }
    const placed = renderSection(board, section, i + 1, x, y);
    shapes.push(...placed.shapes);
    sectionBounds[section.id] = { x, y, w: CONTENT_W, h: placed.height };
    y += placed.height + LAYOUT.sectionGap;
    columnHeights[col] = y - LAYOUT.sectionGap;
  });

  // Dashed vertical rules between columns, like the reference design's grid.
  const tallest = Math.max(...columnHeights, 0);
  for (let c = 1; c <= col; c++) {
    const lx = c * LAYOUT.columnStride - (LAYOUT.columnStride - CONTENT_W) / 2;
    shapes.push({ id: `col${c}|rule`, kind: "line", x: lx, y: -10, points: [[0, 0], [0, tallest + 20]], stroke: COLORS.dash, dashed: true });
  }

  return { shapes, sectionBounds, columns: col + 1 };
}
