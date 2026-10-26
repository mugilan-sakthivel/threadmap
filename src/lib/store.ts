"use client";

import { create } from "zustand";
import { applyOps, overrideTemplate } from "@/lib/board/reducer";
import type { BrainNote, Op } from "@/lib/brain/schema";
import type { EngineKind, EngineState } from "@/lib/stt/engine";
import { EMPTY_BOARD, type Board, type LivePartial, type Note, type Segment, type TemplateKind } from "@/lib/types";

export type Settings = {
  title: string;
  languages: string[];
  mapLanguage: string;
  engine: EngineKind;
  withTabAudio: boolean;
  terms: string[];
  /** Pasted transcript for replay mode. */
  replayText: string;
  replaySpeed: number;
};

export type BrainStatus = "idle" | "thinking" | "off" | "error";

type State = {
  phase: "setup" | "live" | "ended";
  settings: Settings;
  engineState: EngineState;
  engineDetail?: string;
  segments: Segment[];
  partial: LivePartial;
  notes: Note[];
  board: Board;
  brainStatus: BrainStatus;
  brainDetail?: string;
  brainCalls: number;
  speakerNames: Record<string, string>;
  followLive: boolean;
  paused: boolean;
  startedAt: number | null;
  /** Elapsed time banked before the current pause/resume span. */
  elapsedBeforePause: number;
};

type Actions = {
  setSettings: (patch: Partial<Settings>) => void;
  begin: () => void;
  end: () => void;
  reset: () => void;
  setEngineState: (state: EngineState, detail?: string) => void;
  addSegments: (segments: Segment[]) => void;
  setPartial: (partial: LivePartial) => void;
  applyBrain: (result: { ops: Op[]; notes: BrainNote[]; resolvedFollowups: string[]; resolveAll?: boolean }) => void;
  setBrainStatus: (status: BrainStatus, detail?: string) => void;
  countBrainCall: () => void;
  renameSpeaker: (speaker: string, name: string) => void;
  setFollowLive: (on: boolean) => void;
  setPaused: (paused: boolean) => void;
  toggleNoteResolved: (id: string) => void;
  setVisualTemplate: (visualId: string, template: TemplateKind) => void;
};

export const DEFAULT_SETTINGS: Settings = {
  title: "",
  languages: ["ta", "en"],
  mapLanguage: "English",
  engine: "demo",
  withTabAudio: false,
  terms: [],
  replayText: "",
  replaySpeed: 1,
};

const fresh = (): Omit<State, "settings" | "phase"> => ({
  engineState: "idle",
  engineDetail: undefined,
  segments: [],
  partial: null,
  notes: [],
  board: EMPTY_BOARD,
  brainStatus: "idle",
  brainDetail: undefined,
  brainCalls: 0,
  speakerNames: {},
  followLive: true,
  paused: false,
  startedAt: null,
  elapsedBeforePause: 0,
});

export function elapsedMs(s: Pick<State, "startedAt" | "elapsedBeforePause" | "paused">, now = Date.now()): number {
  if (s.startedAt === null || s.paused) return s.elapsedBeforePause;
  return s.elapsedBeforePause + (now - s.startedAt);
}

let noteCounter = 0;

export const useSession = create<State & Actions>()((set, get) => ({
  phase: "setup",
  settings: DEFAULT_SETTINGS,
  ...fresh(),

  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  begin: () => set({ ...fresh(), phase: "live", startedAt: Date.now() }),
  end: () =>
    set((s) => ({
      phase: "ended",
      partial: null,
      elapsedBeforePause: elapsedMs(s),
      startedAt: null,
      paused: false,
    })),
  reset: () => set({ ...fresh(), phase: "setup" }),
  setEngineState: (engineState, engineDetail) => set({ engineState, engineDetail }),
  addSegments: (segments) => set((s) => ({ segments: [...s.segments, ...segments] })),
  setPartial: (partial) => set({ partial }),

  applyBrain: ({ ops, notes, resolvedFollowups, resolveAll }) => {
    const s = get();
    const atMs = elapsedMs(s);
    const resolved = new Set(resolvedFollowups);
    const existing = s.notes.map((n) =>
      n.kind === "followup" && !n.resolved && (resolveAll || resolved.has(n.id)) ? { ...n, resolved: true } : n,
    );
    const seen = new Set(existing.map((n) => n.text.toLowerCase()));
    const added: Note[] = [];
    for (const n of notes) {
      const key = n.text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      noteCounter += 1;
      added.push({ id: `n${noteCounter}`, kind: n.kind, text: n.text, sourceIds: n.source, atMs });
    }
    set({ board: applyOps(s.board, ops), notes: [...existing, ...added] });
  },

  setBrainStatus: (brainStatus, brainDetail) => set({ brainStatus, brainDetail }),
  countBrainCall: () => set((s) => ({ brainCalls: s.brainCalls + 1 })),
  renameSpeaker: (speaker, name) => set((s) => ({ speakerNames: { ...s.speakerNames, [speaker]: name } })),
  setFollowLive: (followLive) => set({ followLive }),
  setPaused: (paused) =>
    set((s) => {
      if (paused === s.paused || s.startedAt === null) return {};
      return paused
        ? { paused: true, elapsedBeforePause: elapsedMs(s) }
        : { paused: false, startedAt: Date.now() };
    }),
  setVisualTemplate: (visualId, template) => set((s) => ({ board: overrideTemplate(s.board, visualId, template) })),
  toggleNoteResolved: (id) =>
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, resolved: !n.resolved } : n)) })),
}));

export function speakerLabel(names: Record<string, string>, speaker: string): string {
  return names[speaker] ?? `Speaker ${speaker}`;
}
