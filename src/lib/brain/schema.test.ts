import { describe, expect, it } from "vitest";
import { extractJson, parseBrainOutput } from "./schema";

describe("parseBrainOutput", () => {
  it("keeps valid items and drops invalid ones individually", () => {
    const r = parseBrainOutput({
      notes: [{ kind: "point", text: "Reels 3/day", source: ["s1"] }, { kind: "nonsense", text: "x" }],
      ops: [
        { op: "create_visual", id: "v1", template: "pyramid", capacity: 3 },
        { op: "create_visual", id: "v2", template: "hexagon" },
        { op: "fill_slot", visual: "v1", label: "Brand" },
      ],
      resolved_followups: ["n1", 42],
    });
    expect(r.ops.map((o) => o.op)).toEqual(["create_visual", "fill_slot"]);
    expect(r.notes).toHaveLength(1);
    expect(r.resolvedFollowups).toEqual(["n1"]);
    expect(r.dropped).toBe(2);
  });

  it("tolerates garbage", () => {
    expect(parseBrainOutput(null)).toEqual({ notes: [], ops: [], resolvedFollowups: [], dropped: 0 });
    expect(parseBrainOutput({ ops: "nope" }).ops).toEqual([]);
  });

  it("clamps capacity", () => {
    const r = parseBrainOutput({ ops: [{ op: "create_visual", id: "v", template: "grid", capacity: 99 }] });
    expect(r.ops).toEqual([]);
  });
});

describe("extractJson", () => {
  it("reads fenced JSON", () => {
    expect(extractJson('Sure!\n```json\n{"ops": []}\n```')).toEqual({ ops: [] });
  });
  it("throws without an object", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});
