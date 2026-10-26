import type { EngineCallbacks, EngineOptions, SttEngine } from "./engine";

/* Minimal typings for the Web Speech API (not in lib.dom for all browsers). */
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

/** Errors that will repeat on every restart, so we stop instead of looping. */
const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported", "network"]);

const LOCALE: Record<string, string> = { en: "en-IN", ta: "ta-IN", hi: "hi-IN", te: "te-IN", kn: "kn-IN", ml: "ml-IN" };

export function browserSpeechSupported(): boolean {
  return typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

/**
 * Free fallback using the browser's built-in recognizer. One language at a
 * time, no speaker labels; good enough to try the app without any keys.
 */
export class BrowserSpeechEngine implements SttEngine {
  private rec: Recognition | null = null;
  private running = false;
  private paused = false;
  private counter = 0;
  private startedAt = 0;
  private cb: EngineCallbacks | null = null;

  constructor(private readonly opts: EngineOptions) {}

  async start(cb: EngineCallbacks): Promise<void> {
    const w = window as unknown as Record<string, new () => Recognition>;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) throw new Error("This browser has no built-in speech recognition. Use Chrome, or add a Soniox key.");
    const rec = new Ctor();
    this.cb = cb;
    const primary = this.opts.languages.find((l) => l !== "en") ?? "en";
    rec.lang = LOCALE[primary] ?? primary;
    rec.continuous = true;
    rec.interimResults = true;
    this.startedAt = Date.now();

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript.trim();
        if (!text) continue;
        if (r.isFinal) {
          this.counter += 1;
          const now = Date.now() - this.startedAt;
          cb.onSegments([{ id: `br${this.counter}`, speaker: "1", text, startMs: now, endMs: now }]);
        } else {
          interim += `${text} `;
        }
      }
      cb.onPartial(interim.trim() ? { speaker: "1", text: interim.trim() } : null);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (FATAL_ERRORS.has(e.error)) this.running = false; // stop the onend auto-restart loop
      cb.onState("error", e.error === "not-allowed" ? "Microphone permission denied" : `Speech error: ${e.error}`);
    };
    // Chrome ends recognition after silence; keep it going while the session runs.
    rec.onend = () => {
      if (!this.running || this.paused) return;
      try {
        rec.start();
      } catch {
        /* already restarting */
      }
    };

    this.rec = rec;
    this.running = true;
    rec.start();
    cb.onState("live");
  }

  async stop(): Promise<void> {
    this.running = false;
    this.rec?.stop();
    this.rec = null;
    this.cb?.onPartial(null);
    this.cb?.onState("stopped");
  }

  pause(): void {
    this.paused = true;
    this.rec?.stop();
  }

  resume(): void {
    this.paused = false;
    if (!this.running) return;
    try {
      this.rec?.start();
    } catch {
      /* still stopping; onend will restart it */
    }
  }
}
