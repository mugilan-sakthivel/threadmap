import type { BrainNote, Op } from "@/lib/brain/schema";
import type { EngineCallbacks, SttEngine } from "./engine";

export type DemoLine = {
  speaker: string;
  text: string;
  /** What a good model returns for this line; used when no LLM key is configured. */
  ops?: Op[];
  notes?: BrainNote[];
  /** This line answers the open follow-ups. */
  resolvesFollowups?: boolean;
};

/** A short Tanglish founder interview that exercises several templates. */
export const DEMO_SCRIPT: DemoLine[] = [
  {
    speaker: "1",
    text: "Welcome Priya! So first, how did you actually start Kanavu Naturals?",
    ops: [{ op: "start_section", id: "s1", title: "How did you start?", kind: "question" }],
  },
  // No one says "pyramid" here: the structure is only implied, so the board
  // starts neutral (a list) and converts once the layering becomes clear.
  {
    speaker: "2",
    text: "Honestly, first you need a product people actually love, adhu illama onnum work aagadhu.",
    ops: [
      { op: "create_visual", id: "v1", section: "s1", template: "list", title: "How growth works", why: "one item so far, relationship unclear" },
      { op: "fill_slot", visual: "v1", index: 0, label: "Product people love", detail: "nothing works without it", source: [] },
    ],
    notes: [{ kind: "point", text: "Everything starts with a product people actually love", source: [] }],
  },
  {
    speaker: "2",
    text: "Only once that is solid, repeat buyers come. Andha second order dhaan real signal.",
    ops: [
      { op: "convert_visual", visual: "v1", template: "pyramid", why: "each layer needs the one below" },
      { op: "fill_slot", visual: "v1", index: 1, label: "Repeat buyers", detail: "the second order is the signal", source: [] },
    ],
  },
  {
    speaker: "2",
    text: "And brand sits on top of both. Most founders start with brand first, that was my forty lakh mistake actually.",
    ops: [{ op: "fill_slot", visual: "v1", index: 2, label: "Brand", detail: "comes last, not first", source: [] }],
    notes: [{ kind: "followup", text: "She mentioned a ₹40L mistake. Ask what happened", source: [] }],
  },
  {
    speaker: "1",
    text: "Got it. So how did you get your first thousand customers?",
    ops: [{ op: "start_section", id: "s2", title: "First 1,000 customers", kind: "question" }],
  },
  {
    speaker: "2",
    text: "There are four methods we used. First, Instagram reels, daily three podunvom, founder on camera.",
    ops: [
      { op: "create_visual", id: "v2", section: "s2", template: "grid", title: "4 acquisition methods", capacity: 4 },
      { op: "fill_slot", visual: "v2", index: 0, label: "Instagram reels", detail: "3 a day, founder on camera", source: [] },
    ],
    notes: [{ kind: "point", text: "Reels: 3 per day with the founder on camera", source: [] }],
  },
  {
    speaker: "2",
    text: "Second, a WhatsApp community. Ippo twelve thousand members irukanga, they get early drops.",
    ops: [{ op: "fill_slot", visual: "v2", index: 1, label: "WhatsApp community", detail: "12k members, early drops", source: [] }],
  },
  {
    speaker: "2",
    text: "Third is creator collabs, micro creators between ten and fifty thousand followers.",
    ops: [{ op: "fill_slot", visual: "v2", index: 2, label: "Creator collabs", detail: "micro creators, 10–50k", source: [] }],
  },
  {
    speaker: "2",
    text: "And fourth, offline pop-ups at college fests. Surprisingly that gave the best retention.",
    ops: [{ op: "fill_slot", visual: "v2", index: 3, label: "Offline pop-ups", detail: "college fests, best retention", source: [] }],
    notes: [{ kind: "quote", text: "“Offline pop-ups surprisingly gave the best retention.”", source: [] }],
  },
  {
    speaker: "1",
    text: "And what does a good product mean for you?",
    ops: [{ op: "start_section", id: "s5", title: "What makes a good product", kind: "question" }],
  },
  {
    speaker: "2",
    text: "See, it has to be effective, it should actually fix the skin problem.",
    notes: [{ kind: "point", text: "A good product must be effective: actually fix the problem", source: [] }],
  },
  {
    speaker: "2",
    text: "And efficient, one product instead of five step routines. And honest, labels la full ingredient list podanum.",
    ops: [
      { op: "create_visual", id: "v5", section: "s5", template: "grid", title: "A good product is" },
      { op: "fill_slot", visual: "v5", label: "Effective", detail: "actually fixes the problem", source: [] },
      { op: "fill_slot", visual: "v5", label: "Efficient", detail: "one product, not 5 steps", source: [] },
      { op: "fill_slot", visual: "v5", label: "Honest", detail: "full ingredient list on label", source: [] },
    ],
  },
  {
    speaker: "2",
    text: "Oh and affordable also, under five hundred rupees.",
    ops: [{ op: "fill_slot", visual: "v5", label: "Affordable", detail: "under ₹500", source: [] }],
  },
  {
    speaker: "1",
    text: "You said forty lakh mistake earlier. What happened there?",
    ops: [{ op: "start_section", id: "s3", title: "The ₹40L mistake", kind: "question" }],
    resolvesFollowups: true,
  },
  {
    speaker: "2",
    text: "We hired a big team first, then built a fancy brand campaign, then only checked if people reorder. Total reverse order.",
    ops: [
      { op: "create_visual", id: "v3", section: "s3", template: "steps", title: "What went wrong", capacity: 3 },
      { op: "fill_slot", visual: "v3", index: 0, label: "Hired a big team", source: [] },
      { op: "fill_slot", visual: "v3", index: 1, label: "Brand campaign", source: [] },
      { op: "fill_slot", visual: "v3", index: 2, label: "Checked reorders", detail: "far too late", source: [] },
    ],
    notes: [{ kind: "point", text: "The mistake: team → brand → reorders, the pyramid in reverse", source: [] }],
  },
  {
    speaker: "1",
    text: "Last one. Bootstrapping or VC money, what would you tell a first time founder?",
    ops: [
      { op: "start_section", id: "s4", title: "Bootstrap vs VC", kind: "question" },
      { op: "create_visual", id: "v4", section: "s4", template: "comparison", columns: ["Bootstrap", "VC money"] },
    ],
  },
  {
    speaker: "2",
    text: "Bootstrap gives you control and forces you to find repeat buyers fast. VC gives speed, but you start optimising for the next round.",
    ops: [
      { op: "fill_slot", visual: "v4", label: "Control + discipline", detail: "forces repeat buyers fast", column: 0, source: [] },
      { op: "fill_slot", visual: "v4", label: "Speed", detail: "but you optimise for the next round", column: 1, source: [] },
    ],
    notes: [{ kind: "action", text: "Clip idea: bootstrap vs VC answer", source: [] }],
  },
];

const WORD_MS = 140;
const LINE_GAP_MS = 900;

/**
 * Plays the demo script like a live stream: words appear as a partial,
 * then the line is finalized. Lets anyone try the full UI with no keys.
 */
export class DemoEngine implements SttEngine {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private paused = false;
  private stopped = false;
  private line = 0;
  private word = 0;
  private cb: EngineCallbacks | null = null;
  private clock = 0;

  async start(cb: EngineCallbacks): Promise<void> {
    this.cb = cb;
    cb.onState("live");
    this.schedule(400);
  }

  private schedule(ms: number) {
    this.timer = setTimeout(() => this.tick(), ms);
  }

  private tick() {
    if (this.stopped || this.paused || !this.cb) return;
    const item = DEMO_SCRIPT[this.line];
    if (!item) {
      this.cb.onState("stopped", "Demo finished");
      return;
    }
    const words = item.text.split(" ");
    this.word += 1;
    this.clock += WORD_MS;
    if (this.word < words.length) {
      this.cb.onPartial({ speaker: item.speaker, text: words.slice(0, this.word).join(" ") });
      this.schedule(WORD_MS);
      return;
    }
    this.cb.onPartial(null);
    this.cb.onSegments([{ id: `demo${this.line}`, speaker: item.speaker, text: item.text, startMs: this.clock - words.length * WORD_MS, endMs: this.clock }]);
    this.line += 1;
    this.word = 0;
    this.clock += LINE_GAP_MS;
    this.schedule(LINE_GAP_MS);
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

export function demoLineForSegment(segmentId: string): DemoLine | undefined {
  const m = /^demo(\d+)$/.exec(segmentId);
  return m ? DEMO_SCRIPT[Number(m[1])] : undefined;
}
