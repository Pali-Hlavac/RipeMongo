# 0001. Use Tauri 2 for the desktop shell

- Status: Accepted
- Date: 2026-10-22

## Context

The app must be small, start fast, run on Windows, macOS and Linux, and bundle the
mongo-tools binaries. Electron ships its own Chromium (about 100 MB+ per install). Tauri uses
the OS webview and a Rust core.

## Decision

Use Tauri 2.x (stable line; 3.0 is still alpha) with a Rust backend.

## Consequences

- Small binaries and low memory use. Rust gives us the official MongoDB driver and safe
  concurrency.
- Rendering differs slightly per OS webview (WebView2, WKWebView, WebKitGTK), so the UI
  must avoid bleeding-edge CSS/JS and be tested on all three.
- End-to-end testing on macOS is limited (no WKWebView WebDriver).
- Linux users need WebKitGTK 4.1; packaging (deb/AppImage) handles it.
