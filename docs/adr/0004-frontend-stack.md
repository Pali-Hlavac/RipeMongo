# 0004. Frontend stack

- Status: Accepted
- Date: 2026-10-22

## Context

We need a productive, typed UI stack with accessible primitives, strong data caching,
virtualized grids and a code editor.

## Decision

- React 19 + TypeScript 6.0 (strict) + Vite 8. TypeScript 7 is avoided until
  `typescript-eslint` supports it.
- Tailwind CSS 4 + shadcn/ui-style components on Radix primitives, `cmdk` for the palette,
  `sonner` for toasts, `lucide-react` icons.
- TanStack Query for backend state; TanStack Table + TanStack Virtual for grids (M3).
- Zustand for UI state.
- Monaco editor (bundled locally, no CDN) for queries, pipelines, JSON and validators (M3+).
- Vitest + Testing Library (jsdom 27) for tests.
- pnpm as the package manager.

## Consequences

- shadcn components are copied into `src/shared/ui` and owned by us; upgrades are manual.
- Monaco is large (several MB). It will be lazy-loaded and needs `worker-src blob:` in the CSP.
