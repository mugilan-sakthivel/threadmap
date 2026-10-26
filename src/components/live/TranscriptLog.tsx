"use client";

import { useStickToBottom } from "@/components/live/useStickToBottom";
import { speakerLabel, useSession } from "@/lib/store";

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** Host-ish first speaker in ink, everyone else in the accent plum. */
function speakerColor(speaker: string): string {
  return speaker === "1" ? "text-ink" : "text-speaker";
}

export default function TranscriptLog() {
  const segments = useSession((s) => s.segments);
  const partial = useSession((s) => s.partial);
  const names = useSession((s) => s.speakerNames);
  const rename = useSession((s) => s.renameSpeaker);
  const { ref, onScroll } = useStickToBottom([segments.length, partial?.text]);

  const askRename = (speaker: string) => {
    const name = window.prompt("Name for this speaker", speakerLabel(names, speaker))?.trim();
    if (name) rename(speaker, name.slice(0, 40));
  };

  return (
    <div ref={ref} onScroll={onScroll} className="tm-card min-h-0 overflow-y-auto px-4 py-3 text-[13px] leading-normal">
      {segments.length === 0 && !partial && <p className="py-6 text-center font-ui text-xs text-soft">Waiting for someone to speak…</p>}
      {segments.map((seg) => (
        <p key={seg.id} className="mb-2.5 tm-rise">
          <button type="button" onClick={() => askRename(seg.speaker)} className={`tm-serif text-[13.5px] font-semibold ${speakerColor(seg.speaker)} hover:underline`} title="Rename speaker">
            {speakerLabel(names, seg.speaker)}
          </button>{" "}
          <span className="font-ui text-[10.5px] text-soft">{formatClock(seg.startMs)}</span>
          <br />
          {seg.text}
        </p>
      ))}
      {partial && (
        <p className="italic text-[#9a9a96]">
          <span className="tm-serif text-[13.5px] font-semibold not-italic text-[#d27bc0]">{speakerLabel(names, partial.speaker)}</span>{" "}
          <span className="font-ui text-[10.5px] not-italic">now</span>
          <br />
          {partial.text}
        </p>
      )}
    </div>
  );
}
