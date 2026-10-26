"use client";

import { CaptureUpdateAction, Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { layoutBoard } from "@/lib/board/layout";
import { useSession } from "@/lib/store";
import ShapePicker from "./ShapePicker";
import { shapesToElements } from "./toExcalidraw";

const PAPER = "#fdfdfc";

export default function BoardCanvasInner() {
  const board = useSession((s) => s.board);
  const phase = useSession((s) => s.phase);
  const followLive = useSession((s) => s.followLive);
  const setFollowLive = useSession((s) => s.setFollowLive);
  const title = useSession((s) => s.settings.title);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const lastFocus = useRef<string>("");

  const scene = useMemo(() => layoutBoard(board), [board]);
  const elements = useMemo(() => shapesToElements(scene.shapes), [scene]);
  const editable = phase === "ended";

  // The board owns the canvas while live; after the session the user can edit freely.
  useEffect(() => {
    if (!api || editable) return;
    api.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER });
  }, [api, elements, editable]);

  // Follow the active section: scroll when it changes or grows.
  useEffect(() => {
    if (!api || !followLive || editable) return;
    const id = board.activeSectionId;
    if (!id) return;
    const b = scene.sectionBounds[id];
    const key = b ? `${id}:${b.x}:${b.y}:${b.h}` : id;
    if (key === lastFocus.current) return;
    lastFocus.current = key;
    const target = elements.filter((e) => e.id.startsWith(`${id}|`));
    if (target.length) api.scrollToContent(target, { animate: true, duration: 450 });
  }, [api, board.activeSectionId, scene, elements, followLive, editable]);

  const fitAll = () => {
    if (!api) return;
    setFollowLive(false);
    api.scrollToContent(undefined, { fitToViewport: true, viewportZoomFactor: 0.9, animate: true, duration: 450 });
  };

  const downloadPng = async () => {
    if (!api) return;
    const blob = await exportToBlob({
      elements: api.getSceneElements(),
      appState: { ...api.getAppState(), exportBackground: true, viewBackgroundColor: PAPER },
      files: api.getFiles(),
      mimeType: "image/png",
      exportPadding: 40,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "threadmap").replace(/[^\w-]+/g, "-").toLowerCase()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="tm-canvas relative h-full w-full"
      // Any manual pan/zoom means the user wants to look around; stop auto-follow.
      onWheelCapture={() => followLive && setFollowLive(false)}
      onPointerDownCapture={(e) => {
        if (followLive && (e.target as HTMLElement).tagName === "CANVAS") setFollowLive(false);
      }}
    >
      <Excalidraw
        excalidrawAPI={setApi}
        viewModeEnabled={!editable}
        zenModeEnabled={!editable}
        initialData={{ appState: { viewBackgroundColor: PAPER, currentItemFontFamily: 5 } }}
        UIOptions={{
          canvasActions: { changeViewBackgroundColor: false, loadScene: false, saveToActiveFile: false, toggleTheme: false, clearCanvas: false },
        }}
      />
      <div className="absolute right-4 top-4 z-10 flex gap-1.5">
        {!editable && <ShapePicker />}
        <button type="button" className="tm-pill tm-pill-sm tm-pill-ghost" onClick={fitAll}>
          Fit all
        </button>
        {board.sections.length > 0 && (
          <button type="button" className="tm-pill tm-pill-sm tm-pill-ghost" onClick={downloadPng}>
            Download PNG
          </button>
        )}
      </div>
      {board.sections.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="font-hand text-lg text-mute">The map draws itself here as you talk…</p>
        </div>
      )}
    </div>
  );
}
