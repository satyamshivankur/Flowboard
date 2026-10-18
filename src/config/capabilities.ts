/**
 * Authorization policy, expressed entirely as data.
 *
 * `can()` in the Model reads this table and contains no role-specific
 * branches. Adding a `guest` that may view but not edit, or a `lead` that may
 * create lists but not archive spaces, is one entry here and zero changes to
 * control flow (Requirement 21.7).
 */

export type Role = "admin" | "member";

export type Capability =
  | "task:create"
  | "task:update"
  | "task:delete"
  | "task:reorder"
  | "container:create"
  | "container:update"
  | "container:archive"
  | "container:reorder"
  /**
   * Decides who may see a container — the access list chosen at creation and
   * edited afterwards (Requirement 8.15, 8.16).
   *
   * Deliberately its own capability rather than folded into
   * `container:update`. Renaming a list and deciding who can see it are
   * different powers, and a role that may do the first but not the second is
   * one table entry away only if they are separable here.
   */
  | "container:share"
  | "status:update"
  /**
   * Bypasses every visibility and edit check. Expressed as a capability rather
   * than a `role === 'admin'` comparison so that what admins may bypass is
   * itself configurable (Requirement 8.6).
   */
  | "workspace:bypass";

export interface RoleConfig {
  readonly role: Role;
  readonly label: string;
  readonly description: string;
}

export const ROLE_CONFIG: Record<Role, RoleConfig> = {
  admin: {
    role: "admin",
    label: "Admin",
    description: "Sees and edits everything in the workspace",
  },
  member: {
    role: "member",
    label: "Member",
    description: "Edits tasks in lists they have access to",
  },
};

export const ROLES = Object.keys(ROLE_CONFIG) as Role[];

/**
 * The whole policy. `workspace:bypass` implies every other capability, which is
 * resolved in `roleCapabilities` rather than duplicated here.
 */
export const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  admin: new Set<Capability>(["workspace:bypass"]),
  member: new Set<Capability>([
    "task:create",
    "task:update",
    "task:delete",
    "task:reorder",
  ]),
};

export const ALL_CAPABILITIES: readonly Capability[] = [
  "task:create",
  "task:update",
  "task:delete",
  "task:reorder",
  "container:create",
  "container:update",
  "container:archive",
  "container:reorder",
  "container:share",
  "status:update",
  "workspace:bypass",
];

/** Human-readable capability names, used in FORBIDDEN error messages. */
export const CAPABILITY_LABELS: Record<Capability, string> = {
  "task:create": "create tasks",
  "task:update": "edit tasks",
  "task:delete": "delete tasks",
  "task:reorder": "reorder tasks",
  "container:create": "create spaces, folders and lists",
  "container:update": "rename spaces, folders and lists",
  "container:archive": "archive spaces, folders and lists",
  "container:reorder": "reorder spaces, folders and lists",
  "container:share": "change who can access spaces, folders and lists",
  "status:update": "change status configuration",
  "workspace:bypass": "administer the workspace",
};

/**
 * True when the role holds the capability, honouring the bypass implication.
 * The single question every authorization check asks.
 */
export function roleHasCapability(
  role: Role,
  capability: Capability,
  table: Partial<Record<string, ReadonlySet<Capability>>> = ROLE_CAPABILITIES,
): boolean {
  const granted = table[role];

  if (!granted) return false;
  if (granted.has("workspace:bypass")) return true;

  return granted.has(capability);
}

/** True when the role bypasses visibility checks entirely. */
export function roleBypassesChecks(
  role: Role,
  table: Partial<Record<string, ReadonlySet<Capability>>> = ROLE_CAPABILITIES,
): boolean {
  return table[role]?.has("workspace:bypass") ?? false;
}
