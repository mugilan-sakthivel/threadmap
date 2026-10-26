"use client";

import { useStickToBottom } from "@/components/live/useStickToBottom";
import { formatClock } from "@/components/live/TranscriptLog";
import { useSession } from "@/lib/store";
import type { Note } from "@/lib/types";

const KIND_LABEL: Record<Note["kind"], string> = {
  point: "",
  followup: "FOLLOW UP",
  quote: "QUOTE",
  action: "CLIP / TODO",
};

export default function NotesLog() {
  const notes = useSession((s) => s.notes);
  const toggle = useSession((s) => s.toggleNoteResolved);
  const { ref, onScroll } = useStickToBottom([notes.length]);

  // Open follow-ups stay pinned on top so the host sees them at a glance.
  const open = notes.filter((n) => n.kind === "followup" && !n.resolved);
  const rest = notes.filter((n) => !(n.kind === "followup" && !n.resolved));

  return (
    <div ref={ref} onScroll={onScroll} className="flex min-h-0 flex-col gap-1.5 overflow-y-auto pb-2">
      {notes.length === 0 && <p className="py-6 text-center font-ui text-xs text-soft">Key points, quotes and follow-ups appear here.</p>}
      {open.map((n) => (
        <button key={n.id} type="button" onClick={() => toggle(n.id)} title="Mark as asked" className="tm-row tm-row-selected tm-rise flex-col items-start! gap-0.5 rounded-2xl!">
          <span className="font-ui text-[10.5px] tracking-wider text-[#ff9cf0]">FOLLOW UP · tap when asked</span>
          <span>{n.text}</span>
        </button>
      ))}
      {rest.map((n) => (
        <div
          key={n.id}
          className={`tm-row tm-rise rounded-2xl! ${n.kind === "quote" ? "border border-hair bg-white!" : ""} ${n.resolved ? "opacity-50" : ""}`}
        >
          <span className={n.resolved ? "line-through" : ""}>
            {KIND_LABEL[n.kind] && <span className="mr-2 font-ui text-[10px] tracking-wider text-soft">{KIND_LABEL[n.kind]}</span>}
            {n.text}
          </span>
          <span className="font-ui text-[10.5px] text-soft">{formatClock(n.atMs)}</span>
        </div>
      ))}
    </div>
  );
}
