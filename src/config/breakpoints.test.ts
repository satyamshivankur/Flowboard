import { describe, expect, it } from "vitest";

import {
  BREAKPOINT_REM,
  minWidthQuery,
  SIDEBAR_STATIC_BREAKPOINT,
  type Breakpoint,
} from "./breakpoints";

/*
 * Parity with the `--breakpoint-*` tokens in src/index.css is enforced by
 * scripts/check-units.mjs, which runs as part of `npm run lint`. It lives there
 * rather than here because Vitest stubs CSS imports to empty strings when
 * `css: false`, and reading the file with node:fs would mean pulling Node types
 * into the app tsconfig for the sake of one assertion.
 *
 * What remains here is the query construction itself.
 */

describe("minWidthQuery", () => {
  it("builds a rem-based media query", () => {
    expect(minWidthQuery("md")).toBe("(min-width: 48rem)");
    expect(minWidthQuery("lg")).toBe("(min-width: 64rem)");
  });

  it("covers every breakpoint without producing NaN", () => {
    for (const breakpoint of Object.keys(BREAKPOINT_REM) as Breakpoint[]) {
      expect(minWidthQuery(breakpoint)).toMatch(/^\(min-width: [\d.]+rem\)$/);
    }
  });
});

describe("sidebar boundary", () => {
  it("names a breakpoint that exists", () => {
    expect(BREAKPOINT_REM).toHaveProperty(SIDEBAR_STATIC_BREAKPOINT);
  });
});
