import { describe, expect, it } from "vitest";

import type { Capability } from "@/config/capabilities";
import { aContainer, aState, aUser } from "@/test/fixtures";

import {
  accessForContainer,
  defaultAccessFor,
  governedMemberIds,
  grantRowsForAccess,
  grantsExcluding,
  OPEN_ACCESS,
  RESTRICTED_ACCESS,
  type ContainerAccess,
} from "./access";
import type { FlowboardState } from "./state";
import type { Grant } from "./types";

/*
 * A workspace with one admin and two members. The admin is here specifically
 * to prove she is excluded from every access list — her visibility comes from
 * `workspace:bypass`, so a list that claimed to govern it would be lying about
 * what the control does.
 */
const WORKSPACE = "ws-access";

const alice = aUser({ id: "u-a", name: "Alice" });
const bob = aUser({ id: "u-b", name: "Bob" });
const carol = aUser({ id: "u-c", name: "Carol" });

const workspace = aContainer({
  id: WORKSPACE,
  workspaceId: WORKSPACE,
  type: "workspace",
  parentId: null,
  visibility: "public",
});

function stateWith(
  container: Parameters<typeof aContainer>[0],
  grants: readonly Grant[] = [],
): FlowboardState {
  return aState({
    activeWorkspaceId: WORKSPACE,
    containers: [
      workspace,
      aContainer({ workspaceId: WORKSPACE, ...container }),
    ],
    users: [alice, bob, carol],
    memberships: [
      { workspaceId: WORKSPACE, userId: alice.id, role: "admin" },
      { workspaceId: WORKSPACE, userId: bob.id, role: "member" },
      { workspaceId: WORKSPACE, userId: carol.id, role: "member" },
    ],
    grants,
  });
}

function grant(
  resourceId: string,
  subjectId: string,
  mode: Grant["mode"],
): Grant {
  return {
    workspaceId: WORKSPACE,
    resourceId,
    subjectId,
    subjectType: "user",
    mode,
  };
}

describe("governedMemberIds", () => {
  it("excludes roles that bypass checks", () => {
    const state = stateWith({ id: "sp-1", parentId: WORKSPACE });

    expect(governedMemberIds(state, WORKSPACE)).toEqual([bob.id, carol.id]);
  });

  /*
   * Read from the capability table rather than compared against "admin", so a
   * synthetic role proves the exclusion is policy-driven (Requirement 21.7).
   */
  it("follows the injected capability table rather than the role name", () => {
    const state = stateWith({ id: "sp-1", parentId: WORKSPACE });
    const table: Partial<Record<string, ReadonlySet<Capability>>> = {
      admin: new Set<Capability>([]),
      member: new Set<Capability>(["workspace:bypass"]),
    };

    expect(governedMemberIds(state, WORKSPACE, table)).toEqual([alice.id]);
  });
});

describe("accessForContainer", () => {
  it("reads a private container as the members holding an allow", () => {
    const state = stateWith(
      { id: "sp-1", parentId: WORKSPACE, visibility: "private" },
      [grant("sp-1", carol.id, "allow")],
    );

    expect(accessForContainer(state, WORKSPACE, "sp-1")).toEqual({
      visibility: "private",
      memberIds: [carol.id],
    });
  });

  it("reads a public container as everyone not denied", () => {
    const state = stateWith(
      { id: "sp-1", parentId: WORKSPACE, visibility: "public" },
      [grant("sp-1", bob.id, "deny")],
    );

    expect(accessForContainer(state, WORKSPACE, "sp-1")).toEqual({
      visibility: "public",
      memberIds: [carol.id],
    });
  });

  it("ignores grants belonging to another resource", () => {
    const state = stateWith(
      { id: "sp-1", parentId: WORKSPACE, visibility: "private" },
      [grant("sp-other", bob.id, "allow"), grant("sp-1", carol.id, "allow")],
    );

    expect(accessForContainer(state, WORKSPACE, "sp-1").memberIds).toEqual([
      carol.id,
    ]);
  });

  /* Fails closed, for the same reason `canView` does on a broken chain. */
  it("reads a missing container as restricted", () => {
    const state = stateWith({ id: "sp-1", parentId: WORKSPACE });

    expect(accessForContainer(state, WORKSPACE, "sp-gone")).toEqual(
      RESTRICTED_ACCESS,
    );
  });

  it("reads a container in another workspace as restricted", () => {
    const state = stateWith({
      id: "sp-1",
      parentId: WORKSPACE,
      workspaceId: "ws-elsewhere",
    });

    expect(accessForContainer(state, WORKSPACE, "sp-1")).toEqual(
      RESTRICTED_ACCESS,
    );
  });
});

describe("grantRowsForAccess", () => {
  it("writes an allow per chosen member when restricted", () => {
    const state = stateWith({ id: "sp-1", parentId: WORKSPACE });

    expect(
      grantRowsForAccess(state, WORKSPACE, "sp-1", {
        visibility: "private",
        memberIds: [carol.id],
      }),
    ).toEqual([grant("sp-1", carol.id, "allow")]);
  });

  it("writes a deny per excluded member when open", () => {
    const state = stateWith({ id: "sp-1", parentId: WORKSPACE });

    expect(
      grantRowsForAccess(state, WORKSPACE, "sp-1", {
        visibility: "public",
        memberIds: [carol.id],
      }),
    ).toEqual([grant("sp-1", bob.id, "deny")]);
  });

  it("writes nothing for the two cases that need no exception", () => {
    const state = stateWith({ id: "sp-1", parentId: WORKSPACE });

    // Open to everyone: no denials to record.
    expect(
      grantRowsForAccess(state, WORKSPACE, "sp-1", {
        visibility: "public",
        memberIds: [bob.id, carol.id],
      }),
    ).toEqual([]);

    // Restricted to nobody: no allowances to record.
    expect(
      grantRowsForAccess(state, WORKSPACE, "sp-1", RESTRICTED_ACCESS),
    ).toEqual([]);
  });

  it("never writes a row for a role that bypasses checks", () => {
    const state = stateWith({ id: "sp-1", parentId: WORKSPACE });

    const rows = grantRowsForAccess(state, WORKSPACE, "sp-1", {
      visibility: "private",
      memberIds: [alice.id, bob.id],
    });

    expect(rows.map((row) => row.subjectId)).toEqual([bob.id]);
  });
});

/*
 * The property the whole module exists for. One rule table drives the read and
 * the write, so saving an access list and reading it back must be the identity
 * — asserted directly rather than trusted to two mappings staying in step.
 */
describe("access round-trips", () => {
  const cases: readonly ContainerAccess[] = [
    RESTRICTED_ACCESS,
    OPEN_ACCESS,
    { visibility: "private", memberIds: [bob.id] },
    { visibility: "private", memberIds: [bob.id, carol.id] },
    { visibility: "public", memberIds: [carol.id] },
    { visibility: "public", memberIds: [bob.id, carol.id] },
  ];

  it.each(cases)("survives a save and a read: %j", (access) => {
    const base = stateWith({
      id: "sp-1",
      parentId: WORKSPACE,
      visibility: access.visibility,
    });

    const saved: FlowboardState = {
      ...base,
      grants: [
        ...grantsExcluding(base.grants, WORKSPACE, "sp-1"),
        ...grantRowsForAccess(base, WORKSPACE, "sp-1", access),
      ],
    };

    const read = accessForContainer(saved, WORKSPACE, "sp-1");

    expect(read.visibility).toBe(access.visibility);
    expect([...read.memberIds].sort()).toEqual(
      [...access.memberIds].filter((id) => id !== alice.id).sort(),
    );
  });
});

describe("grantsExcluding", () => {
  it("keeps other resources and other subject types", () => {
    const teamGrant: Grant = {
      ...grant("sp-1", "team-eng", "allow"),
      /*
       * `subjectType` is a one-member union today, so this cast is the only way
       * to express the row a team grant would be. The assertion is that a save
       * on `sp-1` leaves it alone — which is the behaviour that makes adding
       * team grants additive (Requirement 21.8).
       */
      subjectType: "team" as Grant["subjectType"],
    };

    const kept = grantsExcluding(
      [
        grant("sp-1", bob.id, "allow"),
        grant("sp-2", bob.id, "deny"),
        teamGrant,
      ],
      WORKSPACE,
      "sp-1",
    );

    expect(kept).toEqual([grant("sp-2", bob.id, "deny"), teamGrant]);
  });
});

describe("defaultAccessFor", () => {
  /*
   * The one-line statement of Requirement 8.15: a grantable type arrives
   * closed. Asserted against the registry's flag rather than a type literal,
   * so moving which levels are shareable stays a configuration change.
   */
  it("restricts a grantable type and opens one that cannot be granted", () => {
    expect(defaultAccessFor("list")).toEqual(RESTRICTED_ACCESS);
    expect(defaultAccessFor("space")).toEqual(RESTRICTED_ACCESS);
    expect(defaultAccessFor("folder")).toEqual(RESTRICTED_ACCESS);
    expect(defaultAccessFor("workspace")).toEqual(OPEN_ACCESS);
  });
});
