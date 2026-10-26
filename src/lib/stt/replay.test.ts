import { describe, expect, it } from "vitest";
import { parseTranscript, speakerIds } from "./replay";

describe("parseTranscript", () => {
  it("reads podcast-site format with timestamps", () => {
    const r = parseTranscript("Lex Fridman (00:11:49) So 12 startups in 12 months.\nPieter Levels (00:11:55) Yeah, every month.");
    expect(r).toEqual([
      { name: "Lex Fridman", t: 709, text: "So 12 startups in 12 months." },
      { name: "Pieter Levels", t: 715, text: "Yeah, every month." },
    ]);
  });

  it("reads [ts] Name: text and plain Name: text", () => {
    expect(parseTranscript("[01:02] Host: Hi there")).toEqual([{ name: "Host", t: 62, text: "Hi there" }]);
    expect(parseTranscript("Guest: Hello\nmore words")).toEqual([{ name: "Guest", text: "Hello more words" }]);
  });

  it("assigns speaker ids in order of appearance", () => {
    const ids = speakerIds(parseTranscript("A: x\nB: y\nA: z"));
    expect([...ids.entries()]).toEqual([["A", "1"], ["B", "2"]]);
  });

  it("ignores junk before the first speaker", () => {
    expect(parseTranscript("   \n(applause)\nHost: ok")).toEqual([{ name: "Host", text: "ok" }]);
  });
});
