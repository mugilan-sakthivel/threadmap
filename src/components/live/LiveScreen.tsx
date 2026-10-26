"use client";

import { useState } from "react";
import BoardCanvas from "@/components/canvas/BoardCanvas";
import Dock from "@/components/live/Dock";
import NotesLog from "@/components/live/NotesLog";
import TranscriptLog from "@/components/live/TranscriptLog";
import { endSession, newSession } from "@/lib/controller";
import { describeLanguages, MAP_LANGUAGES } from "@/lib/languages";
import { useSession } from "@/lib/store";

function StatusChip() {
  const engineState = useSession((s) => s.engineState);
  const engineDetail = useSession((s) => s.engineDetail);
  const brainStatus = useSession((s) => s.brainStatus);
  const brainDetail = useSession((s) => s.brainDetail);
  const calls = useSession((s) => s.brainCalls);
  const phase = useSession((s) => s.phase);

  const speech =
    engineState === "error"
      ? { text: `Mic: ${engineDetail ?? "error"}`, tone: "text-live" }
      : engineState === "connecting"
        ? { text: "Connecting…", tone: "text-soft" }
        : engineState === "reconnecting"
          ? { text: "Reconnecting…", tone: "text-soft" }
          : null;
  const ai =
    brainStatus === "thinking"
      ? { text: "AI drawing…", tone: "text-pink-ink" }
      : brainStatus === "off"
        ? { text: "AI off · demo steps", tone: "text-soft" }
        : brainStatus === "error"
          ? { text: "AI error", tone: "text-live" }
          : { text: calls ? `AI · ${calls} updates` : "AI ready", tone: "text-soft" };

  return (
    <div className="flex items-center gap-3 font-ui text-xs">
      {speech && phase === "live" && <span className={speech.tone}>{speech.text}</span>}
      <span className={ai.tone} title={brainDetail}>
        {ai.text}
      </span>
    </div>
  );
}

export default function LiveScreen() {
  const phase = useSession((s) => s.phase);
  const settings = useSession((s) => s.settings);
  const [ending, setEnding] = useState(false);
  const mapLabel = MAP_LANGUAGES.find((m) => m.id === settings.mapLanguage)?.label ?? settings.mapLanguage;

  const onEnd = async () => {
    setEnding(true);
    await endSession();
    setEnding(false);
  };

  return (
    <div className="grid h-screen grid-rows-[64px_1fr]">
      <header className="flex items-center gap-3.5 border-b border-dashed border-dash px-5">
        <div className="tm-serif text-[21px]">✳︎ ThreadMap</div>
        <div className="h-5 w-px bg-dash" />
        <div className="tm-serif min-w-0 truncate text-[15px]">{settings.title || "Untitled session"}</div>
        <span className="tm-tag hidden md:inline-flex">
          {describeLanguages(settings.languages)} → {mapLabel} map
        </span>
        <div className="ml-auto flex items-center gap-3">
          <StatusChip />
          {phase === "live" ? (
            <button type="button" className="tm-pill tm-pill-pink tm-pill-sm" onClick={onEnd} disabled={ending}>
              {ending ? "Ending…" : "End session"}
            </button>
          ) : (
            <button type="button" className="tm-pill tm-pill-dark tm-pill-sm" onClick={() => void newSession()}>
              New session
            </button>
          )}
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-1 md:grid-cols-[1fr_380px]">
        <div className="relative min-h-[60vh] min-w-0 md:min-h-0">
          <BoardCanvas />
          <Dock />
          {phase === "ended" && (
            <div className="tm-tag absolute bottom-24 left-1/2 z-10 -translate-x-1/2">Session ended · the canvas is now editable</div>
          )}
        </div>
        <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1.1fr)_auto_minmax(0,1fr)] gap-2.5 border-dashed border-dash p-3.5 md:border-l">
          <div className="flex items-center gap-2">
            <span className="tm-num">1</span>
            <h2 className="tm-serif text-base">Live transcript</h2>
          </div>
          <TranscriptLog />
          <div className="flex items-center gap-2 pt-1">
            <span className="tm-num">2</span>
            <h2 className="tm-serif text-base">Notes</h2>
          </div>
          <NotesLog />
        </aside>
      </div>
    </div>
  );
}
