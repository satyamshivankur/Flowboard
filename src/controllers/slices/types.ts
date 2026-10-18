import type { PersistenceAdapter } from "@/adapters/persistence/types";
import type { Transport } from "@/adapters/transport/types";
import type { Priority } from "@/config/priorities";
import type { ContainerAccess } from "@/model/access";
import type { Result } from "@/model/result";
import type { FlowboardState, MutableFlowboardState } from "@/model/state";
import type { Container, Scope, Status, Task, User } from "@/model/types";

/** Adapters injected at store construction, never imported inside a slice. */
export interface StoreDeps {
  readonly persistence: PersistenceAdapter;
  readonly transport: Transport;
}

/* -------------------------------------------------------------------------- */
/* Session                                                                    */
/* -------------------------------------------------------------------------- */

export interface SessionState {
  /** Who the app is acting as. The user switcher writes this. */
  readonly currentUserId: string;
  /** True during the initial load, so the shell can render skeletons. */
  readonly isHydrating: boolean;
  /** The list whose data is currently resolving, for the content skeleton. */
  readonly loadingListId: string | null;
}

export interface SessionActions {
  readonly switchUser: (userId: string) => Result<User>;
  readonly setActiveWorkspace: (workspaceId: string) => Result<string>;
  readonly hydrate: () => Promise<void>;
  readonly resetToSeed: () => Promise<void>;
  readonly beginListLoad: (listId: string) => Promise<void>;
}

/* -------------------------------------------------------------------------- */
/* Containers                                                                 */
/* -------------------------------------------------------------------------- */

export interface CreateContainerInput {
  readonly parentId: string;
  readonly type: Container["type"];
  readonly name: string;
  /**
   * Who may see it, decided by the creator.
   *
   * Omitting it does **not** mean "everyone" — it falls back to
   * `defaultAccessFor(type)`, which is restricted for any grantable type. The
   * create form always sends an explicit value; the fallback exists so a
   * programmatic caller that forgets cannot accidentally publish a container
   * to the whole workspace (Requirement 8.15).
   */
  readonly access?: ContainerAccess;
}

export interface ContainerActions {
  readonly create: (
    scope: Scope,
    input: CreateContainerInput,
  ) => Promise<Result<Container>>;
  readonly rename: (
    scope: Scope,
    containerId: string,
    name: string,
  ) => Promise<Result<Container>>;
  /**
   * Replaces a container's access list — visibility and the per-member grants
   * — in one mutation, so the two cannot land apart (Requirement 8.16).
   */
  readonly setAccess: (
    scope: Scope,
    containerId: string,
    access: ContainerAccess,
  ) => Promise<Result<Container>>;
  readonly archive: (
    scope: Scope,
    containerId: string,
  ) => Promise<Result<{ readonly archivedIds: readonly string[] }>>;
  readonly unarchive: (
    scope: Scope,
    containerId: string,
  ) => Promise<Result<{ readonly restoredIds: readonly string[] }>>;
  readonly reorder: (
    scope: Scope,
    containerId: string,
    toIndex: number,
  ) => Promise<Result<Container>>;
  readonly move: (
    scope: Scope,
    containerId: string,
    newParentId: string,
    toIndex: number,
  ) => Promise<Result<Container>>;
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

export interface CreateTaskInput {
  readonly listId: string;
  readonly title: string;
  readonly statusId?: string;
  readonly description?: string | null;
  readonly priority?: Priority;
  readonly assigneeIds?: readonly string[];
  readonly dueDate?: string | null;
  readonly parentTaskId?: string | null;
}

export interface UpdateTaskInput {
  readonly title?: string;
  readonly description?: string | null;
  readonly statusId?: string;
  readonly priority?: Priority;
  readonly assigneeIds?: readonly string[];
  readonly dueDate?: string | null;
}

export interface MoveTaskInput {
  readonly taskId: string;
  /** The status the task lands in. May belong to a different list. */
  readonly toStatusId: string;
  /** Index within the destination column, from the drop handler. */
  readonly toIndex: number;
}

export interface MoveTaskResult {
  readonly task: Task;
  /** True when the destination list had no matching status category. */
  readonly statusRemapped: boolean;
}

export interface TaskActions {
  readonly create: (
    scope: Scope,
    input: CreateTaskInput,
  ) => Promise<Result<Task>>;
  readonly update: (
    scope: Scope,
    taskId: string,
    input: UpdateTaskInput,
  ) => Promise<Result<Task>>;
  readonly remove: (
    scope: Scope,
    taskId: string,
  ) => Promise<Result<{ readonly deletedIds: readonly string[] }>>;
  /** Optimistic. Handles both intra-column reorder and cross-column moves. */
  readonly move: (
    scope: Scope,
    input: MoveTaskInput,
  ) => Promise<Result<MoveTaskResult>>;
  readonly moveToList: (
    scope: Scope,
    taskId: string,
    toListId: string,
  ) => Promise<Result<MoveTaskResult>>;
  readonly toggleComplete: (
    scope: Scope,
    taskId: string,
  ) => Promise<Result<Task>>;
  readonly duplicate: (scope: Scope, taskId: string) => Promise<Result<Task>>;
}

/* -------------------------------------------------------------------------- */
/* Statuses                                                                   */
/* -------------------------------------------------------------------------- */

export interface StatusActions {
  readonly rename: (
    scope: Scope,
    statusId: string,
    name: string,
  ) => Promise<Result<Status>>;
  readonly reorder: (
    scope: Scope,
    statusId: string,
    toIndex: number,
  ) => Promise<Result<Status>>;
}

/* -------------------------------------------------------------------------- */
/* Composed store                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Action groups are nested under a single `actions` key rather than spread onto
 * the root.
 *
 * The design doc originally put them at the root as `containers`, `tasks` and
 * `statuses` — which collides head-on with the entity maps of the same name in
 * `FlowboardState`. Nesting keeps both, and keeps `useStore(s => s.tasks)`
 * meaning the data rather than the verbs.
 */
export interface StoreActions {
  readonly session: SessionActions;
  readonly container: ContainerActions;
  readonly task: TaskActions;
  readonly status: StatusActions;
}

export type StoreState = FlowboardState &
  SessionState & { readonly actions: StoreActions };

/** The shape a mutation recipe may write to: domain data and session flags. */
export type StoreDraft = MutableFlowboardState & {
  currentUserId: string;
  isHydrating: boolean;
  loadingListId: string | null;
};

/** What a slice factory receives. */
export interface SliceContext {
  readonly deps: StoreDeps;
  readonly getState: () => StoreState;
  readonly setState: (recipe: (draft: StoreDraft) => void) => void;
}
