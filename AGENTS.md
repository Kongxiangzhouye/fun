# AGENTS.md

## Cursor Cloud specific instructions

This is a **purely client-side** idle gacha browser game (万象唤灵 · 放置挂机) built with TypeScript, Vite 5, and PixiJS 8. There is no backend, no database, and no Docker — all game state lives in the browser's `localStorage`.

### Prerequisites

- **Node.js 20** (matches CI). Use `nvm use 20` if the default version differs.

### Key commands

All commands are defined in `package.json`:

| Task | Command |
|---|---|
| Install deps | `npm ci` |
| Dev server | `npm run dev` (Vite, default port 5173, `server.host: true`) |
| Type check | `npm run typecheck` |
| Full build | `npm run build` (runs typecheck then vite build) |
| Preview prod | `npm run preview` |

### Non-obvious notes

- The project has **no linter or formatter** configured (no ESLint, Prettier, or similar). Type checking via `tsc --noEmit` is the only static analysis.
- The project has **no automated tests** (no test framework, no test scripts).
- `vite.config.ts` reads `BASE_PATH` env var for CI deployment; locally it defaults to `./`, so no env var is needed for dev.
- `src/main.ts` is very large (~152K chars). Hot-reload works but may take a moment.
