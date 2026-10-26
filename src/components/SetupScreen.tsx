"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { startSession } from "@/lib/controller";
import { MAP_LANGUAGES, SPOKEN_OPTIONS } from "@/lib/languages";
import { browserSpeechSupported } from "@/lib/stt/browser";
import { useSession, type Settings } from "@/lib/store";

type Capabilities = { stt: boolean; llm: boolean; model: string | null };

type AudioChoice = { id: string; label: string; hint: string; engine: Settings["engine"]; tab: boolean; needs?: "stt" | "browser" | "llm" };

const AUDIO_CHOICES: AudioChoice[] = [
  { id: "demo", label: "Play the demo conversation", hint: "no mic, no keys needed", engine: "demo", tab: false },
  { id: "mic", label: "My mic", hint: "in-person · Soniox", engine: "soniox", tab: false, needs: "stt" },
  { id: "mic-tab", label: "My mic + guest audio", hint: "Riverside / Zoom / Meet tab", engine: "soniox", tab: true, needs: "stt" },
  { id: "browser", label: "Browser speech (free)", hint: "Chrome, one language, no speakers", engine: "browser", tab: false, needs: "browser" },
  { id: "replay", label: "Replay a transcript", hint: "paste a real episode · needs AI", engine: "replay", tab: false, needs: "llm" },
];

const noopSubscribe = () => () => {};

function Step({ n, title, aside, children }: { n: number; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="tm-rise">
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="tm-num">{n}</span>
        <h2 className="tm-serif text-base">{title}</h2>
        {aside && <span className="ml-auto font-ui text-xs text-soft">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export default function SetupScreen() {
  const settings = useSession((s) => s.settings);
  const setSettings = useSession((s) => s.setSettings);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [termsText, setTermsText] = useState(settings.terms.join(", "));
  // Server render assumes no browser speech; the client reads the real value without a mismatch.
  const hasBrowserSpeech = useSyncExternalStore(noopSubscribe, browserSpeechSupported, () => false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setCaps)
      .catch(() => setCaps({ stt: false, llm: false, model: null }));
  }, []);

  const spokenId = SPOKEN_OPTIONS.find((o) => o.codes.join() === settings.languages.join())?.id;
  const audioId = settings.engine === "soniox" ? (settings.withTabAudio ? "mic-tab" : "mic") : settings.engine;

  const available = (c: AudioChoice) =>
    c.needs === "stt" ? Boolean(caps?.stt) : c.needs === "browser" ? hasBrowserSpeech : c.needs === "llm" ? Boolean(caps?.llm) : true;

  const selected = AUDIO_CHOICES.find((c) => c.id === audioId);
  const canStart = (selected ? available(selected) : false) && (settings.engine !== "replay" || settings.replayText.trim().length > 0);

  const start = () => {
    setSettings({ terms: termsText.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 30) });
    void startSession();
  };

  return (
    <main className="grid min-h-full grid-cols-1 lg:grid-cols-[340px_1fr]">
      <aside className="flex flex-col border-dashed border-dash px-8 py-10 lg:sticky lg:top-0 lg:h-screen lg:border-r">
        <div className="tm-serif text-[21px]">✳︎ ThreadMap</div>
        <h1 className="tm-serif mt-6 text-[30px] leading-[1.08]">
          Start a new
          <br />
          session 🎙
        </h1>
        <p className="mt-3.5 text-sm leading-relaxed">
          Tell us who&apos;s talking and in which languages. The conversation is drawn on the canvas as it happens, with the transcript and notes logged on the right.
        </p>
        <div className="mt-5 flex gap-1.5">
          <button type="button" className="tm-pill tm-pill-pink" onClick={start} disabled={!canStart}>
            {settings.engine === "demo" ? "Play demo" : settings.engine === "replay" ? "Start replay" : "Start recording"}
          </button>
        </div>

        <div className="mt-auto space-y-1.5 pt-10 font-ui text-xs text-soft">
          <Status ok={caps?.stt} label="Speech-to-text (Soniox)" missing="add SONIOX_API_KEY" />
          <Status ok={caps?.llm} label={caps?.model ? `AI drawing (${caps.model})` : "AI drawing"} missing="add LLM_API_KEY + LLM_MODEL" />
          {caps && !caps.llm && <p className="pt-1 leading-relaxed">Without an AI key the demo uses pre-recorded drawing steps.</p>}
        </div>
      </aside>

      <div className="grid content-start gap-10 px-6 py-10 md:grid-cols-2 md:px-12">
        <div className="flex flex-col gap-7">
          <Step n={1} title="Episode title">
            <input
              className="tm-field"
              placeholder="Ep 14 · How Priya built a ₹10Cr D2C brand"
              value={settings.title}
              maxLength={120}
              onChange={(e) => setSettings({ title: e.target.value })}
            />
          </Step>

          <Step n={2} title="Spoken language">
            <div className="flex flex-col gap-1.5">
              {SPOKEN_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`tm-row ${o.id === spokenId ? "tm-row-selected" : ""}`}
                  onClick={() => setSettings({ languages: o.codes })}
                >
                  <span>
                    {o.label}
                    {o.hint && <span className="ml-2.5 text-[12.5px] underline decoration-dotted underline-offset-3 opacity-60">{o.hint}</span>}
                  </span>
                  {o.id === spokenId && <span className="font-ui">✓</span>}
                </button>
              ))}
            </div>
          </Step>

          <Step n={3} title="Draw the map in">
            <div className="flex flex-wrap gap-1.5">
              {MAP_LANGUAGES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`tm-pill tm-pill-sm ${settings.mapLanguage === m.id ? "tm-pill-dark" : "tm-pill-grey"}`}
                  onClick={() => setSettings({ mapLanguage: m.id })}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </Step>
        </div>

        <div className="flex flex-col gap-7">
          <Step n={4} title="Audio">
            <div className="flex flex-col gap-1.5">
              {AUDIO_CHOICES.map((c) => {
                const ok = available(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!ok}
                    title={ok ? undefined : c.needs === "stt" ? "Add SONIOX_API_KEY to .env.local" : c.needs === "llm" ? "Add an LLM key to .env.local" : "Not supported in this browser"}
                    className={`tm-row ${c.id === audioId ? "tm-row-selected" : ""} disabled:opacity-45`}
                    onClick={() => setSettings({ engine: c.engine, withTabAudio: c.tab })}
                  >
                    <span>{c.label}</span>
                    <span className="text-[12.5px] opacity-60">{ok ? c.hint : "needs key"}</span>
                  </button>
                );
              })}
            </div>
            {audioId === "replay" && (
              <div className="mt-2.5 flex flex-col gap-2">
                <textarea
                  aria-label="Transcript to replay"
                  className="tm-field min-h-36 rounded-2xl! font-ui text-[12.5px] leading-relaxed"
                  placeholder={"Lex Fridman (00:11:49) So 12 startups in 12 months…\nPieter Levels (00:11:55) Yeah…\n\nor  Host: …  /  [00:12] Guest: …"}
                  value={settings.replayText}
                  maxLength={200_000}
                  onChange={(e) => setSettings({ replayText: e.target.value })}
                />
                <div className="flex items-center gap-1.5">
                  <span className="font-ui text-xs text-soft">Speed</span>
                  {[1, 1.5, 2].map((x) => (
                    <button
                      key={x}
                      type="button"
                      className={`tm-pill tm-pill-sm ${settings.replaySpeed === x ? "tm-pill-dark" : "tm-pill-grey"}`}
                      onClick={() => setSettings({ replaySpeed: x })}
                    >
                      {x}×
                    </button>
                  ))}
                </div>
              </div>
            )}
            {audioId === "mic-tab" && (
              <p className="mt-2.5 font-ui text-xs leading-relaxed text-soft">
                When you press start, pick the browser tab with your call and tick <b>Share tab audio</b>.
              </p>
            )}
          </Step>

          <Step n={5} title="Names to spell right" aside="optional">
            <input
              className="tm-field"
              placeholder="Priya, Kanavu Naturals, Shark Tank"
              value={termsText}
              maxLength={600}
              onChange={(e) => setTermsText(e.target.value)}
            />
          </Step>
        </div>
      </div>
    </main>
  );
}

function Status({ ok, label, missing }: { ok: boolean | undefined; label: string; missing: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block size-2 rounded-full ${ok === undefined ? "bg-dot" : ok ? "bg-success" : "bg-dot"}`} />
      <span>
        {label}
        {ok === false && <span className="text-mute">: {missing}</span>}
      </span>
    </div>
  );
}
