# GDTF Creator

## Dev Commands

```bash
pnpm dev          # Start dev server (React Router + Cloudflare)
pnpm build        # Production build
pnpm deploy       # Build + deploy to Cloudflare Workers
pnpm typecheck    # Generate CF types + RR types + tsc check
pnpm preview      # Build + Vite preview
```

## Architecture

- **Frontend:** React Router 7 (SSR enabled) on Cloudflare Workers
- **Backend:** Convex.dev (planned)
- **AI:** Vercel AI SDK (planned)
- **State:** URL-based state management
- **Build:** Vite 7 with `@cloudflare/vite-plugin`, `@tailwindcss/vite`, `vite-tsconfig-paths`

## Project Structure

```
app/           React Router app (routes, components, styles)
workers/       Cloudflare Worker entry point (app.ts)
DESIGN.md      Design system reference (colors, typography, components)
```

## Conventions

- TypeScript strict mode (`strict: true`)
- Tailwind CSS 4 (OKLCH color system — see DESIGN.md)
- Path alias: `~/` → `app/`
- SSR enabled, Vite environment API (`v8_viteEnvironmentApi`)
- No border-radius, no box-shadow — brutalist design language
- Fonts: JetBrains Mono (values/labels), Inter (UI text)
- All new front-end components must be added to the `/storybook` route (`app/routes/storybook.tsx`) with live examples and a props table

## Design System

See [DESIGN.md](./DESIGN.md) for the full design specification including:
- OKLCH surface scale and accent colors
- Typography rules and component patterns
- Brutalist "dark venue" design philosophy

## GDTF Specification

When working on GDTF XML generation (`convex/gdtf.ts`) or validating output, refer to the official spec files:

- **Full spec:** `https://raw.githubusercontent.com/mvrdevelopment/spec/main/gdtf-spec.md`
- **Attribute definitions:** `https://raw.githubusercontent.com/mvrdevelopment/spec/refs/heads/main/gdtf_attributes_with_description.json`

These files are large. Use `WebFetch` with a targeted prompt to extract only the section you need (e.g., "Find the DMXChannel attributes table" or "List all attributes in the Dimmer feature group").
