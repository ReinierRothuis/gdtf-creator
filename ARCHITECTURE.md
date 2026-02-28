# Architecture

GDTF Creator is an AI-powered web application that converts lighting fixture PDF manuals into GDTF files. Users upload a PDF, an LLM extracts structured fixture data, and the app generates a valid `.gdtf` file — no manual data entry required.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Router 7 (framework mode) |
| Hosting | Cloudflare Workers |
| Backend | Convex.dev |
| LLM | Vercel AI SDK — provider-agnostic |
| State | URL (session ID) + Convex database |
| Export | Convex action (XML generation + zip packaging) |

## Architecture Diagram

```
┌─────────┐       WebSocket        ┌────────┐        API        ┌─────┐
│ Browser  │◄─────────────────────►│ Convex  │◄───────────────►│ LLM │
└────┬─────┘                       └────────┘                   └─────┘
     │
     │  HTTP (SSR + assets)
     ▼
┌──────────────────────┐
│ Cloudflare Workers   │
└──────────────────────┘
```

## Data Flow

1. User uploads PDF
2. Session created in Convex, ID stored in URL
3. PDF stored in Convex file storage
4. Convex action calls LLM via AI SDK with PDF
5. LLM returns structured fixture data (via `generateObject` + Zod)
6. Data stored in Convex, synced to frontend via WebSocket
7. Convex action generates `description.xml`, packages `.gdtf`, stores in Convex file storage, returns download URL
8. Browser downloads `.gdtf` file from Convex URL

## Design Decisions

**Convex over CF Worker actions for LLM** — Cloudflare Workers have a 30s CPU limit. Convex actions support up to 10min timeout, which LLM extraction needs.

**AI SDK** — Provider-agnostic: swap models with one line. `generateObject` with Zod gives typed, validated output. PDF support works across providers.

**State in URL + Convex DB** — Sessions are bookmarkable, real-time sync via WebSocket, survives page reload.

**PDFs via Convex file storage** — Avoids action argument size limits. Persists files for re-extraction if needed.

**Server-side GDTF export (Convex)** — XML generation and zip packaging run in a Convex action. Output is stored in Convex file storage; browser downloads via URL.
