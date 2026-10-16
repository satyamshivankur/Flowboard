import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

import {
  setSimulationSettings,
  TEST_SIMULATION,
} from "@/adapters/transport/simulated";

/**
 * Pins simulated latency to zero for the whole suite, so tests are fast and
 * non-flaky while the app still exercises real async paths at runtime
 * (Requirement 18.8).
 */
beforeEach(() => {
  setSimulationSettings(TEST_SIMULATION);
});

afterEach(() => {
  cleanup();
});

/**
 * jsdom does not implement matchMedia, which ViewportContext depends on.
 * Defaults to the desktop breakpoint with a fine pointer; individual tests
 * override it when asserting responsive behaviour.
 */
function stubMatchMedia(query: string): MediaQueryList {
  return {
    matches: query.includes("hover: hover") || query.includes("pointer: fine"),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  } as MediaQueryList;
}

/*
 * Defined unconditionally rather than guarded. jsdom's own implementation, where
 * present, always reports `matches: false`, which would silently give every
 * responsive test the mobile layout. Tests asserting a specific breakpoint
 * override this with their own stub.
 */
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: stubMatchMedia,
});
