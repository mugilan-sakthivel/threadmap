import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrainScheduler } from "./scheduler";
import type { BrainRequest } from "./schema";

const request = (n: number): BrainRequest => ({
  segments: Array.from({ length: n }, (_, i) => ({ id: `s${i}`, speaker: "1", text: "hi", isNew: true })),
  board: "",
  openFollowups: [],
  recentNotes: [],
  nextIds: { section: "s1", visual: "v1" },
  mapLanguage: "English",
  spokenLanguages: ["en"],
});

function setup(responses: Array<{ status: number; body: unknown }>) {
  let total = 0;
  const calls: number[] = [];
  const statuses: string[] = [];
  const results: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const r = responses.shift() ?? { status: 200, body: { ops: [], notes: [], resolvedFollowups: [], dropped: 0 } };
      return new Response(JSON.stringify(r.body), { status: r.status });
    }),
  );
  const s = new BrainScheduler({
    buildRequest: (processed) => {
      if (total <= processed) return null;
      calls.push(total - processed);
      return { request: request(total), total };
    },
    onResult: (r) => results.push(r),
    onStatus: (st) => statuses.push(st),
    onCall: () => undefined,
  });
  return { s, calls, statuses, results, add: (n: number) => (total += n) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("BrainScheduler", () => {
  it("debounces bursts of segments into one call", async () => {
    const t = setup([]);
    for (let i = 0; i < 3; i++) {
      t.add(1);
      t.s.notify();
      await vi.advanceTimersByTimeAsync(500);
    }
    await vi.advanceTimersByTimeAsync(2000);
    expect(t.calls).toEqual([3]);
  });

  it("never waits longer than the max wait during continuous speech", async () => {
    const t = setup([]);
    for (let i = 0; i < 10; i++) {
      t.add(1);
      t.s.notify();
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(t.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("disables itself when no LLM is configured", async () => {
    const t = setup([{ status: 503, body: { error: "llm_not_configured" } }]);
    t.add(1);
    t.s.notify();
    await vi.advanceTimersByTimeAsync(2000);
    t.add(1);
    t.s.notify();
    await vi.advanceTimersByTimeAsync(10000);
    expect(t.calls).toEqual([1]);
    expect(t.statuses).toContain("off");
  });

  it("retries failed segments on the next tick", async () => {
    const t = setup([{ status: 502, body: { error: "boom" } }]);
    t.add(2);
    t.s.notify();
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(6000);
    expect(t.calls).toEqual([2, 2]);
    expect(t.results).toHaveLength(1);
  });

  it("flush sends pending segments immediately", async () => {
    const t = setup([]);
    t.add(1);
    t.s.notify();
    await t.s.flush();
    expect(t.calls).toEqual([1]);
  });
});
