import { describe, expect, it } from "vitest";

import {
  CONTAINER_REGISTRY,
  type ContainerTypeConfig,
} from "@/config/containers";
import { MAX_ASSIGNEES, MAX_NAME_LEN, MAX_TITLE_LEN } from "@/config/limits";
import { PRIORITIES } from "@/config/priorities";
import { aContainer, aState, aStatus, aTask, aUser } from "@/test/fixtures";

import {
  validateAssignees,
  validateContainerMove,
  validateContainerName,
  validateDueDate,
  validateListHoldsTasks,
  validateNoCycle,
  validateParentType,
  validatePriority,
  validateStatusBelongsToList,
  validateSubtaskDepth,
  validateSubtaskList,
  validateTaskTitle,
} from "./validation";

describe("validateContainerName", () => {
  it("requires a non-empty name after trimming", () => {
    expect(validateContainerName("")?.field).toBe("name");
    expect(validateContainerName("   ")?.field).toBe("name");
    expect(validateContainerName("\t\n ")?.code).toBe("VALIDATION");
  });

  it("accepts a normal name", () => {
    expect(validateContainerName("Engineering")).toBeNull();
    expect(validateContainerName("  padded  ")).toBeNull();
  });

  it("enforces the length limit on the trimmed value", () => {
    expect(validateContainerName("a".repeat(MAX_NAME_LEN))).toBeNull();
    expect(validateContainerName("a".repeat(MAX_NAME_LEN + 1))?.code).toBe(
      "VALIDATION",
    );
    // Trailing whitespace should not push a valid name over the limit.
    expect(validateContainerName(`${"a".repeat(MAX_NAME_LEN)}    `)).toBeNull();
  });
});

describe("validateTaskTitle", () => {
  it("requires a title", () => {
    expect(validateTaskTitle("")?.field).toBe("title");
    expect(validateTaskTitle("  ")?.field).toBe("title");
  });

  it("enforces the 500-character limit from the brief", () => {
    expect(MAX_TITLE_LEN).toBe(500);
    expect(validateTaskTitle("a".repeat(500))).toBeNull();
    expect(validateTaskTitle("a".repeat(501))?.code).toBe("VALIDATION");
  });
});

describe("validateDueDate", () => {
  it("accepts null and valid ISO datetimes", () => {
    expect(validateDueDate(null)).toBeNull();
    expect(validateDueDate("2026-10-16T09:00:00.000Z")).toBeNull();
  });

  /*
   * An unparseable string would become `Invalid Date` and sort silently to the
   * end, which looks like a sorting bug rather than bad input.
   */
  it("rejects a string Date cannot parse", () => {
    expect(validateDueDate("not a date")?.field).toBe("dueDate");
    expect(validateDueDate("2026-13-45")?.code).toBe("VALIDATION");
  });
});

describe("validateAssignees", () => {
  const state = aState({
    users: [aUser({ id: "u-a" }), aUser({ id: "u-b" }), aUser({ id: "u-x" })],
    memberships: [
      { workspaceId: "ws-test", userId: "u-a", role: "admin" },
      { workspaceId: "ws-test", userId: "u-b", role: "member" },
    ],
  });

  it("accepts members of the workspace", () => {
    expect(validateAssignees(state, "ws-test", ["u-a", "u-b"])).toBeNull();
    expect(validateAssignees(state, "ws-test", [])).toBeNull();
  });

  it("rejects duplicates", () => {
    expect(validateAssignees(state, "ws-test", ["u-a", "u-a"])?.field).toBe(
      "assigneeIds",
    );
  });

  it("rejects a user who exists but is not a member of this workspace", () => {
    expect(validateAssignees(state, "ws-test", ["u-x"])?.code).toBe(
      "VALIDATION",
    );
  });
});

describe("validateParentType", () => {
  it("accepts the registry's hierarchy", () => {
    expect(validateParentType("workspace", "space")).toBeNull();
    expect(validateParentType("space", "folder")).toBeNull();
    expect(validateParentType("folder", "list")).toBeNull();
  });

  it("rejects every invalid pairing", () => {
    expect(validateParentType("list", "list")?.code).toBe("VALIDATION");
    expect(validateParentType("workspace", "list")?.code).toBe("VALIDATION");
    expect(validateParentType("folder", "space")?.code).toBe("VALIDATION");
  });

  /*
   * The extensibility proof for validation. If this function compared type
   * literals instead of reading the registry, a synthetic level would fail.
   * Requirement 18.9, 21.4.
   */
  it("follows an injected registry with a synthetic level", () => {
    const extended: Record<string, ContainerTypeConfig<string>> = {
      ...CONTAINER_REGISTRY,
      folder: { ...CONTAINER_REGISTRY.folder, childTypes: ["subfolder"] },
      subfolder: {
        ...CONTAINER_REGISTRY.folder,
        type: "subfolder",
        label: "Subfolder",
        labelPlural: "Subfolders",
        childTypes: ["list"],
      },
    };

    expect(validateParentType("folder", "subfolder", extended)).toBeNull();
    expect(validateParentType("subfolder", "list", extended)).toBeNull();
    // Under the extended registry, folder no longer takes lists directly.
    expect(validateParentType("folder", "list", extended)?.code).toBe(
      "VALIDATION",
    );
  });
});

describe("validateNoCycle", () => {
  const state = aState({
    containers: [
      aContainer({ id: "ws-test", type: "workspace", parentId: null }),
      aContainer({ id: "sp-a", type: "space", parentId: "ws-test" }),
      aContainer({ id: "fo-a", type: "folder", parentId: "sp-a" }),
      aContainer({ id: "li-a", type: "list", parentId: "fo-a" }),
    ],
  });

  it("rejects moving a node into itself", () => {
    expect(validateNoCycle(state, "sp-a", "sp-a")?.code).toBe("VALIDATION");
  });

  it("rejects moving a node into its own child", () => {
    expect(validateNoCycle(state, "sp-a", "fo-a")?.code).toBe("VALIDATION");
  });

  it("rejects moving a node into a deeper descendant", () => {
    expect(validateNoCycle(state, "sp-a", "li-a")?.code).toBe("VALIDATION");
  });

  it("allows an unrelated destination", () => {
    expect(validateNoCycle(state, "li-a", "sp-a")).toBeNull();
  });
});

describe("validateContainerMove", () => {
  const state = aState({
    containers: [
      aContainer({ id: "ws-test", type: "workspace", parentId: null }),
      aContainer({ id: "sp-a", type: "space", parentId: "ws-test" }),
      aContainer({ id: "sp-b", type: "space", parentId: "ws-test" }),
      aContainer({ id: "fo-a", type: "folder", parentId: "sp-a" }),
      aContainer({ id: "li-a", type: "list", parentId: "fo-a" }),
      aContainer({
        id: "sp-foreign",
        type: "space",
        parentId: "ws-other",
        workspaceId: "ws-other",
      }),
    ],
  });

  it("allows a folder to move between spaces", () => {
    expect(validateContainerMove(state, "fo-a", "sp-b")).toBeNull();
  });

  it("reports a missing node or destination as NOT_FOUND", () => {
    expect(validateContainerMove(state, "ghost", "sp-a")?.code).toBe(
      "NOT_FOUND",
    );
    expect(validateContainerMove(state, "fo-a", "ghost")?.code).toBe(
      "NOT_FOUND",
    );
  });

  it("refuses to move items between workspaces", () => {
    expect(validateContainerMove(state, "fo-a", "sp-foreign")?.code).toBe(
      "VALIDATION",
    );
  });

  it("rejects an invalid type pairing", () => {
    expect(validateContainerMove(state, "fo-a", "li-a")?.code).toBe(
      "VALIDATION",
    );
  });
});

describe("validateStatusBelongsToList", () => {
  const state = aState({
    statuses: [
      aStatus({ id: "st-a", listId: "li-a" }),
      aStatus({ id: "st-b", listId: "li-b" }),
    ],
  });

  it("accepts a status from the task's own list", () => {
    expect(validateStatusBelongsToList(state, "st-a", "li-a")).toBeNull();
  });

  it("rejects a status from another list", () => {
    const error = validateStatusBelongsToList(state, "st-b", "li-a");

    expect(error?.code).toBe("VALIDATION");
    expect(error?.field).toBe("statusId");
  });

  it("reports an unknown status as NOT_FOUND", () => {
    expect(validateStatusBelongsToList(state, "st-ghost", "li-a")?.code).toBe(
      "NOT_FOUND",
    );
  });
});

describe("validateSubtaskDepth", () => {
  const state = aState({
    tasks: [
      aTask({ id: "t-parent", parentTaskId: null }),
      aTask({ id: "t-child", parentTaskId: "t-parent" }),
    ],
  });

  it("allows a top-level task", () => {
    expect(validateSubtaskDepth(state, null)).toBeNull();
  });

  it("allows one level of nesting", () => {
    expect(validateSubtaskDepth(state, "t-parent")).toBeNull();
  });

  it("rejects nesting under a subtask", () => {
    expect(validateSubtaskDepth(state, "t-child")?.code).toBe("VALIDATION");
  });

  it("reports a missing parent as NOT_FOUND", () => {
    expect(validateSubtaskDepth(state, "t-ghost")?.code).toBe("NOT_FOUND");
  });
});

describe("validateSubtaskList", () => {
  const state = aState({
    tasks: [aTask({ id: "t-parent", primaryListId: "li-a" })],
  });

  it("accepts a subtask in the parent's list", () => {
    expect(validateSubtaskList(state, "t-parent", "li-a")).toBeNull();
  });

  it("rejects a subtask in a different list", () => {
    expect(validateSubtaskList(state, "t-parent", "li-b")?.code).toBe(
      "VALIDATION",
    );
  });

  it("is a no-op for top-level tasks", () => {
    expect(validateSubtaskList(state, null, "li-anything")).toBeNull();
  });
});

describe("validateListHoldsTasks", () => {
  const state = aState({
    containers: [
      aContainer({ id: "li-a", type: "list" }),
      aContainer({ id: "fo-a", type: "folder" }),
      aContainer({
        id: "li-archived",
        type: "list",
        archivedAt: "2026-10-01T00:00:00.000Z",
      }),
    ],
  });

  it("accepts a list", () => {
    expect(validateListHoldsTasks(state, "li-a")).toBeNull();
  });

  it("rejects a container type that does not hold tasks", () => {
    expect(validateListHoldsTasks(state, "fo-a")?.code).toBe("VALIDATION");
  });

  it("rejects an archived list", () => {
    expect(validateListHoldsTasks(state, "li-archived")?.code).toBe(
      "NOT_FOUND",
    );
  });

  it("rejects a missing list", () => {
    expect(validateListHoldsTasks(state, "li-ghost")?.code).toBe("NOT_FOUND");
  });
});

/*
 * `validatePriority` guards the one task field that arrives as an unknown from
 * outside the type system — a persisted payload, or a URL. `isPriority` is the
 * registry lookup behind it, so this is also what proves the priority set is
 * read from `PRIORITY_CONFIG` rather than restated here.
 */
describe("validatePriority", () => {
  it("accepts every configured priority", () => {
    for (const priority of PRIORITIES) {
      expect(validatePriority(priority)).toBeNull();
    }
  });

  it("rejects a string that is not a priority", () => {
    const error = validatePriority("critical");

    expect(error?.code).toBe("VALIDATION");
    expect(error?.field).toBe("priority");
  });

  it("rejects values that are not strings at all", () => {
    for (const value of [undefined, null, 3, {}, []]) {
      expect(validatePriority(value)?.code).toBe("VALIDATION");
    }
  });
});

describe("validateAssignees — the ceiling", () => {
  const members = Array.from({ length: MAX_ASSIGNEES + 1 }, (_, index) =>
    aUser({ id: `u-${String(index)}` }),
  );

  const state = aState({
    users: members,
    memberships: members.map((user) => ({
      workspaceId: "ws-test",
      userId: user.id,
      role: "member" as const,
    })),
  });

  it("accepts exactly the limit", () => {
    const ids = members.slice(0, MAX_ASSIGNEES).map((user) => user.id);

    expect(validateAssignees(state, "ws-test", ids)).toBeNull();
  });

  it("rejects one past the limit, naming the field", () => {
    const ids = members.map((user) => user.id);
    const error = validateAssignees(state, "ws-test", ids);

    expect(error?.code).toBe("VALIDATION");
    expect(error?.field).toBe("assigneeIds");
    expect(error?.message).toContain(String(MAX_ASSIGNEES));
  });

  /* The ceiling is checked before membership, so the message is the useful one. */
  it("reports the count before complaining about unknown members", () => {
    const ids = Array.from(
      { length: MAX_ASSIGNEES + 1 },
      (_, index) => `u-stranger-${String(index)}`,
    );

    expect(validateAssignees(state, "ws-test", ids)?.message).toContain(
      "at most",
    );
  });
});

describe("validateSubtaskList — a parent that is gone", () => {
  it("reports a missing parent as NOT_FOUND rather than accepting it", () => {
    const state = aState({ tasks: [] });

    expect(validateSubtaskList(state, "t-vanished", "li-a")?.code).toBe(
      "NOT_FOUND",
    );
  });
});

/*
 * The message falls back to the raw type name when the registry has no label
 * for it. Reached only by a type the registry does not describe, which is
 * exactly the state a half-finished registry edit leaves behind — so the
 * fallback is there to keep the error legible rather than print "undefined".
 */
describe("validateParentType — an unlabelled type", () => {
  it("names the raw type when the registry carries no label", () => {
    const sparse: Partial<Record<string, ContainerTypeConfig<string>>> = {
      ...CONTAINER_REGISTRY,
    };

    const error = validateParentType("list", "mystery", sparse);

    expect(error?.code).toBe("VALIDATION");
    expect(error?.message).toContain("mystery");
  });
});
