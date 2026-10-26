"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/components/live/TranscriptLog";
import { setPaused } from "@/lib/controller";
import { elapsedMs, useSession } from "@/lib/store";

/** Floating dark control bar over the canvas (reference: Flowjam's dark pill). */
export default function Dock() {
  const phase = useSession((s) => s.phase);
  const paused = useSession((s) => s.paused);
  const followLive = useSession((s) => s.followLive);
  const setFollowLive = useSession((s) => s.setFollowLive);
  const engineState = useSession((s) => s.engineState);
  const [, tick] = useState(0);

  useEffect(() => {
    if (phase !== "live" || paused) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [phase, paused]);

  const elapsed = elapsedMs(useSession.getState());
  const live = phase === "live";
  const recording = live && !paused && (engineState === "live" || engineState === "reconnecting");

  return (
    <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[linear-gradient(#2b2b2b,#1c1c1c_50%,#2b2b2b)] p-1.5 shadow-dock">
      <span className="tm-pill text-white">
        {recording ? <span className="tm-live-dot" /> : <span className="inline-block size-2 rounded-full bg-white/30" />}
        <span className="font-ui font-semibold tabular-nums">{formatClock(elapsed)}</span>
      </span>
      {live && (
        <button
          type="button"
          className="tm-pill bg-white/10 text-white"
          onClick={() => setPaused(!paused)}
          // The speech engine can only pause once it is actually streaming.
          disabled={!paused && engineState !== "live"}
        >
          {paused ? "▶ Resume" : "❚❚ Pause"}
        </button>
      )}
      {live && (
        <button
          type="button"
          className={`tm-pill ${followLive ? "tm-pill-pink" : "bg-white/10 text-white"}`}
          onClick={() => setFollowLive(!followLive)}
          title="Keep the camera on the section being discussed"
        >
          ◎ Follow live
        </button>
      )}
    </div>
  );
}
