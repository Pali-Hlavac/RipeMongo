import tauriConfig from "../src-tauri/tauri.conf.json";

import { APP_NAME } from "./app.config";

describe("app config", () => {
  it("keeps APP_NAME in sync with the Tauri product name and window title", () => {
    expect(tauriConfig.productName).toBe(APP_NAME);
    expect(tauriConfig.app.windows.map((window) => window.title)).toEqual([APP_NAME]);
  });
});
