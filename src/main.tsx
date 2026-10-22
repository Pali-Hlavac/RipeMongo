// Frontend entry point: mounts the React tree into #root.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { Providers } from "./app/providers";
import { installNativeFeel } from "./shared/lib/native-feel";
import "./app/styles.css";

// Dev builds keep the webview context menu so "Inspect" stays available.
if (import.meta.env.PROD) installNativeFeel();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element in index.html");

createRoot(rootElement).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
