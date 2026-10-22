# Settings and theme

## What it does

Users pick **System**, **Light** or **Dark** from the status-bar theme menu or the command
palette. The choice is saved and restored on the next launch. With System, the app follows
OS changes live.

## How it works

```
ThemeMenu / palette → useThemePreference().setPreference
  → useUpdateSettings (optimistic cache update)
  → update_settings → SettingsStore::save (atomic write)
ThemeController ← useSettings + usePrefersDark → resolveTheme → <html class="dark">
```

- **Backend:** `src-tauri/src/settings/`. The settings file is
  `<app config dir>/settings.json`. A missing file gives defaults, and unknown fields are
  ignored, so different app versions can share it.
- **Frontend:** `src/features/settings/`
  - `api/settings.ts`: `useSettings` (cached forever) and `useUpdateSettings` (optimistic,
    rolls back on error; the global mutation handler shows a toast).
  - `lib/theme.ts`: `THEME_OPTIONS`, `resolveTheme`, `isThemePreference`.
  - `components/ThemeController.tsx`: toggles the `dark` class and `color-scheme`.
  - `components/ThemeMenu.tsx`: radio dropdown in the status bar.
- `App` waits for settings before the first paint to avoid a theme flash. If loading fails,
  the app starts with defaults.

## Edge cases

- **Corrupted file:** `get_settings` returns `INVALID_DATA` with a hint to delete or fix the
  file. The app still starts with defaults.
- **Unwritable directory:** `update_settings` returns `IO`. The UI rolls back and shows a toast.

## Tests

- Rust: `settings::service::tests` (defaults, round trip, corrupt file, unknown fields).
- TS: `src/features/settings/lib/theme.test.ts`.
- Manual: switch the theme, restart the app, and check it persists. Switch the OS theme
  while on System.
