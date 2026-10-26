/** A finalized piece of transcript from one speaker. */
export type Segment = {
  id: string;
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
  lang?: string;
};

/** The not-yet-final text currently being spoken. */
export type LivePartial = {
  speaker: string;
  text: string;
} | null;

export type NoteKind = "point" | "followup" | "quote" | "action";

export type Note = {
  id: string;
  kind: NoteKind;
  text: string;
  sourceIds: string[];
  atMs: number;
  resolved?: boolean;
};

export const TEMPLATE_KINDS = [
  "list",
  "pyramid",
  "funnel",
  "grid",
  "steps",
  "cycle",
  "comparison",
  "timeline",
] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export type Slot = {
  label: string;
  detail?: string;
  /** Comparison only: which side (0 = left, 1 = right). */
  column?: 0 | 1;
};

export type Visual = {
  id: string;
  sectionId: string;
  template: TemplateKind;
  title?: string;
  /** How many slots the speaker announced ("there are 4 methods"). */
  capacity: number;
  /** Index-aligned with capacity; null means announced but not yet explained. */
  slots: (Slot | null)[];
  /** Comparison only: the two things being compared. */
  columns?: [string, string];
  /** The relationship the AI detected, e.g. "each layer needs the one below". */
  why?: string;
  /** Set when the host picked the shape by hand; the AI may not convert it. */
  locked?: boolean;
};

export type SectionKind = "question" | "topic";

export type Section = {
  id: string;
  title: string;
  kind: SectionKind;
  visualIds: string[];
};

export type Board = {
  sections: Section[];
  visuals: Record<string, Visual>;
  activeSectionId?: string;
  activeVisualId?: string;
  /** Slot most recently written, for the "drawing live" highlight. */
  lastTouched?: { visualId: string; index: number };
};

export const EMPTY_BOARD: Board = { sections: [], visuals: {} };
