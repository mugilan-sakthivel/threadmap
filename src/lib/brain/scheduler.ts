import type { BrainRequest, BrainResult } from "./schema";

const DEBOUNCE_MS = 1500;
const MAX_WAIT_MS = 6000;
const ERROR_BACKOFF_MS = 5000;
const MAX_CONSECUTIVE_ERRORS = 5;

export type SchedulerHooks = {
  /** Build the request; `isNew` must mark segments after `processedCount`. */
  buildRequest: (processedCount: number) => { request: BrainRequest; total: number } | null;
  onResult: (result: BrainResult) => void;
  onStatus: (status: "idle" | "thinking" | "off" | "error", detail?: string) => void;
  onCall: () => void;
};

/**
 * Batches finalized transcript into LLM ticks: waits for a short pause in
 * speech (debounce), never waits longer than MAX_WAIT, and keeps at most one
 * request in flight. Segments that arrive mid-flight go into the next tick.
 */
export class BrainScheduler {
  private processed = 0;
  private inFlight = false;
  private dirty = false;
  private firstDirtyAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disabled = false;
  private stopped = false;
  private lastErrorAt = 0;
  private consecutiveErrors = 0;
  private current: Promise<void> | null = null;

  constructor(private readonly hooks: SchedulerHooks) {}

  /** Call whenever new final segments arrive. */
  notify(): void {
    if (this.disabled || this.stopped) return;
    const now = Date.now();
    if (!this.dirty) this.firstDirtyAt = now;
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    const waited = now - this.firstDirtyAt;
    const backoff = Math.max(0, this.lastErrorAt + ERROR_BACKOFF_MS - now);
    const delay = Math.max(backoff, Math.min(DEBOUNCE_MS, MAX_WAIT_MS - waited));
    this.timer = setTimeout(() => void this.run(), delay);
  }

  /** Flush any pending transcript immediately (used when the session ends). */
  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    // Let an in-flight tick land, then send whatever arrived meanwhile.
    if (this.current) await this.current;
    if (this.timer) clearTimeout(this.timer);
    if (this.dirty) await this.run();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private run(): Promise<void> {
    if (this.inFlight || this.disabled) return this.current ?? Promise.resolve();
    this.current = this.tick().finally(() => {
      this.current = null;
    });
    return this.current;
  }

  private async tick(): Promise<void> {
    const built = this.hooks.buildRequest(this.processed);
    this.dirty = false;
    if (!built) return;
    this.inFlight = true;
    this.hooks.onStatus("thinking");
    this.hooks.onCall();
    try {
      const res = await fetch("/api/brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(built.request),
      });
      const body = (await res.json().catch(() => ({}))) as BrainResult & { error?: string };
      if (res.status === 503 && body.error === "llm_not_configured") {
        this.disabled = true;
        this.hooks.onStatus("off", "No LLM key configured");
        return;
      }
      if (!res.ok) throw new Error(body.error ?? `AI request failed (${res.status})`);
      this.processed = built.total;
      this.consecutiveErrors = 0;
      if (!this.stopped) this.hooks.onResult(body);
      this.hooks.onStatus("idle");
    } catch (err) {
      this.lastErrorAt = Date.now();
      this.consecutiveErrors += 1;
      const message = err instanceof Error ? err.message : "AI request failed";
      if (this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        // Likely misconfiguration (bad model name, invalid key); stop burning requests.
        this.disabled = true;
        this.hooks.onStatus("error", `${message} (paused after ${MAX_CONSECUTIVE_ERRORS} failures)`);
        return;
      }
      this.dirty = true; // retry these segments on the next tick
      this.hooks.onStatus("error", message);
    } finally {
      this.inFlight = false;
      if (this.dirty && !this.stopped && !this.disabled) this.notify();
    }
  }
}
