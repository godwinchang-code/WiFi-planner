# Repository Guidelines

## Project Structure & Module Organization
This repository combines a React + TypeScript frontend with a Rust/WASM signal engine.

- `src/`: app code (components, hooks, store, utils, types)
- `src/components/Canvas` and `src/components/Sidebar`: primary UI modules
- `src/test/`: Vitest test suite (`*.test.ts` / `*.test.tsx`)
- `wasm-engine/`: Rust crate compiled to WebAssembly
- `scripts/build-wasm-if-changed.sh`: incremental WASM build helper
- `docs/`: architecture notes, signal model, screenshots

Keep cross-layer changes explicit: if you alter propagation logic in `wasm-engine/src/lib.rs`, update the TS wrapper in `src/wasm/engine.ts` and related tests.

## Build, Test, and Development Commands
- `npm run dev`: build WASM if needed, then start Vite dev server
- `npm run dev:fast`: start Vite without rebuilding WASM
- `npm run build`: build WASM, type-check, and create production bundle
- `npm run build:wasm` / `npm run build:wasm:force`: incremental or forced WASM rebuild
- `npm run lint`: run ESLint on `ts/tsx`
- `npm test`: run Vitest once
- `npm run test:watch`: run Vitest in watch mode
- `npm run test:rust`: run `cargo test` in `wasm-engine/`
- `npm run test:all`: run Rust + TS tests (recommended before PR)

## Coding Style & Naming Conventions
- TypeScript is `strict`; keep code warning-free under ESLint and `tsc --noEmit`.
- Follow existing formatting: 2-space indentation in TS/TSX, 4 spaces in Rust.
- React components: PascalCase file and export names (`PlannerCanvas.tsx`).
- Hooks/utilities: camelCase (`useHeatmap.ts`, `signalSimulation.ts`).
- Use `_` prefix for intentionally unused params/vars to satisfy lint rules.

## Testing Guidelines
- Frontend tests use Vitest + Testing Library; place tests under `src/test/`.
- Rust unit tests live next to implementation in `wasm-engine/src/lib.rs`.
- Name tests by behavior, e.g., `simulation.integration.test.ts`.
- No fixed coverage gate is configured; add or update tests for every behavior change.

## Commit & Pull Request Guidelines
- Match existing commit style: short, imperative subject lines (e.g., `Fix production build target`, `Add Rust/WASM engine`).
- Keep commits focused; separate refactors from behavior changes.
- PRs should include: clear summary, linked issue (if any), test commands run, and screenshots/GIFs for UI changes.
- Ensure CI parity locally: `npm run lint`, `npm run test:all`, and `npm run build`.
