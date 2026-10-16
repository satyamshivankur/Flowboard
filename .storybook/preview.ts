import type { Preview } from "@storybook/react-vite";

import { BREAKPOINT_REM } from "../src/config/breakpoints";
import "../src/index.css";

/**
 * Viewport presets derived from the breakpoint tokens.
 *
 * Importing `BREAKPOINT_REM` rather than restating widths means the workbench,
 * the stylesheet and `SidebarContext` cannot disagree about where a breakpoint
 * sits — and `scripts/check-units.mjs` fails the build if the tokens and the
 * module ever drift (Requirement 20.3, 20.14).
 *
 * Widths are given in rem so the presets scale with the root font size, exactly
 * as the real breakpoints do.
 */
const rem = (value: number) => `${String(value)}rem`;

const viewports = {
  phone: {
    name: "Phone (20rem)",
    styles: { width: rem(20), height: rem(45) },
    type: "mobile" as const,
  },
  phoneLarge: {
    name: `Large phone (sm, ${rem(BREAKPOINT_REM.sm)})`,
    styles: { width: rem(BREAKPOINT_REM.sm), height: rem(50) },
    type: "mobile" as const,
  },
  tablet: {
    name: `Tablet (md, ${rem(BREAKPOINT_REM.md)})`,
    styles: { width: rem(BREAKPOINT_REM.md), height: rem(60) },
    type: "tablet" as const,
  },
  laptop: {
    name: `Laptop (lg, ${rem(BREAKPOINT_REM.lg)})`,
    styles: { width: rem(BREAKPOINT_REM.lg), height: rem(48) },
    type: "desktop" as const,
  },
  desktop: {
    name: `Desktop (xl, ${rem(BREAKPOINT_REM.xl)})`,
    styles: { width: rem(BREAKPOINT_REM.xl), height: rem(56) },
    type: "desktop" as const,
  },
};

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    viewport: { viewports, defaultViewport: "laptop" },
    backgrounds: { disable: true },
    layout: "padded",
  },
  globalTypes: {
    density: {
      description: "UI density",
      defaultValue: "comfortable",
      toolbar: {
        title: "Density",
        items: [
          { value: "comfortable", title: "Comfortable" },
          { value: "compact", title: "Compact" },
        ],
      },
    },
  },
  decorators: [
    /*
     * Applies the density attribute the same way the app shell does, so the
     * `density-compact` variant is exercisable from the toolbar rather than
     * only visible in the assembled app.
     */
    (Story, context) => {
      document.documentElement.setAttribute(
        "data-density",
        String(context.globals.density ?? "comfortable"),
      );

      return Story();
    },
  ],
};

export default preview;
