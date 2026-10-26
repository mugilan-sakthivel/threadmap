export type SpokenOption = { id: string; label: string; hint?: string; codes: string[] };

export const SPOKEN_OPTIONS: SpokenOption[] = [
  { id: "ta-en", label: "Tamil + English", hint: "mixed / Tanglish", codes: ["ta", "en"] },
  { id: "hi-en", label: "Hindi + English", hint: "Hinglish", codes: ["hi", "en"] },
  { id: "en", label: "English only", codes: ["en"] },
  { id: "te-en", label: "Telugu + English", codes: ["te", "en"] },
  { id: "ml-en", label: "Malayalam + English", codes: ["ml", "en"] },
  { id: "kn-en", label: "Kannada + English", codes: ["kn", "en"] },
];

export const MAP_LANGUAGES = [
  { id: "English", label: "English" },
  { id: "Tamil", label: "தமிழ்" },
  { id: "Hindi", label: "हिन्दी" },
  { id: "the same language the speakers use", label: "Same as spoken" },
];

const NAMES: Record<string, string> = { en: "English", ta: "Tamil", hi: "Hindi", te: "Telugu", ml: "Malayalam", kn: "Kannada" };

export function describeLanguages(codes: string[]): string {
  return codes.map((c) => NAMES[c] ?? c).join(" + ");
}
