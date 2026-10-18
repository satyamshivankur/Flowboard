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
  /*
   * Desktop with a fine pointer. The `min-width` case matters: without it,
   * `SidebarContext` reports `isModal` and the sidebar renders as a *closed*
   * sheet, so every shell test would look for a tree that is not in the DOM.
   * Tests asserting mobile behaviour override this with their own stub.
   */
  const matches =
    query.includes("min-width") ||
    query.includes("hover: hover") ||
    query.includes("pointer: fine");

  return {
    matches,
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

/**
 * jsdom implements no `ResizeObserver`, which `ScrollShadow` uses to decide
 * whether its edge fades apply. Stubbed rather than skipped so the component
 * mounts and its scroll listener is still exercised.
 */
class StubResizeObserver implements ResizeObserver {
  observe(): void {
    // No layout in jsdom, so there is nothing to report.
  }

  unobserve(): void {
    /* no-op */
  }

  disconnect(): void {
    /* no-op */
  }
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: StubResizeObserver,
});

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: StubResizeObserver,
});

/**
 * jsdom implements no Web Animations API.
 *
 * dnd-kit measures an element by first forcing any running animation on it to
 * finish, so that a rect taken mid-transition is the resting one. It reaches
 * for `document.getAnimations()` to do that, and in jsdom that call throws and
 * takes the drag down with it.
 *
 * Reporting "nothing is animating" is the honest answer here: jsdom runs no
 * animations, so there is none to settle. Stubbed on both the document and
 * elements, since dnd-kit asks both.
 */
function noAnimations(): Animation[] {
  return [];
}

Object.defineProperty(Document.prototype, "getAnimations", {
  writable: true,
  configurable: true,
  value: noAnimations,
});

Object.defineProperty(Element.prototype, "getAnimations", {
  writable: true,
  configurable: true,
  value: noAnimations,
});

/**
 * jsdom implements no `IntersectionObserver`.
 *
 * dnd-kit uses one to notice when a dragged element leaves the viewport or an
 * ancestor frame, so it can re-measure. Without a stub, starting a drag in a
 * test throws from inside a signal effect, which surfaces as an unhandled
 * error rather than a failed assertion.
 *
 * Observing nothing is correct here for the same reason as the animation stub:
 * jsdom has no layout to intersect.
 */
class StubIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly scrollMargin = "";
  readonly thresholds: readonly number[] = [];

  observe(): void {
    // No layout in jsdom, so there is nothing to report.
  }

  unobserve(): void {
    /* no-op */
  }

  disconnect(): void {
    /* no-op */
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

for (const target of [window, globalThis]) {
  Object.defineProperty(target, "IntersectionObserver", {
    writable: true,
    configurable: true,
    value: StubIntersectionObserver,
  });
}

/**
 * `Element.prototype.animate`, the other half of the missing Web Animations
 * API.
 *
 * dnd-kit runs the drop animation through it and awaits the returned
 * animation's `finished` promise before tearing the operation down. Without
 * this, every drop in a test throws from inside that teardown — after the
 * assertions have passed, which is the worst place for it.
 *
 * Resolving immediately is the right stub: a test asserts where the card
 * ended up, not that it took 250ms to get there.
 */
Object.defineProperty(Element.prototype, "animate", {
  writable: true,
  configurable: true,
  value: function stubAnimate(): Animation {
    const animation = {
      finished: Promise.resolve(),
      playState: "finished",
      currentTime: 0,
      pending: false,
      effect: null,
      cancel: () => undefined,
      finish: () => undefined,
      commitStyles: () => undefined,
    };

    return animation as unknown as Animation;
  },
});
