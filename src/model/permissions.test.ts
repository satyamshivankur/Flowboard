import { describe, expect, it } from "vitest";

import type { Capability } from "@/config/capabilities";
import {
  aContainer,
  aGrant,
  aWorkspaceWith,
  scopeFor,
} from "@/test/fixtures";

import {
  can,
  canView,
  requireCapability,
  resolveGrant,
  roleOf,
} from "./permissions";

/**
 * The permission resolution table from the design doc, one case per row.
 *
 * These are the tests the brief asks for by name, and they are the reason the
 * engine is pure: no rendering, no store, no async.
 */

const admin = scopeFor("u-admin", "ws-test");
const member = scopeFor("u-member", "ws-test");
const other = scopeFor("u-other", "ws-test");

describe("roleOf", () => {
  it("resolves role from workspace membership, not from the user", () => {
    const state = aWorkspaceWith([]);

    expect(roleOf(state, "ws-test", "u-admin")).toBe("admin");
    expect(roleOf(state, "ws-test", "u-member")).toBe("member");
  });

  it("returns null for a user with no membership in that workspace", () => {
    const state = aWorkspaceWith([]);

    expect(roleOf(state, "ws-test", "u-nobody")).toBeNull();
    expect(roleOf(state, "ws-elsewhere", "u-admin")).toBeNull();
  });
});

describe("canView resolution table", () => {
  it("admin bypasses every check", () => {
    const state = aWorkspaceWith([
      aContainer({ id: "sp-private", visibility: "private" }),
    ]);

    expect(canView(state, admin, "sp-private")).toBe(true);
  });

  it("public chain with no grants is visible", () => {
    const state = aWorkspaceWith([
      aContainer({ id: "sp-public" }),
      aContainer({ id: "fo-public", type: "folder", parentId: "sp-public" }),
      aContainer({ id: "li-public", type: "list", parentId: "fo-public" }),
    ]);

    expect(canView(state, member, "li-public")).toBe(true);
  });

  it("private node without a grant is denied", () => {
    const state = aWorkspaceWith([
      aContainer({ id: "sp-private", visibility: "private" }),
    ]);

    expect(canView(state, member, "sp-private")).toBe(false);
  });

  it("private node with an allow grant is visible", () => {
    const state = aWorkspaceWith(
      [aContainer({ id: "sp-private", visibility: "private" })],
      [aGrant("sp-private", "u-member", "allow")],
    );

    expect(canView(state, member, "sp-private")).toBe(true);
    // The grant is per user: Other still cannot see it.
    expect(canView(state, other, "sp-private")).toBe(false);
  });

  it("an allow grant is inherited by the subtree", () => {
    const state = aWorkspaceWith(
      [
        aContainer({ id: "sp-private", visibility: "private" }),
        aContainer({ id: "fo-child", type: "folder", parentId: "sp-private" }),
        aContainer({ id: "li-grandchild", type: "list", parentId: "fo-child" }),
      ],
      [aGrant("sp-private", "u-member", "allow")],
    );

    expect(canView(state, member, "li-grandchild")).toBe(true);
    expect(canView(state, other, "li-grandchild")).toBe(false);
  });

  it("a deny on an ancestor denies the whole subtree", () => {
    const state = aWorkspaceWith(
      [
        aContainer({ id: "sp-public" }),
        aContainer({ id: "fo-child", type: "folder", parentId: "sp-public" }),
        aContainer({ id: "li-grandchild", type: "list", parentId: "fo-child" }),
      ],
      [aGrant("sp-public", "u-member", "deny")],
    );

    expect(canView(state, member, "sp-public")).toBe(false);
    expect(canView(state, member, "fo-child")).toBe(false);
    expect(canView(state, member, "li-grandchild")).toBe(false);
  });

  it("a deny on a public node blocks only that node's subtree", () => {
    const state = aWorkspaceWith(
      [
        aContainer({ id: "sp-public" }),
        aContainer({ id: "li-open", type: "list", parentId: "sp-public" }),
        aContainer({ id: "li-denied", type: "list", parentId: "sp-public" }),
      ],
      [aGrant("li-denied", "u-member", "deny")],
    );

    expect(canView(state, member, "li-open")).toBe(true);
    expect(canView(state, member, "li-denied")).toBe(false);
  });

  /*
   * Nearest grant wins. This is the semantic the design doc commits to: a
   * deeper allow re-opens a subtree an ancestor deny had closed. The
   * alternative — deny always wins globally — is equally defensible, which is
   * exactly why it needs a test stating which one this codebase implements.
   */
  it("a descendant allow overrides an ancestor deny — nearest grant wins", () => {
    const state = aWorkspaceWith(
      [
        aContainer({ id: "sp-public" }),
        aContainer({ id: "fo-child", type: "folder", parentId: "sp-public" }),
        aContainer({ id: "li-regranted", type: "list", parentId: "fo-child" }),
      ],
      [
        aGrant("sp-public", "u-member", "deny"),
        aGrant("li-regranted", "u-member", "allow"),
      ],
    );

    expect(canView(state, member, "sp-public")).toBe(false);
    expect(canView(state, member, "fo-child")).toBe(false);
    expect(canView(state, member, "li-regranted")).toBe(true);
  });

  it("an archived node anywhere in the chain denies", () => {
    const state = aWorkspaceWith([
      aContainer({ id: "sp-archived", archivedAt: "2026-10-01T00:00:00.000Z" }),
      aContainer({ id: "li-child", type: "list", parentId: "sp-archived" }),
    ]);

    expect(canView(state, member, "sp-archived")).toBe(false);
    expect(canView(state, member, "li-child")).toBe(false);
    // Even an admin cannot view an archived node: archive is state, not access.
    expect(canView(state, admin, "li-child")).toBe(false);
  });

  it("denies a non-member of the workspace", () => {
    const state = aWorkspaceWith([aContainer({ id: "sp-public" })]);

    expect(canView(state, scopeFor("u-nobody", "ws-test"), "sp-public")).toBe(
      false,
    );
  });

  it("fails closed for a missing node", () => {
    const state = aWorkspaceWith([]);

    expect(canView(state, member, "sp-ghost")).toBe(false);
    expect(canView(state, admin, "sp-ghost")).toBe(false);
  });

  it("fails closed for an orphaned node whose parent is gone", () => {
    const state = aWorkspaceWith([
      aContainer({ id: "fo-orphan", type: "folder", parentId: "sp-missing" }),
    ]);

    expect(canView(state, member, "fo-orphan")).toBe(false);
  });

  it("rejects a node belonging to a different workspace", () => {
    const state = aWorkspaceWith([
      aContainer({ id: "sp-foreign", workspaceId: "ws-elsewhere" }),
    ]);

    expect(canView(state, member, "sp-foreign")).toBe(false);
  });
});

describe("resolveGrant", () => {
  it("returns the grant matching the user", () => {
    const state = aWorkspaceWith(
      [aContainer({ id: "sp-a" })],
      [aGrant("sp-a", "u-member", "allow")],
    );

    expect(resolveGrant(state, "sp-a", "u-member")?.mode).toBe("allow");
    expect(resolveGrant(state, "sp-a", "u-other")).toBeUndefined();
  });

  /*
   * One user matches at most one grant today, so this tie-break is unobservable
   * in the app. It is asserted because it is the semantics team grants need,
   * and encoding it now means that change stays additive (Requirement 21.8).
   */
  it("prefers deny when several grants match the same node", () => {
    const state = aWorkspaceWith(
      [aContainer({ id: "sp-a" })],
      [
        aGrant("sp-a", "u-member", "allow"),
        aGrant("sp-a", "u-member", "deny"),
      ],
    );

    expect(resolveGrant(state, "sp-a", "u-member")?.mode).toBe("deny");
  });
});

describe("can — capability checks", () => {
  const state = aWorkspaceWith([
    aContainer({ id: "sp-public" }),
    aContainer({ id: "li-public", type: "list", parentId: "sp-public" }),
  ]);

  it("lets admins do anything", () => {
    const capabilities: Capability[] = [
      "task:update",
      "container:archive",
      "container:create",
      "status:update",
    ];

    for (const capability of capabilities) {
      expect(can(state, admin, capability, "li-public")).toBe(true);
    }
  });

  it("lets members edit tasks but not structure", () => {
    expect(can(state, member, "task:create", "li-public")).toBe(true);
    expect(can(state, member, "task:update", "li-public")).toBe(true);
    expect(can(state, member, "task:delete", "li-public")).toBe(true);
    expect(can(state, member, "task:reorder", "li-public")).toBe(true);

    expect(can(state, member, "container:create", "li-public")).toBe(false);
    expect(can(state, member, "container:archive", "li-public")).toBe(false);
    expect(can(state, member, "container:update", "li-public")).toBe(false);
    expect(can(state, member, "status:update", "li-public")).toBe(false);
  });

  it("refuses any capability on a resource the user cannot see", () => {
    const denied = aWorkspaceWith(
      [aContainer({ id: "li-denied", type: "list" })],
      [aGrant("li-denied", "u-member", "deny")],
    );

    expect(can(denied, member, "task:update", "li-denied")).toBe(false);
  });

  it("supports a synthetic role through the injected table", () => {
    const table: Partial<Record<string, ReadonlySet<Capability>>> = {
      member: new Set<Capability>(["task:update", "container:create"]),
    };

    expect(can(state, member, "container:create", "li-public", table)).toBe(
      true,
    );
    expect(can(state, member, "container:archive", "li-public", table)).toBe(
      false,
    );
  });
});

describe("requireCapability", () => {
  const state = aWorkspaceWith(
    [
      aContainer({ id: "sp-public" }),
      aContainer({ id: "li-public", type: "list", parentId: "sp-public" }),
      aContainer({ id: "li-denied", type: "list", parentId: "sp-public" }),
    ],
    [aGrant("li-denied", "u-member", "deny")],
  );

  it("returns null when permitted", () => {
    expect(requireCapability(state, member, "task:update", "li-public")).toBeNull();
  });

  /*
   * The two FORBIDDEN cases are worded differently on purpose: "cannot see it"
   * is a navigation problem and "cannot change it" is a role problem, and
   * conflating them makes the toast useless (Requirement 8.11, 14.5).
   */
  it("distinguishes no-access from insufficient-role", () => {
    const noAccess = requireCapability(state, member, "task:update", "li-denied");
    const wrongRole = requireCapability(
      state,
      member,
      "container:archive",
      "li-public",
    );

    expect(noAccess?.code).toBe("FORBIDDEN");
    expect(noAccess?.message).toMatch(/don't have access/i);

    expect(wrongRole?.code).toBe("FORBIDDEN");
    expect(wrongRole?.message).toMatch(/permission to archive/i);
  });

  it("reports a non-member distinctly", () => {
    const result = requireCapability(
      state,
      scopeFor("u-nobody", "ws-test"),
      "task:update",
      "li-public",
    );

    expect(result?.code).toBe("FORBIDDEN");
    expect(result?.message).toMatch(/not a member/i);
  });
});
