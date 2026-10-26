import type { EngineCallbacks, SttEngine } from "./engine";

export type ReplayLine = { name: string; text: string; t?: number };

const TIMESTAMP = String.raw`\(?\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\)?`;
// "Name (00:11:49) text", "Name (00:11:49): text", "[00:11:49] Name: text", "Name: text"
const PATTERNS = [
  new RegExp(String.raw`^\s*([^:()\[\]]{1,40}?)\s*${TIMESTAMP}\s*:?\s*(.+)$`),
  new RegExp(String.raw`^\s*${TIMESTAMP}\s*([^:]{1,40}):\s*(.+)$`),
  /^\s*([^:]{1,40}):\s*(.+)$/,
];

function toSeconds(ts: string): number {
  const p = ts.split(":").map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
}

/** Parse a pasted transcript. Lines that don't start with a speaker continue the previous turn. */
export function parseTranscript(raw: string): ReplayLine[] {
  const lines: ReplayLine[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const a = PATTERNS[0].exec(line);
    const b = a ? null : PATTERNS[1].exec(line);
    const c = a || b ? null : PATTERNS[2].exec(line);
    if (a) lines.push({ name: a[1].trim(), t: toSeconds(a[2]), text: a[3].trim() });
    else if (b) lines.push({ name: b[2].trim(), t: toSeconds(b[1]), text: b[3].trim() });
    else if (c) lines.push({ name: c[1].trim(), text: c[2].trim() });
    else if (lines.length) lines[lines.length - 1].text += ` ${line.trim()}`;
  }
  return lines.filter((l) => l.text);
}

/** Stable speaker ids ("1", "2", ...) in order of first appearance. */
export function speakerIds(lines: ReplayLine[]): Map<string, string> {
  const ids = new Map<string, string>();
  for (const l of lines) if (!ids.has(l.name)) ids.set(l.name, String(ids.size + 1));
  return ids;
}

const WORDS_PER_SECOND = 2.6; // natural conversation pace when there are no timestamps
const MIN_WORD_MS = 40;

/**
 * Plays a transcript through the live pipeline at (roughly) real speed, using
 * the transcript's own timestamps when present. Same path as a live mic.
 */
export class ReplayEngine implements SttEngine {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private paused = false;
  private stopped = false;
  private line = 0;
  private word = 0;
  private cb: EngineCallbacks | null = null;
  private clockMs = 0;
  private readonly ids: Map<string, string>;

  constructor(
    private readonly lines: ReplayLine[],
    private readonly speed = 1,
  ) {
    this.ids = speakerIds(lines);
  }

  async start(cb: EngineCallbacks): Promise<void> {
    if (this.lines.length === 0) throw new Error("The transcript is empty or couldn't be read.");
    this.cb = cb;
    cb.onState("live");
    this.schedule(300);
  }

  /** How long this line takes to say, from timestamps if we have them. */
  private lineMs(i: number): number {
    const cur = this.lines[i];
    const next = this.lines[i + 1];
    const words = cur.text.split(/\s+/).length;
    const spoken = (words / WORDS_PER_SECOND) * 1000;
    if (cur.t !== undefined && next?.t !== undefined && next.t > cur.t) {
      // Timestamps include pauses; never stretch a line beyond 1.6x natural pace.
      return Math.min((next.t - cur.t) * 1000, spoken * 1.6);
    }
    return spoken;
  }

  private schedule(ms: number) {
    this.timer = setTimeout(() => this.tick(), ms / this.speed);
  }

  private tick() {
    if (this.stopped || this.paused || !this.cb) return;
    const item = this.lines[this.line];
    if (!item) {
      this.cb.onState("stopped", "Replay finished");
      return;
    }
    const words = item.text.split(/\s+/);
    const step = Math.max(MIN_WORD_MS, this.lineMs(this.line) / words.length);
    const speaker = this.ids.get(item.name) ?? "1";
    this.word += 1;
    this.clockMs += step;
    if (this.word < words.length) {
      this.cb.onPartial({ speaker, text: words.slice(0, this.word).join(" ") });
      this.schedule(step);
      return;
    }
    this.cb.onPartial(null);
    const startMs = item.t !== undefined ? (item.t - (this.lines[0].t ?? 0)) * 1000 : this.clockMs - words.length * step;
    this.cb.onSegments([{ id: `rp${this.line}`, speaker, text: item.text, startMs, endMs: startMs + words.length * step }]);
    this.line += 1;
    this.word = 0;
    this.schedule(350);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.cb?.onPartial(null);
    this.cb?.onState("stopped");
  }

  pause(): void {
    this.paused = true;
    if (this.timer) clearTimeout(this.timer);
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.schedule(200);
  }
}
