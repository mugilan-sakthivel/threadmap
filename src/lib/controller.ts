"use client";

import { summarizeBoard } from "@/lib/board/reducer";
import { BrainScheduler } from "@/lib/brain/scheduler";
import type { BrainRequest } from "@/lib/brain/schema";
import { BrowserSpeechEngine } from "@/lib/stt/browser";
import { DemoEngine, demoLineForSegment } from "@/lib/stt/demo";
import { parseTranscript, ReplayEngine, speakerIds } from "@/lib/stt/replay";
import type { SttEngine } from "@/lib/stt/engine";
import { SonioxEngine } from "@/lib/stt/soniox";
import { useSession } from "@/lib/store";
import type { Board, Segment } from "@/lib/types";

const CONTEXT_SEGMENTS = 30;
/** Matches BrainRequestSchema's segment cap. */
const MAX_REQUEST_SEGMENTS = 80;
/** Already-processed segments sent along with a backlog, for context. */
const BACKLOG_CONTEXT = 5;

let engine: SttEngine | null = null;
let scheduler: BrainScheduler | null = null;
/** null = unknown until the first AI call answers. */
let llmAvailable: boolean | null = null;
/** Set while endSession runs, so the engine's own "stopped" event doesn't re-enter it. */
let ending = false;

function nextId(prefix: string, ids: string[]): string {
  const max = ids.reduce((m, id) => {
    const n = id.startsWith(prefix) ? Number(id.slice(prefix.length)) : NaN;
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `${prefix}${max + 1}`;
}

export function buildRequest(processed: number): { request: BrainRequest; total: number } | null {
  const s = useSession.getState();
  const all = s.segments.length;
  if (all <= processed) return null;
  // Normally the last 30 segments; after a long stall, start at the oldest unsent one so
  // nothing is skipped, and send at most 80 (the rest goes in the next tick).
  const start = Math.max(0, Math.min(all - CONTEXT_SEGMENTS, processed - BACKLOG_CONTEXT));
  const total = Math.min(all, start + MAX_REQUEST_SEGMENTS);
  const window = s.segments.slice(start, total);
  const offset = start;
  const board: Board = s.board;
  return {
    total,
    request: {
      segments: window.map((seg, i) => ({
        id: seg.id,
        speaker: seg.speaker,
        text: seg.text.slice(0, 4000),
        isNew: offset + i >= processed,
      })),
      board: summarizeBoard(board).slice(0, 12000),
      openFollowups: s.notes.filter((n) => n.kind === "followup" && !n.resolved).slice(-20).map((n) => ({ id: n.id, text: n.text })),
      recentNotes: s.notes.slice(-30).map((n) => n.text),
      nextIds: {
        section: nextId("s", board.sections.map((x) => x.id)),
        visual: nextId("v", Object.keys(board.visuals)),
      },
      mapLanguage: s.settings.mapLanguage,
      spokenLanguages: s.settings.languages,
    },
  };
}

/** Without an LLM, the demo still draws by replaying the script's reference ops. */
function applyDemoFallback(segments: Segment[]) {
  if (llmAvailable !== false) return;
  const { applyBrain } = useSession.getState();
  for (const seg of segments) {
    const line = demoLineForSegment(seg.id);
    if (line) applyBrain({ ops: line.ops ?? [], notes: line.notes ?? [], resolvedFollowups: [], resolveAll: line.resolvesFollowups });
  }
}

let starting = false;

export async function startSession(): Promise<void> {
  if (starting) return; // ignore double-clicks while the previous start is in progress
  starting = true;
  try {
    await startSessionInner();
  } finally {
    starting = false;
  }
}

async function startSessionInner(): Promise<void> {
  await stopEngine();
  scheduler?.stop();
  const store = useSession.getState();
  const { settings } = store;
  store.begin();

  const opts = { languages: settings.languages, terms: settings.terms, withTabAudio: settings.withTabAudio };
  if (settings.engine === "replay") {
    const lines = parseTranscript(settings.replayText);
    // Show the transcript's real speaker names instead of "Speaker 1/2".
    for (const [name, id] of speakerIds(lines)) useSession.getState().renameSpeaker(id, name);
    engine = new ReplayEngine(lines, settings.replaySpeed);
  } else {
    engine = settings.engine === "soniox" ? new SonioxEngine(opts) : settings.engine === "browser" ? new BrowserSpeechEngine(opts) : new DemoEngine();
  }

  // Learn up front whether an LLM is configured, so the demo can fall back instantly.
  llmAvailable = null;
  try {
    const cfg = (await fetch("/api/config").then((r) => r.json())) as { llm: boolean };
    llmAvailable = cfg.llm;
  } catch {
    /* unknown: the scheduler discovers it on its first call */
  }

  scheduler = null;
  if (llmAvailable === false) {
    useSession.getState().setBrainStatus("off", "No LLM key configured");
  } else {
    scheduler = new BrainScheduler({
      buildRequest,
      onResult: (r) => useSession.getState().applyBrain(r),
      onStatus: (status, detail) => {
        if (status === "off") llmAvailable = false;
        useSession.getState().setBrainStatus(status, detail);
      },
      onCall: () => useSession.getState().countBrainCall(),
    });
  }

  const current = engine;
  try {
    await current.start({
      onSegments: (segments) => {
        if (engine !== current) return;
        useSession.getState().addSegments(segments);
        applyDemoFallback(segments);
        scheduler?.notify();
      },
      onPartial: (partial) => {
        if (engine === current) useSession.getState().setPartial(partial);
      },
      onState: (state, detail) => {
        if (engine !== current) return;
        useSession.getState().setEngineState(state, detail);
        // The demo ends on its own; close the session so the timer stops and the canvas unlocks.
        if (state === "stopped" && !ending && useSession.getState().phase === "live") void endSession();
      },
    });
  } catch (err) {
    useSession.getState().setEngineState("error", err instanceof Error ? err.message : "Could not start");
  }
}

async function stopEngine(): Promise<void> {
  const e = engine;
  engine = null;
  if (e) await e.stop().catch(() => undefined);
}

export async function endSession(): Promise<void> {
  if (ending) return;
  ending = true;
  try {
    // Stop first while the engine is still current, so its final words are kept.
    const e = engine;
    if (e) await e.stop().catch(() => undefined);
    engine = null;
    await scheduler?.flush();
    scheduler?.stop();
    scheduler = null;
    useSession.getState().end();
  } finally {
    ending = false;
  }
}

export function setPaused(paused: boolean): void {
  if (paused) engine?.pause();
  else engine?.resume();
  useSession.getState().setPaused(paused);
}

export async function newSession(): Promise<void> {
  await stopEngine();
  scheduler?.stop();
  scheduler = null;
  useSession.getState().reset();
}
