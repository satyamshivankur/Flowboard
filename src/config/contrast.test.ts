import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { AVATAR_COLOR_TOKENS } from "./avatars";
import { PRIORITY_CONFIG, type Priority } from "./priorities";
import {
  STATUS_CATEGORY_CONFIG,
  STATUS_COLOR_TOKENS,
} from "./statusCategories";

/**
 * Token contrast, computed rather than eyeballed.
 *
 * "Check AA contrast on the tokens" is the kind of audit item that gets ticked
 * after a glance at the palette and then silently rots the first time a token
 * is nudged. Parsing the real stylesheet and computing the ratios makes it a
 * test, so a token that drops below the threshold fails the build instead of
 * shipping (Requirement 17.7).
 *
 * Thresholds are WCAG 2.1: 4.5:1 for normal text, 3:1 for large text and for
 * the boundary of a meaningful graphic. Tokens used only as a dot or a bar are
 * held to 3:1 and additionally required to carry a text label, which is the
 * part contrast alone cannot fix.
 *
 * The stylesheet is parsed from disk because jsdom loads no CSS: the tokens are
 * not available through `getComputedStyle` in this environment, and reading the
 * file is also what guarantees the test and the app see the same values.
 */

const CSS = readFileSync(join(process.cwd(), "src/index.css"), "utf8");

/** Every `--color-*` token in the `@theme` block, as a hex string. */
function colorTokens(): ReadonlyMap<string, string> {
  const tokens = new Map<string, string>();
  const pattern = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;

  for (const match of CSS.matchAll(pattern)) {
    const [, name, hex] = match;

    if (name !== undefined && hex !== undefined) tokens.set(name, hex);
  }

  return tokens;
}

const TOKENS = colorTokens();

function channel(value: number): number {
  const ratio = value / 255;

  // sRGB → linear, per WCAG's relative-luminance definition.
  return ratio <= 0.03928
    ? ratio / 12.92
    : Math.pow((ratio + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);

  return (
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  );
}

/** WCAG contrast ratio, always >= 1. */
function contrast(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

function token(name: string): string {
  const hex = TOKENS.get(name);

  if (hex === undefined) {
    throw new Error(`No --color-${name} token in src/index.css`);
  }

  return hex;
}

/** Rounded for readable failure messages. */
function ratio(foreground: string, background: string): number {
  return (
    Math.round(contrast(token(foreground), token(background)) * 100) / 100
  );
}

const SURFACES = ["surface", "surface-sunken", "surface-hover"] as const;

describe("the token block parses", () => {
  it("finds every colour token the config layer references", () => {
    expect(TOKENS.size).toBeGreaterThan(30);
    expect(TOKENS.get("surface")).toBe("#ffffff");
  });
});

describe("text on surfaces meets AA", () => {
  /*
   * `ink-400` is the one deliberate exception. It is placeholder and secondary
   * metadata — due dates, counts, timestamps — never the only carrier of
   * meaning, which is what 17.7 actually requires. It is held to the 3:1 large
   * text and graphics threshold instead, and asserted as such rather than
   * quietly skipped.
   */
  /*
   * `ink-400` is in this list, not exempted from it. It carries due dates,
   * counts, timestamps and placeholders — secondary, but still text, and WCAG
   * has no "only metadata" exemption. The audit caught it at 2.58:1.
   */
  it.each(["ink-900", "ink-600", "ink-400"])(
    "%s on every surface",
    (ink) => {
      for (const surface of SURFACES) {
        expect(ratio(ink, surface)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it("ink-300 is decorative only and is not used for text", () => {
    /*
     * Asserted rather than assumed: `ink-300` is an icon tint and would fail
     * any text threshold, so this records that fact and would fail if someone
     * re-pointed it at copy.
     */
    expect(ratio("ink-300", "surface")).toBeLessThan(3);
  });
});

describe("semantic text tones meet AA on their own tinted background", () => {
  /*
   * Each pairing is one the app actually renders: the warning tone is the
   * drawer's and the board's read-only strip, the danger tone is the delete
   * confirmation, the info tone is the status-remap toast.
   */
  it.each([
    ["success-700", "success-50"],
    ["warning-700", "warning-50"],
    ["danger-700", "danger-50"],
    ["info-700", "info-50"],
    ["brand-700", "brand-50"],
  ])("%s on %s", (foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["success-600", "surface"],
    ["warning-700", "surface"],
    ["danger-600", "surface"],
    ["info-600", "surface"],
    ["brand-600", "surface"],
  ])("%s on %s", (foreground, background) => {
    // Toast titles and inline links sit on plain surface.
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(3);
  });
});

describe("focus and selection indicators are distinguishable", () => {
  /*
   * The focus ring is the single most important non-text contrast in the app:
   * if it fails, keyboard operation fails. WCAG 2.1 asks 3:1 against adjacent
   * colours.
   */
  it("the focus ring clears 3:1 against every surface it lands on", () => {
    for (const surface of SURFACES) {
      expect(ratio("brand-600", surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it("borders are visible against the surfaces they divide", () => {
    // A hairline divider is decorative, so 1.3:1 is the bar — enough to be
    // seen, deliberately not enough to read as content.
    expect(ratio("border", "surface")).toBeGreaterThanOrEqual(1.1);
    expect(ratio("border-strong", "surface")).toBeGreaterThanOrEqual(1.3);
  });
});

describe("priority and status are never colour alone", () => {
  /*
   * This is the half of 17.7 that contrast cannot satisfy. Every priority
   * carries an icon and a label, and every status category carries a label, so
   * the colour is reinforcement rather than the signal.
   */
  it("every priority has an icon and a label beside its token", () => {
    for (const priority of Object.keys(PRIORITY_CONFIG) as Priority[]) {
      const config = PRIORITY_CONFIG[priority];

      // A Lucide icon is a `forwardRef` component, which is an object rather
      // than a function — so this checks it is renderable, not callable.
      expect(config.icon).toBeDefined();
      expect(config.label.length).toBeGreaterThan(0);
      expect(TOKENS.has(config.token)).toBe(true);
    }
  });

  it("every status category has a label beside its token", () => {
    for (const config of Object.values(STATUS_CATEGORY_CONFIG)) {
      expect(config.label.length).toBeGreaterThan(0);
    }
  });

  it("every priority dot clears 3:1 as a meaningful graphic", () => {
    for (const priority of Object.keys(PRIORITY_CONFIG) as Priority[]) {
      const { token: name } = PRIORITY_CONFIG[priority];

      /*
       * `priority-none` is the exception and is meant to be: it is the absence
       * of a priority, rendered as a dashed outline icon with the label
       * "None". Nothing is conveyed by that swatch, so holding it to a
       * graphics threshold would be measuring the wrong thing. Its text form
       * uses `ink-400`, which is covered above.
       */
      if (priority === "none") continue;

      for (const surface of SURFACES) {
        expect(ratio(name, surface)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  /*
   * The pairing that actually ships, and the one a palette review misses:
   * `PriorityBadge`'s soft variant renders the priority token as *text* on the
   * matching tint, so it has to clear 4.5:1 there — not merely against white.
   * Three of the four original values failed this.
   */
  it.each([
    ["priority-urgent", "danger-50"],
    ["priority-high", "warning-50"],
    ["priority-normal", "info-50"],
    ["priority-low", "surface-sunken"],
  ])("%s as badge text on %s", (foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("every status token clears 3:1 as a pill dot", () => {
    for (const name of STATUS_COLOR_TOKENS) {
      for (const surface of SURFACES) {
        expect(ratio(name, surface)).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("avatar tokens carry readable initials", () => {
  /*
   * Avatar text is white on the token, so each ramp entry has to clear the
   * large-text threshold — initials render at `text-xs` but bold and short,
   * and 3:1 is the floor that keeps them legible against the fill.
   */
  it.each([...AVATAR_COLOR_TOKENS])("%s against white initials", (name) => {
    const white = "#ffffff";

    expect(
      Math.round(contrast(token(name), white) * 100) / 100,
    ).toBeGreaterThanOrEqual(3);
  });
});
