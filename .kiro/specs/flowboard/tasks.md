# Flowboard — Implementation Plan

Tasks are ordered so that each one builds on working code from the previous one. Config registries and the Model come first because every other layer reads from their shape, and because the permission tests are the stated test minimum. The design system lands before the feature views so views are composed from primitives rather than retrofitted onto them.

Three rules apply to every task below rather than being tasks of their own:

- **Mobile-first.** Build each surface at the base viewport first and add `md:`/`lg:` enhancements in the same task. There is a verification pass in Phase 7, but responsive behaviour is not deferred to it — a view built desktop-first and narrowed later is the outcome this ordering exists to prevent.
- **`rem` only.** Any dimension written during any task is `rem`, drawn from the Tailwind scale or the `--size-*` tokens. The audit in Phase 9 is a check, not the first time units are considered.
- **Config over conditionals.** When a task needs a closed set — container types, views, priorities, capabilities — it reads the registry from `src/config` rather than restating the set inline.

Pin exact resolved versions in `package.json` after each install step rather than leaving caret ranges.

---

## Phase 0 — Scaffold and toolchain

- [ ] 1. Install dependencies and strip the boilerplate
- [ ] 1.1 Install runtime dependencies
  - `zustand@5.0.15`, `immer@11.1.21`, `nanoid@6.0.2`, `lucide-react@1.57.0`, `@headlessui/react@2.2.10`
  - `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2`, `@dnd-kit/modifiers@9.0.0`
  - _Requirements: 9.1, 11.10, 13.10, 13.11_
- [ ] 1.2 Install and wire Tailwind v4
  - `tailwindcss@4.3.3` + `@tailwindcss/vite@4.3.3`, register the plugin in `vite.config.ts`
  - _Requirements: 13.1, 13.2_
- [ ] 1.3 Install the test toolchain
  - `vitest@5.0.5`, `@vitest/coverage-v8@5.0.5`, `jsdom@30.1.3`, `@testing-library/react@16.3.3`, `@testing-library/user-event@14.6.8`, `@testing-library/jest-dom`
  - Add `test` (single-run), `test:watch` and `coverage` scripts; create `src/test/setup.ts` with jest-dom matchers and zero simulated latency
  - _Requirements: 18.1, 18.8_
- [ ] 1.4 Delete the Vite boilerplate
  - Remove `src/App.css`, `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`, `public/icons.svg`; reduce `src/App.tsx` to a shell placeholder
  - _Requirements: 13.3_
- [ ] 1.5 Author `src/index.css` as the project's only stylesheet
  - Replace all boilerplate rules with `@import "tailwindcss"`, the full `@theme` token block and the custom variants
  - Tokens: neutrals, brand, semantic, five priority tokens, four status tokens, `fontFamily`, `borderRadius`, `boxShadow`
  - `rem` breakpoint tokens `--breakpoint-sm/md/lg/xl` at `40/48/64/80rem`
  - Named `--size-*` dimension tokens in `rem` (sidebar, rail, sidebar min/max, topbar, column, column-mobile, drawer, drawer-xl, touch-target, three icon sizes) so no component needs an arbitrary value
  - Variants: `density-compact` and `can-hover (@media (hover: hover) and (pointer: fine))`
  - Do not override the root font size
  - _Requirements: 13.2, 13.5, 13.6, 16.3, 20.3, 20.10, 22.1, 22.6, 22.8_
- [ ] 1.6 Add the lint rules that enforce the architecture
  - `no-restricted-imports` zones: Model may not import React/Zustand/Controller/View; `components/ui` may not import Controller or Model state; views may import only `controllers/hooks/**`, never `controllers/store`; `src/config` may not import any other layer
  - Add rules failing on circular imports, unused exports and `export default`
  - Enable TypeScript `strict`; forbid `any` in application code
  - Also forbid the Model importing the browser (`window`, `localStorage`) or any adapter, so it stays runnable in a non-browser runtime
  - Verify the rules actually fail by introducing a deliberate violation, then reverting it
  - _Requirements: 10.1, 10.4, 10.5, 11.4, 21.12, 21.13, 21.16, 21.20_
- [ ] 1.7 Add the `cn()` class-merge helper and date utilities in `src/lib`
  - _Requirements: 11.3_
- [ ] 1.8 Add the `px` guard
  - A lint rule or `scripts/check-units.mjs` that fails when `px` appears in a Tailwind arbitrary value, in a dimensional `@theme` token, or in an inline `style` layout computation
  - Allow-list the four exceptions: hairline borders/rings/dividers, `box-shadow` offsets, dnd-kit sensor thresholds, raster asset intrinsic sizes
  - Wire it into the `lint` script so the rule holds continuously rather than at review time
  - _Requirements: 22.3, 22.4, 22.7_

- [ ] 1.9 Author the configuration registries in `src/config`
  - These land before the Model because validation, selectors and views all read from them
- [ ] 1.9.1 `containers.ts` — `ContainerTypeConfig` and `CONTAINER_REGISTRY`
  - Per type: `label`, `labelPlural`, `icon`, `childTypes`, `holdsTasks`, `grantable`; plus the `canContain(parent, child)` helper
  - _Requirements: 1.2, 21.4, 21.18_
- [ ] 1.9.2 `views.ts` — `ViewConfig` and `VIEW_REGISTRY` keyed by `ViewId`
  - _Requirements: 21.5_
- [ ] 1.9.3 `priorities.ts` and `statusCategories.ts`
  - Each entry carries `label`, display `token`, `icon` and `rank`; `rank` is what comparators sort on
  - _Requirements: 5.3, 13.6, 21.6_
- [ ] 1.9.4 `capabilities.ts` — the `Capability` union and `ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>>`
  - Includes `workspace:bypass`, so the admin bypass is a table entry rather than a role comparison
  - _Requirements: 8.9, 21.7_
- [ ] 1.9.5 `breakpoints.ts` and `limits.ts`
  - Breakpoints re-export the `rem` values from the `@theme` block for `ViewportContext`, so CSS and JS cannot disagree
  - `limits.ts`: `MAX_TASK_DEPTH`, `MAX_TITLE_LEN`, `MAX_NAME_LEN`, `PAGE_SIZE`, `POSITION_GAP`
  - _Requirements: 12.7, 20.3, 21.9, 22.6_

---

## Phase 1 — Model layer (pure TypeScript, no React)

- [ ] 2. Define entities and state shape
- [ ] 2.1 Write `src/model/types.ts`
  - `Container`, `Status`, `Task`, `User`, `Membership`, `Grant`; the `ContainerType`, `Visibility`, `StatusCategory`, `Priority`, `Role` unions; `ErrorCode`, `AppError`, `Result<T>` with `ok`/`err` constructors; a `Scope` type of `{ workspaceId, userId }`
  - `workspaceId` on `Container`, `Task`, `Status` and `Grant`; **no** `role` field on `User` — role lives on `Membership`
  - `Grant` uses `subjectId` + `subjectType: 'user'` rather than `userId`, so team grants are a union widening
  - Doc comment on each exported interface stating its contract
  - _Requirements: 1.1, 2.2, 3.2, 8.4, 8.5, 9.1, 9.5, 21.2, 21.3, 21.19_
- [ ] 2.2 Write `src/model/state.ts`
  - `FlowboardState` with normalized `Record<id, entity>` maps, `memberships` and `grants` arrays, `version`, and an empty-state factory
  - `activeWorkspaceId` plus a `workspaceIds` index — no singleton field naming "the" workspace
  - _Requirements: 9.1, 21.1, 21.2_
- [ ] 2.2.1 Write `src/model/hierarchy.ts`
  - `ancestorChain`, `depthOf`, `taskDepth`, and registry-backed lookups; `taskDepth` compared against `MAX_TASK_DEPTH` rather than a `parentTaskId == null` check
  - _Requirements: 21.4, 21.9_
- [ ] 2.3 Write `src/model/position.ts` with tests
  - `nextPosition(prev, next)` for head/middle/tail insertion, `needsRebalance`, `rebalance(siblings)`
  - Tests: all three insertion points, repeated midpoint insertion until the gap collapses, rebalance preserving order
  - _Requirements: 1.7, 2.9, 18.5_
- [ ] 2.4 Write `src/model/validation.ts` with tests
  - Container name bounds via `MAX_NAME_LEN`, parent-type checks via `canContain` from the registry, cyclic-move rejection, task title bounds via `MAX_TITLE_LEN`, status-belongs-to-list check, subtask depth via `taskDepth` and `MAX_TASK_DEPTH`, assignee de-duplication
  - No `switch` on container type and no literal type comparisons — every hierarchy rule resolves through the registry
  - _Requirements: 1.2, 1.3, 1.9, 1.10, 2.4, 2.5, 2.11, 18.5, 21.4, 21.9_
- [ ] 2.5 Write `registry.test.ts` — the extensibility proof for the hierarchy
  - Inject a synthetic container type into a test registry and assert that validation, reorder and move logic handle it with no production-code change
  - _Requirements: 18.9, 21.4_

- [ ] 3. Build the permission engine
- [ ] 3.1 Write `src/model/permissions.ts`
  - `roleOf(state, workspaceId, userId)` resolving through `memberships` — never a field on `User`
  - `resolveGrant(state, resourceId, userId)` as the single grant seam, built on a `subjectsOf` lookup that today returns `[userId]`, preferring `deny` among multiple matches
  - `canView(state, scope, nodeId)`: bypass via `ROLE_CAPABILITIES[role].has('workspace:bypass')` → reject cross-workspace nodes → walk the chain → `private` resets → nearest grant wins → archived denies
  - `canViewTask`, and `can(state, scope, capability, resourceId)` reading the capability table with no role-specific branches
  - _Requirements: 8.5, 8.6, 8.7, 8.8, 8.9, 8.12, 21.3, 21.7, 21.8_
- [ ] 3.2 Write `permissions.test.ts` covering the full resolution table
  - Admin bypass; public chain no grants; private without grant; private with allow; allow inherited by subtree; ancestor deny; ancestor deny overridden by descendant allow; archived ancestor; non-member of the workspace
  - _Requirements: 18.2_
- [ ] 3.3 Write `capabilities.test.ts`
  - Assert outcomes from `ROLE_CAPABILITIES` rather than restating policy, and prove a synthetic third role works without touching `can()`
  - _Requirements: 18.9, 21.7_

- [ ] 4. Author seed fixtures
- [ ] 4.1 Write `src/model/seed.ts`
  - Deterministic IDs and a fixed `SEED_NOW`. 1 workspace, 2 spaces (Engineering public, Marketing private), 2 folders, 3 lists, 3 users (Alice admin, Bob member, Carol member), 17 tasks across all statuses
  - Per-list status sets, with Sprint 14 carrying an extra "In review" status
  - Task coverage: one overdue, one due today, one with no due date, one multi-assignee, one unassigned, one urgent, one parent with two subtasks
  - Grants: `allow` Carol on `sp-marketing`, `deny` Bob on `li-infra`, each carrying `workspaceId` and `subjectType: 'user'`
  - Memberships: Alice admin, Bob member, Carol member — all on `ws-acme`
  - _Requirements: 2.2, 3.3, 3.4, 8.1, 9.2, 9.3, 8.14, 21.2, 21.3_
- [ ] 4.2 Assert the expected visible tree per user
  - Test the exact node sets for Alice, Bob and Carol against the fixtures, so the demo guarantee is enforced by CI rather than by hand
  - _Requirements: 8.14, 18.3_
- [ ] 4.3 Add a second workspace to the **test** fixtures only
  - `ws-other` with one space and two tasks, never present in the app seed
  - _Requirements: 18.10, 21.1_

- [ ] 5. Write pure selectors with tests
- [ ] 5.1 Tree and container selectors
  - `selectVisibleTree`, `selectBreadcrumb`, `selectChildren`, `selectFirstVisibleList` — permission-filtered, archive-filtered, position-sorted
  - Every collection selector takes a `{ workspaceId, userId }` scope; none reads `activeWorkspaceId` internally
  - _Requirements: 1.6, 6.1, 6.4, 8.8, 21.2_
- [ ] 5.2 Task and status selectors
  - `selectTasksForList`, `selectBoardColumns` (grouped by status, sorted by position), `selectTaskRows` (top-level with nested subtasks), `selectStatusesForList`, `selectSortedTasks`, `selectPaginatedTasks`
  - Sorting reads `PRIORITY_CONFIG[p].rank` rather than a hand-written priority order
  - _Requirements: 3.5, 4.1, 5.1, 5.3, 5.4, 5.7, 9.12, 18.3, 21.6_
- [ ] 5.3 Write `workspaceScope.test.ts`
  - Using the two-workspace fixture, assert no `ws-acme` selector returns a `ws-other` entity and that `canView` rejects a cross-workspace node
  - _Requirements: 18.10, 21.1, 21.2_

---

## Phase 2 — Controller layer

- [ ] 6. Build the adapters, store and mutation pipeline
- [ ] 6.1 Write the adapter interfaces and implementations
  - `adapters/persistence/types.ts` — `PersistenceAdapter` with async `load`/`save`/`clear`; async even though `localStorage` is not, because a sync signature cannot later become async without changing every caller
  - `adapters/persistence/localStorage.ts` — serialize, deserialize, shape validation, version guard with seed fallback
  - `adapters/persistence/memory.ts` — for tests
  - _Requirements: 9.11, 21.10_
- [ ] 6.1.1 Write `adapters/transport/simulated.ts` behind a `Transport` interface
  - `SimulationSettings` (defaults: 120–380ms jitter, `failureRate: 0`, `failNext: false`), a `NETWORK` error on trigger, a settings subscription the dev panel drives, and a zero-latency test mode
  - Controller actions call `transport.run(...)` and contain no transport-specific logic
  - _Requirements: 9.6, 9.7, 9.9, 18.8, 21.11_
- [ ] 6.2 Write `src/controllers/pipeline.ts`
  - The shared `validate → authorize → [snapshot] → apply → transport → result` runner, plus `snapshot`/`restore` helpers scoped to affected slices
  - `authorize` takes a `Scope`, so no action resolves the current workspace or user itself
  - _Requirements: 9.5, 9.10, 10.6, 21.2_
- [ ] 6.3 Compose the Zustand store with `immer` and `persist`
  - `createFlowboardStore({ persistence, transport, initialState? })` — adapters injected, never imported inside slices
  - Versioned key `flowboard:v1`, `partialize` excluding actions and transient flags, `migrate` falling back to seed on mismatch, and a `resetToSeed` action
  - _Requirements: 9.1, 9.4, 9.11, 21.10, 21.11_
- [ ] 6.4 Write `persistence.test.ts`
  - Build the store on `memoryAdapter` and prove no coupling to `localStorage`
  - _Requirements: 18.11, 21.10_

- [ ] 7. Implement the store slices
- [ ] 7.1 `sessionSlice` — `currentUserId`, `switchUser`, first-load and per-list loading flags
  - _Requirements: 8.2, 8.3, 14.1, 14.2_
- [ ] 7.2 `containerSlice` — `createContainer`, `renameContainer`, `archiveContainer` (cascading), `unarchiveContainer`, `reorderContainer`, `moveContainer`
  - All admin-only via `can()`; all returning `Result`
  - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8, 8.9, 8.11_
- [ ] 7.3 `taskSlice` — `createTask`, `updateTask`, `deleteTask` (cascading to subtasks), `changeStatus`, `reorderTask`, `moveTaskToList` (with status remapping by category and subtask co-move), `toggleComplete`, `createSubtask`
  - Bump `updatedAt` on every success
  - _Requirements: 2.3, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12_
- [ ] 7.4 `statusSlice` — per-list status CRUD and reorder, guarding the minimum one-per-category invariant
  - _Requirements: 3.1, 3.2, 3.3_
- [ ] 7.5 Implement optimistic `moveTask` with exact rollback
  - Snapshot the affected lists' task slices, apply immediately, restore on `NETWORK` failure
  - _Requirements: 4.8, 9.10, 14.12, 23.3_
- [ ] 7.6 Write Controller tests
  - `pipeline.test.ts`: a denied mutation returns `FORBIDDEN` and leaves state deep-equal to its snapshot
  - `taskSlice.test.ts`: cross-list move with status remapping, subtask cascade delete, `updatedAt` bump
  - `rollback.test.ts`: `failNext` during a drag restores pre-drag state exactly
  - _Requirements: 18.4, 18.5, 18.6_

- [ ] 8. Build the view-model hooks
- [ ] 8.0 `useScope` — the only reader of `activeWorkspaceId`, composed by every other hook
  - _Requirements: 21.1, 21.2_
- [ ] 8.1 `useSession`, `usePermissions`
  - _Requirements: 8.2, 8.3, 8.12_
- [ ] 8.2 `useVisibleTree`
  - _Requirements: 6.1, 6.4_
- [ ] 8.3 `useBoard`
  - Returns `{ columns, isLoading, canEdit, onMoveTask, onQuickUpdate, onCreateTask }`
  - _Requirements: 4.1, 4.4, 4.5_
- [ ] 8.4 `useTaskTable`
  - Returns `{ rows, total, hasMore, sort, isLoading, onSortChange, onLoadMore }`
  - _Requirements: 5.1, 5.2, 9.12_
- [ ] 8.5 `useTaskDrawer`
  - Returns `{ task, list, statuses, assignees, breadcrumb, fieldState, canEdit, onFieldSave, onMoveToList, onDelete }` with per-field pending/error state
  - _Requirements: 7.4, 7.7, 7.8, 7.9, 7.10_
- [ ] 8.6 `useContainerActions`
  - _Requirements: 1.4, 6.5_
- [ ] 8.7 Route every failed `Result` through `ToastContext` inside the hooks
  - Single error-surfacing path; no component repeats it
  - _Requirements: 14.4, 14.5_

---

## Phase 3 — Context layer

- [ ] 9. Implement the seven Contexts
- [ ] 9.1 `ToastContext` — queue, `push`, `dismiss`, auto-dismiss timeout, optional retry action, polite live region
  - _Requirements: 12.2, 14.4, 14.6, 17.6_
- [ ] 9.2 `DensityContext` — comfortable/compact, persisted, applied via `data-density` on the shell
  - _Requirements: 12.2, 16.3_
- [ ] 9.3 `NavigationContext` — `selectedListId`, `view`, `openTaskId` and setters; ids only, never entities
  - _Requirements: 12.2, 12.6, 6.3_
- [ ] 9.4 `ConfirmContext` — promise-based `confirm(opts)` backed by `ConfirmDialog`
  - _Requirements: 12.2, 14.9_
- [ ] 9.5 `SimulationContext` — settings, setters, `failNext()`, publishing to the transport
  - _Requirements: 9.7, 9.8, 12.2_
- [ ] 9.6 `SidebarContext` — `collapsed`, `width`, `expandedIds`, togglers, session-persisted
  - _Requirements: 6.2, 6.6, 12.2, 16.2_
- [ ] 9.7 `ViewportContext` — `breakpoint`, `isAtLeast(token)`, `hasFinePointer`
  - Built from `matchMedia` queries using the `rem` tokens in `src/config/breakpoints.ts`, so JS and CSS agree on breakpoint positions
  - Used only for the three structural swaps (board snap vs columns, list cards vs table, drawer sheet vs panel); anything achievable with Tailwind variants stays in CSS
  - _Requirements: 12.2, 12.7, 20.5, 20.6, 20.7_
- [ ] 9.8 Apply the shared Context rules and compose `AppProviders`
  - Typed `useX()` hook per Context that throws outside its provider, `useMemo`-wrapped values, one explicit provider composition
  - _Requirements: 12.3, 12.4, 12.5_

---

## Phase 4 — Design system and Storybook

- [ ] 10. Build the primitives in `src/components/ui`
- [ ] 10.1 Core controls — `Button`, `IconButton`, `Input`, `Textarea`, `Checkbox`, `SegmentedControl`
  - Typed variant lookup records; `IconButton` requires `label`; visible hover/focus-visible/active/disabled states; `loading` where relevant
  - Hover-dependent styling uses the `can-hover` variant, never bare `hover:` for anything that reveals functionality
  - Every size variant meets `2.75rem` on coarse pointers; the `sm` size is offered only where a fine pointer is present
  - Font size `0.875rem` input minimum, so iOS does not zoom the viewport on focus
  - _Requirements: 11.1, 11.2, 11.3, 11.5, 11.9, 13.11, 14.8, 17.1, 20.9, 20.10, 22.1_
- [ ] 10.2 Headless UI wrappers — `Select`, `Menu`, `Dialog`, `ConfirmDialog`, `Drawer`, `Sheet`, `Tooltip`
  - Focus trap, Escape, focus restore, ARIA wiring inherited from Headless UI
  - `Drawer` takes a `side` of `'right' | 'bottom'` so the same component serves the desktop panel and the mobile sheet; `Sheet` is the bottom preset with `max-h-[92dvh]` and a drag-to-dismiss affordance
  - `Menu` and `Select` panels are width-constrained in `rem` and flip to a sheet below `40rem`, since a dropdown anchored near a screen edge is unusable on a phone
  - `Tooltip` suppresses itself on coarse pointers, where it would either never fire or fire on tap and block the tap
  - _Requirements: 11.2, 13.10, 17.1, 17.2, 20.7, 20.10_
- [ ] 10.3 Domain-token displays — `Badge`, `StatusPill`, `PriorityBadge`, `DueDateChip`, `Avatar`, `AvatarGroup`
  - Token-only colors; `DueDateChip` resolves overdue/today tone internally; color always paired with a label or icon
  - _Requirements: 3.6, 11.2, 13.6, 15.8, 17.7_
- [ ] 10.4 Feedback and layout — `Skeleton`, `EmptyState`, `Toast`, `Spinner`, `Card`, `Kbd`, `Separator`, `ScrollShadow`
  - `Skeleton` variants sized to the real layouts they stand in for; `Card` carries `interactive`/`elevated`/`selected`/`dragging`
  - _Requirements: 11.2, 14.1, 14.3, 15.1_
- [ ] 10.5 Encode the spacing contract into the primitives
  - Per-surface padding driven by the primitive, the breakpoint and the density variant — not by per-instance utilities at call sites
  - Mobile base values from the spacing table, including `h-11` tree and menu items for touch
  - Density clamped to comfortable below `md`
  - _Requirements: 13.8, 13.9, 16.3, 20.9_
- [ ] 10.6 Verify the primitives use no arbitrary `px` values
  - Every dimension comes from the Tailwind scale or a `--size-*` token; run the 1.8 guard against `src/components/ui`
  - _Requirements: 22.1, 22.2, 22.3_

- [ ] 11. Set up Storybook
- [ ] 11.1 Install and configure `storybook@10.6.2` with `@storybook/react-vite@10.6.2`
  - Reuse the app's Vite config so `@tailwindcss/vite` is active; import `src/index.css` in `preview.ts`; add the `storybook` script
  - _Requirements: 11.6_
- [ ] 11.1.1 Register viewport presets matching the breakpoint tokens
  - `base` (`20rem`), `sm` (`40rem`), `md` (`48rem`), `lg` (`64rem`), `xl` (`80rem`), sourced from `src/config/breakpoints.ts` so Storybook, CSS and `ViewportContext` share one definition
  - _Requirements: 20.3, 20.14_
- [ ] 11.2 Write a story per primitive covering variants, sizes and disabled/loading/error states
  - _Requirements: 11.7_
- [ ] 11.3 Write fixture-driven composite stories
  - `TaskCard`, `KanbanColumn`, `SidebarTree`, `TaskDrawer`, `EmptyState`, wrapped in `AppProviders` with a seeded store
  - _Requirements: 11.8_
- [ ] 11.4 Add responsive stories for every surface that changes shape
  - Board, list view, drawer, sidebar and top bar at base and at `md`, so responsive behaviour is reviewable per component rather than only in the assembled app
  - _Requirements: 20.14_

---

## Phase 5 — App chrome

- [ ] 12. Build the shell
- [ ] 12.1 `AppShell`
  - `h-dvh overflow-hidden` with independent scroll regions; `data-density` attribute; page itself never scrolls
  - `h-dvh` rather than `h-screen`, so mobile browser chrome does not push fixed affordances out of view
  - Safe-area padding on any bottom-anchored element
  - Single-pane at base, sidebar + content from `lg`
  - _Requirements: 13.7, 16.1, 20.12, 20.13_
- [ ] 12.2 `TopBar` in a single `h-topbar` row
  - Base: menu button, truncated list name, search icon, user avatar; `ViewSwitcher` and `DevPanel` in an overflow menu
  - `md`: adds the inline `ViewSwitcher`
  - `lg`: full row with breadcrumbs, `ViewSwitcher`, search, `DevPanel`, `UserSwitcher`
  - _Requirements: 13.7, 16.4, 20.4_
- [ ] 12.3 `UserSwitcher`
  - Avatar, name and role for the current user; switching re-evaluates the tree, board, table and drawer with no reload
  - _Requirements: 8.2, 8.3, 8.14_
- [ ] 12.4 `DevPanel`
  - Latency range, failure probability, "fail next operation", and "reset to seed"
  - _Requirements: 9.8, 9.11_
- [ ] 12.5 `Breadcrumbs` with truncation and tooltips
  - Current list name only at base, last two segments at `md`, full path at `lg`
  - _Requirements: 16.6, 20.4_

- [ ] 13. Build the sidebar
- [ ] 13.1 `SidebarTree` and `TreeItem`
  - Recursive render from `useVisibleTree`; active list marked; tree ARIA semantics with expanded/selected state
  - _Requirements: 6.1, 6.3, 6.4, 17.3_
- [ ] 13.2 Expand/collapse persistence across selection and user switching
  - _Requirements: 6.2_
- [ ] 13.3 Per-row context menu
  - Rename, create child, archive — each disabled with a reason when the capability check fails
  - _Requirements: 6.5, 8.9, 8.11_
- [ ] 13.4 Collapse-to-rail and drag-to-resize at `lg` and above
  - Both persisted; the resizer's live width is the second documented inline-`style` exception
  - The resizer writes `rem` (`${px / 16}rem`), clamped between `--size-sidebar-min` and `--size-sidebar-max`, so even the one dynamic dimension obeys the unit rule
  - _Requirements: 6.6, 13.4, 16.2, 22.1, 22.3_
- [ ] 13.4.1 Off-canvas sidebar below `lg`
  - Slide-over built on the `Drawer` primitive, opened from the top-bar menu button, closing on selection, Escape and overlay tap; focus trapped while open and restored on close
  - Tree rows at `h-11` for touch
  - _Requirements: 20.4, 20.9, 17.2_
- [ ] 13.5 Keyboard navigation — arrows to move and expand/collapse, Enter to select
  - _Requirements: 6.7, 17.1_
- [ ] 13.6 Container reorder and reparent by drag and drop
  - Valid-parent and cyclic-move checks enforced in the Controller, with drop targets reflecting validity
  - _Requirements: 1.7, 1.8, 1.9_
- [ ] 13.7 Inline hint for a space or folder with no visible children
  - _Requirements: 6.8_
- [ ] 13.8 Tree skeleton on first load
  - _Requirements: 14.1_

---

## Phase 6 — Views

- [ ] 14. Build the kanban board
- [ ] 14.1 `KanbanBoard` and `KanbanColumn`
  - One column per list status in position order; per-column vertical scroll with sticky headers
  - Base: one column at a time, `w-column-mobile snap-center` inside `snap-x snap-mandatory`, with a pager indicator showing position in the column set
  - `md` and above: `w-column` columns side by side with horizontal board scroll
  - _Requirements: 4.1, 4.10, 16.5, 20.5_
- [ ] 14.2 Column headers — color indicator, name, count, add-task affordance
  - _Requirements: 4.2_
- [ ] 14.3 `TaskCard`
  - Title (2-line clamp + tooltip), priority indicator, assignee avatars, due date, subtask count
  - _Requirements: 4.3, 15.9, 16.6_
- [ ] 14.4 Card interactions
  - Hover elevation; reveal of secondary affordances via `can-hover:group-hover` and `can-hover:group-focus-within`, so coarse pointers get them persistently visible instead of unreachable
  - Body click opens the drawer with `stopPropagation` on interactive children; inline complete checkbox at `2.75rem` on touch
  - _Requirements: 15.1, 15.4, 15.7, 20.9, 20.10_
- [ ] 14.5 Card overflow quick-action menu
  - Open, change status, change priority, assign, set due date, move to list, duplicate, delete — all applied inline, all permission-checked, all also present in the drawer
  - _Requirements: 15.2, 15.3, 15.10_
- [ ] 14.6 Card keyboard operability
  - Focusable, Enter opens, overflow menu reachable without a pointer
  - _Requirements: 15.5, 17.1_
- [ ] 14.7 Wire `DndContext` with pointer, touch and keyboard sensors
  - `PointerSensor` at 8px activation distance so clicks are not swallowed; `TouchSensor` at 200ms delay and 8px tolerance so swipes scroll and page rather than drag; `KeyboardSensor` with sortable coordinates
  - `SortableContext` per column; `useDroppable` per column for cross-column moves
  - Annotate the two numeric thresholds as documented `px` exceptions
  - _Requirements: 4.4, 4.5, 4.11, 20.8, 22.4, 22.5_
- [ ] 14.7.1 Verify touch drag against mobile column paging
  - Confirm a vertical swipe scrolls, a horizontal swipe pages columns, and only a long press starts a drag
  - Confirm status change and reorder are both reachable without dragging, from the card menu and the drawer
  - _Requirements: 20.8_
- [ ] 14.8 Drag visuals
  - `DragOverlay` with a tilted elevated clone, subdued same-size placeholder in the source slot, highlighted drop-target column and insertion point
  - _Requirements: 4.6, 15.6_
- [ ] 14.9 Drop handling and cancellation
  - Compute target status and fractional position from drop-index neighbours; Escape or an invalid drop mutates nothing
  - _Requirements: 4.4, 4.5, 4.7_
- [ ] 14.10 Optimistic apply with visible rollback and error toast
  - _Requirements: 4.8, 14.12, 23.3_
- [ ] 14.11 Empty columns that are also valid drop targets
  - _Requirements: 4.9_
- [ ] 14.12 dnd-kit live-region announcements for pick-up, over and drop
  - _Requirements: 4.11, 17.5_
- [ ] 14.13 Board column skeletons on first load and list switch
  - _Requirements: 14.1, 14.2_

- [ ] 15. Build the list view
- [ ] 15.1 `TaskTable` and `TaskRow` with real table semantics, from `md` upward
  - Title, status, assignees, priority, due date; sticky header; flexible title column, content-width remainder
  - _Requirements: 5.1, 5.6, 16.7, 17.4_
- [ ] 15.1.1 `TaskCardList` — the base-viewport form of the list view
  - Stacked cards showing title, status, priority, due date and assignees; same drawer on tap; same sort options
  - Selected via `ViewportContext` rather than by rendering both forms and hiding one
  - _Requirements: 20.6_
- [ ] 15.2 Sorting by due date and priority
  - Both directions, active column and direction indicated, ranking from `PRIORITY_CONFIG[p].rank`, null due dates always last, sort direction exposed to assistive technology
  - Table headers at `md` and above; a sort dropdown at base, exposing the identical option set
  - _Requirements: 5.2, 5.3, 5.4, 17.4, 20.6, 21.6_
- [ ] 15.3 Row click opens the task drawer
  - _Requirements: 5.5_
- [ ] 15.4 Nested subtask rows with a disclosure control, excluded from the top level
  - _Requirements: 5.7_
- [ ] 15.5 Shared status and priority tokens with the board
  - _Requirements: 5.8, 13.6_
- [ ] 15.6 Empty state with a primary create-task action
  - _Requirements: 5.9, 14.3_
- [ ] 15.7 Simulated offset pagination with a load-more control
  - _Requirements: 9.12_

- [ ] 16. Build the task drawer
- [ ] 16.1 `TaskDrawer` on the Headless UI `Dialog` primitive
  - Closes on Escape, overlay click and explicit button; focus moves in, is trapped, and returns to the trigger
  - Full-height bottom sheet at base (`max-h-[92dvh]`, drag-to-dismiss, safe-area padding), right-side panel at `md` (`w-drawer`) and `xl` (`w-drawer-xl`)
  - Identical content, field behaviour and close affordances in both forms
  - _Requirements: 7.1, 7.2, 7.3, 17.2, 20.7, 20.12_
- [ ] 16.2 `PropertyRow` label/value grid with uniform row height and spacing
  - _Requirements: 7.6, 13.8_
- [ ] 16.3 Inline title and description editing
  - Save on blur and ⌘/Ctrl+Enter; Escape reverts the focused field rather than closing the drawer
  - _Requirements: 7.4, 7.5_
- [ ] 16.4 Property controls — `StatusPicker`, `PriorityPicker`, `AssigneePicker`, `DueDatePicker`
  - Status options restricted to the task's list status set
  - _Requirements: 2.5, 3.5, 7.4_
- [ ] 16.5 Per-field pending indicator and revert-with-toast on failure
  - _Requirements: 7.7, 14.7_
- [ ] 16.6 Read-only metadata — breadcrumb path, created and updated timestamps
  - _Requirements: 7.8_
- [ ] 16.7 Move-to-list action limited to lists the user can edit, surfacing status remapping when it occurs
  - _Requirements: 2.6, 7.9_
- [ ] 16.8 `SubtaskList` — create, toggle, open, delete, depth-1 enforced
  - _Requirements: 2.11, 2.12_
- [ ] 16.9 Read-only drawer state when the user lacks `task:update`, with an explanatory note
  - _Requirements: 7.10, 8.12_
- [ ] 16.10 Previous/next task keyboard navigation within the current view
  - _Requirements: 7.11_
- [ ] 16.11 Enter/exit transition under 200ms, wrapped in `motion-safe:`
  - _Requirements: 7.12, 14.11_

---

## Phase 7 — Cross-cutting polish

- [ ] 17. Permission UX
- [ ] 17.1 `PermissionDeniedState` for a selected list that is no longer visible
  - Offers navigation to a list the current user can see; closes a drawer open on a now-denied task
  - _Requirements: 8.13_
- [ ] 17.2 Disable rather than hide capability-gated affordances, with a stated reason
  - Reason shown on hover where available and as inline helper text on coarse pointers, so it is never hover-only
  - _Requirements: 8.11, 8.12, 20.10_
- [ ] 17.3 Distinguish permission-denied toasts from network-error toasts in tone and wording
  - _Requirements: 14.5_

- [ ] 18. Feedback, states and motion
- [ ] 18.1 Audit every empty surface for a distinct empty state
  - Empty list, empty column, no list selected, no search results, folder with no visible lists
  - _Requirements: 14.3, 6.8_
- [ ] 18.2 Audit loading states for layout-shift-free skeletons on first load and list switch
  - _Requirements: 14.1, 14.2_
- [ ] 18.3 Confirm destructive actions through `ConfirmContext`, naming target and cascade
  - _Requirements: 14.9, 1.5, 2.12_
- [ ] 18.4 Success toasts for non-obvious mutations only; none for inline edits
  - _Requirements: 14.10_
- [ ] 18.5 Verify hover, focus-visible, active and disabled states on every interactive element; no removed focus rings
  - _Requirements: 14.8, 17.1_
- [ ] 18.6 Normalize transition durations to 120–200ms under `motion-safe:`
  - _Requirements: 14.11_
- [ ] 18.7 Point-of-interaction pending states — in-button spinners, subdued rows and cards, no global overlay
  - _Requirements: 14.7_

- [ ] 19. Responsive, space and density pass
- [ ] 19.1 Verify independent scroll regions and that the page never scrolls vertically
  - _Requirements: 16.1_
- [ ] 19.2 Wire the density toggle through every affected surface and verify persistence
  - Confirm it is hidden below `md` and cannot reduce a touch target below `2.75rem`
  - _Requirements: 16.3, 20.9_
- [ ] 19.3 Audit truncation and tooltips across tree, breadcrumbs, cards and table cells
  - Confirm the full value is reachable without hover on coarse pointers
  - _Requirements: 16.6, 20.10_
- [ ] 19.4 Progressively disclose secondary metadata rather than permanently occupying space
  - _Requirements: 16.8_
- [ ] 19.5 Audit for mobile-first authoring, not just mobile-working
  - Grep for `max-w`/`max-h` breakpoint variants and for any surface whose unprefixed classes describe the desktop layout; fix by inverting the class order rather than adding overrides
  - _Requirements: 20.1_
- [ ] 19.6 Walk every surface at each breakpoint
  - `20rem`, `40rem`, `48rem`, `64rem`, `120rem` — sidebar, top bar, board, list view, drawer, menus, dialogs, toasts, empty states, skeletons
  - No horizontal page scroll, no clipped or overlapping content, no unreachable affordance at any width
  - _Requirements: 20.2, 20.4, 20.5, 20.6, 20.7, 16.9_
- [ ] 19.7 Verify touch targets across the app
  - Every interactive target at least `2.75rem` in both dimensions on coarse pointers, including tree rows, menu items, card checkboxes, pager dots and icon buttons
  - _Requirements: 20.9_
- [ ] 19.8 Verify no interaction depends on hover
  - Every `can-hover`-gated affordance has a coarse-pointer equivalent that is visible or one tap away
  - _Requirements: 20.10, 15.10_
- [ ] 19.9 Verify the layout at a 150% root font size
  - No clipping or overlap, and the breakpoint the layout receives shifts as expected because breakpoints are `rem`
  - _Requirements: 20.11, 22.6_
- [ ] 19.10 Verify safe-area insets and dynamic viewport sizing
  - Bottom-anchored affordances clear notches and home indicators; no fixed element sits under mobile browser chrome
  - _Requirements: 20.12, 20.13_

- [ ] 20. Accessibility pass
- [ ] 20.1 Verify tab order and accessible names on all icon-only controls
  - _Requirements: 17.1_
- [ ] 20.2 Verify tree and table semantics with expanded/selected and sort state exposed
  - _Requirements: 17.3, 17.4_
- [ ] 20.3 Verify drag announcements and toast live region
  - _Requirements: 17.5, 17.6_
- [ ] 20.4 Check AA contrast on tokens and confirm no status or priority is conveyed by color alone
  - _Requirements: 17.7_
- [ ] 20.5 Verify the off-canvas sidebar and bottom sheet meet dialog expectations
  - Focus trapped while open, Escape closes, focus restored to the trigger, background content not reachable by tab
  - _Requirements: 17.2, 20.4, 20.7_

---

## Phase 8 — Stretch goals (only after everything above passes)

- [ ] 21. Client-side task search
  - Debounced input over title and description, scoped to the current user's visible tasks, results grouped by list with highlighted matches and a keyboard shortcut to focus the field
  - Full-screen overlay at base viewport, anchored panel from `md`; results list uses `2.75rem` rows on touch
  - _Requirements: 23.1, 23.2_
- [ ] 22. Confirm optimistic DnD rollback end to end
  - Already implemented in 7.5 and 14.10; verify via the dev panel's forced-failure trigger and record it as the second attempted stretch goal
  - _Requirements: 23.3, 23.4_

---

## Phase 9 — Tests and documentation

- [ ] 23. Component test
- [ ] 23.1 Render `AppShell` in `AppProviders` with a seeded store and assert the user-switch behaviour
  - As Alice the tree shows Marketing; switching to Bob removes Marketing and Infra
  - _Requirements: 18.7, 8.3_
- [ ] 23.2 Assert drawer behaviour
  - Clicking a card opens the drawer with that task's title; Escape closes it and returns focus to the card
  - _Requirements: 18.7, 7.2, 7.3_

- [ ] 24. Write the README
- [ ] 24.1 Replace the Vite boilerplate with run instructions for dev, test, lint, build and Storybook
  - _Requirements: 19.1_
- [ ] 24.2 Add the Mermaid architecture diagram and the MVC layer mapping
  - _Requirements: 10.7, 19.2_
- [ ] 24.3 Document the data model — relationships, fractional positions, archive-vs-delete strategy
  - _Requirements: 19.3_
- [ ] 24.4 Document permission enforcement and the extension path
  - Resolution algorithm, admin bypass, view/edit capability split, and how to extend to team grants, role hierarchies and field-level permissions
  - _Requirements: 8.12, 19.4_
- [ ] 24.5 Document the simulated latency and failure-injection layer and how to demo error and rollback paths
  - _Requirements: 19.5_
- [ ] 24.6 Document the `localStorage` choice, its versioned key and the reset path
  - _Requirements: 19.6_
- [ ] 24.7 Document trade-offs, what was cut, and a prioritized week-2 plan
  - _Requirements: 19.7_
- [ ] 24.8 Write the AI usage log, with the long form in `AI_USAGE.md`
  - _Requirements: 19.8_
- [ ] 24.9 List every inline `style=` exception with file location and justification
  - dnd-kit sortable transforms; sidebar resizer live width
  - _Requirements: 13.4, 19.9_
- [ ] 24.9.1 Document the `rem` unit rule
  - The rule, the four exceptions taken under 22.4 with their locations, and the repeatable verification command
  - _Requirements: 19.13, 22.5, 22.7_
- [ ] 24.9.2 Document the mobile-first approach
  - Breakpoint token set, the per-surface adaptation table, how touch drag and drop is handled, which widths were verified by hand, and that visual regression testing was not automated
  - _Requirements: 19.11, 20.14_
- [ ] 24.9.3 Write `ARCHITECTURE.md` covering every extension point
  - One section per seam: container registry, view registry, enumeration configs, capability table, grant resolver, task depth, persistence adapter, transport adapter
  - Each with the concrete steps to extend it, plus worked examples of adding a second workspace and adding a calendar view — naming the exact files each would touch
  - _Requirements: 19.12, 21.21_
- [ ] 24.10 List the design-system inventory, the Storybook pointer, and the two attempted stretch goals
  - _Requirements: 19.10, 23.4_
- [ ] 24.11 State the accessibility testing scope honestly
  - Automated checks and manual keyboard testing performed; assistive-technology testing and expert review not performed; no WCAG conformance claimed
  - _Requirements: 17.8_

- [ ] 25. Final verification
- [ ] 25.1 Run `npm run lint`, `npm run build` and `npm run test` clean
  - _Requirements: 10.5, 18.1_
- [ ] 25.2 Grep the repo to prove the styling constraints hold
  - No `.css` file other than `src/index.css`; no `styled`/`emotion`/`sass` dependencies; every `style=` occurrence is one of the two documented exceptions
  - _Requirements: 13.1, 13.2, 13.4_
- [ ] 25.3 Run the `px` audit and confirm every hit is an allowed exception
  - `rg -n '\bpx\b' src` — remaining matches must be hairline borders, shadow offsets, dnd-kit thresholds or raster intrinsic sizes, and each must be annotated in code
  - Confirm no arbitrary Tailwind value and no dimensional `@theme` token uses `px`, and that the root font size is not overridden
  - _Requirements: 22.3, 22.4, 22.7, 22.8_
- [ ] 25.4 Audit the scalability seams against the requirement, not the happy path
  - No module-level workspace singleton; no `role` field on `User`; no hierarchy `switch` outside the registry; no priority or capability set restated inline; no `localStorage` or latency reference inside a slice
  - Confirm `registry.test.ts`, `capabilities.test.ts`, `workspaceScope.test.ts` and `persistence.test.ts` all pass and genuinely exercise the synthetic fixtures
  - _Requirements: 18.9, 18.10, 18.11, 21.1, 21.2, 21.3, 21.4, 21.6, 21.7, 21.10, 21.11_
- [ ] 25.5 Audit the readability conventions
  - No `export default`, no `any`, no nested ternaries; exhaustive switches carry a `never` default; doc comments present on Model exports, design-system props, Context hooks and adapter interfaces; one vocabulary across layers
  - Confirm tests import public module surfaces only, with no reaching into internals
  - _Requirements: 21.13, 21.14, 21.15, 21.16, 21.17, 21.19, 21.22_
- [ ] 25.6 Walk the demo script end to end at desktop and at phone width
  - Tree navigation → kanban drag → card quick action → task drawer → forced failure and rollback → Alice vs Bob under 30 seconds
  - Repeat at `20rem` with touch emulation, confirming the off-canvas sidebar, column paging, bottom sheet and long-press drag
  - _Requirements: 8.14, 9.8, 20.2, 20.8_
