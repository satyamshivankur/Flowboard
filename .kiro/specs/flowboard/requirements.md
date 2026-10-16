# Flowboard — Requirements

## Introduction

Flowboard is a frontend-only mini project-management app for a single team ("workspace"), in the spirit of ClickUp / Asana / Linear at hobby scale. It lets a user organize work in a `workspace → space → folder → list → task` hierarchy, manage tasks inside lists, view those tasks on a kanban board and in a list view, and control who sees what through a simple container-level permission model with an in-app user switcher.

There is no backend. A typed client data layer seeded from fixtures stands in for the API and database, including simulated network latency and injectable failures so that loading, error, and rollback paths are real rather than theoretical.

**Stack (fixed):** React 19 + TypeScript, Vite, Zustand (state), dnd-kit (drag and drop), Headless UI (accessible primitives), Tailwind CSS v4 (styling, exclusive), Lucide (icons), Vitest + Testing Library (tests), Storybook (design system).

**Architecture (fixed):** MVC — a React-free Model layer, a Controller layer owning all mutations and permission enforcement, and a View layer of presentational components driven by props and React Context.

**Design approach (fixed):** Mobile-first. Every surface is designed and built at the smallest supported viewport first, then progressively enhanced upward with Tailwind's min-width breakpoints. Desktop is the richest expression of the layout, not its baseline.

**Sizing (fixed):** `rem` is the project's dimension unit. See Requirement 22 for the full rule and its narrow exception list.

**Forward-compatibility (fixed):** The delivered scope is one workspace, but the code must be structured so that additional workspaces, container levels, views, roles, priorities, statuses and persistence backends can be added without redesign. See Requirement 21.

### Out of scope

Pixel-perfect design clone, dark mode, marketing landing page, real authentication, server persistence, billing, email, file uploads.

Multiple workspaces, team-based grants, role hierarchies and additional view types are out of scope **to implement**, but Requirement 21 requires the code be shaped so each can be added as a configuration or adapter change rather than a refactor. "Out of scope" here means "not built", never "not accounted for".

---

## Requirement 1 — Container hierarchy

**User story:** As a team member, I want my work organized in a navigable tree of spaces, folders and lists, so I can find and group related tasks.

### Acceptance criteria

1.1. The system SHALL model a single workspace containing a tree of containers where every node has `id`, `name`, `type`, `parentId`, `position`, `visibility`, `archivedAt`, `createdAt`, `updatedAt`.

1.2. The system SHALL restrict parent-child relationships to exactly `workspace → space → folder → list`. A `list` SHALL NOT contain containers, only tasks.

1.3. WHEN a caller attempts to create or move a container under an invalid parent type, THEN the Controller SHALL reject the operation with error code `VALIDATION` and SHALL NOT mutate the Model.

1.4. The system SHALL support create, read, rename/update and archive operations for `space`, `folder` and `list` container types.

1.5. The system SHALL implement deletion as **soft-delete (archive)** by setting `archivedAt` to an ISO timestamp. Archiving a container SHALL cascade to its descendant containers and to the tasks of any archived list.

1.6. Archived containers SHALL be excluded from the sidebar tree and from all default selectors, and SHALL remain in the Model so the choice is reversible via an `unarchive` operation.

1.7. The system SHALL allow reordering of sibling containers by drag and drop, persisting the new `position`.

1.8. The system SHALL allow moving a container to a different valid parent by drag and drop, updating `parentId` and `position` in a single operation.

1.9. WHEN a container is moved, THEN the system SHALL reject any move that would make a node its own ancestor, with error code `VALIDATION`.

1.10. Container names SHALL be required, trimmed, and limited to 120 characters.

---

## Requirement 2 — Tasks

**User story:** As a team member, I want to create and maintain tasks inside a list, so I can track work items with the detail I need.

### Acceptance criteria

2.1. Each task SHALL belong to exactly one primary list, referenced by `primaryListId`.

2.2. Each task SHALL carry the following fields with the stated constraints:

| Field                     | Required | Constraint                                                           |
| ------------------------- | -------- | -------------------------------------------------------------------- |
| `id`                      | Yes      | Stable unique string                                                 |
| `title`                   | Yes      | Non-empty after trim, max 500 characters                             |
| `description`             | No       | Plain text / markdown source string                                  |
| `status`                  | Yes      | Must be a `statusId` belonging to the task's list                    |
| `priority`                | No       | One of `urgent`, `high`, `normal`, `low`, `none`; defaults to `none` |
| `assigneeIds`             | No       | Array of workspace user IDs, no duplicates                           |
| `dueDate`                 | No       | ISO datetime string or `null`                                        |
| `position`                | Yes      | Fractional order within its status column                            |
| `parentTaskId`            | No       | Task ID in the same list, max nesting depth 1                        |
| `createdAt` / `updatedAt` | Yes      | ISO datetime strings                                                 |

2.3. The system SHALL support create, read, update and delete for tasks. Task delete SHALL be a hard delete, distinct from container archiving, and SHALL be documented as such.

2.4. WHEN a task's `title` is empty after trimming or exceeds 500 characters, THEN the Controller SHALL reject the mutation with error code `VALIDATION` and a field-specific message, and the View SHALL surface that message inline on the field.

2.5. WHEN a task is assigned a `status` that does not exist in its list's status set, THEN the Controller SHALL reject the mutation with error code `VALIDATION`.

2.6. The system SHALL support moving a task between lists, updating `primaryListId`. WHEN the destination list has no status with the same `category` as the task's current status, THEN the task SHALL be remapped to the destination list's first status by position, and the View SHALL inform the user that the status was remapped.

2.7. WHEN a task is moved to another list, THEN its subtasks SHALL move with it so that the depth-1 invariant and same-list constraint are preserved.

2.8. The system SHALL support changing a task's status, which SHALL move the task to the corresponding kanban column.

2.9. The system SHALL support reordering tasks within a status column, persisting the new `position`.

2.10. Every successful task mutation SHALL set `updatedAt` to the current ISO timestamp.

2.11. The system SHALL support one level of subtasks via `parentTaskId`. A subtask SHALL NOT itself have subtasks, and the Controller SHALL reject attempts to nest deeper with error code `VALIDATION`.

2.12. WHEN a parent task is deleted, THEN its subtasks SHALL also be deleted, and the confirmation prompt SHALL state how many subtasks will be removed.

---

## Requirement 3 — Per-list status configuration

**User story:** As a team member, I want each list to define its own workflow stages, so different lists can model different processes.

### Acceptance criteria

3.1. Each list SHALL own its own ordered status set. Statuses SHALL NOT be shared across lists.

3.2. Each status SHALL have `id`, `listId`, `name`, `category`, `color`, `position`, where `category` is one of `todo`, `active`, `done`.

3.3. Every list SHALL have at minimum a status in each of the `todo`, `active` and `done` categories, seeded as "To do", "In progress" and "Done".

3.4. At least one seeded list SHALL define an additional status (for example "In review") so that per-list status sets are visibly distinct and demonstrable.

3.5. Selectors returning a task's status SHALL resolve it only from the status set of that task's list.

3.6. Status `color` SHALL be expressed as a design-token key, not a raw hex value, so status colors stay identical between kanban cards and list rows.

---

## Requirement 4 — Kanban board view

**User story:** As a team member, I want to see a selected list as a kanban board, so I can see work distribution at a glance and advance tasks by dragging.

### Acceptance criteria

4.1. The board SHALL render one column per status of the selected list, ordered by status `position`.

4.2. Each column header SHALL show the status color indicator, status name, task count and an "add task" affordance.

4.3. Each task card SHALL show title, priority indicator, assignee avatars, due date, and a subtask count when the task has subtasks.

4.4. WHEN a card is dragged to a different column and dropped, THEN the task's `status` SHALL be updated and its `position` set from the drop index.

4.5. WHEN a card is dragged within its own column and dropped, THEN only the task's `position` SHALL be updated.

4.6. WHILE a card is being dragged, the system SHALL render a drag overlay following the pointer and SHALL visually highlight the hovered drop target column and the insertion point.

4.7. WHEN a drag is cancelled with the Escape key or dropped outside a valid target, THEN no mutation SHALL occur and the card SHALL return to its original position.

4.8. Drag-and-drop mutations SHALL be applied optimistically and SHALL roll back to the exact pre-drag ordering if the Controller returns an error, accompanied by an error toast.

4.9. Empty columns SHALL render an empty state that also functions as a valid drop target.

4.10. Columns SHALL scroll independently on the vertical axis while column headers remain visible, and the board SHALL scroll on the horizontal axis when columns exceed the viewport width.

4.11. Drag and drop SHALL be operable from the keyboard via dnd-kit's keyboard sensor, with an accessible announcement of pick-up, move and drop events.

---

## Requirement 5 — List view

**User story:** As a team member, I want a dense tabular view of a list's tasks, so I can scan many tasks and sort them by what matters.

### Acceptance criteria

5.1. The list view SHALL render a table of the selected list's tasks with columns for title, status, assignees, priority and due date.

5.2. The system SHALL allow sorting by due date and by priority, in ascending and descending directions, with the active sort column and direction visibly indicated.

5.3. WHEN sorting by priority, THEN the order SHALL follow the semantic ranking `urgent > high > normal > low > none` rather than alphabetical order.

5.4. WHEN sorting by due date, THEN tasks without a due date SHALL always sort last regardless of direction.

5.5. Clicking a row SHALL open the task detail drawer for that task.

5.6. The table header SHALL remain visible while the task rows scroll.

5.7. Subtasks SHALL be rendered nested under their parent row with a disclosure control, and SHALL be excluded from the top level of the table.

5.8. Status and priority in list rows SHALL use the same tokens and visual language as the kanban cards.

5.9. An empty list SHALL render an empty state with a primary "create task" action.

---

## Requirement 6 — Sidebar navigation

**User story:** As a team member, I want a collapsible tree in the sidebar, so I can navigate the hierarchy and switch lists quickly.

### Acceptance criteria

6.1. The sidebar SHALL render the workspace as a collapsible tree of spaces, folders and lists, ordered by `position` at each level.

6.2. Expand and collapse state SHALL persist across list selection and user switching within a session.

6.3. Selecting a list SHALL load that list's board or list view in the main content area, and the selected list SHALL be visually marked as active.

6.4. The sidebar SHALL show only the nodes the current user is permitted to view, as returned by the Controller's visible-tree selector.

6.5. Each tree row SHALL expose a context menu with the operations valid for its type and the current user's permissions (rename, create child, archive).

6.6. The sidebar SHALL be collapsible to an icon rail to reclaim horizontal space, and its expanded width SHALL be resizable by dragging its edge.

6.7. Tree rows SHALL be navigable by keyboard with arrow keys for move and expand/collapse, and Enter to select.

6.8. A space or folder with no visible children SHALL render an inline hint rather than appearing as a dead end.

---

## Requirement 7 — Task detail drawer

**User story:** As a team member, I want a focused detail panel for a task, so I can read and edit everything about it without losing my place on the board.

### Acceptance criteria

7.1. Opening a task SHALL present a drawer overlaying the main content, built on the Headless UI `Dialog` primitive. At viewports below `48rem` it SHALL present as a full-height bottom sheet; at `48rem` and above it SHALL present as a right-side panel. Requirement 20 governs the responsive form; this requirement governs the content and behaviour, which are identical in both forms.

7.2. The drawer SHALL close on Escape, on overlay click, and on an explicit close button.

7.3. WHEN the drawer opens, THEN focus SHALL move into the drawer and SHALL be trapped within it. WHEN the drawer closes, THEN focus SHALL return to the element that opened it.

7.4. The drawer SHALL allow editing of title, description, status, priority, assignees, due date and subtasks.

7.5. Title and description SHALL be edited in place with save on blur and on Cmd/Ctrl+Enter, and discard on Escape. Escape with unsaved field edits SHALL revert the field rather than close the drawer.

7.6. Property controls SHALL be arranged in a consistent two-column label/value grid with uniform row height and spacing.

7.7. Each field SHALL show a saving indicator while its mutation is pending and SHALL revert to its previous value with an error toast if the mutation fails.

7.8. The drawer SHALL display read-only metadata: the task's breadcrumb path, created and updated timestamps.

7.9. The drawer SHALL expose a "move to list" action restricted to lists the current user can edit.

7.10. WHEN the current user lacks edit permission on the task's list, THEN all controls in the drawer SHALL render in a disabled read-only state with an explanatory note, rather than failing on submit.

7.11. The drawer SHALL offer keyboard navigation to the previous and next task in the current view, so a user can triage without closing it.

7.12. The drawer SHALL animate in and out with a transition under 200ms and SHALL respect `prefers-reduced-motion`.

---

## Requirement 8 — Permissions and user switching

**User story:** As an admin or member, I want visibility and editing to reflect my grants, so people only see and change what they should.

### Acceptance criteria

8.1. The seed data SHALL define exactly three users: Alice (`admin`), Bob (`member`), Carol (`member`).

8.2. The app chrome SHALL include an obvious user switcher showing the current user's avatar, name and role.

8.3. WHEN the current user is switched, THEN the sidebar tree, board, list view and any open drawer SHALL immediately re-evaluate against the new user, with no page reload.

8.4. Grants SHALL attach to containers as `{ resourceId, userId, mode: 'allow' | 'deny' }`.

8.5. A container SHALL carry a `visibility` of `public` or `private`. Public containers SHALL be visible to all workspace members unless explicitly denied. Private containers SHALL be visible only with an explicit `allow` grant.

8.6. A user's role SHALL be resolved from their membership in the workspace being evaluated, not from a global field on the user, so that a user can hold different roles in different workspaces once more than one exists. Users whose resolved role for the workspace is `admin` SHALL bypass all visibility and edit checks.

8.7. Visibility SHALL be resolved by walking the ancestor chain from workspace down to the node, in a single deterministic pass, where a `private` node resets visibility to denied and an explicit grant at a node overrides the inherited result for that node and its subtree. The nearest grant in the chain SHALL win.

8.7.1. Structural checks SHALL be evaluated **before** the admin bypass of 8.6, and the bypass SHALL apply only to the grant and visibility decision. Specifically, a node SHALL be denied to every role — admins included — when it does not exist, when its ancestor chain is broken or cyclic, when any node in its chain belongs to a different workspace, or when any node in its chain is archived. Archive is state rather than access, and workspace membership is not transitive across workspaces, so neither is something a role can see past.

8.7.2. The workspace check of 8.7.1 SHALL verify every node in the ancestor chain, not only the chain's root, so that a node whose denormalized `workspaceId` disagrees with its parent chain is rejected rather than inherited into the wrong workspace.

8.8. All tree and task selectors SHALL return only nodes and tasks the current user is permitted to view. A task SHALL be viewable if and only if its primary list is viewable.

8.9. Edit permission SHALL be defined as: admins may edit anything; members may create, update, delete and reorder **tasks** in lists they can view; container create, rename, archive and reorder operations SHALL be admin-only.

8.10. WHEN a user attempts to read or mutate a resource they cannot view, THEN the Controller SHALL return `{ error: { code: 'FORBIDDEN', message } }` without mutating the Model.

8.11. WHEN a user attempts a mutation they can view but not edit, THEN the Controller SHALL return `{ error: { code: 'FORBIDDEN', message } }` naming the required capability.

8.12. Permission checks SHALL be implemented in the Model/Controller layers. The View SHALL only use permission results to disable or hide affordances and SHALL NOT be the sole enforcement point.

8.13. WHEN the selected list becomes invisible after a user switch, THEN the main content SHALL render a permission-denied state offering navigation to a list the new user can see, and any open drawer for a now-denied task SHALL close.

8.14. The difference between Alice's and Bob's visible tree SHALL be demonstrable within 30 seconds using only the user switcher, which requires at least one private space or list granted to a subset of users and at least one explicit `deny` in the seed grants.

---

## Requirement 9 — Client data layer

**User story:** As a developer, I want a typed in-memory store that behaves like a real API, so the UI exercises genuine loading, error and rollback paths.

### Acceptance criteria

9.1. The Model SHALL define typed entities for containers, tasks, statuses, users and grants, stored in normalized `Record<id, entity>` maps with sibling ordering derived from `position`.

9.2. Seed fixtures SHALL create 1 workspace, 2 spaces, 2 folders, 3 lists, 3 users, 15 or more tasks spread across all lists and statuses, and sample grants that include both `allow` and `deny`.

9.3. Seed data SHALL be deterministic: fixed IDs and due dates derived from a fixed reference date, including at least one overdue task and one task due today, so the UI and tests are stable across runs.

9.4. All mutations SHALL pass through Controller actions. The View SHALL NOT write to the Model directly.

9.5. Every Controller action SHALL return a discriminated result of the shape `{ ok: true, data }` or `{ ok: false, error: { code, message, field? } }`, with `code` drawn from `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `NETWORK`.

9.6. The data layer SHALL simulate asynchronous latency on every mutation and on first load, with randomized jitter in a configurable range, so loading states are observable.

9.7. The data layer SHALL support injectable failures: a configurable failure probability that causes actions to return a `NETWORK` error, plus the ability to force the next operation to fail.

9.8. A developer panel in the app chrome SHALL expose latency range, failure probability and a "fail next operation" trigger, so error and rollback behaviour is demonstrable on command.

9.9. Failure injection SHALL default to zero probability so that normal use is not randomly broken.

9.10. Optimistic mutations SHALL snapshot the affected Model slice before applying, and SHALL restore that snapshot exactly when the operation fails.

9.11. The system SHALL persist state to `localStorage` under a versioned key, rehydrating on load and falling back to seed fixtures when the stored version does not match or the payload fails validation. A "reset to seed" control SHALL be available.

9.12. The list view SHALL simulate offset-based pagination over in-memory tasks, with a page size and a control to load further pages.

---

## Requirement 10 — MVC architecture

**User story:** As a reviewer, I want the codebase to follow an explicit MVC separation, so responsibilities and data flow are obvious.

### Acceptance criteria

10.1. The codebase SHALL be organized into three explicit layers: Model (`src/model`), Controller (`src/controllers`), View (`src/views`, `src/components`).

10.2. The Model layer SHALL contain entity types, seed fixtures, the normalized state shape, validation rules, the permission engine, position arithmetic and pure selector functions. It SHALL NOT import React or any React library.

10.3. The Controller layer SHALL own the Zustand store, all mutation actions, permission enforcement, latency and failure simulation, optimistic apply/rollback, and the view-model hooks that adapt Model data into View props.

10.4. The View layer SHALL be presentational: components receive data and callbacks via props or Context and SHALL NOT import the store directly. Store access SHALL be confined to Controller hooks.

10.5. An ESLint boundary rule SHALL fail the lint step when the Model imports from the Controller or View, or when a component under `src/components` imports the store.

10.6. Every Controller mutation SHALL follow the same pipeline: validate input, resolve permission, apply to Model, return result.

10.7. The README SHALL document the MVC mapping and include an architecture diagram showing the three layers and the direction of data flow.

---

## Requirement 11 — Design system and Storybook

**User story:** As a developer, I want a documented set of reusable primitives, so the UI stays consistent and components can be reviewed in isolation.

### Acceptance criteria

11.1. The system SHALL provide a design-system layer of presentational primitives under `src/components/ui`, each with an explicitly typed props interface exported from the component module.

11.2. The design system SHALL include at minimum: `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Menu`, `Dialog`, `Drawer`, `Tooltip`, `Badge`, `Avatar`, `AvatarGroup`, `StatusPill`, `PriorityBadge`, `DueDateChip`, `Checkbox`, `SegmentedControl`, `Skeleton`, `EmptyState`, `Toast`, `Spinner`, `Card`, `Kbd`, `Separator`, `ScrollShadow`.

11.3. Every primitive SHALL accept a `className` override merged last so callers can adjust layout without forking the component, and SHALL forward refs where the underlying element requires it.

11.4. Primitives SHALL be pure: no store imports, no data fetching, no permission logic.

11.5. Interactive primitives SHALL accept `disabled` and, where relevant, `loading`, and SHALL render a visually distinct state for each.

11.6. Storybook SHALL be configured with the Vite builder and SHALL serve the same Tailwind stylesheet as the app, so stories render with real tokens.

11.7. Every design-system primitive SHALL have a story file covering its variants, sizes and disabled/loading/error states.

11.8. Storybook SHALL additionally include stories for `TaskCard`, `KanbanColumn`, `SidebarTree`, `TaskDrawer` and `EmptyState` driven by fixture props, so composite components can be reviewed without the full app.

11.9. Variant-to-class mapping SHALL be expressed as typed lookup records rather than inline conditional strings, so variants stay enumerable and reviewable.

---

## Requirement 12 — React Context usage

**User story:** As a developer, I want cross-cutting UI concerns provided by Context, so components stay decoupled from global wiring.

### Acceptance criteria

12.1. Presentation-level cross-cutting concerns SHALL be provided via React Context, distinct from the Zustand store which holds domain state.

12.2. The system SHALL provide the following Contexts: `ToastContext` (queue and dispatch of notifications), `DensityContext` (comfortable/compact UI density), `NavigationContext` (selected list, active view, open task), `ConfirmContext` (promise-based confirmation dialogs), `SimulationContext` (latency and failure-injection settings), `SidebarContext` (collapsed state, width, expanded node set, and whether the sidebar is currently modal).

12.7. Responsive behaviour SHALL be expressed in CSS by default. A breakpoint SHALL be observed from JavaScript only where the decision is about **behaviour** rather than appearance — specifically, whether the sidebar is a focus-trapping modal sheet or part of the static layout, since a sheet left open while the viewport widens would otherwise become an invisible focus trap. Layout differences achievable with Tailwind variants SHALL NOT be routed through JavaScript.

12.8. WHERE JavaScript observes a breakpoint, the value SHALL be derived from a shared module that mirrors the `--breakpoint-*` tokens, and a build-time check SHALL fail when the two drift. Duplication of breakpoint values SHALL be permitted only with such a check in place.

12.3. Each Context SHALL expose a typed consumer hook that throws a descriptive error when used outside its provider.

12.4. Context values SHALL be memoized so that unrelated state changes do not re-render all consumers.

12.5. Providers SHALL be composed in a single `AppProviders` component so provider order is explicit and testable.

12.6. Context SHALL NOT be used to carry domain entities that already live in the store, to avoid two sources of truth.

---

## Requirement 13 — Visual system and styling constraints

**User story:** As a reviewer, I want the app to read as one coherent, modern product, styled only with Tailwind.

### Acceptance criteria

13.1. All styling SHALL be expressed as Tailwind utility classes in JSX.

13.2. The project SHALL contain no CSS modules, SCSS, styled-components, Emotion, or hand-written CSS rules for layout or theming. Exactly one stylesheet, `src/index.css`, SHALL exist, containing only the Tailwind import, the `@theme` token block and `@custom-variant`/`@utility` declarations.

13.3. The boilerplate `src/App.css` SHALL be deleted and the boilerplate rules in `src/index.css` replaced.

13.4. Inline `style=` SHALL NOT be used for layout or theming. The permitted uses are exactly four, each annotated in code and listed in the README. What they share is that the value is produced per pointer event or per frame, which no static class can express:

| Exception                                                   | Why it cannot be a class                                                                                                                                                                                                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dnd-kit's `transform` and `transition` on sortable items    | Recomputed per frame from pointer position                                                                                                                                                                                                                  |
| The sidebar resizer's live width                            | A user-dragged value, written in `rem` and clamped to the token range                                                                                                                                                                                       |
| Positioned overlay coordinates — the tooltip's `top`/`left` | A viewport position from `getBoundingClientRect`. Required because an absolutely positioned overlay is clipped by any ancestor with `overflow` set, and `z-index` cannot escape an overflow clip, so such overlays must be portalled and positioned `fixed` |
| The bottom sheet's live drag-to-dismiss offset             | A per-pointer-event translation, converted from the pointer's `clientY` travel into `rem` before it is written                                                                                                                                              |

13.4.1. Any overlay that can appear inside a scrolling or clipping region — tooltips, and any popover not already handled by Headless UI's anchoring — SHALL be rendered in a portal and positioned against the viewport. Rem-derived offsets SHALL be converted against the real root font size rather than an assumed 16px, so overlay spacing scales with the rest of the layout.

13.5. The Tailwind `@theme` block SHALL define a token set covering `colors` (neutral ramp, brand/accent, semantic success/warning/danger/info, five priority tokens, four status tokens), `fontFamily`, `borderRadius`, `boxShadow` and `spacing` extensions.

13.6. Priority and status colors SHALL be referenced exclusively through tokens, guaranteeing identical appearance in kanban cards, list rows and the drawer.

13.7. The app SHALL present one coherent chrome: left sidebar, top bar containing breadcrumbs, view switcher, search, developer panel and user switcher, and a main content region.

13.8. Spacing SHALL follow a single `0.25rem`-based scale. Surface padding SHALL be standardized per surface type (page region, card, table row, drawer section, menu item) and applied through shared primitives rather than ad-hoc per-instance values.

13.9. Typography SHALL use a constrained set of roles — page title, section title, body, secondary, caption — each a fixed size/weight/color combination applied consistently.

13.10. Component libraries SHALL be limited to headless, Tailwind-friendly ones. Headless UI and dnd-kit are approved; component kits that ship their own styling are not.

13.11. Icons SHALL come from `lucide-react`, used at a consistent stroke width and a constrained size set (`0.875rem` / `1rem` / `1.25rem`), and SHALL carry `aria-hidden` when decorative or an accessible label when they are the only content of a control.

---

## Requirement 14 — UI feedback and interaction quality

**User story:** As a user, I want the interface to tell me what is happening, so I am never left guessing after an action.

### Acceptance criteria

14.1. First load SHALL render skeletons for the sidebar tree and the board/list region, matching the final layout's dimensions to avoid layout shift.

14.2. Switching lists SHALL render a skeleton or inline loading state for the content region while the new list's data resolves.

14.3. Every list, column and table SHALL have a distinct empty state with an icon, a short explanation and, where applicable, a primary action.

14.4. WHEN any mutation fails, THEN a toast SHALL appear stating what failed and why, using the error message from the Controller result.

14.5. Permission-denied errors SHALL be surfaced with a distinct tone and wording from network errors, so the cause is unambiguous.

14.6. Toasts SHALL stack, auto-dismiss after a timeout, be manually dismissible, and SHALL offer a retry action for failed mutations that are safely retryable.

14.7. Pending mutations SHALL be reflected at the point of interaction — a spinner inside the triggering button, or a subdued state on the affected row or card — rather than by a global overlay.

14.8. Interactive elements SHALL have visible hover, focus-visible, active and disabled states. Focus rings SHALL be present on all keyboard-reachable controls and SHALL NOT be removed.

14.9. Destructive actions (archive container, delete task) SHALL require confirmation through the `ConfirmContext` dialog, naming the target and its cascade consequences.

14.10. Successful non-obvious mutations (move between lists, archive, bulk change) SHALL confirm with a success toast. Obvious inline edits SHALL NOT produce toasts, to avoid noise.

14.11. State transitions SHALL be animated with durations between 120ms and 200ms using Tailwind transition utilities, and SHALL be suppressed under `prefers-reduced-motion`.

14.12. Optimistic updates SHALL render immediately and visibly revert on failure, with the accompanying toast explaining the revert.

---

## Requirement 15 — Card interactions

**User story:** As a user, I want to act on a task directly from its card, so common changes do not require opening the drawer.

### Acceptance criteria

15.1. WHERE a fine pointer is available, hovering a task card SHALL elevate it with a shadow and border transition and SHALL reveal its secondary affordances, which remain hidden otherwise to keep the card uncluttered. WHERE only a coarse pointer is available, those affordances SHALL be persistently visible, since there is no hover state to reveal them.

15.2. Each card SHALL expose a hover/focus overflow menu with quick actions: open details, change status, change priority, assign, set due date, move to list, duplicate, delete.

15.3. Quick actions SHALL apply directly from the card without opening the drawer, and SHALL respect the same permission checks as the drawer.

15.4. Clicking a card body SHALL open the task drawer. Clicking an interactive element inside the card SHALL NOT also open the drawer.

15.5. A card SHALL be reachable and operable by keyboard: focusable, Enter to open, and its overflow menu reachable without a pointer.

15.6. Dragging a card SHALL render a tilted, elevated drag overlay while the source slot shows a subdued placeholder of the same dimensions, so column height does not jump.

15.7. Task cards SHALL show an inline checkbox to mark the task complete, moving it to the list's `done` status with a brief transition.

15.8. Cards SHALL render an overdue due date in the danger token and a due-today date in the warning token.

15.9. Card titles SHALL clamp to two lines with the full title available on hover via tooltip.

15.10. Card interactions SHALL have no hover-only paths to functionality: every quick action SHALL also be available from the drawer.

---

## Requirement 16 — Space optimization and density

**User story:** As a user on a laptop, I want the interface to use its space well, so I can see more work at once.

### Acceptance criteria

16.1. The layout SHALL fill the viewport height with independent scroll regions for the sidebar, the board columns and the task table. The page itself SHALL NOT scroll vertically.

16.2. At viewports of `64rem` and above the sidebar SHALL collapse to an icon rail and SHALL be resizable, with both states persisted for the session. Below `64rem` the sidebar SHALL instead behave as specified in Requirement 20.

16.3. A density toggle SHALL switch between comfortable and compact modes, affecting row height, card padding and font size through `DensityContext`, with the choice persisted. The toggle SHALL be offered only where compact density does not reduce touch targets below the minimum in 20.9.

16.4. The top bar SHALL be a single row combining breadcrumbs, view switcher, search, developer panel and user switcher, with a fixed height not exceeding `3.5rem`. Below `48rem` it SHALL reduce to the subset defined in 20.4.

16.5. At viewports of `48rem` and above, kanban columns SHALL have a fixed width in the `17.5rem`–`20rem` range so multiple columns are visible at once, and the board SHALL scroll horizontally beyond that. Below `48rem` the board SHALL use the single-column snap behaviour in 20.5.

16.6. Long names in the tree, breadcrumbs, cards and table cells SHALL truncate with ellipsis and expose the full value via tooltip, never wrapping into a broken layout.

16.7. The task table SHALL allocate the flexible remaining width to the title column while other columns stay at content width.

16.8. Secondary metadata SHALL be progressively disclosed — revealed on hover where a fine pointer is available, otherwise persistently visible or reachable in one tap — rather than permanently occupying space on large viewports.

16.9. The layout SHALL remain usable across the full supported viewport range defined in Requirement 20, with no horizontal page scrolling of the app chrome at any width.

---

## Requirement 17 — Accessibility

**User story:** As a keyboard or screen-reader user, I want to operate the app without a mouse.

### Acceptance criteria

17.1. All interactive elements SHALL be reachable by keyboard in a logical tab order, with icon-only controls carrying accessible names.

17.2. The drawer and dialogs SHALL trap focus, close on Escape, and restore focus to their trigger on close, using Headless UI primitives.

17.3. The sidebar tree SHALL use appropriate tree semantics with expanded/selected state exposed to assistive technology.

17.4. The task table SHALL use real table semantics with sortable headers exposing their sort direction.

17.5. Drag and drop SHALL announce pick-up, over-target and drop events through dnd-kit's live-region announcements.

17.6. Toasts SHALL be announced via a polite live region.

17.7. Text and interactive elements SHALL meet WCAG AA contrast against their backgrounds. Status and priority SHALL never be conveyed by color alone — each SHALL pair color with a label or icon.

17.8. Full WCAG conformance SHALL NOT be claimed; the README SHALL state that automated checks and manual keyboard testing were performed and that assistive-technology testing and expert review were not.

---

## Requirement 18 — Testing

**User story:** As a reviewer, I want the critical logic covered by tests, so I can trust the permission model and core flows.

### Acceptance criteria

18.1. The project SHALL be configured with Vitest, Testing Library and jsdom, runnable via `npm run test` in single-run mode.

18.2. Unit tests SHALL cover the permission engine: admin bypass, public inheritance, private requiring allow, explicit deny, nearest-grant-wins resolution, and deep-chain inheritance.

18.3. Unit tests SHALL cover permission filtering of the visible tree and of task access for each of Alice, Bob and Carol, asserting the exact expected node sets from the seed fixtures.

18.4. Unit tests SHALL cover Controller mutation guards, asserting that a denied mutation returns `FORBIDDEN` and leaves the Model byte-for-byte unchanged.

18.5. Unit tests SHALL cover task validation rules, status-set enforcement, cross-list move with status remapping, subtask depth limits and fractional position arithmetic including rebalancing.

18.6. Unit tests SHALL cover optimistic rollback: a forced failure SHALL restore the pre-mutation state exactly.

18.7. At least one component test SHALL render a real view and assert behaviour — switching the current user changes the rendered tree, and opening a task renders the drawer and closes on Escape.

18.8. Tests SHALL use the deterministic seed fixtures and SHALL set simulated latency to zero, so the suite is fast and non-flaky.

18.9. Unit tests SHALL cover the extensibility seams rather than only the current configuration: the container-type registry SHALL be driven through a fixture type to prove validation and reorder logic are configuration-driven, role capabilities SHALL be asserted from the capability table, and permission resolution SHALL be exercised with a second synthetic workspace to prove workspace scoping is real.

18.10. Unit tests SHALL assert that selectors scoped to one workspace return nothing belonging to another, using a two-workspace fixture, so single-workspace assumptions cannot silently creep in.

18.11. The `PersistenceAdapter` SHALL be tested through an in-memory implementation, proving the store is not coupled to `localStorage`.

---

## Requirement 19 — Documentation

**User story:** As a reviewer, I want a README that explains the system and the decisions behind it.

### Acceptance criteria

19.1. The README SHALL replace the Vite boilerplate and SHALL document how to run the app, tests, lint, build and Storybook.

19.2. The README SHALL include a Mermaid architecture diagram showing the MVC layers, the store, the Contexts and the component tree.

19.3. The README SHALL explain the data model, including entity relationships, the fractional `position` scheme and the archive strategy.

19.4. The README SHALL explain how permissions are enforced in the client, including the resolution algorithm, the admin bypass, the view/edit capability split, and how the model would be extended to team-based grants, role hierarchies and field-level permissions.

19.5. The README SHALL document the simulated latency and failure-injection layer and how to demonstrate error and rollback paths.

19.6. The README SHALL document the `localStorage` persistence choice, its versioned key and reset path.

19.7. The README SHALL list trade-offs: what was cut, what is incomplete, and a prioritized week-2 plan.

19.8. The README SHALL include an AI usage log describing which tools were used, where they helped and where their output was corrected or rejected. An optional `AI_USAGE.md` MAY carry the long form.

19.9. The README SHALL list every `style=` exception with its file location and justification.

19.10. The README SHALL state which stretch goals were attempted — at most two — and SHALL list the design-system inventory with a pointer to Storybook.

19.11. The README SHALL document the mobile-first approach: the breakpoint token set, the per-surface adaptation table, how touch drag and drop is handled, and which viewport widths were manually verified.

19.12. The README SHALL document every extension point from 21.4 through 21.11 with the concrete steps required to extend it, including a worked example of what adding a second workspace and adding a new view type would touch.

19.13. The README SHALL state the `rem` unit rule and list the exceptions taken under 22.4, together with the repeatable verification command from 22.7.

---

## Requirement 20 — Mobile-first responsive design

**User story:** As a user on a phone, tablet or desktop, I want a layout designed for my screen rather than a desktop layout squeezed into it, so the app is genuinely usable at any size.

### Acceptance criteria

20.1. Every surface SHALL be designed and implemented for the smallest supported viewport first, then progressively enhanced upward using Tailwind's min-width breakpoints. Unprefixed utility classes SHALL describe the mobile layout, and `sm:`/`md:`/`lg:`/`xl:` prefixes SHALL add to it. Max-width utilities SHALL NOT be used to walk a desktop layout backwards.

20.2. The supported viewport range SHALL be `20rem` (320px) to `120rem` and above. The layout SHALL be usable without horizontal page scrolling at every width in that range.

20.3. The system SHALL use a fixed, documented breakpoint set expressed in `rem`: base (`<40rem`, phone), `sm` (`40rem`, large phone), `md` (`48rem`, tablet), `lg` (`64rem`, laptop), `xl` (`80rem`, desktop). No breakpoint values SHALL be declared outside this token set.

20.4. The app chrome SHALL adapt as follows:

| Surface      | Base (`<40rem`)                                                                                                            | `md` (`≥48rem`)                       | `lg` (`≥64rem`)                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------- |
| Sidebar      | Off-canvas slide-over, opened from a top-bar menu button, closing on selection, Escape and overlay tap                     | Off-canvas slide-over                 | Persistent, collapsible, resizable |
| Top bar      | Menu button, truncated current-list name, search icon, user avatar; view switcher and dev panel move into an overflow menu | Adds the view switcher inline         | Full single row per 16.4           |
| Breadcrumbs  | Current list name only, with the full path in the sidebar                                                                  | Last two segments                     | Full path                          |
| Main content | Full viewport width                                                                                                        | Remaining width beside the slide-over | Remaining width beside the sidebar |

20.5. The kanban board SHALL adapt as follows: below `48rem` it SHALL present one column at a time at a width near the viewport, using horizontal scroll-snap with an indicator showing position within the column set; at `48rem` and above it SHALL present the fixed-width multi-column board of 16.5. Both forms SHALL render the same column elements, differing only by Tailwind variants — the scroll-snap container and column width — so no JavaScript breakpoint check is required. The position indicator SHALL derive the active column from scroll position, not from viewport width.

20.6. The list view SHALL adapt as follows: below `48rem` each task SHALL render as a stacked card showing title, status, priority, due date and assignees, with sort controls in a dropdown rather than as table headers; at `48rem` and above it SHALL render the full table of Requirement 5. Both forms SHALL expose the same sort options, be driven by the same view-model hook, and open the same drawer. The inactive form SHALL be hidden with `display: none`, which removes it from the accessibility tree and the tab order, so no JavaScript breakpoint check is required.

20.7. The task drawer SHALL render as a full-height bottom sheet below `48rem` and as a right-side panel at `48rem` and above, with identical content, field behaviour and close affordances in both forms. The two forms SHALL be the same `Dialog` differing only in positioning and sizing utilities, not separate components.

20.7.1. The sidebar SHALL be the one surface permitted a JavaScript breakpoint check, because its two forms differ in behaviour rather than appearance: below `64rem` it is a focus-trapping, scroll-locking modal sheet, and at `64rem` and above it is a static region of the layout. WHEN the viewport crosses that boundary while the sheet is open, THEN the sheet SHALL close, so that it cannot persist as an invisible focus trap.

20.8. Drag and drop SHALL work on touch. The system SHALL register dnd-kit's `TouchSensor` with a press delay and movement tolerance tuned so that vertical scrolling and horizontal column paging remain possible without accidentally initiating a drag. WHERE touch drag is impractical for a given surface, an equivalent non-drag path SHALL exist — reordering and status changes SHALL both be reachable from the card quick-action menu and the drawer.

20.9. All interactive targets SHALL be at least `2.75rem` in both dimensions where the primary pointer is coarse. Compact density SHALL NOT be applied in a way that violates this.

20.10. Interactions SHALL NOT depend on hover. Every hover-revealed affordance SHALL have a coarse-pointer equivalent that is persistently visible or reachable in a single tap, gated by a `can-hover` variant rather than assumed.

20.11. Text SHALL remain legible without zoom at the smallest supported viewport, and the layout SHALL tolerate a user root font size up to 150% without clipping or overlap — which follows from Requirement 22's `rem` rule.

20.12. The layout SHALL respect safe-area insets so that content and fixed affordances are not obscured by device notches or home indicators.

20.13. Any fixed or sticky element SHALL account for mobile browser chrome by sizing against the dynamic viewport rather than a static viewport height.

20.14. Each responsive form SHALL be verifiable in Storybook at the defined breakpoints, so responsive behaviour is reviewable per component and not only in the assembled app.

---

## Requirement 21 — Readability, maintainability, scalability and extensibility

**User story:** As the next developer on this codebase, I want to extend it at any level of its hierarchy without rewriting what exists, so today's narrow scope does not become tomorrow's refactor.

### Acceptance criteria

#### Scope that must be extensible

21.1. The delivered scope is a single workspace. The data model, state shape, selectors and Controller actions SHALL be written so that supporting multiple workspaces requires adding data and UI, not changing existing signatures or control flow.

21.2. Every entity SHALL carry an explicit `workspaceId`, and every selector that returns a collection SHALL accept a workspace scope. No module-level singleton, hard-coded constant or implicit `theWorkspace` lookup SHALL stand in for workspace scoping.

21.3. A user's role SHALL be modeled as a membership of a workspace (`{ workspaceId, userId, role }`) rather than a global field on the user, so a user can hold different roles in different workspaces. The seed SHALL contain one workspace's memberships and the engine SHALL resolve role through them.

21.4. Container hierarchy rules SHALL be expressed as a declarative configuration — a registry mapping each container type to its permitted child types, icon, labels and capabilities — not as `switch` statements or chained conditionals spread across validation, UI and selectors. Adding a container level SHALL be a registry entry plus its own UI affordances, with no change to the validation, reorder, move or tree-render logic.

21.5. Views SHALL be registered in a view registry keyed by view id, supplying label, icon and component. Adding a calendar, timeline or table view SHALL be a registry entry, with no change to the view switcher, navigation context or routing.

21.6. Priorities, status categories and capabilities SHALL each be defined as a single configuration map carrying label, display token and ordering rank. Adding or reordering a value SHALL touch exactly one map, and no sort comparator, badge component or filter SHALL hard-code the set.

21.7. Role capabilities SHALL be expressed as a `Record<Role, Set<Capability>>` table rather than inline role comparisons, so adding a role is a table entry.

21.8. Grant resolution SHALL sit behind a single resolver function so that team-based grants can be added by widening that resolver's subject lookup, with no change to any call site.

21.9. Subtask nesting depth SHALL be governed by a named constant and a depth-computing function, not by boolean `parentTaskId == null` checks, so raising the depth limit is a constant change.

21.10. Persistence SHALL sit behind a `PersistenceAdapter` interface (`load`, `save`, `clear`), with the `localStorage` implementation as one conformant adapter, so swapping to IndexedDB or a server is a new implementation rather than an edit to the store.

21.11. The simulated transport SHALL sit behind a transport interface, so replacing it with a real HTTP client is a module swap. Controller actions SHALL NOT contain transport-specific logic.

21.12. The Model layer SHALL have no dependency on React, Zustand, the browser or the chosen persistence mechanism, so it remains reusable in a different runtime — including a future server.

#### Readability and maintainability

21.13. Each module SHALL have a single responsibility, and each file SHALL export a coherent, named public surface. Default exports SHALL NOT be used, so every symbol has one searchable name.

21.14. Functions SHALL prefer early returns over nested conditionals. Nested ternaries and boolean parameters that select behaviour SHALL be avoided in favour of discriminated unions and named options objects.

21.15. Exhaustive `switch` statements over union types SHALL include a `never`-typed default case, so extending a union produces a compile error at every site that must handle the new member rather than silent fall-through.

21.16. TypeScript SHALL run in strict mode. `any` SHALL NOT appear in application code, and type assertions SHALL be accompanied by a comment justifying them.

21.17. Domain vocabulary SHALL be used consistently across layers: the names `container`, `space`, `folder`, `list`, `task`, `subtask`, `status`, `grant`, `capability`, `membership` SHALL mean the same thing in types, actions, selectors, components and tests, with no synonyms introduced.

21.18. Variant-to-class mapping, configuration registries and token references SHALL be data rather than inline conditional strings, so the set of valid values is enumerable by reading one declaration.

21.19. Module boundaries intended for reuse — Model exports, design-system props, Context hooks, adapter interfaces — SHALL carry a brief doc comment stating purpose and contract. Inline comments SHALL explain _why_, not restate _what_.

21.20. Lint SHALL enforce the MVC import boundaries of 10.5 and SHALL additionally fail on unused exports, circular imports and disallowed dependency directions, so architectural drift breaks the build rather than accumulating.

21.21. A short `ARCHITECTURE.md` or README section SHALL document each extension point from 21.4 through 21.11 with the concrete steps to extend it, so the extensibility claim is verifiable rather than asserted.

21.22. Tests SHALL be written against public module surfaces rather than internals, so refactoring implementation details does not require rewriting tests.

---

## Requirement 22 — Dimension units

**User story:** As a user who has changed my browser's font size, I want the entire interface to scale with it, so the app respects my settings rather than overriding them.

### Acceptance criteria

22.1. `rem` SHALL be the project's dimension unit. All spacing, padding, margin, width, height, min/max dimensions, font size, line height, border radius, gap, icon size and breakpoint values SHALL be expressed in `rem`.

22.2. Tailwind's default spacing, sizing, typography and breakpoint scales are already `rem`-based and SHALL be used in preference to arbitrary values. WHERE an arbitrary value is unavoidable, it SHALL be written in `rem` — `w-[18.75rem]`, never `w-[300px]`.

22.3. `px` SHALL NOT appear in any arbitrary Tailwind value, in the `@theme` token block's dimensional tokens, or in any inline `style` computation of a layout dimension.

22.4. The following narrow exceptions SHALL be permitted, and SHALL be the only ones:

| Exception                                                             | Reason                                                                                                                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hairline borders, rings and dividers (`border`, `ring-1`, `divide-y`) | A border is a rendering detail, not a layout dimension. Scaling a hairline with root font size produces blurred sub-pixel edges. Tailwind's defaults are `1px` by design. |
| `box-shadow` offsets, blur and spread                                 | Cosmetic depth, not layout. Shadows should not grow with user font size.                                                                                                  |
| Pointer-travel thresholds — dnd-kit's activation distance and touch tolerance, and the bottom sheet's drag-to-dismiss threshold | Compared against `clientX`/`clientY`, which the browser reports in CSS pixels. A threshold is not a dimension that is rendered, so there is no `rem` equivalent to express it in. |
| Raster asset intrinsic dimensions, if any are added                   | A pixel count is the correct unit for a pixel buffer.                                                                                                                     |

22.5. Every exception taken SHALL be annotated in code and listed in the README alongside the inline-`style` exception list of 19.9.

22.6. Breakpoints SHALL be declared in `rem` so that a user's root font size changes which layout they receive, consistent with the intent of 20.11.

22.7. A verification step SHALL grep the repository for `px` and SHALL confirm every remaining occurrence falls within the 22.4 exception list. This check SHALL be documented so it is repeatable.

22.8. The root font size SHALL NOT be overridden away from the browser default, since doing so would defeat the purpose of using `rem`.

---

## Requirement 23 — Stretch goals

**User story:** As a reviewer, I want to see at most two well-finished extras rather than several half-finished ones.

### Acceptance criteria

23.1. Stretch work SHALL only begin once all must-have requirements are met.

23.2. The system SHALL implement client-side search over task title and description, scoped to the current user's visible tasks, with debounced input, result grouping by list, highlighted matches and a keyboard shortcut to focus the field.

23.3. The system SHALL implement optimistic drag-and-drop with rollback as specified in 4.8, 9.10 and 14.12, demonstrable via the developer panel's forced-failure trigger.

23.4. No further stretch goals SHALL be implemented. The README SHALL name these two as the attempted set.
