/**
 * Renderer-agnostic drawing primitives. Templates and layout produce these;
 * the canvas component converts them to Excalidraw elements. Keeping this
 * layer pure makes layout testable without a browser.
 */
export type Font = "hand" | "ui";

type Base = { id: string };

export type RectShape = Base & {
  kind: "rect" | "ellipse";
  x: number;
  y: number;
  w: number;
  h: number;
  stroke: string;
  fill?: string;
  dashed?: boolean;
  rounded?: boolean;
};

export type PolyShape = Base & {
  kind: "poly";
  x: number;
  y: number;
  /** Closed polygon; points are relative to (x, y). */
  points: [number, number][];
  stroke: string;
  fill?: string;
  dashed?: boolean;
};

export type LineShape = Base & {
  kind: "line" | "arrow";
  x: number;
  y: number;
  points: [number, number][];
  stroke: string;
  dashed?: boolean;
};

export type TextShape = Base & {
  kind: "text";
  text: string;
  size: number;
  color: string;
  font: Font;
  /** center: (x, y) is the visual center. left: (x, y) is the top-left corner. */
  align: "center" | "left";
  x: number;
  y: number;
};

export type Shape = RectShape | PolyShape | LineShape | TextShape;

export const COLORS = {
  ink: "#1e1e1e",
  text: "#363636",
  muted: "#8f8f8a",
  empty: "#b9b9b4",
  paper: "#ffffff",
  chip: "#f1f1ef",
  hair: "#d9d9d5",
  dash: "#dcdcd7",
  activeFill: "#ffe6fb",
  activeStroke: "#ff4de1",
} as const;

/** Rough average glyph width as a fraction of font size (Excalifont is fairly wide). */
const CHAR_W = { hand: 0.56, ui: 0.52 } as const;

export function charsThatFit(width: number, size: number, font: Font = "hand"): number {
  return Math.max(4, Math.floor(width / (size * CHAR_W[font])));
}

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

function graphemes(text: string): string[] {
  return segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text);
}

/** Latin and common punctuation; everything else (Tamil, Devanagari, ...) renders wider per cluster. */
const NARROW = /^[\u0000-\u024F\u2000-\u20CF\u2190-\u21FF₹…·•]$/u;

/**
 * Visual width in "Latin character" units, counted per grapheme cluster so a
 * Tamil letter with its vowel sign counts once, not as two code units.
 */
export function textUnits(text: string): number {
  return graphemes(text).reduce((u, g) => u + (NARROW.test(g) ? 1 : 1.4), 0);
}

function sliceUnits(text: string, maxUnits: number): string {
  let out = "";
  let u = 0;
  for (const g of graphemes(text)) {
    const w = NARROW.test(g) ? 1 : 1.4;
    if (u + w > maxUnits) break;
    out += g;
    u += w;
  }
  return out;
}

export function estimateTextWidth(text: string, size: number, font: Font = "hand"): number {
  const longest = text.split("\n").reduce((m, l) => Math.max(m, textUnits(l)), 0);
  return longest * size * CHAR_W[font];
}

/** Word-wrap to at most `maxLines`, adding an ellipsis when truncated. Widths are script-aware. */
export function wrapText(text: string, maxChars: number, maxLines = 2): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const chunk = textUnits(word) > maxChars ? `${sliceUnits(word, maxChars - 1)}…` : word;
    if (!line) line = chunk;
    else if (textUnits(`${line} ${chunk}`) <= maxChars) line = `${line} ${chunk}`;
    else {
      lines.push(line);
      line = chunk;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines.join("\n");
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] = textUnits(last) >= maxChars ? `${sliceUnits(last, maxChars - 1)}…` : `${last}…`;
  return kept.join("\n");
}

export function lineCount(text: string): number {
  return text ? text.split("\n").length : 0;
}
