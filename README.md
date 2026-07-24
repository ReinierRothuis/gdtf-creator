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
