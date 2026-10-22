# Frontend structure (`src/`)

```
src/
  main.tsx               entry: native-feel guards (prod), providers, <App/>
  app.config.ts          APP_NAME / tagline (must match tauri.conf.json productName)
  app/
    App.tsx              root: waits for settings, mounts layout, palette, dialogs, toaster
    providers.tsx        QueryClientProvider, TooltipProvider
    query-client.ts      QueryClient defaults; mutation errors → toast
    styles.css           Tailwind v4 + design tokens (light/dark)
    layout/              AppLayout (resizable panels), StatusBar, renderTab (tab kind → view)
    commands/            useAppCommands: palette entries composed from features
  features/<name>/
    index.ts             public API; other code imports only from here
    components/ hooks/ api/ store/ lib/ types.ts
  shared/
    ipc/                 bindings.ts (generated), client.ts (unwrap, call, IpcError)
    ui/                  shadcn/ui primitives: button, dialog, dropdown-menu, command, tooltip, kbd
    components/          EmptyState, ErrorState, LoadingState
    hooks/               useHotkey, usePrefersDark
    lib/                 cn, hotkeys, platform, native-feel
  test/setup.ts          Vitest setup (jest-dom, matchMedia/ResizeObserver stubs)
  test/render.tsx        renderWithProviders + ok() helper for mocked commands
```

## Features

| Feature           | Responsibility                                                 | Doc                                                     |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| `workspace`       | Tabs store, tab bar, tab hotkeys, welcome tab                  | [app-shell](../features/app-shell.md)                   |
| `command-palette` | Palette UI, open state, Ctrl/Cmd+K                             | [app-shell](../features/app-shell.md)                   |
| `settings`        | Settings queries, theme preference, theme controller/menu      | [settings-and-theme](../features/settings-and-theme.md) |
| `about`           | App info query, About dialog                                   | [app-shell](../features/app-shell.md)                   |
| `connections`     | Sidebar, editor, overview tab, import/export, palette commands | [connections](../features/connections.md)               |
| `catalog`         | Database tree, collection header, create/rename/drop dialogs   | [navigation](../features/navigation.md)                 |

## State rules

- **Backend data** → TanStack Query (`api/`). Query keys are exported constants next to
  their hook (`settingsQueryKey`). Don't mirror query data into Zustand.
- **UI-only state** → small Zustand stores (`store/`). Read with selectors in components;
  call actions via `useXStore.getState()` in event handlers.
- **Derived values** → compute in render or in `lib/` pure functions (unit-tested).

## Routing

There is no URL router. Navigation is tab-based: the workspace tab store decides what the
main area renders. Each new tab `kind` gets a view component in its feature and a case in
`src/app/layout/renderTab.tsx` (the workspace feature never imports other features).

## Styling

- Tailwind utilities with semantic tokens (`bg-background`, `text-muted-foreground`, ...).
- Tokens live in `src/app/styles.css` for `:root` (light) and `.dark`.
- Compose classes with `cn()`. Variants via `class-variance-authority`.
- Dark mode is the `dark` class on `<html>`, set by `ThemeController`.

## Keyboard shortcuts

Use `useHotkey("mod+k", handler)`. `mod` is Cmd on macOS and Ctrl elsewhere. Display combos
with `<Kbd combo="mod+k" />`. Current shortcuts are listed in
[app-shell.md](../features/app-shell.md).
