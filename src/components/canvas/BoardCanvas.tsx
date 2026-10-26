"use client";

import dynamic from "next/dynamic";

/** Excalidraw touches `window` at import time, so it only loads in the browser. */
const BoardCanvas = dynamic(() => import("./BoardCanvasInner"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center font-ui text-sm text-mute">Loading canvas…</div>,
});

export default BoardCanvas;
