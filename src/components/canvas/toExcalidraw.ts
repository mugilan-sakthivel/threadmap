import { convertToExcalidrawElements, FONT_FAMILY } from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { Shape } from "@/lib/board/shapes";
import { seedFromId } from "./seed";

type Element = ReturnType<typeof convertToExcalidrawElements>[number];

const common = { roughness: 1, strokeWidth: 1, fillStyle: "solid" as const, opacity: 100 };

function toSkeleton(s: Shape): ExcalidrawElementSkeleton {
  return { ...baseSkeleton(s), seed: seedFromId(s.id) } as ExcalidrawElementSkeleton;
}

function baseSkeleton(s: Shape): ExcalidrawElementSkeleton {
  switch (s.kind) {
    case "rect":
    case "ellipse":
      return {
        ...common,
        type: s.kind === "rect" ? "rectangle" : "ellipse",
        id: s.id,
        x: s.x,
        y: s.y,
        width: s.w,
        height: s.h,
        strokeColor: s.stroke,
        backgroundColor: s.fill ?? "transparent",
        strokeStyle: s.dashed ? "dashed" : "solid",
        roundness: s.rounded ? { type: 3 } : null,
      };
    case "poly":
      // A closed line (first point == last point) is filled by Excalidraw.
      return {
        ...common,
        type: "line",
        id: s.id,
        x: s.x,
        y: s.y,
        points: s.points,
        strokeColor: s.stroke,
        backgroundColor: s.fill ?? "transparent",
        strokeStyle: s.dashed ? "dashed" : "solid",
      } as ExcalidrawElementSkeleton;
    case "line":
    case "arrow":
      return {
        ...common,
        type: s.kind,
        id: s.id,
        x: s.x,
        y: s.y,
        points: s.points,
        strokeColor: s.stroke,
        strokeStyle: s.dashed ? "dashed" : "solid",
        ...(s.kind === "arrow" ? { endArrowhead: "arrow" as const, startArrowhead: null } : {}),
      } as ExcalidrawElementSkeleton;
    case "text":
      return {
        ...common,
        type: "text",
        id: s.id,
        x: s.x,
        y: s.y,
        text: s.text,
        fontSize: s.size,
        fontFamily: s.font === "hand" ? FONT_FAMILY.Excalifont : FONT_FAMILY.Nunito,
        strokeColor: s.color,
        textAlign: s.align,
        customData: s.align === "center" ? { cx: s.x, cy: s.y } : undefined,
      };
  }
}

/**
 * Convert layout shapes into Excalidraw elements. Ids are kept stable so
 * updates modify elements in place, and centered text is positioned after
 * Excalidraw has measured it.
 */
export function shapesToElements(shapes: Shape[]): Element[] {
  const elements = convertToExcalidrawElements(shapes.map(toSkeleton), { regenerateIds: false });
  return elements.map((el) => {
    const c = el.customData as { cx?: number; cy?: number } | undefined;
    if (el.type !== "text" || c?.cx === undefined || c.cy === undefined) return el;
    return { ...el, x: c.cx - el.width / 2, y: c.cy - el.height / 2 };
  });
}
