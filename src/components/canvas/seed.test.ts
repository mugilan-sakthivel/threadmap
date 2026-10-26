import { describe, expect, it } from "vitest";
import { seedFromId } from "./seed";

describe("seedFromId", () => {
  it("is stable and distinct per id", () => {
    expect(seedFromId("s1|v1|grid|s0|box")).toBe(seedFromId("s1|v1|grid|s0|box"));
    expect(seedFromId("s1|v1|grid|s0|box")).not.toBe(seedFromId("s1|v1|grid|s1|box"));
    expect(seedFromId("x")).toBeGreaterThan(0);
  });
});
