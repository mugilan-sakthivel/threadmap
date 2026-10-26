import type { LivePartial, Segment } from "@/lib/types";

export type EngineState = "idle" | "connecting" | "live" | "reconnecting" | "stopped" | "error";

export type EngineCallbacks = {
  onSegments: (segments: Segment[]) => void;
  onPartial: (partial: LivePartial) => void;
  onState: (state: EngineState, detail?: string) => void;
};

export interface SttEngine {
  start(cb: EngineCallbacks): Promise<void>;
  stop(): Promise<void>;
  pause(): void;
  resume(): void;
}

export type EngineKind = "soniox" | "browser" | "demo" | "replay";

export type EngineOptions = {
  /** ISO codes, e.g. ["ta", "en"]. */
  languages: string[];
  /** Names and terms to spell correctly. */
  terms: string[];
  /** Also capture a browser tab's audio (the remote guest). */
  withTabAudio: boolean;
};
