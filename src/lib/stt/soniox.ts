import { SonioxClient, type Recording } from "@soniox/client";
import { TokenAssembler } from "./assembler";
import type { EngineCallbacks, EngineOptions, SttEngine } from "./engine";
import { MixedSource } from "./mixedSource";

const STOP_TIMEOUT_MS = 5000;

async function fetchTemporaryKey(): Promise<string> {
  const res = await fetch("/api/stt-token", { method: "POST" });
  const body = (await res.json().catch(() => ({}))) as { api_key?: string; error?: string };
  if (!res.ok || !body.api_key) throw new Error(body.error ?? `Could not get a speech key (${res.status})`);
  return body.api_key;
}

export class SonioxEngine implements SttEngine {
  private recording: Recording | null = null;
  private assembler = new TokenAssembler("sx");
  private cb: EngineCallbacks | null = null;

  constructor(private readonly opts: EngineOptions) {}

  async start(cb: EngineCallbacks): Promise<void> {
    this.cb = cb;
    cb.onState("connecting");
    const client = new SonioxClient({ api_key: fetchTemporaryKey });
    const recording = client.realtime.record({
      model: "stt-rt-v5",
      language_hints: this.opts.languages,
      enable_speaker_diarization: true,
      enable_language_identification: true,
      enable_endpoint_detection: true,
      context: this.opts.terms.length > 0 ? { terms: this.opts.terms } : undefined,
      source: this.opts.withTabAudio ? new MixedSource() : undefined,
      // Survive Wi-Fi blips during long recordings; already-final text is kept (see session_restart).
      auto_reconnect: true,
      max_reconnect_attempts: 6,
    });
    this.recording = recording;

    recording.on("result", (result) => {
      const { finals, partial } = this.assembler.push(result.tokens);
      if (finals.length) cb.onSegments(finals);
      cb.onPartial(partial);
    });
    recording.on("connected", () => cb.onState("live"));
    recording.on("reconnecting", () => cb.onState("reconnecting"));
    recording.on("reconnected", () => cb.onState("live"));
    recording.on("error", (err) => cb.onState("error", err.message));
    recording.on("session_restart", ({ reset_transcript }) => {
      if (!reset_transcript) return;
      // Keep words that were already final, then start a clean buffer for the new connection.
      const rest = this.assembler.flush();
      if (rest.length) cb.onSegments(rest);
      cb.onPartial(null);
      this.assembler = new TokenAssembler(`sx${Date.now()}_`);
    });
  }

  async stop(): Promise<void> {
    const recording = this.recording;
    this.recording = null;
    if (recording) {
      // stop() waits for the server's "finished" message; a stalled socket must not hang the session end.
      const timedOut = await Promise.race([
        recording.stop().then(() => false, () => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(true), STOP_TIMEOUT_MS)),
      ]);
      if (timedOut) recording.cancel();
    }
    const rest = this.assembler.flush();
    if (rest.length) this.cb?.onSegments(rest);
    this.cb?.onPartial(null);
    this.cb?.onState("stopped");
  }

  pause(): void {
    this.recording?.pause();
  }

  resume(): void {
    this.recording?.resume();
  }
}
