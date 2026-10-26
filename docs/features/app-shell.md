# App shell

## What it does

The main window: a resizable sidebar (connections will live here), a tabbed workspace, a
status bar, a command palette, an About dialog and global keyboard shortcuts.

## Shortcuts

| Action                                   | Windows / Linux | macOS |
| ---------------------------------------- | --------------- | ----- |
| Command palette                          | Ctrl+K          | ⌘K    |
| Close tab                                | Ctrl+W          | ⌘W    |
| Next tab                                 | Ctrl+Tab        | ⌃Tab  |
| Previous tab                             | Ctrl+Shift+Tab  | ⌃⇧Tab |
| Move between tabs (tab bar focused)      | ← / →           | ← / → |
| Go to collection ([search](search.md))   | Ctrl+P          | ⌘P    |
| Filter the sidebar ([search](search.md)) | Ctrl+Shift+F    | ⌘⇧F   |

## How it works

- **Layout:** `src/app/layout/AppLayout.tsx` uses `react-resizable-panels` v4 (`Group`,
  `Panel`, `Separator`). Sidebar size limits are in `SIDEBAR_SIZE`.
- **Tabs:** `src/features/workspace/store/tabs.ts` (Zustand) holds `tabs` and `activeTabId`.
  Opening a tab whose `id` is already open focuses it. Closing the active tab activates the
  right neighbour, or else the new last tab. `TabBar` implements the WAI-ARIA tabs pattern
  (roving `tabIndex`, arrow keys). The only tab kind so far is `welcome`.
- **Command palette:** `src/features/command-palette` renders a cmdk list inside a Radix
  dialog. Commands are plain objects (`PaletteCommand`) composed in
  `src/app/commands/useAppCommands.ts`. Each feature contributes entries there.
- **Hotkeys:** `useHotkey(combo, handler)` (`src/shared/hooks`) on top of pure helpers in
  `src/shared/lib/hotkeys.ts` (`parseHotkey`, `matchesHotkey`, `formatHotkey`).
- **About:** `src/features/about` queries `get_app_info` once (`staleTime: Infinity`). The
  status bar shows the same data. When the dialog opens, `ToolsVersion` queries
  `get_tools_info` once and shows the bundled tools version (or which tools are missing).
- **Native feel:** in production, `installNativeFeel()` blocks the webview context menu
  (except in editable fields) and reload/print shortcuts.
- **States:** shared `EmptyState`, `ErrorState` (shows `message` and `hint` from
  `IpcError`, with optional retry) and `LoadingState` (`role="status"`).

## Edge cases and limitations

- Open tabs are not yet restored after restart (milestone 8).
- The sidebar shows a clearly labelled placeholder until connections land (milestone 2).
- Ctrl+Tab may be intercepted by some Linux window managers.

## Tests

- `src/features/workspace/store/tabs.test.ts`: open, focus, close and cycle behaviour.
- `src/features/command-palette/components/CommandPalette.test.tsx`: Ctrl+K, filter, run.
- `src/shared/lib/hotkeys.test.ts`, `src/shared/lib/native-feel.test.ts`.
- Manual: `pnpm app:dev`, press Ctrl/Cmd+K, run "Theme: Light", close and reopen tabs.
