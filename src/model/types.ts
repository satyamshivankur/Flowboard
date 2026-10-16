import type { AvatarColorToken } from "@/config/avatars";
import type { Role } from "@/config/capabilities";
import type { ContainerType, Visibility } from "@/config/containers";
import type { Priority } from "@/config/priorities";
import type {
  StatusCategory,
  StatusColorToken,
} from "@/config/statusCategories";

/**
 * Domain entities.
 *
 * The vocabulary unions — `ContainerType`, `Priority`, `StatusCategory`, `Role`
 * — live in `src/config` rather than here, because they are configuration that
 * both the Model and the View read. This module describes the *shapes* that use
 * them (Requirement 21.17).
 */

/**
 * Any node in the hierarchy, including the workspace itself.
 *
 * Which parent/child pairs are legal is NOT encoded in this type — it comes
 * from `CONTAINER_REGISTRY`, so adding a level is a configuration change
 * (Requirement 21.4).
 */
export interface Container {
  readonly id: string;
  /**
   * Denormalized workspace scope. Could be derived by walking `parentId` to the
   * root, but that is O(depth) on every selector and assumes there is one root
   * worth finding. Denormalizing makes scoping an O(1) filter and makes a
   * second workspace a data change (Requirement 21.2).
   */
  readonly workspaceId: string;
  readonly name: string;
  readonly type: ContainerType;
  /** `null` only on a workspace node. */
  readonly parentId: string | null;
  /** Fractional index ordering this node among its siblings. */
  readonly position: number;
  readonly visibility: Visibility;
  /** ISO timestamp when archived, `null` when live. Soft delete. */
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A workflow stage. Owned by exactly one list, never shared. */
export interface Status {
  readonly id: string;
  readonly workspaceId: string;
  readonly listId: string;
  readonly name: string;
  readonly category: StatusCategory;
  /** Token key, never a hex literal, so cards and rows cannot diverge. */
  readonly color: StatusColorToken;
  readonly position: number;
}

export interface Task {
  readonly id: string;
  readonly workspaceId: string;
  readonly primaryListId: string;
  /**
   * Parent task, for subtasks. Depth is governed by `MAX_TASK_DEPTH` and the
   * `taskDepth` function rather than by this field being null, so raising the
   * limit needs no new logic (Requirement 21.9).
   */
  readonly parentTaskId: string | null;
  readonly title: string;
  readonly description: string | null;
  /** Must reference a status belonging to `primaryListId`. */
  readonly statusId: string;
  readonly priority: Priority;
  readonly assigneeIds: readonly string[];
  /** ISO datetime, or `null` when unscheduled. */
  readonly dueDate: string | null;
  /** Fractional index ordering this task within its status column. */
  readonly position: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * A person. Workspace-independent by design: role lives on `Membership`.
 *
 * A global `role` field is the single most common thing that blocks
 * multi-tenancy later, because it ends up read from dozens of call sites
 * (Requirement 21.3).
 */
export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly avatarToken: AvatarColorToken;
}

/** A user's role within one workspace. */
export interface Membership {
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: Role;
}

/** What a grant is attached to. Widening this is the team-grant seam. */
export type GrantSubjectType = "user";

/**
 * A permission grant on a container.
 *
 * `subjectId` rather than `userId` so that adding team grants is a union
 * widening rather than a rename across the resolver, seed and tests. The
 * exhaustive-switch rule then makes the compiler point at every site that must
 * handle the new subject type (Requirement 21.8, 21.15).
 */
export interface Grant {
  readonly workspaceId: string;
  /** A container id. */
  readonly resourceId: string;
  readonly subjectId: string;
  readonly subjectType: GrantSubjectType;
  readonly mode: "allow" | "deny";
}

/**
 * Who is asking, and in which workspace.
 *
 * Threaded explicitly through every selector and guard. Mild ceremony with one
 * workspace; the thing that makes a second one a seed change rather than a
 * cross-cutting refactor (Requirement 21.1, 21.2).
 */
export interface Scope {
  readonly workspaceId: string;
  readonly userId: string;
}

/** Sort direction for list-view columns. */
export type SortDirection = "asc" | "desc";

/** Which column the list view is sorted by. */
export type SortField = "dueDate" | "priority" | "title" | "status";

export interface SortState {
  readonly field: SortField;
  readonly direction: SortDirection;
}
