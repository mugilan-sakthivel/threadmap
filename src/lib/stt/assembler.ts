import type { LivePartial, Segment } from "@/lib/types";

export type SttToken = {
  text: string;
  is_final: boolean;
  speaker?: string;
  language?: string;
  start_ms?: number;
  end_ms?: number;
};

/** Control tokens Soniox emits at endpoints (<end>) and manual finalization (<fin>). */
const BOUNDARY = new Set(["<end>", "<fin>"]);
const MAX_SEGMENT_CHARS = 600;

type Open = { speaker: string; text: string; startMs: number; endMs: number; lang?: string };

/**
 * Turns a stream of word-piece tokens into speaker-attributed segments.
 * A segment closes on an endpoint, a speaker change, or when it gets long.
 */
export class TokenAssembler {
  private open: Open | null = null;
  private counter = 0;

  constructor(private readonly idPrefix = "seg") {}

  push(tokens: SttToken[]): { finals: Segment[]; partial: LivePartial } {
    const finals: Segment[] = [];
    let pending = "";
    let pendingSpeaker: string | undefined;

    for (const t of tokens) {
      if (BOUNDARY.has(t.text.trim())) {
        if (t.is_final) this.close(finals);
        continue;
      }
      if (!t.is_final) {
        pending += t.text;
        pendingSpeaker ??= t.speaker;
        continue;
      }
      const speaker = t.speaker ?? this.open?.speaker ?? "1";
      if (this.open && this.open.speaker !== speaker) this.close(finals);
      if (!this.open) {
        this.open = { speaker, text: "", startMs: t.start_ms ?? 0, endMs: t.end_ms ?? 0, lang: t.language };
      }
      this.open.text += t.text;
      this.open.endMs = t.end_ms ?? this.open.endMs;
      this.open.lang ??= t.language;
      if (this.open.text.length > MAX_SEGMENT_CHARS) this.close(finals);
    }

    const openText = this.open?.text ?? "";
    const text = `${openText}${pending}`.trim();
    const partial: LivePartial = text ? { speaker: this.open?.speaker ?? pendingSpeaker ?? "1", text } : null;
    return { finals, partial };
  }

  /** Close whatever is open (call when the stream stops). */
  flush(): Segment[] {
    const finals: Segment[] = [];
    this.close(finals);
    return finals;
  }

  private close(into: Segment[]) {
    const open = this.open;
    this.open = null;
    if (!open) return;
    const text = open.text.trim();
    if (!text) return;
    this.counter += 1;
    into.push({ id: `${this.idPrefix}${this.counter}`, speaker: open.speaker, text, startMs: open.startMs, endMs: open.endMs, lang: open.lang });
  }
}
