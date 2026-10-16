import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

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
 * like. The behavioural assertions live in `views.test.tsx`.
 */

type StoryModule = Record<string, unknown>;

/** Every exported story in a module, excluding the default `meta`. */
function storiesOf(module: StoryModule): [string, () => React.ReactNode][] {
  return Object.entries(module)
    .filter(([name]) => name !== "default")
    .map(([name, story]) => {
      const candidate = story as { render?: () => React.ReactNode };

      if (typeof candidate.render !== "function") {
        throw new Error(`Story ${name} has no render function`);
      }

      return [name, candidate.render];
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
