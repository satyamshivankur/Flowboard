# Flowboard — extension points

Every closed set in this app is a declaration in `src/config`, and the logic that consumes one reads the declaration rather than restating it. That is what makes the claims below changes to *data* rather than refactors.

Each section names the seam, the files involved, and the concrete steps. Two worked examples at the end trace what a second workspace and a new view type would actually touch.

> The general rule, and the reason the rest of this document is short: **if you find yourself adding a `switch` over a domain union outside `src/config`, the extension point already exists and you have missed it.** Lint will not catch that; this document is the place to look first.

---

## 1. Container hierarchy — `CONTAINER_REGISTRY`

**File:** `src/config/containers.ts`

The naive version of this app hard-codes `workspace → space → folder → list` into validation, the sidebar renderer, the create menu and the move handler — four places that must each be found and edited. Here it is one record:

```ts
export const CONTAINER_REGISTRY: ContainerRegistry = {
  folder: {
    type: "folder",
    label: "Folder",
    labelPlural: "Folders",
    icon: Folder,
    childTypes: ["list"],   // what may be created directly inside
    holdsTasks: false,      // tasks rather than containers
    grantable: true,        // may carry a permission grant
    mutable: true,          // may be created, renamed, archived
  },
  // …
};
```

Everything downstream reads it through a helper rather than touching the record: `canContain(parent, child)`, `holdsTasks(type)`, `isGrantableType(type)`, `isMutableType(type)`, `rootContainerType()`, `taskHoldingType()`.

### To add a level — say `subfolder`, between folder and list

1. Add a `subfolder` entry to `CONTAINER_REGISTRY` with `childTypes: ["list"]`.
2. Change `folder`'s `childTypes` to `["subfolder"]`.
3. Add `"subfolder"` to the `ContainerType` union in the same file.

That is the whole change. Specifically **not** touched:

| Consumer                                 | Why it needs no edit                                      |
| ---------------------------------------- | --------------------------------------------------------- |
| `src/model/validation.ts`                | Calls `canContain`, never compares type literals          |
| `src/views/sidebar/TreeItem.tsx`         | Maps `childTypes` for its create menu; icon and label come from the registry |
| `src/views/sidebar/SidebarTree.tsx`      | Asks `canContain` whether a drop target is legal          |
| `src/controllers/slices/containerSlice.ts` | Gates statuses on `holdsTasks` and access on `isGrantableType` |
| `src/model/hierarchy.ts`                 | Walks `parentId`; depth is computed, not enumerated       |

**This is tested rather than asserted.** `src/model/registry.test.ts` injects a *synthetic* container type into a test registry and drives validation, reorder and move through it. If any of that logic secretly hard-codes `space`/`folder`/`list`, that test fails — which makes it the most valuable test in the extensibility set, because it is the one that catches a conditional someone added in a hurry.

The helpers all take an optional registry argument for exactly that reason; they are not welded to the production record.

---

## 2. Views — `VIEW_REGISTRY`

**Files:** `src/config/views.ts` (description) and `src/views/viewComponents.ts` (component)

```ts
// src/config/views.ts — metadata only
export const VIEW_REGISTRY: Record<ViewId, ViewMeta> = {
  board: { id: "board", label: "Board", icon: Columns3 },
  list: { id: "list", label: "List", icon: Rows3 },
};

// src/views/viewComponents.ts — keyed by the same ViewId
export const VIEW_COMPONENTS: Record<ViewId, ComponentType<ViewProps>> = {
  board: KanbanBoard,
  list: TaskListView,
};
```

The split is deliberate. Holding the component in `src/config` would make a config module import the View layer — which the boundary lint rejects, and which would invert the dependency direction. Keeping the description in config and the mapping in the View layer preserves both the single enumeration and the layering.

### To add a view

1. Add the id to the `ViewId` union and an entry to `VIEW_REGISTRY`.
2. Add the component to `VIEW_COMPONENTS`, implementing `ViewProps` (`{ listId }`).

`ViewSwitcher` maps over the registry, `NavigationContext` stores a `ViewId`, and the content region looks up `VIEW_COMPONENTS[view]`. No switch statement anywhere gains a case. Because both are `Record<ViewId, …>`, adding to the union without adding to either record is a compile error.

See the worked example at the end for what a calendar view touches in practice.

---

## 3. Enumerations — priorities and status categories

**Files:** `src/config/priorities.ts`, `src/config/statusCategories.ts`

Each value carries everything any surface needs, including its complete Tailwind class strings:

```ts
export const PRIORITY_CONFIG: Record<Priority, PriorityConfig> = {
  urgent: {
    label: "Urgent",
    token: "priority-urgent",
    icon: ChevronsUp,
    rank: 0,                              // what comparators sort on
    classes: { text: "…", soft: "…", dot: "…" },
  },
  // …
};
```

`rank` is why the list view's priority sort needs no bespoke comparator and why adding a priority cannot produce an inconsistent order. `classes` is why a priority renders identically on a card, a row and in the drawer.

### To add or reorder a priority

1. Add the key to the `Priority` union and the entry to `PRIORITY_CONFIG`.
2. Add a `--color-priority-*` token to `src/index.css` if the entry needs a new colour.

Nothing else. No sort comparator, badge component or filter enumerates the set — they all read `PRIORITIES` (derived) or index the record.

### Status categories carry one extra field

```ts
export const DEFAULT_STATUS_TEMPLATE: readonly DefaultStatusTemplate[] =
  STATUS_CATEGORIES.map((category) => ({
    category,
    name: STATUS_CATEGORY_CONFIG[category].defaultStatusName,
    color: STATUS_CATEGORY_CONFIG[category].defaultToken,
  }));
```

`defaultStatusName` is a second field rather than a reuse of `label`, because the label names the *category* in UI that groups by it ("Not started") while this names the *status* a list actually receives ("To do"). Collapsing them would put "Not started" on a kanban column header.

Because the template is **derived** from the category table, adding a fourth category gives every newly created list a column for it with no second edit — and both the seed fixtures and `containerSlice.create` read this one declaration, so "the default set" has exactly one definition.

### To add a status category

1. Add the key to the `StatusCategory` union and the entry to `STATUS_CATEGORY_CONFIG` (label, `defaultStatusName`, `defaultToken`, `order`, `isTerminal`).
2. Add the `--color-status-*` token and a `STATUS_TOKEN_CLASSES` entry.
3. Re-read `MIN_STATUSES_PER_LIST` in `src/config/limits.ts` — `config.test.ts` asserts the template's length against it, so a new category fails the build until the minimum is reconsidered deliberately. That failure is the point.

Exactly one category may be `isTerminal`; `TERMINAL_STATUS_CATEGORY` is derived and throws at module load otherwise. That is what the complete checkbox and cross-list status remapping both resolve through.

---

## 4. Role capabilities — `ROLE_CAPABILITIES`

**File:** `src/config/capabilities.ts`

The whole authorization policy, as data:

```ts
export const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  admin: new Set<Capability>(["workspace:bypass"]),  // bypass implies everything
  member: new Set<Capability>([
    "task:create", "task:update", "task:delete", "task:reorder",
  ]),
};
```

`can()` in `src/model/permissions.ts` reads this table and contains **no role-specific branches**. The admin bypass is itself a capability lookup rather than `role === "admin"`, so what admins may bypass is configurable too.

### To add a role

One entry. `guest` is `new Set([])`; `owner` is `new Set(["workspace:bypass", "workspace:delete"])`. Then add it to the `Role` union and to `ROLE_CONFIG` (label and description, used by the user switcher). Seed a `Membership` with it.

No control flow changes, because there is none to add to. `src/model/capabilities.test.ts` proves this by driving `can()` through a **synthetic third role** injected into a test table — and asserts outcomes *from* the table rather than restating "members can't archive", so adding a role does not require editing assertions.

### To add a capability

Four edits in this file: the `Capability` union, `ALL_CAPABILITIES`, `CAPABILITY_LABELS` (the human phrase used in `FORBIDDEN` messages), and an entry in `ROLE_CAPABILITIES` for any role that should hold it. That is the documented cost of the table.

`container:share` was the first capability added after the initial set, and it is the test of this claim: deciding who can see a container is a different power from renaming it, so folding it into `container:update` would have made "a lead who may rename lists but not re-share them" impossible to express without new branching.

---

## 5. Grant resolution — one seam

**File:** `src/model/permissions.ts`

```ts
export function subjectsOf(state, userId): string[] {
  return [userId];                      // today: the user is the only subject
}

export function resolveGrant(state, resourceId, userId): Grant | undefined {
  const subjects = subjectsOf(state, userId);
  const matches = state.grants.filter(
    (g) => g.resourceId === resourceId && subjects.includes(g.subjectId),
  );
  // deny wins ties at the same node — which stays correct once a user can
  // match several subjects through team membership
  return matches.find((g) => g.mode === "deny") ?? matches[0];
}
```

`Grant` carries `subjectId` + `subjectType: "user"` rather than a `userId` field, specifically so that teams are a union widening rather than a rename across the resolver, the seed and every test.

### To add team grants

1. Add `Team` and `TeamMembership` entities.
2. Widen `Grant.subjectType` to `"user" | "team"`.
3. Widen `subjectsOf` to return `[userId, ...teamIdsOf(state, userId)]`.

No call site changes. `resolveGrant` already prefers `deny` among multiple matches, which is exactly the tie-break teams need when a user matches through two subjects at once.

Two things in `src/model/access.ts` are already waiting for this, and both matter:

- A save replaces only the **user-subject** rows for the one resource being edited (`grantsExcluding`). So team rows survive an access save instead of being deleted by it.
- `isUserSubject` is a `Record<GrantSubjectType, boolean>` lookup, not `subjectType === "user"`. A comparison does the same job today and silently keeps team rows the moment the union widens; the lookup makes that widening a **missing key and a compile error**. It also reads an out-of-union value as `undefined` → preserved, which matters because the persisted payload is validated for shape, not for subject values.

An exhaustive-`switch` form was tried here first and was wrong: `return exhaustive` returns the `never` binding's *runtime* value, so a subject type outside the union came back as the truthy string `"team"` and the row was dropped. One test constructs such a row deliberately, which is how that was caught.

---

## 6. Subtask depth — a constant and a function

**Files:** `src/config/limits.ts`, `src/model/hierarchy.ts`

```ts
export const MAX_TASK_DEPTH = 1;   // 0 = none, 1 = one level, n = n levels

export function taskDepth(state, taskId): number { /* walks parentTaskId */ }
```

Validation asks `taskDepth(parent) + 1 <= MAX_TASK_DEPTH`, never `parent.parentTaskId === null`. Identical behaviour today, and raising the limit is a one-line change instead of rewriting a check that only ever understood two levels.

### To allow deeper nesting

Change the constant. Then check the three places that *render* nesting, because each caps itself on the same constant rather than assuming one level:

- `buildTaskCard` in `src/controllers/hooks/useBoard.ts` recurses with an explicit depth guard. It terminates on its own today because the Model caps nesting — a subtask has no children one level down — and the guard is kept anyway so that raising the cap deepens the tree *deliberately* rather than handing it an unbounded one and blowing the stack on a malformed parent chain.
- `src/views/list/TaskTable.tsx` indents by `depth` and recurses.
- `src/views/drawer/SubtaskList.tsx` is deliberately flat, and would need recursion.

Also worth knowing: the three structural refusals on a subtask (move-to-list, reorder, duplicate) are consequences of the depth-1 invariant, not of the constant. Raising the cap means revisiting them.

---

## 7. Persistence — `PersistenceAdapter`

**Files:** `src/adapters/persistence/types.ts`, `localStorage.ts`, `memory.ts`

```ts
export interface PersistenceAdapter {
  load(): Promise<PersistedPayload | null>;
  save(payload: PersistedPayload): Promise<void>;
  clear(): Promise<void>;
}
```

The adapter only moves strings. `src/model/persistence.ts` owns serialization, shape validation and the version guard — so a new adapter inherits all of that rather than reimplementing it.

The signatures are async even though `localStorage` is not. An interface returning `T` cannot later return `Promise<T>` without changing every caller.

### To swap in IndexedDB or a server

1. Write a module satisfying `PersistenceAdapter`.
2. Pass it at store construction: `createFlowboardStore({ persistence: myAdapter })`.

That is the whole change — a **new file**, not a diff through the Controller. The adapter is injected, never imported inside a slice, which is also what lets `src/controllers/persistence.test.ts` build a store on `memoryAdapter` and prove there is no coupling to `localStorage`.

---

## 8. Transport — `Transport`

**Files:** `src/adapters/transport/types.ts`, `simulated.ts`

```ts
export interface Transport {
  run<T>(operation: () => T): Promise<Result<T>>;
}
```

Controller actions call `transport.run(...)` and contain no transport-specific logic — no latency figures, no failure rates, no retry policy.

### To replace the simulation with real HTTP

1. Write a module satisfying `Transport` that performs the request and maps failures onto `Result` with a `NETWORK` code.
2. Pass it at store construction: `createFlowboardStore({ transport: httpTransport })`.

The mutation pipeline is unchanged, which includes the optimistic apply and rollback: `moveTask` snapshots, applies, awaits `transport.run`, and restores on failure, without caring what produced the failure.

Tests set `minLatencyMs = maxLatencyMs = 0` through the same seam, which is what keeps the suite fast and deterministic.

---

## Worked example — adding a second workspace

The model, the scoping and the tests already support this; what is missing is data and chrome. Nothing below is a signature change.

**Already done, which is the point:**

- Every entity carries `workspaceId`. Scope is an O(1) filter, not a walk to a root.
- Every collection selector takes `{ workspaceId, userId }` explicitly. None reads `activeWorkspaceId` internally.
- `useScope()` in `src/controllers/hooks/useScope.ts` is the **only** place `activeWorkspaceId` is read. Every other hook composes it.
- `canView` already rejects a node whose chain crosses workspaces — and checks *every* node in the chain, not just the root, because `workspaceId` is denormalized and checking only the root would let a corrupt node inherit into the wrong workspace.
- Role comes from `Membership`, so one user can be admin in one workspace and member in another with no change at all.
- `src/model/workspaceScope.test.ts` already drives a **two-workspace fixture** and asserts that no `ws-acme` selector returns a `ws-other` entity.

**What you would actually touch:**

| Step | File                                    | Change                                                              |
| ---- | --------------------------------------- | ------------------------------------------------------------------- |
| 1    | `src/model/seed.ts`                     | A second workspace container, its spaces/lists, and `Membership` rows. Add its id to `workspaceIds`. |
| 2    | `src/views/topbar/`                     | A workspace switcher, calling `actions.session.setActiveWorkspace`  |
| 3    | —                                       | Nothing. The action and its guards already exist.                   |

`setActiveWorkspace` already refuses a workspace the current user holds no membership in — covered in `src/controllers/slices/sessionSlice.test.ts`, which is the guard that makes the switcher safe to build.

The one thing to decide rather than copy: what happens to `selectedListId` when the active workspace changes. The list belongs to the old workspace, so `AppShell`'s "open the first visible list" effect needs to re-run — the permission-denied state already handles the interim correctly, so this is a nicety rather than a correctness problem.

---

## Worked example — adding a calendar view

**Files touched: two.**

| Step | File                              | Change                                                                 |
| ---- | --------------------------------- | ---------------------------------------------------------------------- |
| 1    | `src/config/views.ts`             | `"calendar"` in the `ViewId` union; `{ id, label: "Calendar", icon: CalendarDays }` in `VIEW_REGISTRY` |
| 2    | `src/views/viewComponents.ts`     | `calendar: CalendarView` in `VIEW_COMPONENTS`                          |
| 3    | `src/views/calendar/CalendarView.tsx` | The component, implementing `ViewProps` (`{ listId }`)             |

**Not touched:** `ViewSwitcher` (maps the registry), `NavigationContext` (stores a `ViewId`), `AppShell` (looks up `VIEW_COMPONENTS[view]`), `lib/uiStorage` (persists whatever id it is given).

Because both registries are `Record<ViewId, …>`, adding to the union without adding to either one is a compile error rather than a runtime `undefined`.

For the view itself, the Controller side probably needs nothing new either: `selectTasksForList` already returns permission-filtered tasks with `dueDate`, and `useTaskTable` already exposes sorted, paginated rows. A calendar wants grouping by day rather than by status, which is a selector of its own — but it would sit beside `selectBoardColumns` and `selectTaskRows` and take the same `(state, scope, listId)` shape, not a new one.

If the view should only appear above a certain width, `ViewMeta` already carries an optional `minViewportRem` for that purpose.

---

## Where the seams are *not*

Honesty is more useful here than a complete-sounding list. These are real limits, not extension points:

- **`localStorage` is not a security boundary.** Permissions here are a UI and domain model. Everything runs client-side and is editable by anyone with devtools. A real deployment needs this same engine enforcing server-side — which it can, because the Model has no React, Zustand, browser or storage dependency, and that is the substantive reason for the constraint rather than tidiness.
- **Access editing is per container.** There is no "apply to everything inside" and no audit view of who can see what across the tree. Inheritance already falls out of the ancestor walk, so neither needs a model change — but both are a feature, not a configuration change.
- **`Grant` scopes a container, never a task.** `canViewTask` resolves through `primaryListId`. Task-level grants would be a genuine model change, not a widening.
- **One status set per list, with no editor.** The slice actions and the per-category minimum exist; the UI does not.
