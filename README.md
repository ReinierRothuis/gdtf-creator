# GDTF Creator

A web application that generates GDTF (General Device Type Format) files from PDF manuals using AI. Upload a lighting fixture's manual and get a complete GDTF file — no manual data entry required.

## What it does

GDTF Creator uses an LLM to read and interpret lighting fixture PDF manuals, extracting the information needed to build a full GDTF file. This includes:

- **DMX modes and channels** — channel layouts, functions, and value ranges
- **Physical descriptions** — dimensions, weight, power consumption, and lens properties
- **Geometry** — fixture body, yoke, head, and beam geometry
- **Wheels** — color wheels, gobo wheels, and their slots
- **Emitters and filters** — light source specifications

## How it works

1. Upload a PDF manual for a lighting fixture
2. The app sends the document to an LLM for interpretation
3. Extracted data is presented for review and correction
4. Export a valid `.gdtf` file ready for use in lighting consoles and visualizers

## PDF extraction path

Set `PDF_EXTRACTION_PATH` in Convex. Default: `claude-haiku-native`.

| Value | Pipeline | Required key |
|---|---|---|
| `claude-haiku-native` | Claude Haiku 4.5 reads PDF | `ANTHROPIC_API_KEY` |
| `gemini-flash-lite-native` | Gemini 3.5 Flash-Lite reads PDF | `GOOGLE_GENERATIVE_AI_API_KEY` |
| `openai-gpt-nano-native` | GPT-5.4 Nano reads PDF through OpenAI | `OPENAI_API_KEY` |
| `openrouter-unpdf-qwen` | `unpdf` extracts text, Qwen Plus converts it through OpenRouter | `OPENROUTER_API_KEY` |
| `cloudflare-markdown-qwen` | Cloudflare converts PDF to Markdown, Qwen Plus converts it through OpenRouter | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_API_TOKEN`, `OPENROUTER_API_KEY` |

```bash
pnpm convex env set PDF_EXTRACTION_PATH gemini-flash-lite-native
pnpm convex env set GOOGLE_GENERATIVE_AI_API_KEY <key>
```

Use `pnpm convex env list` to inspect active values. Unknown flag values fail explicitly instead of silently falling back.

Cloudflare Markdown conversion is called directly from Convex. It is free for most documents; image analysis can consume Workers AI usage beyond its daily free allocation. OpenAI PDF extraction also runs directly and disables response storage.

## Extraction benchmark

Put each manual and its validated `.gdtf` in one directory. Files may share a basename, or each fixture may have its own subdirectory containing one PDF and one GDTF.

```text
manuals/
  fixture-a/
    manual.pdf
    validated.gdtf
  fixture-b/
    fixture-b.pdf
    fixture-b.gdtf
```

Export the provider keys listed above, then run:

```bash
pnpm benchmark -- ./manuals
```

Outputs `benchmark-output/report.html` plus resumable raw results in `benchmark-output/report.json`. The report compares weighted correctness, schema success, input/output tokens, latency, estimated cost, and per-fixture/per-category scores.

Useful options:

```bash
pnpm benchmark -- ./manuals \
  --paths claude-haiku-native,gemini-flash-lite-native \
  --concurrency 2 \
  --output ./benchmark-output/report.html
```

Concurrency is per extraction path. By default every manual runs concurrently on every selected path; `--concurrency 2` limits each path to two manuals at a time.

Standard USD prices per million tokens are hardcoded from provider pricing checked 2026-07-24:

| Path | Input | Output | Extra |
|---|---:|---:|---|
| `claude-haiku-native` | $1.00 | $5.00 | — |
| `gemini-flash-lite-native` | $0.30 | $2.50 | — |
| `openai-gpt-nano-native` | $0.20 | $1.25 | — |
| `openrouter-unpdf-qwen` | $0.26 | $0.78 | $0.78/$2.34 at ≥256K input tokens |
| `cloudflare-markdown-qwen` | $0.26 | $0.78 | Same Qwen tier; Markdown conversion treated as free |

Sources: [Anthropic](https://www.anthropic.com/pricing), [Google](https://ai.google.dev/gemini-api/docs/pricing), [OpenAI](https://developers.openai.com/api/docs/pricing), [OpenRouter](https://openrouter.ai/api/v1/models), and [Cloudflare](https://developers.cloudflare.com/workers-ai/features/markdown-conversion/#pricing). Cloudflare image-processing overages are excluded because the conversion API does not return them.

For ambiguous filenames, add `manuals/benchmark-manifest.json`:

```json
[
  { "name": "Fixture A", "pdf": "fixture-a/manual.pdf", "gdtf": "fixture-a/validated.gdtf" }
]
```

Each path uses the shared extraction contract plus its own model-specific addendum in `convex/extractionPrompt.ts`; changing one path's prompt invalidates only that path's benchmark cache. Each manual is processed once per path at temperature 0. Claude PDFs above 20 MiB are automatically uploaded through Anthropic's Files API instead of being base64-embedded, then deleted after extraction; production uses the existing Convex storage URL. Successful results are cached by PDF, GDTF, prompt, and path. Use `--no-resume` to rerun them.

Scores use externally validated GDTFs as ground truth. Mode pairing uses optimal assignment; channel scoring includes offsets, attributes, defaults, and fine links; function scoring uses DMX-range intersection-over-union; wheel scoring includes slot names and colors; physical scoring normalizes weight units and includes beam type. Deterministic output repairs subtract two percentage points each, capped at twenty. Fixture category and overall dimensions are not scored because GDTF does not provide reliable fixture-level ground truth for them. Valid GDTFs can still model equivalent fixtures differently, so inspect outliers.
