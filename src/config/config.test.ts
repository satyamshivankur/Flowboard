import { describe, expect, it } from "vitest";

import {
  ALL_CAPABILITIES,
  ROLE_CAPABILITIES,
  roleBypassesChecks,
  roleHasCapability,
  type Capability,
} from "./capabilities";
import {
  CONTAINER_REGISTRY,
  canContain,
  containerConfig,
  holdsTasks,
  isGrantableType,
  isMutableType,
  rootContainerType,
  taskHoldingType,
  type ContainerTypeConfig,
} from "./containers";
import { MAX_TASK_DEPTH, MIN_STATUSES_PER_LIST, POSITION_GAP } from "./limits";
import { PRIORITIES, comparePriority, isPriority } from "./priorities";
import {
  DEFAULT_STATUS_TEMPLATE,
  STATUS_CATEGORIES,
  TERMINAL_STATUS_CATEGORY,
} from "./statusCategories";
import { DEFAULT_VIEW, VIEW_IDS, isViewId } from "./views";

describe("container registry", () => {
  it("declares the documented hierarchy", () => {
    expect(canContain("workspace", "space")).toBe(true);
    expect(canContain("space", "folder")).toBe(true);
    expect(canContain("folder", "list")).toBe(true);
  });

  it("rejects every invalid parent/child pair", () => {
    expect(canContain("list", "list")).toBe(false);
    expect(canContain("workspace", "list")).toBe(false);
    expect(canContain("space", "space")).toBe(false);
    expect(canContain("folder", "folder")).toBe(false);
  });

  it("treats only lists as task holders", () => {
    expect(holdsTasks("list")).toBe(true);
    expect(holdsTasks("folder")).toBe(false);
    expect(holdsTasks("space")).toBe(false);
    expect(holdsTasks("workspace")).toBe(false);
  });

  it("resolves exactly one root type", () => {
    expect(rootContainerType()).toBe("workspace");
  });

  /*
   * The extensibility proof. If any hierarchy logic hard-codes the four known
   * types rather than reading the registry, a synthetic level breaks it.
   * Requirement 18.9 and 21.4.
   */
  it("accepts a synthetic hierarchy level without code changes", () => {
    const extended: Record<string, ContainerTypeConfig<string>> = {
      ...CONTAINER_REGISTRY,
      folder: { ...CONTAINER_REGISTRY.folder, childTypes: ["subfolder"] },
      subfolder: {
        type: "subfolder",
        label: "Subfolder",
        labelPlural: "Subfolders",
        icon: CONTAINER_REGISTRY.folder.icon,
        childTypes: ["list"],
        holdsTasks: false,
        grantable: true,
        mutable: true,
      },
    };

    expect(canContain("folder", "subfolder", extended)).toBe(true);
    expect(canContain("subfolder", "list", extended)).toBe(true);
    expect(canContain("folder", "list", extended)).toBe(false);
    expect(rootContainerType(extended)).toBe("workspace");
    expect(taskHoldingType(extended)).toBe("list");
  });

  it("rejects a registry with more than one root", () => {
    const twoRoots: Record<string, ContainerTypeConfig<string>> = {
      ...CONTAINER_REGISTRY,
      orphan: { ...CONTAINER_REGISTRY.space, type: "orphan", childTypes: [] },
    };

    expect(() => rootContainerType(twoRoots)).toThrow(/exactly one root type/i);
  });
});

describe("capability table", () => {
  it("gives admins the bypass, which implies every capability", () => {
    expect(roleBypassesChecks("admin")).toBe(true);

    for (const capability of ALL_CAPABILITIES) {
      expect(roleHasCapability("admin", capability)).toBe(true);
    }
  });

  it("gives members task capabilities and no structural ones", () => {
    expect(roleHasCapability("member", "task:update")).toBe(true);
    expect(roleHasCapability("member", "task:create")).toBe(true);
    expect(roleHasCapability("member", "container:archive")).toBe(false);
    expect(roleHasCapability("member", "container:create")).toBe(false);
    expect(roleHasCapability("member", "status:update")).toBe(false);
    expect(roleBypassesChecks("member")).toBe(false);
  });

  /*
   * Adding a role must be a table entry, not a code change. Requirement 21.7.
   */
  it("supports a synthetic role with no change to the check function", () => {
    const table: Record<string, ReadonlySet<Capability>> = {
      ...ROLE_CAPABILITIES,
      guest: new Set<Capability>([]),
      lead: new Set<Capability>(["task:update", "container:create"]),
    };

    expect(roleHasCapability("guest" as never, "task:update", table)).toBe(
      false,
    );
    expect(roleHasCapability("lead" as never, "task:update", table)).toBe(true);
    expect(roleHasCapability("lead" as never, "container:create", table)).toBe(
      true,
    );
    expect(roleHasCapability("lead" as never, "container:archive", table)).toBe(
      false,
    );
  });

  it("denies an unknown role everything", () => {
    expect(roleHasCapability("nobody" as never, "task:update")).toBe(false);
  });
});

describe("priority config", () => {
  it("orders by semantic rank, not alphabetically", () => {
    expect(PRIORITIES).toEqual(["urgent", "high", "normal", "low", "none"]);
  });

  it("sorts urgent before none in both directions", () => {
    expect(comparePriority("urgent", "none")).toBeLessThan(0);
    expect(comparePriority("urgent", "none", "desc")).toBeGreaterThan(0);
    expect(comparePriority("high", "high")).toBe(0);
  });
});

describe("status categories", () => {
  it("orders todo before active before done", () => {
    expect(STATUS_CATEGORIES).toEqual(["todo", "active", "done"]);
  });

  it("resolves exactly one terminal category", () => {
    expect(TERMINAL_STATUS_CATEGORY).toBe("done");
  });
});

describe("default status template", () => {
  it("names the three statuses a new list starts with", () => {
    expect(DEFAULT_STATUS_TEMPLATE.map((entry) => entry.name)).toEqual([
      "To do",
      "In progress",
      "Done",
    ]);
  });

  /*
   * The template is derived from the category table, so this is what stops a
   * new category being added without new lists getting a column for it — and
   * what keeps the set at the minimum every list must retain.
   */
  it("covers every category exactly once, at the documented minimum", () => {
    expect(DEFAULT_STATUS_TEMPLATE.map((entry) => entry.category)).toEqual(
      STATUS_CATEGORIES,
    );
    expect(DEFAULT_STATUS_TEMPLATE).toHaveLength(MIN_STATUSES_PER_LIST);
  });

  it("carries a colour token per entry, never a hex literal", () => {
    for (const entry of DEFAULT_STATUS_TEMPLATE) {
      expect(entry.color).toMatch(/^status-/);
    }
  });
});

/* Breakpoints are covered by breakpoints.test.ts, which asserts parity with
 * the stylesheet rather than restating the numbers here. */

describe("limits", () => {
  it("exposes named limits rather than inline literals", () => {
    expect(MAX_TASK_DEPTH).toBe(1);
    expect(POSITION_GAP).toBeGreaterThan(0);
  });
});

/*
 * The registry's error paths.
 *
 * Each of these exists because the registry is the single source of a rule the
 * whole app reads, and a half-finished edit to it should fail loudly at the
 * lookup rather than quietly somewhere downstream. They are unreachable with
 * `CONTAINER_REGISTRY` itself, so a synthetic registry is the only way to
 * reach them — which is also the point: the logic takes a registry argument
 * precisely so it is not welded to the production one (Requirement 21.4).
 */
describe("registry lookups fail loudly", () => {
  it("throws on a container type it does not describe", () => {
    expect(() => containerConfig("mystery", CONTAINER_REGISTRY)).toThrow(
      /unknown container type/i,
    );
  });

  it("reports mutability and grantability from the registry", () => {
    expect(isMutableType("list")).toBe(true);
    expect(isMutableType("workspace")).toBe(false);

    expect(isGrantableType("space")).toBe(true);
    expect(isGrantableType("workspace")).toBe(false);
  });

  it("refuses a registry where no type holds tasks", () => {
    const noHolder: Record<string, ContainerTypeConfig<string>> = {
      workspace: {
        ...CONTAINER_REGISTRY.workspace,
        childTypes: [],
        holdsTasks: false,
      },
    };

    expect(() => taskHoldingType(noHolder)).toThrow(/exactly one/i);
  });

  it("refuses a registry where two types hold tasks", () => {
    const twoHolders: Record<string, ContainerTypeConfig<string>> = {
      ...CONTAINER_REGISTRY,
      folder: { ...CONTAINER_REGISTRY.folder, holdsTasks: true },
    };

    expect(() => taskHoldingType(twoHolders)).toThrow(/exactly one/i);
  });
});

/*
 * The predicates that guard a value arriving from outside the type system — a
 * persisted payload or a stored preference. Both have a production caller
 * (`validatePriority` and `NavigationContext`), and both are the reason an
 * unknown value falls back rather than propagating as a nonexistent key.
 */
describe("value predicates", () => {
  it("recognises every configured priority and nothing else", () => {
    for (const priority of PRIORITIES) {
      expect(isPriority(priority)).toBe(true);
    }

    for (const value of ["critical", "", undefined, null, 0, {}]) {
      expect(isPriority(value)).toBe(false);
    }
  });

  it("recognises every registered view id and nothing else", () => {
    for (const id of VIEW_IDS) {
      expect(isViewId(id)).toBe(true);
    }

    expect(isViewId(DEFAULT_VIEW)).toBe(true);

    for (const value of ["calendar", "", undefined, null, 1]) {
      expect(isViewId(value)).toBe(false);
    }
  });
});

/*
 * `roleBypassesChecks` reads a table that may not describe the role it is
 * handed — which is what makes the capability table injectable, and what
 * `canView` relies on to deny a role it has no policy for rather than throwing.
 */
describe("capability table lookups", () => {
  it("denies the bypass to a role the table does not describe", () => {
    expect(
      roleBypassesChecks("ghost" as Parameters<typeof roleBypassesChecks>[0]),
    ).toBe(false);
  });

  it("denies the bypass when the table describes the role without it", () => {
    expect(
      roleBypassesChecks("admin", { admin: new Set<Capability>([]) }),
    ).toBe(false);
  });
});
