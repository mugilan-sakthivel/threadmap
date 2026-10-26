# ThreadMap

Live visual notes for podcasters. While people talk, ThreadMap transcribes the
conversation, and an AI draws it on a canvas: questions become sections, and
"there are four methods" / "think of it like a pyramid" become real diagrams
that fill in as each item is explained. The right panel logs the live
transcript and running notes (key points, quotes, and follow-ups the host can
ask).

## Run it

```bash
pnpm install
cp .env.example .env.local   # add keys (optional for the demo)
pnpm dev                     # http://localhost:3000
```

With no keys at all, choose **Play the demo conversation**: a scripted Tanglish
interview streams in and the board draws itself from reference steps.

With an AI key you can also choose **Replay a transcript**: paste any episode
transcript (`Name (00:11:49) text`, `[00:11:49] Name: text` or `Name: text`)
and it plays through the live pipeline at 1×, 1.5× or 2×.

**Docs:** PRD, Mock UX, research, how it works and a real-podcast test report
are in [`docs/`](docs/) and published at
https://mugilan-sakthivel.github.io/threadmap/

## Keys

| Variable | Needed for | Where to get it |
|---|---|---|
| `SONIOX_API_KEY` | Real-time speech-to-text (mic, or mic + call tab) | console.soniox.com |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | AI drawing + notes | Any OpenAI-compatible API; see `.env.example` |
| `LLM_JSON_MODE` | Set `off` if the provider rejects `response_format` | |

Keys stay on the server. The browser receives a 60-second Soniox key from
`/api/stt-token` and streams audio straight to Soniox; LLM calls go through
`/api/brain`.

Without Soniox you can still use **Browser speech (free)** in Chrome (one
language, no speaker labels).

## How it works

```
mic ─▶ Soniox (streaming) ─▶ TokenAssembler ─▶ transcript log
                                   │ final segments
                                   ▼
                BrainScheduler (debounce 1.5s, max 6s, one call in flight)
                                   │ POST /api/brain
                                   ▼
             LLM returns { notes, ops } ─▶ zod validation (bad items dropped)
                                   │
            reducer(board, ops) ─▶ layout (column flow) ─▶ Excalidraw
```

- **The AI never positions anything.** It returns semantic ops
  (`start_section`, `create_visual`, `fill_slot`, `resize_visual`,
  `convert_visual`, ...). Deterministic templates draw them, so the canvas
  stays tidy and element ids are stable (no flicker).
- **Templates:** pyramid, funnel, grid (N methods / 2×2), steps, cycle,
  comparison, timeline, list. Announced counts create dashed empty slots that
  fill in as the speaker explains each one.
- **Layout:** sections stack top to bottom; when a column is full, the next
  section starts a new column to the right. The camera follows the active
  section ("Follow live"); any manual pan pauses following.
- **Languages:** speech can be mixed (Tamil + English, Hindi + English, ...);
  the map can be drawn in English, Tamil, Hindi, or the spoken language.
  Text wrapping measures grapheme clusters so Indic scripts wrap correctly.

## Scripts

```bash
pnpm test        # vitest: reducer, layout, templates, parsing, scheduler, assembler, replay
pnpm eval        # live-model shape eval (needs LLM keys; 11 keyword-free cases, gate 80%)
pnpm typecheck
pnpm lint
pnpm build
```

## Before a public deploy

`/api/brain` and `/api/stt-token` spend money. They reject cross-site browser
requests and oversized bodies, but that is not authentication. Add sign-in and
per-user rate limits / hour caps before exposing a deployment publicly.
