"use client";

import { useSession } from "@/lib/store";
import { TEMPLATE_KINDS, type TemplateKind } from "@/lib/types";

const LABELS: Record<TemplateKind, string> = {
  list: "List",
  pyramid: "Pyramid",
  funnel: "Funnel",
  grid: "Grid",
  steps: "Steps",
  cycle: "Cycle",
  comparison: "Comparison",
  timeline: "Timeline",
};

/**
 * Shows the shape of the diagram being drawn and lets the host correct it.
 * A manual choice locks the shape so the AI stops changing it.
 */
export default function ShapePicker() {
  // Only the diagram in the section being discussed; a new question hides the picker until it has one.
  const visual = useSession((s) => {
    const v = s.board.activeVisualId ? s.board.visuals[s.board.activeVisualId] : undefined;
    return v && v.sectionId === s.board.activeSectionId ? v : undefined;
  });
  const setVisualTemplate = useSession((s) => s.setVisualTemplate);
  if (!visual) return null;

  return (
    <label className="tm-pill tm-pill-sm tm-pill-ghost relative gap-1.5" title={visual.why ? `AI: ${visual.why}` : undefined}>
      <span className="text-soft">Shape</span>
      <select
        aria-label="Shape of the current diagram"
        className="cursor-pointer appearance-none bg-transparent pr-3 font-ui font-semibold text-ink outline-none"
        value={visual.template}
        onChange={(e) => setVisualTemplate(visual.id, e.target.value as TemplateKind)}
      >
        {TEMPLATE_KINDS.map((t) => (
          <option key={t} value={t}>
            {LABELS[t]}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 text-[10px] text-soft">▾</span>
      {visual.locked && <span className="text-[11px]" title="You set this shape; the AI won't change it">🔒</span>}
    </label>
  );
}
