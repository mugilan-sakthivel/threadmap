import { describe, expect, it } from "vitest";
import { TokenAssembler, type SttToken } from "./assembler";

const f = (text: string, speaker = "1", start_ms = 0, end_ms = 0): SttToken => ({ text, is_final: true, speaker, start_ms, end_ms });
const nf = (text: string, speaker = "1"): SttToken => ({ text, is_final: false, speaker });

describe("TokenAssembler", () => {
  it("shows final + non-final text as the live partial", () => {
    const a = new TokenAssembler();
    const r = a.push([f("There", "1", 0, 100), f(" are"), nf(" four"), nf(" methods")]);
    expect(r.finals).toEqual([]);
    expect(r.partial).toEqual({ speaker: "1", text: "There are four methods" });
  });

  it("closes a segment at an endpoint", () => {
    const a = new TokenAssembler();
    a.push([f("Hello", "1", 0, 300)]);
    const r = a.push([f(" world", "1", 300, 600), f("<end>")]);
    expect(r.finals).toEqual([{ id: "seg1", speaker: "1", text: "Hello world", startMs: 0, endMs: 600, lang: undefined }]);
    expect(r.partial).toBeNull();
  });

  it("splits on speaker change", () => {
    const a = new TokenAssembler();
    const r = a.push([f("Question?", "1"), f("Answer", "2")]);
    expect(r.finals.map((s) => [s.speaker, s.text])).toEqual([["1", "Question?"]]);
    expect(r.partial?.speaker).toBe("2");
    expect(a.flush().map((s) => s.text)).toEqual(["Answer"]);
  });

  it("ignores non-final boundary tokens and empty segments", () => {
    const a = new TokenAssembler();
    expect(a.push([{ text: "<end>", is_final: false }, f("<end>")]).finals).toEqual([]);
  });
});
