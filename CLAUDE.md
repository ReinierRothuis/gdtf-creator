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

## Design System

See [DESIGN.md](./DESIGN.md) for the full design specification including:
- OKLCH surface scale and accent colors
- Typography rules and component patterns
- Brutalist "dark venue" design philosophy
