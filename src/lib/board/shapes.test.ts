import { describe, expect, it } from "vitest";
import { textUnits, wrapText } from "./shapes";

describe("wrapText", () => {
  it("wraps English by words", () => {
    expect(wrapText("Product people actually love", 14)).toBe("Product people\nactually love");
  });

  it("truncates with an ellipsis past maxLines", () => {
    expect(wrapText("one two three four five six", 8, 2)).toBe("one two\nthree…");
  });

  it("counts Tamil grapheme clusters, not code units", () => {
    const word = "வாடிக்கையாளர்கள்"; // 16 code units, 9 clusters
    expect(word.length).toBe(16);
    expect(textUnits(word)).toBeLessThan(16);
    expect(wrapText(word, 14)).toBe(word);
  });

  it("never splits a grapheme cluster when truncating", () => {
    const word = "வாடிக்கையாளர்கள்";
    const out = wrapText(word, 6, 1);
    expect(out.endsWith("…")).toBe(true);
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const clusters = Array.from(seg.segment(word), (x) => x.segment);
    const kept = Array.from(seg.segment(out.slice(0, -1)), (x) => x.segment);
    expect(kept).toEqual(clusters.slice(0, kept.length));
  });

  it("handles Devanagari", () => {
    expect(wrapText("हिन्दी में नोट्स", 20)).toBe("हिन्दी में नोट्स");
  });
});
