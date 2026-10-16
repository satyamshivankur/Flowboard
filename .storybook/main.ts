import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Storybook on the Vite builder, reusing the app's own `vite.config.ts`.
 *
 * That reuse is the point: `@tailwindcss/vite` and the `@` alias are active in
 * stories, so a component renders with the real token set rather than an
 * approximation of it (Requirement 11.6).
 */
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  typescript: {
    // The app's own `tsc -b` already type-checks these files; doing it again
    // here only slows the workbench down.
    check: false,
  },
};

export default config;
