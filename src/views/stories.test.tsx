import { render } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { createElement } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import * as buttons from "@/components/ui/Button.stories";
import * as controls from "@/components/ui/Controls.stories";
import * as feedback from "@/components/ui/Feedback.stories";
import * as overlays from "@/components/ui/Overlays.stories";
import * as tokenDisplays from "@/components/ui/TokenDisplays.stories";
import { useStore } from "@/controllers/store";
import { createSeedState, SEED_IDS } from "@/model/seed";

import * as composites from "./Composites.stories";
import * as responsive from "./Responsive.stories";

/**
 * Story smoke tests.
 *
 * `build-storybook` only proves the stories *bundle*. A story that throws on
 * render still builds, and then silently misrepresents the component it was
 * written to document. Rendering each one here is what makes the workbench
 * trustworthy (Requirement 11.8, 20.14).
 *
 * Deliberately shallow: these assert that a story mounts, not what it looks
 * like. The behavioural assertions live beside the components themselves.
 */

/** The two CSF shapes a story can take. */
interface StoryLike {
  readonly render?: (args: Record<string, unknown>) => ReactNode;
  readonly args?: Record<string, unknown>;
}

interface MetaLike {
  readonly component?: ComponentType<Record<string, unknown>>;
  readonly args?: Record<string, unknown>;
}

type StoryModule = Record<string, unknown>;

/**
 * Renders a story the way Storybook would.
 *
 * Both CSF forms have to be handled. A story with a `render` receives the
 * merged args; a story with only `args` is rendered through `meta.component`.
 * An earlier version of this helper demanded `render` and reported Button's
 * `FullWidth` as broken when it was simply declarative.
 */
function storiesOf(module: StoryModule): [string, () => ReactNode][] {
  const meta = (module["default"] ?? {}) as MetaLike;

  return Object.entries(module)
    .filter(([name]) => name !== "default")
    .map(([name, value]) => {
      const story = value as StoryLike;
      const args = { ...meta.args, ...story.args };

      if (typeof story.render === "function") {
        const renderStory = story.render;

        return [name, () => renderStory(args)];
      }

      const Component = meta.component;

      if (Component === undefined) {
        throw new Error(
          `Story ${name} has neither a render function nor a meta component`,
        );
      }

      return [name, () => createElement(Component, args)];
    });
}

beforeEach(() => {
  useStore.setState((state) => ({
    ...state,
    ...createSeedState(),
    currentUserId: SEED_IDS.users.alice,
    isHydrating: false,
    loadingListId: null,
  }));

  window.localStorage.clear();
});

describe.each([
  ["UI/Button", buttons as StoryModule],
  ["UI/Controls", controls as StoryModule],
  ["UI/Feedback", feedback as StoryModule],
  ["UI/Overlays", overlays as StoryModule],
  ["UI/TokenDisplays", tokenDisplays as StoryModule],
  ["Composites", composites as StoryModule],
  ["Responsive", responsive as StoryModule],
])("%s stories", (_title, module) => {
  it("exports at least one story", () => {
    expect(storiesOf(module).length).toBeGreaterThan(0);
  });

  it.each(storiesOf(module))("%s renders", (_name, renderStory) => {
    const { container } = render(<>{renderStory()}</>);

    expect(container).not.toBeEmptyDOMElement();
  });
});
