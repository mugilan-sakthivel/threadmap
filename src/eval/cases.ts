import type { TemplateKind } from "@/lib/types";

export type StructureCase = {
  name: string;
  /** Spoken lines, fed to the AI one tick at a time like a live session. None of them names the shape. */
  lines: { speaker: string; text: string }[];
  /** Pass if some visual ends up with one of these templates. Empty = no structured visual expected. */
  expect: TemplateKind[];
  /** Templates that must NOT appear (for loose wording that is not really a structure). */
  forbid?: TemplateKind[];
  /** For layered shapes: a word that must be in the base slot (index 0). */
  baseContains?: string;
};

const host = (text: string) => ({ speaker: "1", text });
const guest = (text: string) => ({ speaker: "2", text });

export const STRUCTURE_CASES: StructureCase[] = [
  {
    name: "layers, bottom-up, English",
    lines: [
      host("How do you think about growing a brand?"),
      guest("You can't build a brand without loyal customers."),
      guest("And you can't get loyal customers without a product that actually works."),
      guest("So product first, loyalty on top of that, and the brand comes last."),
    ],
    expect: ["pyramid"],
    baseContains: "product",
  },
  {
    name: "layers, Tanglish",
    lines: [
      host("What keeps you going as a founder?"),
      guest("First health sariya irukanum, adhu illama onnum nadakkaadhu."),
      guest("Health irundha dhaan energy varum."),
      guest("Energy irundha dhaan you can actually chase big goals."),
    ],
    expect: ["pyramid"],
    baseContains: "health",
  },
  {
    name: "layers, described top-down",
    lines: [
      host("How is your company organised in your head?"),
      guest("At the very top is the vision, the thing everyone sees."),
      guest("Under that sits the strategy that holds it up."),
      guest("And all of it rests on daily habits of the team."),
    ],
    expect: ["pyramid"],
    baseContains: "habit",
  },
  {
    name: "layers, Hinglish",
    lines: [
      host("Sales kaise badhaye?"),
      guest("Pehle trust banana padta hai."),
      guest("Trust ke bina sales nahi hoti."),
      guest("Aur sales ke bina brand ka koi matlab nahi."),
    ],
    expect: ["pyramid"],
    baseContains: "trust",
  },
  {
    name: "process without the word step",
    lines: [
      host("What does a normal day look like?"),
      guest("We wake up and check the night's orders."),
      guest("After packing, the courier picks everything up at noon."),
      guest("In the evening we reply to every single review."),
    ],
    expect: ["steps", "timeline"],
  },
  {
    name: "feedback loop without the word cycle",
    lines: [
      host("Why did the platform suddenly take off?"),
      guest("More creators joined, so there was more content."),
      guest("More content brought more viewers."),
      guest("And more viewers pulled in even more creators again."),
    ],
    expect: ["cycle"],
  },
  {
    name: "narrowing without the word funnel",
    lines: [
      host("How do your reels convert?"),
      guest("About ten thousand people see a reel."),
      guest("Maybe a thousand click the link in bio."),
      guest("A hundred add to cart, and only twenty actually pay."),
    ],
    expect: ["funnel"],
  },
  {
    name: "contrast without vs",
    lines: [
      host("What would you do differently?"),
      guest("Most founders hire a big team on day one."),
      guest("What actually worked for us was staying three people until we had revenue."),
    ],
    expect: ["comparison"],
  },
  {
    name: "parallel qualities, no count",
    lines: [
      host("What do you hire for?"),
      guest("Curiosity, first of all."),
      guest("Ownership also matters a lot to us."),
      guest("And kindness, we never compromise on that."),
    ],
    expect: ["grid", "list"],
    forbid: ["pyramid", "steps"],
  },
  {
    name: "dated story without the word timeline",
    lines: [
      host("Take us through the journey."),
      guest("In 2019 I quit my job at Infosys."),
      guest("In 2021 we launched the first product."),
      guest("By 2024 we crossed ten crore in revenue."),
    ],
    expect: ["timeline", "steps"],
  },
  {
    name: "says 'pyramid' but means something else",
    lines: [
      host("What do you think of course sellers?"),
      guest("Honestly a lot of these influencer courses are basically a pyramid scheme."),
      guest("They sell you the dream of selling the same course to others."),
    ],
    expect: [],
    forbid: ["pyramid"],
  },
];
