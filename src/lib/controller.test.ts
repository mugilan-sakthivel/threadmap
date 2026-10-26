import { beforeEach, describe, expect, it } from "vitest";
import { buildRequest } from "./controller";
import { useSession } from "./store";
import type { Segment } from "./types";

const segs = (n: number): Segment[] => Array.from({ length: n }, (_, i) => ({ id: `seg${i}`, speaker: "1", text: `line ${i}`, startMs: i, endMs: i }));

beforeEach(() => useSession.getState().reset());

describe("buildRequest", () => {
  it("sends the last 30 segments in normal flow", () => {
    useSession.getState().addSegments(segs(40));
    const r = buildRequest(38)!;
    expect(r.total).toBe(40);
    expect(r.request.segments).toHaveLength(30);
    expect(r.request.segments.filter((s) => s.isNew).map((s) => s.id)).toEqual(["seg38", "seg39"]);
  });

  it("never skips unsent segments after a long stall, and caps at 80", () => {
    useSession.getState().addSegments(segs(150));
    const first = buildRequest(10)!;
    expect(first.request.segments[0].id).toBe("seg5"); // 5 segments of context
    expect(first.request.segments).toHaveLength(80);
    expect(first.total).toBe(85);
    const second = buildRequest(first.total)!;
    expect(second.request.segments.find((s) => s.isNew)?.id).toBe("seg85");
    expect(second.total).toBe(150);
  });

  it("returns null when nothing is new", () => {
    useSession.getState().addSegments(segs(3));
    expect(buildRequest(3)).toBeNull();
  });
});
