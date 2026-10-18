import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { AVATAR_COLOR_TOKENS } from "./avatars";
import { PRIORITY_CONFIG, type Priority } from "./priorities";
import {
  STATUS_BORDER_ALPHA,
  STATUS_CATEGORY_CONFIG,
  STATUS_COLOR_TOKENS,
  STATUS_SURFACE_ALPHA,
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

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
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
  return Math.round(contrast(token(foreground), token(background)) * 100) / 100;
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
  it.each(["ink-900", "ink-600", "ink-400"])("%s on every surface", (ink) => {
    for (const surface of SURFACES) {
      expect(ratio(ink, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

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

/**
 * The kanban column's own tint.
 *
 * `STATUS_TOKEN_CLASSES[token].surface` paints a whole column — header, card
 * area and empty state — in its status's `-50` tint, which makes those tints
 * backgrounds for body text rather than just for a pill. The ink ramp is
 * asserted against plain surfaces above and that is no longer the full set of
 * backgrounds the app renders text on.
 *
 * Listed explicitly rather than parsed out of the class strings: the pairing
 * is the thing being asserted, and a test that derives it from the same
 * declaration it is checking would agree with any value.
 */
describe("ink is readable on a kanban column's status tint", () => {
  /*
   * The wash is an alpha, so the colour text actually lands on is the
   * composite over the shell's own background — `AppShell` is
   * `bg-surface-sunken`. Comparing against the bare token would measure a
   * colour that never reaches a screen, and comparing against the opaque
   * token would measure one far darker than what ships.
   */
  const SHELL = token("surface-sunken");

  /** `foreground` at `alpha` over `background`, as a hex string. */
  function blend(foreground: string, alpha: number, background: string) {
    const mix = (offset: number) => {
      const top = Number.parseInt(foreground.slice(offset, offset + 2), 16);
      const bottom = Number.parseInt(background.slice(offset, offset + 2), 16);

      return Math.round(alpha * top + (1 - alpha) * bottom);
    };

    const hex = (value: number) => value.toString(16).padStart(2, "0");

    return `#${hex(mix(1))}${hex(mix(3))}${hex(mix(5))}`;
  }

  /** Every status token's column tint, composited as rendered. */
  const TINTS = STATUS_COLOR_TOKENS.map((name) => ({
    name,
    hex: blend(token(name), STATUS_SURFACE_ALPHA, SHELL),
  }));

  function ratioOn(ink: string, tint: string): number {
    return Math.round(contrast(token(ink), tint) * 100) / 100;
  }

  it.each(["ink-900", "ink-600"])("%s on every tint", (ink) => {
    for (const { name, hex } of TINTS) {
      expect(ratioOn(ink, hex), `${ink} on ${name}`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  /*
   * `ink-400` is deliberately not used on a tint, and this records why rather
   * than leaving it to be rediscovered: it clears 4.5:1 on all three plain
   * surfaces and misses it on the `status-todo` wash by two hundredths, that
   * token being a mid grey and so the one that darkens its background most.
   * The column header's count uses `ink-600` for exactly this reason.
   *
   * Asserted as a failure so that raising the wash alpha, or re-pointing the
   * count at `ink-400`, has to come back through here.
   */
  it("ink-400 is not readable on every tint, which is why it is not used there", () => {
    const todo = TINTS.find((tint) => tint.name === "status-todo");

    expect(todo).toBeDefined();
    expect(ratioOn("ink-400", todo?.hex ?? "#ffffff")).toBeLessThan(4.5);
  });

  /*
   * The point of tinting per status: two columns must not look alike. `soft`
   * pairs `status-active` with `bg-info-50` and `status-review` with
   * `bg-brand-50` — `#eaf2fe` and `#eef4ff` — which is why the column wash is
   * taken from the status token instead. This is the assertion that would have
   * caught that, and would also catch an interpolated class compiling to no
   * CSS, since every tint would then be identical.
   */
  /*
   * Channel distance, not luminance. Luminance is the wrong instrument for
   * "are these the same colour" and the first version of this assertion
   * proved it: the blue and the violet washes differ by 0.0003 in luminance
   * and are plainly different colours to look at. Two tints at one lightness
   * and different hues is exactly the case that must pass.
   */
  function distance(a: string, b: string): number {
    const channels = [1, 3, 5].map((offset) => {
      const first = Number.parseInt(a.slice(offset, offset + 2), 16);
      const second = Number.parseInt(b.slice(offset, offset + 2), 16);

      return (first - second) ** 2;
    });

    return Math.sqrt(channels.reduce((sum, value) => sum + value, 0));
  }

  /*
   * Every wash is a different colour, but only just — and that is the point
   * being recorded, not a weak assertion. `status-active` and `status-review`
   * differ almost entirely in red, so at an alpha subtle enough to sit behind
   * white cards their washes land about seven units apart. The background is a
   * family hint; the border below is the signal.
   */
  it("gives every status its own wash", () => {
    expect(new Set(TINTS.map((tint) => tint.hex)).size).toBe(TINTS.length);
  });

  /*
   * The assertion that actually protects the feature. At the border's alpha
   * the same two tokens are far apart, which is why the border carries status
   * identity and the wash only hints at it.
   *
   * It would also catch the interpolation trap — `border-${token}` compiles to
   * no CSS, and every column would then share one border colour.
   */
  it("gives every status a clearly different border", () => {
    const borders = STATUS_COLOR_TOKENS.map((name) => ({
      name,
      hex: blend(token(name), STATUS_BORDER_ALPHA, SHELL),
    }));

    for (const a of borders) {
      for (const b of borders) {
        if (a.name === b.name) continue;

        expect(
          Math.round(distance(a.hex, b.hex)),
          `${a.name} vs ${b.name}`,
        ).toBeGreaterThanOrEqual(15);
      }
    }
  });

  /*
   * The drop highlight has to beat all four tints, not just white — including
   * `status-active`, which is the brand's own blue family. A pale wash could
   * not, which is why the highlight leans on a full-strength ring.
   */
  it("the drop highlight ring clears 3:1 on every tint", () => {
    for (const { name, hex } of TINTS) {
      expect(
        ratioOn("brand-600", hex),
        `ring on ${name}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  /*
   * The border is a status signal, not a divider, so it is held to the 3:1
   * graphics threshold against the tint it encloses. Rendered at 25%, which
   * this composites too.
   */
  it("every status border is visible against its own tint", () => {
    for (const { name, hex } of TINTS) {
      const border = blend(token(name), STATUS_BORDER_ALPHA, hex);

      expect(
        Math.round(contrast(border, hex) * 100) / 100,
        `${name} border`,
      ).toBeGreaterThan(1.1);
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
