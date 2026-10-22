// Global Vitest setup: DOM matchers and browser APIs that jsdom does not implement.
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

const noop = (): undefined => undefined;

if (!("matchMedia" in window)) {
  const matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
  Object.defineProperty(window, "matchMedia", { writable: true, value: matchMedia });
}

if (!("ResizeObserver" in window)) {
  class ResizeObserverStub {
    observe = noop;
    unobserve = noop;
    disconnect = noop;
  }
  Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });
}

Element.prototype.scrollIntoView = noop;
