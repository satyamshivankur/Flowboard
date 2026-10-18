# Flowboard — Implementation Plan

Tasks are ordered so that each one builds on working code from the previous one. Config registries and the Model come first because every other layer reads from their shape, and because the permission tests are the stated test minimum. The design system lands before the feature views so views are composed from primitives rather than retrofitted onto them.

Three rules apply to every task below rather than being tasks of their own:

- **Mobile-first.** Build each surface at the base viewport first and add `md:`/`lg:` enhancements in the same task. There is a verification pass in Phase 7, but responsive behaviour is not deferred to it — a view built desktop-first and narrowed later is the outcome this ordering exists to prevent.
- **`rem` only.** Any dimension written during any task is `rem`, drawn from the Tailwind scale or the named `--spacing-*` tokens. The audit in Phase 9 is a check, not the first time units are considered.
- **Config over conditionals.** When a task needs a closed set — container types, views, priorities, capabilities — it reads the registry from `src/config` rather than restating the set inline.

Pin exact resolved versions in `package.json` after each install step rather than leaving caret ranges.

---

## Phase 0 — Scaffold and toolchain

- [x] 1. Install dependencies and strip the boilerplate
- [x] 1.1 Install runtime dependencies
  - `zustand@5.0.15`, `immer@11.1.21`, `nanoid@6.0.2`, `lucide-react@1.57.0`, `@headlessui/react@2.2.10`
  - ~~`@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2`, `@dnd-kit/modifiers@9.0.0`~~ — all four removed in task 26. The current set is `@dnd-kit/react@0.5.1`, `@dnd-kit/dom@0.5.1`, `@dnd-kit/abstract@0.5.1`, `@dnd-kit/helpers@0.5.1`
  - _Requirements: 9.1, 11.10, 13.10, 13.11_
- [x] 1.2 Install and wire Tailwind v4
  - `tailwindcss@4.3.3` + `@tailwindcss/vite@4.3.3`, register the plugin in `vite.config.ts`
  - _Requirements: 13.1, 13.2_
- [x] 1.3 Install the test toolchain
  - `vitest@5.0.5`, `@vitest/coverage-v8@5.0.5`, `jsdom@30.1.3`, `@testing-library/react@16.3.3`, `@testing-library/user-event@14.6.8`, `@testing-library/jest-dom`
  - Add `test` (single-run), `test:watch` and `coverage` scripts; create `src/test/setup.ts` with jest-dom matchers and zero simulated latency
  - _Requirements: 18.1, 18.8_
- [x] 1.4 Delete the Vite boilerplate
  - Remove `src/App.css`, `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`, `public/icons.svg`; reduce `src/App.tsx` to a shell placeholder
  - _Requirements: 13.3_
- [x] 1.5 Author `src/index.css` as the project's only stylesheet
  - Replace all boilerplate rules with `@import "tailwindcss"`, the full `@theme` token block and the custom variants
  - Tokens: neutrals, brand, semantic, five priority tokens, four status tokens, `fontFamily`, `borderRadius`, `boxShadow`
  - `rem` breakpoint tokens `--breakpoint-sm/md/lg/xl` at `40/48/64/80rem`
  - Named `--spacing-*` dimension tokens in `rem` (sidebar, rail, sidebar min/max, topbar, column, column-mobile, drawer, drawer-xl, touch-target, three icon sizes) so no component needs an arbitrary value
  - Variants: `density-compact` and `can-hover (@media (hover: hover) and (pointer: fine))`
  - Do not override the root font size
  - _Requirements: 13.2, 13.5, 13.6, 16.3, 20.3, 20.10, 22.1, 22.6, 22.8_
- [x] 1.6 Add the lint rules that enforce the architecture
  - `no-restricted-imports` zones: Model may not import React/Zustand/Controller/View; `components/ui` may not import Controller or Model state; views may import only `controllers/hooks/**`, never `controllers/store`; `src/config` may not import any other layer
  - Add rules failing on circular imports, unused exports and `export default`
  - Enable TypeScript `strict`; forbid `any` in application code
  - Also forbid the Model importing the browser (`window`, `localStorage`) or any adapter, so it stays runnable in a non-browser runtime
  - Verify the rules actually fail by introducing a deliberate violation, then reverting it
  - _Requirements: 10.1, 10.4, 10.5, 11.4, 21.12, 21.13, 21.16, 21.20_
- [x] 1.7 Add the `cn()` class-merge helper and date utilities in `src/lib`
  - _Requirements: 11.3_
- [x] 1.8 Add the `px` guard
  - A lint rule or `scripts/check-units.mjs` that fails when `px` appears in a Tailwind arbitrary value, in a dimensional `@theme` token, or in an inline `style` layout computation
  - Allow-list the four exceptions: hairline borders/rings/dividers, `box-shadow` offsets, dnd-kit sensor thresholds, raster asset intrinsic sizes
  - Wire it into the `lint` script so the rule holds continuously rather than at review time
  - _Requirements: 22.3, 22.4, 22.7_

- [x] 1.9 Author the configuration registries in `src/config`
  - These land before the Model because validation, selectors and views all read from them
- [x] 1.9.1 `containers.ts` — `ContainerTypeConfig` and `CONTAINER_REGISTRY`
  - Per type: `label`, `labelPlural`, `icon`, `childTypes`, `holdsTasks`, `grantable`; plus the `canContain(parent, child)` helper
  - _Requirements: 1.2, 21.4, 21.18_
- [x] 1.9.2 `views.ts` — `ViewMeta` and `VIEW_REGISTRY` keyed by `ViewId`
  - Metadata only. The component mapping lives in `src/views/viewComponents.ts` keyed by the same `ViewId`, because holding a component in `src/config` would invert the dependency direction and the boundary lint rejects it
  - _Requirements: 21.5_
- [x] 1.9.3 `priorities.ts` and `statusCategories.ts`
  - Each entry carries `label`, display `token`, `icon` and `rank`; `rank` is what comparators sort on
  - _Requirements: 5.3, 13.6, 21.6_
- [x] 1.9.4 `capabilities.ts` — the `Capability` union and `ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>>`
  - Includes `workspace:bypass`, so the admin bypass is a table entry rather than a role comparison
  - _Requirements: 8.9, 21.7_
- [x] 1.9.5 `breakpoints.ts` and `limits.ts`
  - `breakpoints.ts` is deliberately minimal: the `rem` values, `minWidthQuery`, and the name of the sidebar's modal boundary. Tailwind owns breakpoints for styling; this module exists only for the one behavioural check in 20.7.1
  - Parity with the `--breakpoint-*` tokens enforced by `scripts/check-units.mjs`, which fails on value drift, missing tokens in either direction, and `px`-declared breakpoints
  - `limits.ts`: `MAX_TASK_DEPTH`, `MAX_TITLE_LEN`, `MAX_NAME_LEN`, `PAGE_SIZE`, `POSITION_GAP`
  - _Requirements: 12.7, 12.8, 20.3, 21.9, 22.6_

---

## Phase 1 — Model layer (pure TypeScript, no React)

- [x] 2. Define entities and state shape
- [x] 2.1 Write `src/model/types.ts`
  - `Container`, `Status`, `Task`, `User`, `Membership`, `Grant`; the `ContainerType`, `Visibility`, `StatusCategory`, `Priority`, `Role` unions; `ErrorCode`, `AppError`, `Result<T>` with `ok`/`err` constructors; a `Scope` type of `{ workspaceId, userId }`
  - `workspaceId` on `Container`, `Task`, `Status` and `Grant`; **no** `role` field on `User` — role lives on `Membership`
  - `Grant` uses `subjectId` + `subjectType: 'user'` rather than `userId`, so team grants are a union widening
  - Doc comment on each exported interface stating its contract
  - _Requirements: 1.1, 2.2, 3.2, 8.4, 8.5, 9.1, 9.5, 21.2, 21.3, 21.19_
- [x] 2.2 Write `src/model/state.ts`
  - `FlowboardState` with normalized `Record<id, entity>` maps, `memberships` and `grants` arrays, `version`, and an empty-state factory
  - `activeWorkspaceId` plus a `workspaceIds` index — no singleton field naming "the" workspace
  - _Requirements: 9.1, 21.1, 21.2_
- [x] 2.2.1 Write `src/model/hierarchy.ts`
  - `ancestorChain`, `depthOf`, `taskDepth`, and registry-backed lookups; `taskDepth` compared against `MAX_TASK_DEPTH` rather than a `parentTaskId == null` check
  - _Requirements: 21.4, 21.9_
- [x] 2.3 Write `src/model/position.ts` with tests
  - `nextPosition(prev, next)` for head/middle/tail insertion, `needsRebalance`, `rebalance(siblings)`
  - Tests: all three insertion points, repeated midpoint insertion until the gap collapses, rebalance preserving order
  - _Requirements: 1.7, 2.9, 18.5_
- [x] 2.4 Write `src/model/validation.ts` with tests
  - Container name bounds via `MAX_NAME_LEN`, parent-type checks via `canContain` from the registry, cyclic-move rejection, task title bounds via `MAX_TITLE_LEN`, status-belongs-to-list check, subtask depth via `taskDepth` and `MAX_TASK_DEPTH`, assignee de-duplication
  - No `switch` on container type and no literal type comparisons — every hierarchy rule resolves through the registry
  - _Requirements: 1.2, 1.3, 1.9, 1.10, 2.4, 2.5, 2.11, 18.5, 21.4, 21.9_
- [x] 2.5 Write `registry.test.ts` — the extensibility proof for the hierarchy
  - Inject a synthetic container type into a test registry and assert that validation, reorder and move logic handle it with no production-code change
  - _Requirements: 18.9, 21.4_

- [x] 3. Build the permission engine
- [x] 3.1 Write `src/model/permissions.ts`
  - `roleOf(state, workspaceId, userId)` resolving through `memberships` — never a field on `User`
  - `resolveGrant(state, resourceId, userId)` as the single grant seam, built on a `subjectsOf` lookup that today returns `[userId]`, preferring `deny` among multiple matches
  - `canView(state, scope, nodeId)`: bypass via `ROLE_CAPABILITIES[role].has('workspace:bypass')` → reject cross-workspace nodes → walk the chain → `private` resets → nearest grant wins → archived denies
  - `canViewTask`, and `can(state, scope, capability, resourceId)` reading the capability table with no role-specific branches
  - _Requirements: 8.5, 8.6, 8.7, 8.8, 8.9, 8.12, 21.3, 21.7, 21.8_
- [x] 3.2 Write `permissions.test.ts` covering the full resolution table
  - Admin bypass; public chain no grants; private without grant; private with allow; allow inherited by subtree; ancestor deny; ancestor deny overridden by descendant allow; archived ancestor; non-member of the workspace
  - _Requirements: 18.2_
- [x] 3.3 Write `capabilities.test.ts`
  - Assert outcomes from `ROLE_CAPABILITIES` rather than restating policy, and prove a synthetic third role works without touching `can()`
  - _Requirements: 18.9, 21.7_

- [x] 4. Author seed fixtures
- [x] 4.1 Write `src/model/seed.ts`
  - Deterministic IDs and a fixed `SEED_NOW`. 1 workspace, 2 spaces (Engineering public, Marketing private), 2 folders, 3 lists, 3 users (Alice admin, Bob member, Carol member), 17 tasks across all statuses
  - Per-list status sets, with Sprint 14 carrying an extra "In review" status
  - Task coverage: one overdue, one due today, one with no due date, one multi-assignee, one unassigned, one urgent, one parent with two subtasks
  - Grants: `allow` Carol on `sp-marketing`, `deny` Bob on `li-infra`, each carrying `workspaceId` and `subjectType: 'user'`
  - Memberships: Alice admin, Bob member, Carol member — all on `ws-acme`
  - _Requirements: 2.2, 3.3, 3.4, 8.1, 9.2, 9.3, 8.14, 21.2, 21.3_
- [x] 4.2 Assert the expected visible tree per user
  - Test the exact node sets for Alice, Bob and Carol against the fixtures, so the demo guarantee is enforced by CI rather than by hand
  - _Requirements: 8.14, 18.3_
- [x] 4.3 Add a second workspace to the **test** fixtures only
  - `ws-other` with one space and two tasks, never present in the app seed
  - _Requirements: 18.10, 21.1_

- [x] 5. Write pure selectors with tests
- [x] 5.1 Tree and container selectors
  - `selectVisibleTree`, `selectBreadcrumb`, `selectChildren`, `selectFirstVisibleList` — permission-filtered, archive-filtered, position-sorted
  - Every collection selector takes a `{ workspaceId, userId }` scope; none reads `activeWorkspaceId` internally
  - _Requirements: 1.6, 6.1, 6.4, 8.8, 21.2_
- [x] 5.2 Task and status selectors
  - `selectTasksForList`, `selectBoardColumns` (grouped by status, sorted by position), `selectTaskRows` (top-level with nested subtasks), `selectStatusesForList`, `selectSortedTasks`, `selectPaginatedTasks`
  - Sorting reads `PRIORITY_CONFIG[p].rank` rather than a hand-written priority order
  - _Requirements: 3.5, 4.1, 5.1, 5.3, 5.4, 5.7, 9.12, 18.3, 21.6_
- [x] 5.3 Write `workspaceScope.test.ts`
  - Using the two-workspace fixture, assert no `ws-acme` selector returns a `ws-other` entity and that `canView` rejects a cross-workspace node
  - _Requirements: 18.10, 21.1, 21.2_

---

## Phase 2 — Controller layer

- [x] 6. Build the adapters, store and mutation pipeline
- [x] 6.1 Write the adapter interfaces and implementations
  - `adapters/persistence/types.ts` — `PersistenceAdapter` with async `load`/`save`/`clear`; async even though `localStorage` is not, because a sync signature cannot later become async without changing every caller
  - `adapters/persistence/localStorage.ts` — serialize, deserialize, shape validation, version guard with seed fallback
  - `adapters/persistence/memory.ts` — for tests
  - _Requirements: 9.11, 21.10_
- [x] 6.1.1 Write `adapters/transport/simulated.ts` behind a `Transport` interface
  - `SimulationSettings` (defaults: 120–380ms jitter, `failureRate: 0`, `failNext: false`), a `NETWORK` error on trigger, a settings subscription the dev panel drives, and a zero-latency test mode
  - Controller actions call `transport.run(...)` and contain no transport-specific logic
  - _Requirements: 9.6, 9.7, 9.9, 18.8, 21.11_
- [x] 6.2 Write `src/controllers/pipeline.ts`
  - The shared `validate → authorize → [snapshot] → apply → transport → result` runner, plus `snapshot`/`restore` helpers scoped to affected slices
  - `authorize` takes a `Scope`, so no action resolves the current workspace or user itself
  - _Requirements: 9.5, 9.10, 10.6, 21.2_
- [x] 6.3 Compose the Zustand store with `immer` and `persist`
  - `createFlowboardStore({ persistence, transport, initialState? })` — adapters injected, never imported inside slices
  - Versioned key `flowboard:v1`, `partialize` excluding actions and transient flags, `migrate` falling back to seed on mismatch, and a `resetToSeed` action
  - _Requirements: 9.1, 9.4, 9.11, 21.10, 21.11_
- [x] 6.4 Write `persistence.test.ts`
  - Build the store on `memoryAdapter` and prove no coupling to `localStorage`
  - _Requirements: 18.11, 21.10_

- [x] 7. Implement the store slices
- [x] 7.1 `sessionSlice` — `currentUserId`, `switchUser`, first-load and per-list loading flags
  - _Requirements: 8.2, 8.3, 14.1, 14.2_
- [x] 7.2 `containerSlice` — `createContainer`, `renameContainer`, `archiveContainer` (cascading), `unarchiveContainer`, `reorderContainer`, `moveContainer`
  - All admin-only via `can()`; all returning `Result`
  - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8, 8.9, 8.11_
- [x] 7.3 `taskSlice` — `createTask`, `updateTask`, `deleteTask` (cascading to subtasks), `changeStatus`, `reorderTask`, `moveTaskToList` (with status remapping by category and subtask co-move), `toggleComplete`, `createSubtask`
  - Bump `updatedAt` on every success
  - _Requirements: 2.3, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12_
- [x] 7.4 `statusSlice` — per-list status CRUD and reorder, guarding the minimum one-per-category invariant
  - _Requirements: 3.1, 3.2, 3.3_
- [x] 7.5 Implement optimistic `moveTask` with exact rollback
  - Snapshot the affected lists' task slices, apply immediately, restore on `NETWORK` failure
  - _Requirements: 4.8, 9.10, 14.12, 23.3_
- [x] 7.6 Write Controller tests
  - `pipeline.test.ts`: a denied mutation returns `FORBIDDEN` and leaves state deep-equal to its snapshot
  - `taskSlice.test.ts`: cross-list move with status remapping, subtask cascade delete, `updatedAt` bump
  - `rollback.test.ts`: `failNext` during a drag restores pre-drag state exactly
  - _Requirements: 18.4, 18.5, 18.6_

- [x] 8. Build the view-model hooks
- [x] 8.0 `useScope` — the only reader of `activeWorkspaceId`, composed by every other hook
  - _Requirements: 21.1, 21.2_
- [x] 8.1 `useSession`, `usePermissions`
  - _Requirements: 8.2, 8.3, 8.12_
- [x] 8.2 `useVisibleTree`
  - _Requirements: 6.1, 6.4_
- [x] 8.3 `useBoard`
  - Returns `{ columns, isLoading, canEdit, onMoveTask, onQuickUpdate, onCreateTask }`
  - _Requirements: 4.1, 4.4, 4.5_
- [x] 8.4 `useTaskTable`
  - Returns `{ rows, total, hasMore, sort, isLoading, onSortChange, onLoadMore }`
  - _Requirements: 5.1, 5.2, 9.12_
- [x] 8.5 `useTaskDrawer`
  - Returns `{ task, list, statuses, assignees, breadcrumb, fieldState, canEdit, onFieldSave, onMoveToList, onDelete }` with per-field pending/error state
  - _Requirements: 7.4, 7.7, 7.8, 7.9, 7.10_
- [x] 8.6 `useContainerActions`
  - _Requirements: 1.4, 6.5_
- [x] 8.7 Route every failed `Result` through `ToastContext` inside the hooks
  - Single error-surfacing path; no component repeats it
  - Delivered in Phase 3 as `controllers/hooks/useAction`, once `ToastContext` existed. `run(operation, options)` turns any failed `Result` into a toast, offers retry only for retryable errors, and still returns the `Result` so a caller that needs to branch on success can
  - This is the one permitted Controller → Context edge; the boundary lint forbids the reverse, so no cycle can form
  - _Requirements: 14.4, 14.5_

---

## Phase 3 — Context layer

- [x] 9. Implement the seven Contexts
- [x] 9.1 `ToastContext` — queue, `push`, `dismiss`, auto-dismiss timeout, optional retry action, polite live region
  - _Requirements: 12.2, 14.4, 14.6, 17.6_
- [x] 9.2 `DensityContext` — comfortable/compact, persisted, applied via `data-density` on the shell
  - _Requirements: 12.2, 16.3_
- [x] 9.3 `NavigationContext` — `selectedListId`, `view`, `openTaskId` and setters; ids only, never entities
  - _Requirements: 12.2, 12.6, 6.3_
- [x] 9.4 `ConfirmContext` — promise-based `confirm(opts)` backed by `ConfirmDialog`
  - _Requirements: 12.2, 14.9_
- [x] 9.5 `SimulationContext` — settings, setters, `failNext()`, publishing to the transport
  - _Requirements: 9.7, 9.8, 12.2_
- [x] 9.6 `SidebarContext` — `collapsed`, `width`, `expandedIds`, togglers, session-persisted
  - _Requirements: 6.2, 6.6, 12.2, 16.2_
- [x] 9.6.1 Add `createSafeContext` and the UI-preference helper
  - One factory producing a Provider plus a typed hook that throws outside it, so the rule in 12.3 is structural rather than restated six times
  - `lib/uiStorage` for density, the sidebar's collapsed state and the active view — deliberately separate from `PersistenceAdapter`, which carries domain state. Losing a preference is an annoyance, not data loss, so every failure path there degrades silently
  - A `sidebarWidth` preference was here too, until task 27 removed the resize handle it fed
  - _Requirements: 12.3, 16.2, 16.3_
- [x] 9.7 Add the sidebar's modal/static boundary to `SidebarContext`
  - An `isModal` flag from a single `matchMedia(minWidthQuery('lg'))` subscription, closing the sheet when the boundary is crossed so it cannot persist as an invisible focus trap
  - This is the only JavaScript breakpoint observation in the app. The board, list view, drawer, dnd-kit sensors, tooltips and density toggle are all handled by Tailwind variants — confirm each stays that way rather than reaching for this flag
  - _Requirements: 12.7, 20.7.1_
- [x] 9.8 Apply the shared Context rules and compose `AppProviders`
  - Typed `useX()` hook per Context that throws outside its provider, `useMemo`-wrapped values, one explicit provider composition
  - _Requirements: 12.3, 12.4, 12.5_

---

## Phase 4 — Design system and Storybook

- [x] 10. Build the primitives in `src/components/ui`
- [x] 10.1 Core controls — `Button`, `IconButton`, `Input`, `Textarea`, `Checkbox`, `SegmentedControl`
  - Typed variant lookup records; `IconButton` requires `label`; visible hover/focus-visible/active/disabled states; `loading` where relevant
  - Hover-dependent styling uses the `can-hover` variant, never bare `hover:` for anything that reveals functionality
  - Every size variant meets `2.75rem` on coarse pointers; the `sm` size is offered only where a fine pointer is present
  - Font size `0.875rem` input minimum, so iOS does not zoom the viewport on focus
  - _Requirements: 11.1, 11.2, 11.3, 11.5, 11.9, 13.11, 14.8, 17.1, 20.9, 20.10, 22.1_
- [x] 10.2 Headless UI wrappers — `Select`, `Menu`, `Dialog`, `ConfirmDialog`, `Drawer`, `Tooltip`
  - `Sheet` was dropped as a separate component: it is `Drawer` with `side="bottom"`, and `side="right"` already renders as a bottom sheet below `md`. A second component would have been the same element with different defaults
  - Focus trap, Escape, focus restore, ARIA wiring inherited from Headless UI
  - `Drawer` takes a `side` of `'right' | 'bottom'` so the same component serves the desktop panel and the mobile sheet; `Sheet` is the bottom preset with `max-h-[92dvh]` and a drag-to-dismiss affordance
  - Drag-to-dismiss landed with Phase 6, since the task drawer is its only real consumer. The grab handle carries `md:hidden`, so above `md` it is not in the layout and the pointer handlers cannot fire — the gesture is gated by the same CSS that chooses sheet versus panel, with no viewport check in JavaScript. The handle is deliberately not focusable: Escape and the caller's own close control already serve the keyboard, and a focusable handle would take initial focus since Headless UI focuses the first focusable element in the panel
  - `Menu` and `Select` panels are width-constrained in `rem` and flip to a sheet below `40rem`, since a dropdown anchored near a screen edge is unusable on a phone
  - `Tooltip` suppresses itself on coarse pointers, where it would either never fire or fire on tap and block the tap
  - _Requirements: 11.2, 13.10, 17.1, 17.2, 20.7, 20.10_
- [x] 10.3 Domain-token displays — `Badge`, `StatusPill`, `PriorityBadge`, `DueDateChip`, `Avatar`, `AvatarGroup`
  - Token-only colors; `DueDateChip` resolves overdue/today tone internally; color always paired with a label or icon
  - _Requirements: 3.6, 11.2, 13.6, 15.8, 17.7_
- [x] 10.4 Feedback and layout — `Skeleton`, `EmptyState`, `Toast`, `Spinner`, `Card`, `Kbd`, `Separator`, `ScrollShadow`
  - `Skeleton` variants sized to the real layouts they stand in for; `Card` carries `interactive`/`elevated`/`selected`/`dragging`
  - _Requirements: 11.2, 14.1, 14.3, 15.1_
- [x] 10.5 Encode the spacing contract into the primitives
  - Per-surface padding driven by the primitive, the breakpoint and the density variant — not by per-instance utilities at call sites
  - Mobile base values from the spacing table, including `h-11` tree and menu items for touch
  - Density clamped to comfortable below `md`
  - _Requirements: 13.8, 13.9, 16.3, 20.9_
- [x] 10.6 Verify the primitives use no arbitrary `px` values
  - Every dimension comes from the Tailwind scale or a named `--spacing-*` token; run the 1.8 guard against `src/components/ui`
  - _Requirements: 22.1, 22.2, 22.3_

- [x] 11. Set up Storybook
- [x] 11.1 Install and configure `storybook@10.6.2` with `@storybook/react-vite@10.6.2`
  - Reuse the app's Vite config so `@tailwindcss/vite` is active; import `src/index.css` in `preview.ts`; add the `storybook` script
  - _Requirements: 11.6_
- [x] 11.1.1 Register viewport presets matching the breakpoint tokens
  - `base` (`20rem`), `sm` (`40rem`), `md` (`48rem`), `lg` (`64rem`), `xl` (`80rem`), sourced from `src/config/breakpoints.ts` so Storybook and the stylesheet share one definition, with the parity check covering the rest
  - _Requirements: 20.3, 20.14_
- [x] 11.2 Write a story per primitive covering variants, sizes and disabled/loading/error states
  - _Requirements: 11.7_
- [x] 11.3 Write fixture-driven composite stories
  - `TaskCard`, `KanbanColumn`, `SidebarTree`, `TaskDrawer`, `EmptyState`, wrapped in `AppProviders` with a seeded store
  - `src/views/Composites.stories.tsx`. View-models are built with the real `buildTaskCard` and the real `useVisibleTree` against `createSeedState()`, so a change to a selector shows up in the workbench rather than only in the assembled app. `SEED_NOW` is the reference time, which is what makes "overdue" and "due today" render the same every day
  - `NavigationProvider` gained `initialOpenTaskId` so the drawer is reviewable directly instead of requiring a click through the board to reach it
  - `src/views/stories.test.tsx` renders every exported story. `build-storybook` only proves a story _bundles_; a story that throws on render still builds and then silently misrepresents the component it documents
  - _Requirements: 11.8_
- [x] 11.4 Add responsive stories for every surface that changes shape
  - Board, list view, drawer, sidebar and top bar at base and at `md`, so responsive behaviour is reviewable per component rather than only in the assembled app
  - `src/views/Responsive.stories.tsx`: board at phone and desktop, list at phone and desktop, and the whole shell at phone, tablet and laptop — the last of which is where the sidebar stops being off-canvas
  - No separate drawer viewport story: `UI/Overlays` already demonstrates the sheet/panel swap on the `Drawer` primitive itself, and duplicating it here would be two places to keep in step
  - _Requirements: 20.14_

---

## Phase 5 — App chrome

- [x] 12. Build the shell
- [x] 12.1 `AppShell`
  - `h-dvh overflow-hidden` with independent scroll regions; `data-density` attribute; page itself never scrolls
  - `h-dvh` rather than `h-screen`, so mobile browser chrome does not push fixed affordances out of view
  - Safe-area padding on any bottom-anchored element
  - Single-pane at base, sidebar + content from `lg`
  - _Requirements: 13.7, 16.1, 20.12, 20.13_
- [x] 12.2 `TopBar` in a single `h-topbar` row
  - Base: menu button, truncated list name, search icon, user avatar; `ViewSwitcher` and `DevPanel` in an overflow menu
  - `md`: adds the inline `ViewSwitcher`
  - `lg`: full row with breadcrumbs, `ViewSwitcher`, search, `DevPanel`, `UserSwitcher`
  - _Requirements: 13.7, 16.4, 20.4_
- [x] 12.3 `UserSwitcher`
  - **Menu rows rebuilt in task 44.** They shipped here as `"${name} · ${roleLabel}"` text with a leading check; they now carry avatar, name and role in the trigger's own arrangement
  - Avatar, name and role for the current user; switching re-evaluates the tree, board, table and drawer with no reload
  - _Requirements: 8.2, 8.3, 8.14_
- [x] 12.4 `DevPanel`
  - Latency range, failure probability, "fail next operation", and "reset to seed"
  - _Requirements: 9.8, 9.11_
- [x] 12.5 `Breadcrumbs` with truncation and tooltips
  - Current list name only at base, last two segments at `md`, full path at `lg`
  - _Requirements: 16.6, 20.4_

- [x] 13. Build the sidebar
- [x] 13.1 `SidebarTree` and `TreeItem`
  - Recursive render from `useVisibleTree`; active list marked; tree ARIA semantics with expanded/selected state
  - _Requirements: 6.1, 6.3, 6.4, 17.3_
- [x] 13.2 Expand/collapse persistence across selection and user switching
  - _Requirements: 6.2_
- [x] 13.3 Per-row context menu
  - Rename, create child, archive — each disabled with a reason when the capability check fails
  - _Requirements: 6.5, 8.9, 8.11_
- [x] 13.4 Collapse-to-rail at `lg` and above
  - **Drag-to-resize was built here and removed in task 27.** Recorded as built: the resizer wrote `rem` (`${px / 16}rem`) clamped between `--spacing-sidebar-min` and `--spacing-sidebar-max`, and its live width was one of the documented inline-`style` exceptions
  - Now: two fixed widths, `w-sidebar` expanded and `w-sidebar-rail` collapsed. The collapsed state is still persisted; the width is not state at all
  - _Requirements: 6.6, 13.4, 13.4.3, 16.2, 22.1, 22.3_
- [x] 13.4.1 Off-canvas sidebar below `lg`
  - Slide-over built on the `Drawer` primitive, opened from the top-bar menu button, closing on selection, Escape and overlay tap; focus trapped while open and restored on close
  - Tree rows at `h-11` for touch
  - _Requirements: 20.4, 20.9, 17.2_
- [x] 13.5 Keyboard navigation — arrows to move and expand/collapse, Enter to select
  - _Requirements: 6.7, 17.1_
- [x] 13.6 Container reorder and reparent by drag and drop
  - Valid-parent and cyclic-move checks enforced in the Controller, with drop targets reflecting validity
  - _Requirements: 1.7, 1.8, 1.9_
- [x] 13.7 Inline hint for a space or folder with no visible children
  - _Requirements: 6.8_
- [x] 13.8 Tree skeleton on first load
  - _Requirements: 14.1_

---

## Phase 6 — Views

- [ ] 14. Build the kanban board
  - Everything below is done except the manual touch-gesture confirmation in 14.7.1, which needs a real device
- [x] 14.1 `KanbanBoard` and `KanbanColumn`
  - One column per list status in position order; per-column vertical scroll with sticky headers
  - Base: one column at a time, `w-column-mobile snap-center` inside `snap-x snap-mandatory`, with a pager indicator showing position in the column set
  - `md` and above: `w-column` columns side by side with horizontal board scroll
  - The header is a sibling of the scroll container rather than `sticky` inside it, which is stronger: it cannot scroll away at all, and there is no stacking-context interaction with the drag overlay
  - `BoardPager` renders the position indicator — a dot per column plus "2 of 3" — below `md` only. The active column is derived from scroll position, so a flick, a snap and a tap on a dot all agree
  - _Requirements: 4.1, 4.10, 16.5, 20.5_
- [x] 14.2 Column headers — color indicator, name, count, add-task affordance
  - _Requirements: 4.2_
- [x] 14.3 `TaskCard`
  - Title (2-line clamp + tooltip), priority indicator, assignee avatars, due date, subtask count
  - **The count became the disclosure in task 28.** It shipped here as an inert chip with a tooltip, which named a thing the card gave no route to
  - _Requirements: 4.3, 15.9, 16.6_
- [x] 14.4 Card interactions
  - Hover elevation; reveal of secondary affordances via `can-hover:group-hover` and `can-hover:group-focus-within`, so coarse pointers get them persistently visible instead of unreachable
  - Body click opens the drawer with `stopPropagation` on interactive children; inline complete checkbox at `2.75rem` on touch
  - _Requirements: 15.1, 15.4, 15.7, 20.9, 20.10_
- [x] 14.5 Card overflow quick-action menu
  - Open, change status, change priority, assign, set due date, move to list, duplicate, delete — all applied inline, all permission-checked, all also present in the drawer
  - Task 28 added a second form of this menu for subtask cards, minus the three entries the Controller refuses on a subtask (2.13, 15.2.1)
  - _Requirements: 15.2, 15.3, 15.10_
- [x] 14.6 Card keyboard operability
  - Focusable, Enter opens, overflow menu reachable without a pointer
  - **Bug found and fixed**: the card spread dnd-kit's `listeners` and then set its own `onKeyDown`, which _replaced_ the `KeyboardSensor` activator. Keyboard dragging never started, while `aria-roledescription="sortable"` went on advertising it — a silent failure, since nothing throws. The handler now composes: dnd-kit sees the event first and we act only on what it ignored
  - Key meanings are disjoint by configuration, not by luck: `keyboardCodes` narrows dnd-kit's `start`/`end` to Space, leaving Enter to mean "open the drawer" and nothing else. dnd-kit's default includes Enter in `start`, which would have made one key do two things
  - _Requirements: 15.5, 17.1_
- [x] 14.7 Wire the drag-and-drop provider with pointer and keyboard sensors
  - **Superseded by task 26**, which replaced the library. Recorded as built: `DndContext` with `PointerSensor` at 8px activation distance, `TouchSensor` at 200ms delay and 8px tolerance, `KeyboardSensor` with sortable coordinates, a `SortableContext` per column and a `useDroppable` per column
  - Now: `DragDropProvider` with one `PointerSensor` resolving its constraint from `event.pointerType` — 8px of movement for a fine pointer, a 200ms press with 10px tolerance for touch — and a `KeyboardSensor` whose `start`/`end` codes are narrowed to Space. No `TouchSensor` exists in the current packages, and no `SortableContext`: cards state their own `group` and `index`
  - Annotate the numeric thresholds as documented `px` exceptions
  - _Requirements: 4.4, 4.5, 4.11, 20.8, 22.4, 22.5_
- [x] 14.7.1 Verify touch drag against mobile column paging
  - Confirm a vertical swipe scrolls, a horizontal swipe pages columns, and only a long press starts a drag
  - Confirm status change and reorder are both reachable without dragging, from the card menu and the drawer
  - **Second bullet done in Phase 6**: the card menu carries "Move up", "Move down" and a status item per sibling status, all covered by tests. Reordering no longer requires a drag of any kind
  - **First bullet closed in task 40**, by `e2e/touch-drag.spec.ts` rather than by hand on a device. Carried as "needs a real phone" through two phases; what it actually needed was a touch event stream, which CDP supplies
  - _Requirements: 20.8_
- [x] 14.8 Drag visuals
  - `DragOverlay` with a tilted elevated clone, subdued same-size placeholder in the source slot, highlighted drop-target column and insertion point
  - The insertion point is the gap the sorting strategy opens, rather than a separate drawn line: one fewer element, and it cannot disagree with where the drop will actually land
  - **Everything below describes the `@dnd-kit/core` 6 implementation and is kept as history.** Task 26 replaced the library; the faults are recorded because three of the four recurred in a different form after the migration, and because each one survived a green suite for the same reason — jsdom has no layout, so no test in this repo can run a collision
  - **Corrected three times; the history is the useful part, because the fixes look alike and are not.**
  - _First fault — nothing happened mid-drag._ There was no `onDragOver` handler at all. The destination column never highlighted unless it was empty (its own `useDroppable().isOver` is false whenever one of its cards wins the collision), its cards never parted, and the index was resolved at drop time from the dragged card's corners — which in a non-empty column is nearly always the first card. Hence "it always lands at the top"
  - _Second fault — a preview resolved against the wrong list._ The board rendered the move as though it had happened but resolved `over` against the **store's** columns while displaying the **previewed** ones. Not a fixed point: relocating the card changes which card is under the pointer, which maps to a different index in the original list, which moves the card again. With a fresh object stored on every event it ran away — "Maximum update depth exceeded" — and crashed the app
  - _Third fault — removing the preview._ Stable, and it threw away both the insertion feedback and the cross-column index, so a card had to be dropped into a column and then sorted in a second drag
  - **The shape that works** is dnd-kit's own multiple-containers recipe. The plan _is_ the rendered state, and `over` resolves against the plan rather than the store. Stability rests on one rule: `onDragOver` only ever moves a card **between** columns, never within one. Once the card is in its destination the active and over columns match, the handler returns the same plan object, React bails out, nothing re-measures, and the loop has no fuel. Reordering _inside_ a column is left to `verticalListSortingStrategy` — transforms, no React state — and committed once on drop by `finalDrop`
  - Only column membership lives in state now, and there are three columns; previously the _index_ did, so every pixel of movement was a state change. That is the difference between three renders per drag and hundreds
  - `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}`: a card moving between columns changes their heights, and the default measures once at pickup, so every collision after the first crossing was computed against a stale layout — a drag that felt like it was fighting the cursor
  - Collision detection is `pointerWithin` with `closestCorners` as the fallback, so the hovered card is the one under the cursor rather than the one nearest the dragged card's corners. The fallback remains for keyboard drags, where there is no pointer
  - `TaskCard` and `KanbanColumn` are wrapped in `memo`, and every one of the eleven card callbacks is hoisted into a `useCallback` on the board. They were inline arrows, so each board render handed every card brand-new functions — `memo` would have cost a comparison and saved nothing
  - **Four separate sources of render churn at the crossing**, found after the drag still felt jerky with the plan in place. Each card carries four pickers, a twenty-item menu and several tooltips, so none of these were cheap:
    - `statusOptions` was derived from the _previewed_ columns. A status's id, name and colour cannot change during a drag, but reading them off the preview produced a fresh array on every plan change — which gave every card a new `statuses` prop and rebuilt every menu at the exact moment the drag needed the main thread. Now derived from the store's columns
    - The card's menu was one `useMemo` including `index` and `columnLength`. A crossing shifts the index of every card below the insertion point in _both_ columns, so each of them rebuilt twenty-odd items — including JSX per status and per member — to change two disabled flags. Split: the reorder entries are spliced in separately
    - `SortableContext` received `tasks.map(...)` inline, so a new array identity on every column render rebuilt its context value and re-rendered every `useSortable` beneath it. Memoised on `tasks`
    - `BoardPager` read its names from the preview for no reason
  - `animateLayoutChanges` forces `wasDragging: true`, per dnd-kit's own multiple-containers example. The default predicate bails out when that flag is false, which is the case for a card newly mounted into another column's `SortableContext` — so the cards above and below it _snapped_ into place instead of sliding. That snap, at both ends of a cross-column drag, was the visible part of "jerky"
  - **Not measurable from here.** Frame timing needs a browser and a profiler; these are reasoned reductions in render work plus one behavioural fix to the layout animation. The arithmetic has tests; the feel does not
  - `DragOverlay` uses the default drop animation rather than `null`. Suppressing it meant the overlay vanished and the card reappeared elsewhere in the same frame, which reads as a snap rather than a settle (Requirement 14.11)
  - The arithmetic is a pure module with 31 tests, including that `crossColumnMove` returns the _identical object_ when nothing should change — the loop guard is a testable property, not a hope. A real drag needs layout and jsdom has none, which is why all three faults survived a green suite
  - _Requirements: 4.6, 15.6_
- [x] 14.9 Drop handling and cancellation
  - Compute target status and fractional position from drop-index neighbours; Escape or an invalid drop mutates nothing
  - _Requirements: 4.4, 4.5, 4.7_
- [x] 14.10 Optimistic apply with visible rollback and error toast
  - _Requirements: 4.8, 14.12, 23.3_
- [x] 14.11 Empty columns that are also valid drop targets
  - _Requirements: 4.9_
- [x] 14.12 dnd-kit live-region announcements for pick-up, over and drop
  - _Requirements: 4.11, 17.5_
- [x] 14.13 Board column skeletons on first load and list switch
  - _Requirements: 14.1, 14.2_

- [x] 15. Build the list view
- [x] 15.1 `TaskTable` and `TaskRow` with real table semantics, from `md` upward
  - Title, status, assignees, priority, due date; sticky header; flexible title column, content-width remainder
  - _Requirements: 5.1, 5.6, 16.7, 17.4_
- [x] 15.1.1 `TaskCardList` — the base-viewport form of the list view
  - Stacked cards showing title, status, priority, due date and assignees; same drawer on tap; same sort options
  - Both forms driven by the same `useTaskTable` hook and toggled with `md:hidden` / `hidden md:block`; `display: none` keeps the inactive form out of the accessibility tree and tab order, so no JavaScript breakpoint check is needed
  - _Requirements: 20.6_
- [x] 15.2 Sorting by due date and priority
  - Both directions, active column and direction indicated, ranking from `PRIORITY_CONFIG[p].rank`, null due dates always last, sort direction exposed to assistive technology
  - Table headers at `md` and above; a sort dropdown at base, exposing the identical option set
  - _Requirements: 5.2, 5.3, 5.4, 17.4, 20.6, 21.6_
- [x] 15.3 Row click opens the task drawer
  - _Requirements: 5.5_
- [x] 15.4 Nested subtask rows with a disclosure control, excluded from the top level
  - This was the richest subtask-editing surface in the app for a long time, and the board's lack of an equivalent is what task 28 fixed. The pattern here — nest, disclose, give the child the parent's controls — is the one the board now mirrors
  - _Requirements: 5.7_
- [x] 15.5 Shared status and priority tokens with the board
  - _Requirements: 5.8, 13.6_
- [x] 15.6 Empty state with a primary create-task action
  - _Requirements: 5.9, 14.3_
- [x] 15.7 Simulated offset pagination with a load-more control
  - _Requirements: 9.12_

- [x] 16. Build the task drawer
- [x] 16.1 `TaskDrawer` on the Headless UI `Dialog` primitive
  - Closes on Escape, overlay click and explicit button; focus moves in, is trapped, and returns to the trigger
  - Full-height bottom sheet at base (`max-h-[92dvh]`, drag-to-dismiss, safe-area padding), right-side panel at `md` (`w-drawer`) and `xl` (`w-drawer-xl`)
  - Identical content, field behaviour and close affordances in both forms
  - _Requirements: 7.1, 7.2, 7.3, 17.2, 20.7, 20.12_
- [x] 16.2 `PropertyRow` label/value grid with uniform row height and spacing
  - _Requirements: 7.6, 13.8_
- [x] 16.3 Inline title and description editing
  - Save on blur and ⌘/Ctrl+Enter; Escape reverts the focused field rather than closing the drawer
  - _Requirements: 7.4, 7.5_
- [x] 16.4 Property controls — `StatusPicker`, `PriorityPicker`, `AssigneePicker`, `DueDatePicker`
  - Status options restricted to the task's list status set
  - **Deviation**: these are not four named components. Each is a `Select`, `Menu` or `Input` inside a `PropertyRow`, because a `StatusPicker` would have been a one-line wrapper over `Select` whose only job was to pass `renderValue`. Four such wrappers are four more files to keep in step with the primitive for no behaviour of their own
  - Due-date presets come from `DUE_DATE_PRESETS` and `dueDateAtDays`, shared with the card menu, so "tomorrow" cannot mean two different instants
  - _Requirements: 2.5, 3.5, 7.4_
- [x] 16.5 Per-field pending indicator and revert-with-toast on failure
  - `PropertyRow` takes `pending`, and the drawer tracks _which_ field is saving rather than merely whether something is — a single global spinner cannot say that the status change landed while the assignee change is still in flight
  - The indicator sits on the row's label, not inside the control, so a select does not change size mid-save and shift every row below it
  - Every drawer write goes through `useAction`, which is what turns the Model's rollback into something a user can see (Requirement 14.4)
  - _Requirements: 7.7, 14.7_
- [x] 16.6 Read-only metadata — breadcrumb path, created and updated timestamps
  - _Requirements: 7.8_
- [x] 16.7 Move-to-list action limited to lists the user can edit, surfacing status remapping when it occurs
  - Destinations come from `selectEditableLists`, not `selectVisibleLists`. The two coincide for every seeded role, but the capability table is configuration — a view-only role is one entry away, and offering it a destination that would refuse it is the bug that entry would introduce
  - A successful move whose `statusRemapped` flag is set pushes an info toast explaining that the destination list had no matching status
  - _Requirements: 2.6, 7.9_
- [x] 16.8 `SubtaskList` — create, toggle, open, delete, depth-1 enforced
  - **Widened in task 30.** The narrowing recorded below was reversed: the rows now carry the full inline control set, and `onOpen` survives as an explicit control because the subtask's own drawer is still where its description lives
  - As shipped here, and kept as the reasoning that was wrong: deliberately narrower than the board's subtask cards (task 28) and the table's nested rows, because nesting a second complete field set inside a drawer would be a drawer inside a drawer (15.10.1)
  - _Requirements: 2.11, 2.12, 7.4.1_
- [x] 16.9 Read-only drawer state when the user lacks `task:update`, with an explanatory note
  - _Requirements: 7.10, 8.12_
- [x] 16.10 Previous/next task keyboard navigation within the current view
  - _Requirements: 7.11_
- [x] 16.11 Enter/exit transition under 200ms, wrapped in `motion-safe:`
  - _Requirements: 7.12, 14.11_

---

## Phase 7 — Cross-cutting polish

- [x] 17. Permission UX
- [x] 17.1 `PermissionDeniedState` for a selected list that is no longer visible
  - Offers navigation to a list the current user can see; closes a drawer open on a now-denied task
  - _Requirements: 8.13_
- [x] 17.2 Disable rather than hide capability-gated affordances, with a stated reason
  - Reason shown on hover where available and as inline helper text on coarse pointers, so it is never hover-only
  - **Audit found two gaps.** Menu items carried the reason only in `title`, which a touch device can never surface; and the card's quick-action menu passed no reason at all, so a greyed "Delete task" simply refused. Both fixed
  - `Menu` now renders the reason as a second line, shown under `coarse-pointer:`, wired through `aria-describedby` rather than left as bare text inside the button — as plain text it would have become part of the accessible name, and _only_ on a coarse pointer, so the same item would be called two different things on two devices
  - `ReadOnlyNotice` states it once per surface for the board and the list, matching the drawer's existing strip. The alternative — appending the reason to each control's label — turned "Add task to To do" into a sentence, and was reverted
  - _Requirements: 8.11, 8.12, 20.10_
- [x] 17.3 Distinguish permission-denied toasts from network-error toasts in tone and wording
  - _Requirements: 14.5_

- [x] 18. Feedback, states and motion
- [x] 18.1 Audit every empty surface for a distinct empty state
  - Empty list, empty column, no list selected, no search results, folder with no visible lists
  - _Requirements: 14.3, 6.8_
- [x] 18.2 Audit loading states for layout-shift-free skeletons on first load and list switch
  - _Requirements: 14.1, 14.2_
- [x] 18.3 Confirm destructive actions through `ConfirmContext`, naming target and cascade
  - **Audit found one unguarded path**: deleting a subtask went straight through. Now confirmed like every other delete; no cascade to name, since depth is capped at 1
  - _Requirements: 14.9, 1.5, 2.12_
- [x] 18.4 Success toasts for non-obvious mutations only; none for inline edits
  - _Requirements: 14.10_
- [x] 18.5 Verify hover, focus-visible, active and disabled states on every interactive element; no removed focus rings
  - Swept every `<button>` outside the primitives. One had no focus indicator at all: the list view's subtask disclosure chevron. Fixed
  - The `focus:outline-none` occurrences are all paired with a `focus-visible:ring`, and menu items indicate keyboard focus through Headless UI's `data-focus`, so nothing relies on the removed default
  - _Requirements: 14.8, 17.1_
- [x] 18.6 Normalize transition durations to 120–200ms under `motion-safe:`
  - `Menu` and `Select` were at 100ms, under the floor; both now 150ms. Everything else was already 150 or 200
  - `ScrollShadow`'s two edge fades had no reduced-motion guard. Fixed — it was the only file where the transition count exceeded the guard count
  - Expressed as `motion-reduce:transition-none` rather than `motion-safe:`, which is the same guarantee written as an opt-out; noted here because the task wording says `motion-safe:`
  - _Requirements: 14.11_
- [x] 18.7 Point-of-interaction pending states — in-button spinners, subdued rows and cards, no global overlay
  - `usePendingAction` wraps `useAction` with a set of in-flight keys. The board keys by task id, the list by row, the drawer by field name — the shape of the problem is identical, so it does not have three solutions
  - A set rather than a boolean, because two mutations genuinely overlap under simulated latency: tick one card, drag another, and a single flag clears on the wrong one
  - Every pending surface also sets `aria-busy`. Subdued opacity says nothing to a screen reader
  - _Requirements: 14.7_

- [ ] 19. Responsive, space and density pass
  - 19.1–19.5, 19.7 and 19.8 are done. 19.6, 19.9 and 19.10 are visual or device checks that cannot be made from here; each records what was verified statically and what was not
- [x] 19.1 Verify independent scroll regions and that the page never scrolls vertically
  - _Requirements: 16.1_
- [x] 19.2 Wire the density toggle through every affected surface and verify persistence
  - **The toggle itself was removed in task 27.** The mechanism and the `@media (pointer: fine)` guard below are untouched and still the reason compact can never shrink a touch target; what is gone is the control that set it
  - Confirm it is hidden below `md` and cannot reduce a touch target below `2.75rem`
  - **The clamp was a comment, not a rule.** `src/index.css` claimed density was "clamped to comfortable below md"; the variant was a plain attribute selector with no condition on it. Only `TreeItem` was actually safe, and by accident — it happened to pair `density-compact:` with `can-hover:`
  - The condition now lives in the variant: `density-compact` is wrapped in `@media (pointer: fine)`, so no `density-compact:` utility can shrink a target below the minimum however it is written. Verified against the emitted CSS, not just the source
  - The condition is about the _pointer_, not the viewport — a tablet is wide and still coarse, which a width-based clamp would have missed
  - _Requirements: 16.3, 20.9_
- [x] 19.3 Audit truncation and tooltips across tree, breadcrumbs, cards and table cells
  - Confirm the full value is reachable without hover on coarse pointers
  - _Requirements: 16.6, 20.10_
- [x] 19.4 Progressively disclose secondary metadata rather than permanently occupying space
  - _Requirements: 16.8_
- [x] 19.5 Audit for mobile-first authoring, not just mobile-working
  - Grep for `max-w`/`max-h` breakpoint variants and for any surface whose unprefixed classes describe the desktop layout; fix by inverting the class order rather than adding overrides
  - _Requirements: 20.1_
- [ ] 19.6 Walk every surface at each breakpoint
  - `20rem`, `40rem`, `48rem`, `64rem`, `120rem` — sidebar, top bar, board, list view, drawer, menus, dialogs, toasts, empty states, skeletons
  - No horizontal page scroll, no clipped or overlapping content, no unreachable affordance at any width
  - **Not verifiable here.** This is a visual walk and needs a browser. `src/views/Responsive.stories.tsx` sets the walk up — board, list and the whole shell at phone, tablet and laptop presets — and every story is smoke-rendered, but "nothing is clipped or overlapping" is a judgement no test in this repo makes
  - _Requirements: 20.2, 20.4, 20.5, 20.6, 20.7, 16.9_
- [x] 19.7 Verify touch targets across the app
  - Every interactive target at least `2.75rem` in both dimensions on coarse pointers, including tree rows, menu items, card checkboxes, pager dots and icon buttons
  - **Static audit, and it found five.** The primitives were all correct; the raw `<button>` elements in the views were not. A tree row was `h-11` while the button inside it was only as tall as its text, so the top and bottom of every row looked tappable and were not — same for subtask rows. Fixed with `self-stretch`, which makes the row's height the actual target
  - Also fixed: the drawer's assignee trigger (`h-9`), the click-to-edit title field, and the list view's disclosure chevron and sort headers — the table renders from `md`, which includes tablets, so a coarse pointer at a wide viewport was getting a 1rem target
  - Measured by reading classes rather than by hit-testing a device, so this verifies the authored sizes. 19.6 covers the visual half
  - _Requirements: 20.9_
- [x] 19.8 Verify no interaction depends on hover
  - Every `can-hover`-gated affordance has a coarse-pointer equivalent that is visible or one tap away
  - _Requirements: 20.10, 15.10_
- [ ] 19.9 Verify the layout at a 150% root font size
  - No clipping or overlap, and the breakpoint the layout receives shifts as expected because breakpoints are `rem`
  - **Half-verified.** The mechanism is confirmed: breakpoints are declared in `rem`, `breakpoints.test.ts` fails if the CSS and the JS mirror drift, and a grep confirms nothing overrides the root font size (Requirement 22.8). So the breakpoint a user receives provably does shift
  - The other half — that nothing clips or overlaps once it does — is the same visual judgement as 19.6 and needs a browser
  - _Requirements: 20.11, 22.6_
- [ ] 19.10 Verify safe-area insets and dynamic viewport sizing
  - Bottom-anchored affordances clear notches and home indicators; no fixed element sits under mobile browser chrome
  - **Audit found one gap, now fixed**: `BoardPager` is bottom-anchored on the only layout where it renders and had no inset, so its dots would have sat under a home indicator. The shell, the drawer and the toast stack already had theirs
  - Every viewport dimension is `dvh`, never `vh`, and a grep confirms no `h-screen` survives anywhere
  - Still unchecked because confirming it needs a notched device; the code is in place and the audit is recorded
  - _Requirements: 20.12, 20.13_

- [x] 20. Accessibility pass
- [x] 20.1 Verify tab order and accessible names on all icon-only controls
  - _Requirements: 17.1_
- [x] 20.2 Verify tree and table semantics with expanded/selected and sort state exposed
  - _Requirements: 17.3, 17.4_
- [x] 20.3 Verify drag announcements and toast live region
  - _Requirements: 17.5, 17.6_
- [x] 20.4 Check AA contrast on tokens and confirm no status or priority is conveyed by color alone
  - Done as a test, not a glance: `src/config/contrast.test.ts` parses `src/index.css`, computes WCAG relative luminance and asserts ratios for the pairings the app actually renders. A token nudged below the threshold now fails the build
  - **It found six failures.** `ink-400` was 2.58:1 — and it carries every due date, count, timestamp and placeholder in the app. `warning-700` was 3.72:1 on its own tint, which is the read-only banner's own text. `priority-urgent`, `priority-high` and `priority-normal` were 3.83, 2.52 and 3.38 measured where `PriorityBadge` renders them: as _text_ on the matching 50-level tint, not against white. `status-todo` was 2.32:1 as a pill dot
  - All six darkened to computed values rather than re-picked by eye. The pairing that mattered — token-as-text-on-its-own-tint — is exactly the one a palette review does not look at
  - `ink-400` is held to the 4.5:1 body-text threshold, not a graphics threshold: WCAG has no "it is only metadata" exemption. `ink-300` and `priority-none` are asserted as decorative, so promoting either to text would fail
  - The colour-alone half is asserted structurally: every priority carries an icon and a label, every status category carries a label
  - _Requirements: 17.7_
- [x] 20.5 Verify the off-canvas sidebar and bottom sheet meet dialog expectations
  - Focus trapped while open, Escape closes, focus restored to the trigger, background content not reachable by tab
  - Both covered by tests. The sidebar test overrides `matchMedia` rather than resizing anything, because `isModal` is the one breakpoint this app observes from JavaScript and that query is precisely what it reads
  - "Background not reachable" is asserted from the other direction, and it caught a test of mine: Headless UI hides the rest of the document from the accessibility tree while a modal is open, which is why asserting on the board _through_ an open drawer fails. That is the requirement working
  - _Requirements: 17.2, 20.4, 20.7_

---

## Phase 8 — Stretch goals (only after everything above passes)

Both attempted, both complete. Requirement 23.4 caps the set at these two, so
nothing further was added — the README names them as the attempted pair.

- [x] 21. Client-side task search
  - Debounced input over title and description, scoped to the current user's visible tasks, results grouped by list with highlighted matches and a keyboard shortcut to focus the field
  - Full-screen overlay at base viewport, anchored panel from `md`; results list uses `2.75rem` rows on touch
  - Four pieces, one per layer: `selectSearchResults` (Model, already written in Phase 1) decides _what_ is visible; `useTaskSearch` groups and shapes it; `CommandPalette` renders it; `TaskSearch` connects them. The palette knows nothing about tasks or permissions, which is why it is reviewable in Storybook with literal data
  - Scoping lives in the Model, not the view. A search box matching on titles is the easiest way to leak the name of something a user cannot open, and no amount of UI care fixes an unscoped query. Tested from both directions: Bob gets nothing for a task on his denied Infra list, and nothing for the private Marketing space
  - Built on Headless UI's `Combobox` inside a `Dialog`, which supplies the hard part — `aria-activedescendant` roving focus, arrow keys, Enter, and focus returned to the trigger. Hand-rolling that is how a palette ends up mouse-only
  - **Three bugs found while testing.** (1) `Combobox` swallows Escape as "close the option list", which does nothing when the options are `static` — so the key looked dead and the palette could only be dismissed via the backdrop. Handled explicitly on the input. (2) Reading the debounced value alone left the previous query's hits on screen after clearing the input; clearing is now immediate and only _searching_ is debounced. (3) The `RegExp` built for match highlighting needed escaping — a single `(` typed into the field would otherwise throw
  - Group labels are the full ancestor path, not the leaf name: two spaces can each hold a list called "Backlog"
  - _Requirements: 23.1, 23.2_
- [x] 22. Confirm optimistic DnD rollback end to end
  - Already implemented in 7.5 and 14.10; verify via the dev panel's forced-failure trigger and record it as the second attempted stretch goal
  - `src/views/rollback.test.tsx` drives the panel's own "Fail next operation" control rather than stubbing the transport, because that path has two links the unit tests skip: `SimulationContext` writing through to the adapter's module-level settings, and the one-shot trigger being consumed by exactly one mutation
  - Asserts the **fractional positions**, not just the visible order. Restoring a sequence while leaving the underlying numbers changed would look correct and then misorder the next insert — the failure mode a visual check cannot see
  - Also covers the two adjacent behaviours: the retry succeeds, because "fail next" is one-shot and a mutation is a closure over its inputs rather than something the first attempt consumed; and "Reset simulation" disarms it
  - All four passed on the first run, which is the result worth having here — the mechanism was already right, and this confirms the demo path a reviewer uses
  - _Requirements: 23.3, 23.4_

---

## Phase 9 — Tests and documentation

- [x] 23. Component test
  - **Already satisfied when this phase was reached**, by work done in Phases 5–19 rather than here. Verified by reading the tests rather than assumed from the suite being green, and recorded as done rather than duplicated — a second test asserting the same thing would add a maintenance surface and no coverage
- [x] 23.1 Render `AppShell` in `AppProviders` with a seeded store and assert the user-switch behaviour
  - `src/views/AppShell.test.tsx`: "hides Marketing from Bob and shows it to Alice" and "hides the denied Infra list from Bob but keeps it for Carol" — the two halves of the task, which also covers Carol bringing both back
  - Strengthened beyond the task's wording by `e2e/permissions.spec.ts`, which compares **whole trees** as `"{level}:{name}"` strings for all three users, so a reparent cannot masquerade as a visibility change
  - _Requirements: 18.7, 8.3_
- [x] 23.2 Assert drawer behaviour
  - `src/views/views.test.tsx`: "opens the drawer on a card click, with the task's details" and "closes on Escape and returns focus to the card that opened it" — the latter asserting focus lands back on the card rather than at the top of the document
  - _Requirements: 18.7, 7.2, 7.3_

- [x] 24. Write the README
  - Three documents, not one: `README.md` is the entry point, `ARCHITECTURE.md` carries the extension points (24.9.3), `AI_USAGE.md` the usage log (24.8). The README links both rather than absorbing them — a single file covering run instructions, the data model, permissions, eight extension seams and an AI log is a file nobody reads to the end
  - Deliberately **not** a copy of `design.md`. The design document is the long-form reasoning and keeps the failure history; the README answers "how do I run this, what is it, and what did you decide" for someone who has not read either
- [x] 24.1 Replace the Vite boilerplate with run instructions for dev, test, lint, build and Storybook
  - Every script in `package.json` in one table, plus why the test scripts pin `TZ=Asia/Kolkata` — a half-hour offset is what catches the calendar-day conversions a UTC-only runner lets pass
  - Added a "30-second tour" ahead of the architecture, because the two things worth seeing first — the forced-failure rollback and the Alice/Bob switch — need no setup and are not discoverable from a file listing
  - _Requirements: 19.1_
- [x] 24.2 Add the Mermaid architecture diagram and the MVC layer mapping
  - The layer diagram, a per-layer ownership table, the mutation pipeline, and the lint zones that enforce the boundaries — the point being that the separation is a build failure rather than a convention
  - _Requirements: 10.7, 19.2_
- [x] 24.3 Document the data model — relationships, fractional positions, archive-vs-delete strategy
  - An ER diagram, the normalized state shape, and the three forward-compatibility details with what each one costs today. Fractional positions as the formula plus the rebalance threshold; archive-versus-delete as the deliberate asymmetry it is
  - _Requirements: 19.3_
- [x] 24.4 Document permission enforcement and the extension path
  - The resolution walk as pseudocode, why structural checks precede the admin bypass (an earlier draft had it the other way and let an admin "view" a node in another workspace), why the workspace check covers every node in the chain, the `canView`/`canReach` distinction, the capability table, and the access translation
  - Each of the four extension paths with the specific thing already in place for it — including that `isUserSubject` is a `Record` lookup so widening the subject union is a compile error rather than a filter that starts deleting team grants
  - _Requirements: 8.12, 19.4_
- [x] 24.5 Document the simulated latency and failure-injection layer and how to demo error and rollback paths
  - Each dev-panel control and what it demonstrates, and that rollback restores the **fractional positions** rather than just the visible order — the failure a visual check cannot see. Named all three layers that cover it, since the interesting part is that they cover different links in the same chain
  - _Requirements: 19.5_
- [x] 24.6 Document the `localStorage` choice, its versioned key and the reset path
  - `flowboard:v1`, the adapter interface, why the signatures are async even though `localStorage` is not, why Zustand's `persist` middleware is not used, and why the save subscription reference-compares rather than deep-compares
  - _Requirements: 19.6_
- [x] 24.7 Document trade-offs, what was cut, and a prioritized week-2 plan
  - Fourteen trade-offs with reasoning rather than apology, a "known open items" list, and six week-two items in priority order
  - The week-two list is led by wiring the unused-export lint rule, which is the only item that closes a **stated requirement currently unmet** (21.20) rather than adding something new
  - _Requirements: 19.7_
- [x] 24.8 Write the AI usage log, with the long form in `AI_USAGE.md`
  - Grounded in what the repository records rather than recalled: `tasks.md` is a log of corrections, so every specific in the document is checkable against a file
  - Organised by **failure mode** rather than chronologically, because the categories are the transferable part: confidently wrong about the framework (silent, no error — interpolated Tailwind classes, the `--size-*` namespace, the `cn()` ordering, the `useShallow` loop); right-looking code with a wrong accessible name (three instances); comments asserting behaviour the code did not have (two); subtly wrong ordering; drag and drop five separate times; and tests that pass for the wrong reason
  - Carries a review note at the top: it makes first-person claims about process, so it is a draft for the author to own rather than a finished attestation
  - _Requirements: 19.8_
- [x] 24.9 List every inline `style=` exception with file location and justification
  - Two, not four: `components/ui/Tooltip.tsx` (portalled overlay coordinates) and `components/ui/Drawer.tsx` (bottom sheet drag-to-dismiss offset)
  - dnd-kit's sortable transform was retired in task 26 — `@dnd-kit/dom` writes it to the element directly, so neither `TaskCard` nor `TreeItem` carries an inline style (Requirement 13.4.2)
  - The sidebar resizer's live width was retired in task 27, along with the handle (Requirement 13.4.3)
  - Verified rather than copied from this list: `grep -rn 'style={' src` returns exactly `Tooltip.tsx:235` and `Drawer.tsx:149`, which is the documented pair
  - _Requirements: 13.4, 13.4.2, 13.4.3, 19.9_
- [x] 24.9.1 Document the `rem` unit rule
  - The rule, the four exceptions with their actual locations, and the verification command — which is `npm run lint:units`, not a grep, because the guard already encodes the allow list
  - **Corrected the grep this plan recommended.** Task 25.3 says `rg -n '\bpx\b' src`, which matches Tailwind's `px-3` padding utility — 80-odd hits that are not units at all. The README gives `[0-9]px` and the arbitrary-value pattern instead, which return only shadow tokens and prose
  - Also recorded that the pointer-travel thresholds never appear as `px` in source at all: they are bare numbers handed to dnd-kit, so the exception is about what the number _means_ rather than about a literal to find
  - _Requirements: 19.13, 22.5, 22.7_
- [x] 24.9.2 Document the mobile-first approach
  - The breakpoint table, the per-surface adaptation table, the touch thresholds and why they resolve from pointer type rather than viewport width, and the one surface that is allowed a JavaScript breakpoint check with the reason it is the only one
  - Split the verification claim into automated / by hand / **not automated**, with visual regression named in the third. Saying which widths were checked by hand is more useful than implying CI covers it
  - _Requirements: 19.11, 20.14_
- [x] 24.9.3 Write `ARCHITECTURE.md` covering every extension point
  - Eight sections, one per seam, each with the steps and a table of what is deliberately _not_ touched — the second being the part that makes the claim checkable
  - Worked examples for the second workspace and the calendar view, the latter naming all three files and nothing else
  - Opens with the general rule, because it is the one thing worth remembering: if you are adding a `switch` over a domain union outside `src/config`, the extension point exists and you have missed it
  - Closes with "where the seams are _not_" — `localStorage` is not a security boundary, access is per container, `Grant` scopes a container and never a task. A document listing only what extends well is marketing
  - _Requirements: 19.12, 21.21_
- [x] 24.10 List the design-system inventory, the Storybook pointer, and the two attempted stretch goals
  - All 35 primitives named, the seven story files and what each covers, and why `stories.test.tsx` renders every story — `build-storybook` proves a story _bundles_, and one that throws on render still builds and then misrepresents the component it documents
  - The two stretch goals with the reasoning that matters for each: search scoping lives in the Model because a title-matching search box is the easiest way to leak the name of something a user cannot open
  - _Requirements: 19.10, 23.4_
- [x] 24.11 State the accessibility testing scope honestly
  - Split into what was done (automated contrast in CI, manual keyboard testing, role-first queries throughout) and what was **not** (no screen reader, no assistive technology of any kind, no expert review), with the explicit statement that no WCAG conformance is claimed
  - Named the two things automation cannot find, rather than leaving "not tested with AT" to imply it probably would have passed
  - _Requirements: 17.8_

- [x] 25. Final verification
  - Four of the six passed as written. Two found something: 25.4 found that two test files this plan names do not exist under those names, and 25.6 found a Requirement 20.2 violation at every phone width
- [x] 25.1 Run `npm run lint`, `npm run build` and `npm run test` clean
  - All clean: `lint` (the `px` guard over 171 files plus ESLint), `typecheck` across all four TS projects, `build`, 666 unit tests in 35 files, and 88 end-to-end cases across 11 spec files and 2 browser projects
  - **One stated requirement is not met, and it is a lint gap rather than a lint failure.** Requirement 21.20 says lint shall fail on unused exports. `eslint.config.js` configures `import-x/no-cycle`, `no-self-import` and `no-useless-path-segments` under a "Module hygiene — Requirement 21.20" comment, and **no unused-export rule at all**. So the thirteen dead Model exports from task 38 pass lint, which is exactly why they accumulated silently. Recorded here and as the first week-two item rather than left for a reviewer to notice
  - _Requirements: 10.5, 18.1_
- [x] 25.2 Grep the repo to prove the styling constraints hold
  - One stylesheet: `find src -name '*.css'` returns `src/index.css` and nothing else. No `.scss`, no `.module.css`
  - No CSS-in-JS or preprocessor dependency. Worth noting the naive check gives a false positive — a `/styled|emotion|sass|less/` pattern matches `@headlessui/react` on "less", so the real check anchors the package names
  - `grep -rn 'style={' src` returns exactly two: `Tooltip.tsx:235` and `Drawer.tsx:149`, the documented pair
  - _Requirements: 13.1, 13.2, 13.4_
- [x] 25.3 Run the `px` audit and confirm every hit is an allowed exception
  - **The command this plan specifies is wrong**, and that is the finding. `rg -n '\bpx\b' src` matches Tailwind's `px-3` padding utility — `-` is a non-word character, so the word boundary holds — producing 80-odd hits that are not units. An audit whose output is mostly noise is an audit nobody finishes
  - The precise checks: `[0-9]px` for real lengths, and `[a-z-]+-\[[^]]*[0-9]px[^]]*\]` for arbitrary values. First returns only the `--shadow-*` tokens and prose in comments; second returns nothing
  - Every remaining hit is an allowed exception: `box-shadow` offsets in the `@theme` block, three `h-px`/`w-px` hairlines, and comments describing the pointer thresholds. The thresholds themselves never appear as `px` in source — they are bare numbers handed to dnd-kit
  - Root font size not overridden: no `font-size` rule anywhere in `src/index.css`
  - _Requirements: 22.3, 22.4, 22.7, 22.8_
- [x] 25.4 Audit the scalability seams against the requirement, not the happy path
  - All six seams hold. No `role` on `User` (it is on `Membership`, with the reasoning in a doc comment); `WORKSPACE_ID` appears only in `seed.ts` and in the test fixtures' deliberate second workspace; `activeWorkspaceId` is read by `useScope` alone among consumers, the other hits being its owners — the session slice, the pipeline's snapshot and the store's persistence; no `localStorage` inside any slice or Model logic; no latency reference inside a slice; no hierarchy type comparison outside the registry, the only literal hits being the seed's own data and a comment explaining why `holdsTasks` is used instead
  - **Two of the four named test files do not exist.** `registry.test.ts` and `capabilities.test.ts` are named by this task, by tasks 2.5 and 3.3, and by `design.md`'s testing section. The _coverage_ is real and genuinely uses synthetic fixtures — the injected hierarchy level is in `config/config.test.ts` and `model/validation.test.ts`, the synthetic role in `config/config.test.ts` — so Requirement 18.9 is met and three documents were naming files that were never created. `design.md` corrected to name the real locations
  - `workspaceScope.test.ts` and `persistence.test.ts` exist, pass, and do exercise the two-workspace fixture and the in-memory adapter respectively
  - _Requirements: 18.9, 18.10, 18.11, 21.1, 21.2, 21.3, 21.4, 21.6, 21.7, 21.10, 21.11_
- [x] 25.5 Audit the readability conventions
  - Clean: zero `export default` in `src` outside the seven story files, where CSF requires it and the rule is scoped off; zero `: any` or `as any`; no nested ternaries. All three are lint-enforced rather than review-enforced — `no-restricted-syntax` carries an `ExportDefaultDeclaration` selector and a nested-`ConditionalExpression` selector, and `@typescript-eslint/no-explicit-any` is an error
  - Exhaustive unions are enforced by `switch-exhaustiveness-check` rather than by the `never` default alone; the explicit `never` guards are in `selectors.ts` and `ContainerFormDialog.tsx`. Worth remembering that the `never` _binding_ is a compile-time device only — task 30.1's `return exhaustive` bug returned its runtime value and dropped a grant row
  - _Requirements: 21.13, 21.14, 21.15, 21.16, 21.17, 21.19, 21.22_
- [x] 25.6 Walk the demo script end to end at desktop and at phone width
  - Walked in a browser at 1440px and at 320px: tree navigation, the board, the drawer as a right panel and as a bottom sheet, the off-canvas sidebar sheet, and the column pager. The drag, the forced-failure rollback, the card quick actions and the Alice/Bob switch are all held by `e2e/` and were not re-walked by hand
  - One correct behaviour worth recording because it looked like a bug for a moment: clicking a card's title opens the **inline editor**, not the drawer. That is Requirement 15.4 working — the drawer is reached by clicking the card body or pressing Enter
  - **The phone walk found a Requirement 20.2 violation**, which is written up as task 46 below. The short version: at 320px the entire chrome could be scrolled sideways out of view, leaving a blank surface
  - _Requirements: 8.14, 9.8, 20.2, 20.8_

---

## Phase 10 — dnd-kit migration

Added after Phase 8, so the task numbering continues rather than renumbering
what Phases 0–9 reference. The trigger was a complaint that a cross-column card
drag felt jerky, and the finding that the project was on the legacy
`@dnd-kit/core` 6 line rather than the current packages.

- [x] 26. Migrate from `@dnd-kit/core` 6 to `@dnd-kit/react`
- [x] 26.1 Swap the packages
  - Remove `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@dnd-kit/modifiers`; add `@dnd-kit/react@0.5.1`, `@dnd-kit/dom@0.5.1`, `@dnd-kit/abstract@0.5.1`, `@dnd-kit/helpers@0.5.1`, exact-pinned
  - `@dnd-kit/helpers` is a direct dependency for the `move` helper used in 26.4. It was briefly removed on the assumption that `@dnd-kit/dom/sortable` pulled it in; it does not — `move` is bundled inline there — so the direct dependency is real
  - _Requirements: 13.10_
- [x] 26.2 Port the board to `DragDropProvider`
  - `DndContext` → `DragDropProvider`; `SortableContext` deleted, with cards declaring `group` (their column's status id) and `index` instead; `useDroppable` per column at `CollisionPriority.Low` so cards win the collision whenever the pointer is over one
  - Sensors per 14.7. `onDragCancel` is gone — cancellation arrives as `event.canceled` on `onDragEnd`
  - The custom `pointerWithin`/`closestCorners` detector and the `MeasuringStrategy.Always` override are both removed. 6.x needed the first because `closestCorners` measured from the dragged card's corners and resolved to whichever card sat nearest the column's top-left, and the second to keep collisions honest as column heights changed — constant re-measurement that was itself part of what the drag felt like. The current defaults do both properly
  - _Requirements: 4.1, 4.4, 4.5, 4.6, 4.9, 4.10_
- [x] 26.3 Drop the two inline-`style` transforms
  - `TaskCard` and `TreeItem` no longer compute `CSS.Transform.toString(transform)`; `@dnd-kit/dom` writes the per-frame transform to the element directly. This is why a drag no longer re-renders the board, and it retires one of the four inline-`style` exceptions
  - `isDragging` → `isDragSource` for the source-slot styling, so the placeholder stays subdued through the drop animation instead of flashing back to full opacity for a frame
  - The hand-rolled keyboard composition in `TaskCard` is gone: the `KeyboardSensor`'s default activation guard already refuses any event whose target is not the element itself, which is what the old code was badly reimplementing. The card's own handler is now Enter-only
  - `role`, `tabIndex`, `aria-roledescription` and `aria-describedby` are applied by the accessibility plugin rather than spread from an `attributes` object — which is why the tests that selected cards by `aria-roledescription="sortable"` now select `"draggable"`
  - _Requirements: 13.4, 13.4.2, 15.5, 15.6, 17.1_
- [x] 26.4 Fix the two bugs the migration introduced
  - **Both had one cause**: the migration took the wrong one of dnd-kit's two documented state-management patterns. `OptimisticSortingPlugin` previews a cross-list drag by moving the DOM node itself, which React then tried to remove from a parent it no longer belonged to — `NotFoundError: Failed to execute 'removeChild' on 'Node'`. And the same plugin returns early on a non-sortable target, so a drop into an **empty** column never updated the dragged card's `group` and a commit path reading the destination off that card silently wrote nothing
  - The fix is the pattern dnd-kit checks for: mirror the move into React state in `onDragOver` with the `move` helper, and the plugin stands down (it snapshots every sortable's index, waits for the renderer, and bails out via `hasChanged`). `move` also handles the empty-column target the plugin skips
  - `dragPlan.ts` is therefore not fully retired — `dragDrop.ts` keeps the capture/locate/render bookkeeping around `move`, at roughly a quarter of the size, with the index arithmetic that used to be hand-rolled now the library's
  - The plan is held in both a ref and state: state renders, the ref lets `onDragEnd` and the `dragend` announcement read the current value without depending on render timing or on which listener the monitor calls first
  - _Requirements: 4.9, 4.12_
- [x] 26.5 Opt the sidebar tree out of optimistic sorting
  - `plugins: [SortableKeyboardPlugin]` on the tree's `useSortable`. A tree drop is reorder _or_ reparent _or_ refuse, so there is no single list for a preview to rearrange, and it never had one
  - Leaving the plugin on was not harmless. All rows are siblings in one `<ul>`, so React's keyed reconciliation happened to recover after a successful drop — but a **rejected** mutation rolls the store back, React re-renders nothing, and the sidebar is left showing an order the store disagrees with
  - _Requirements: 1.7, 1.8, 4.12_
- [x] 26.6 Name the announcements
  - The accessibility plugin is configured through `configure(Accessibility, { announcements })` — it has no `static configure` in 0.5.1 — so a drag announces "Picked up Audit empty states across the product" and "Dropped … in In progress, position 2" rather than entity ids
  - Labels are resolved through a ref synced in an effect, so the plugin list keeps a stable identity and renaming a task mid-session does not re-register plugins
  - The sidebar tree still uses dnd-kit's id-based defaults. Pre-existing — it had no custom announcements under 6.x either — and left as a named gap rather than folded in silently
  - _Requirements: 4.11, 17.5_
- [x] 26.7 Add the jsdom stubs the new packages need
  - `Document.getAnimations`, `Element.prototype.animate` and `IntersectionObserver` in `src/test/setup.ts`. `@dnd-kit/dom` reaches for all three to settle animations and observe geometry; jsdom implements none, and without them a drag throws from inside a signal effect — an unhandled error rather than a failed assertion, which is the worst place for it
  - Reporting "nothing is animating" and "nothing is observed" is the honest stub: jsdom runs no animations and has no layout to intersect
  - _Requirements: 18.1, 18.8_
- [x] 26.8 Rewrite the drop-arithmetic tests
  - `dragPlan.test.ts` → `dragDrop.test.ts`. The rearranging is no longer tested here because it is no longer ours; what is tested is the bookkeeping either side of `move`, including the empty-column commit that 26.4 fixed
  - Three suite-level corrections the migration forced: cards select by `aria-roledescription="draggable"`, the keyboard-drag test queries dnd-kit's `[data-dnd-overlay]` container instead of counting two elements with the same accessible name (the overlay clone renders with registration stubbed out, so it never gets the `role` the real card has — the old assertion would have passed for the wrong reason), and the announcement assertion matches the new wording
  - _Requirements: 18.1, 21.22_
- [x] 26.9 Verify the drag in a real browser
  - Neither 26.4 bug is reachable from jsdom: one needs real layout for collision detection, the other needs React to re-render over a moved node. Both passed a green 516-test suite
  - Verified by driving the running app: drop into a populated column (lands under the pointer, no console errors), drop into an empty column (destination highlights mid-drag, card previews there, commits), within-column reorder, keyboard drag across columns, Escape cancel, Enter still opening the drawer, a rejected drop with "fail next operation" armed restoring the exact pre-drag order with a retryable toast, and the sidebar applying valid reorders while refusing invalid ones with the explanatory toast
  - _Requirements: 4.4, 4.5, 4.7, 4.8, 4.9, 4.11, 4.12, 14.12_
- [x] 26.10 Re-check the touch gesture on a device
  - Same gap as 14.7.1, now with a different mechanism behind it: one `PointerSensor` resolving its constraint from `event.pointerType` rather than a separate `TouchSensor`
  - **Closed in task 40.** The migration's mechanism is the one now under test: the delay and tolerance are resolved per event, so the same 260px travel pages the board at 30ms and drags a card at 400ms
  - _Requirements: 20.8_

---

## Phase 11 — Sidebar simplification

Two features built in Phase 5 and removed here. Both were working; both were
removed because what they cost exceeded what they bought.

- [x] 27. Remove the sidebar resizer and the density toggle
- [x] 27.1 Delete the drag-to-resize handle
  - `src/views/sidebar/SidebarResizer.tsx` deleted. It was 112 lines: a pointer-event loop coalesced through `requestAnimationFrame`, a `clientX`-to-rem conversion against the live root font size, window-level `pointermove`/`pointerup` listeners, a `select-none` body class, a double-click reset, ArrowLeft/ArrowRight nudges, and full `role="separator"` ARIA
  - The sidebar now uses two fixed widths: `w-sidebar` expanded, `w-sidebar-rail` collapsed, both already-existing tokens
  - What it actually cost against a per-user width nobody asked for: a 60Hz state loop, a clamp duplicated between two CSS tokens and two JavaScript constants, and the only inline `style=` on a static layout element
  - _Requirements: 6.6, 13.4, 13.4.3, 16.2_
- [x] 27.2 Strip width state from `SidebarContext`
  - Gone: `widthRem`, `setWidthRem`, the `MIN`/`MAX`/`DEFAULT_WIDTH_REM` constants, the `sidebarWidth` persistence key, and the `SIDEBAR_WIDTH_RANGE_REM` export
  - `SIDEBAR_WIDTH_RANGE_REM` was imported only by the resizer, and it held the sole use of `BREAKPOINT_REM` in this module — so that import went too. `minWidthQuery` and `SIDEBAR_STATIC_BREAKPOINT` stay: they feed the one `matchMedia` subscription, which is untouched
  - `collapsed` is now the whole of the sidebar's sizing state, and the width never leaves CSS
  - Orphaned `flowboard:ui:sidebarWidth` entries are left in users' `localStorage` rather than migrated — `readPreference` ignores keys nothing reads, so a cleanup pass would be code that exists to delete three bytes
  - _Requirements: 12.2, 16.2_
- [x] 27.3 Retire the third inline-`style` exception
  - `src/views/sidebar/Sidebar.tsx` no longer carries a `style=` at all. Two remain in the project — `Tooltip.tsx` (portalled overlay coordinates) and `Drawer.tsx` (bottom sheet drag offset) — and both are genuinely per-pointer-event rather than attached to a static layout element
  - Requirement 13.4's count went four → three → two across tasks 26 and 27. The ordinal numbering in the code comments ("the second documented exception") was removed in favour of naming them, since counting to a number that keeps changing is how those comments went stale in the first place
  - _Requirements: 13.4, 13.4.3, 19.9_
- [x] 27.4 Delete the dead width tokens
  - `--spacing-sidebar-min` and `--spacing-sidebar-max` removed from `src/index.css`. Both were already dead _as CSS_ before this task — no utility class ever referenced either, because the clamp lived in JavaScript constants that duplicated their values. That duplication is exactly what 22.x exists to prevent, and it sat there unnoticed
  - `--spacing-sidebar` and `--spacing-sidebar-rail` stay; they are now the sidebar's only two widths
  - _Requirements: 22.1, 22.3_
- [x] 27.5 Remove the density toggle from the sidebar footer
  - The `SegmentedControl` and its surrounding footer `div` are gone, along with `SidebarBody`'s `useDensity()` call. The footer was the only thing in it, so the element went with the control
  - **`DensityContext` is deliberately kept.** The mechanism is the valuable half: `AppShell` still writes `data-density` on the shell root, and the `density-compact` variant — wrapped in `@media (pointer: fine)` so it can never shrink a touch target — is still read by five utilities across `Card`, `Skeleton`, `TreeItem` and `TaskTable`. Storybook's density toolbar global still exercises all five, so they are not dead code
  - **Two consequences, accepted rather than overlooked.** `setDensity` and `toggleDensity` now have no caller in application code. And a user whose stored preference is already `compact` has no in-app route back to comfortable, because the control that could set it is the one removed. Recorded in Requirement 16.3.1 rather than left to be rediscovered
  - Verified the footer control was genuinely the only density setter before removing it: the top bar's overflow menu carries view switches only, `ViewSwitcher` uses `SegmentedControl` for board/list rather than density, and no command-palette action or keyboard shortcut calls either setter
  - _Requirements: 16.3, 16.3.1_
- [x] 27.6 Update the tests and stories
  - Deleted `contexts.test.tsx`'s "clamps the width to the token range and persists it" — nothing in it survives fixed widths. The remaining `SidebarContext` tests all cover the modal/sheet boundary and are untouched
  - `DensityContext`'s own tests stay and still pass: neither renders the sidebar's control, so both exercise the context directly
  - `Controls.stories.tsx` still shows a Comfortable/Compact `SegmentedControl`, driven by local `useState` rather than the context. Left as-is — it documents the primitive, not a shipped feature
  - Corrected two doc comments in `Responsive.stories.tsx` that described the sidebar as resizable, and `uiStorage.ts`'s header, which listed "sidebar width" among the preferences it carries
  - _Requirements: 18.1, 21.22_

---

## Phase 12 — Subtasks on the board

The board showed a subtask count and nothing else, so the drawer was the only
way to see or change a subtask — while the list view's table had nested and
edited them in place since Phase 6. This closes that gap.

- [x] 28. Make a board card disclose and edit its subtasks
- [x] 28.1 Carry subtasks in the board view model
  - `TaskCardViewModel` gained `subtasks: readonly TaskCardViewModel[]`, built recursively in `buildTaskCard`
  - `subtaskCount` and `completedSubtaskCount` are now **derived from that array** rather than re-computed from `statuses`. The badge and the rows it summarises read the same `isComplete` the child card renders, so "1 of 2" cannot disagree with the ticks beneath it
  - Recursion terminates on its own — the Model caps nesting at `MAX_TASK_DEPTH`, so `subtasksOf` returns nothing one level down. An explicit depth guard is kept anyway: raising that cap should deepen the tree deliberately, not hand it an unbounded one and blow the stack on a malformed parent chain
  - _Requirements: 4.13, 21.9_
- [x] 28.2 Split `TaskCard` into wrapper, handle and body
  - The **wrapper** is the sortable element, with expanded subtasks inside it, so dragging a parent takes its visible children along — the invariant the Model already enforces across lists (2.7)
  - The parent **card** is the drag _handle_ via `handleRef`. Without that split, pressing a subtask would start dragging its parent, and the accessibility plugin — which labels `draggable.handle ?? draggable.element` — would put `tabindex` and `aria-roledescription` on a wrapper that is not the thing a user picks up
  - **`TaskCardBody`** is one card's presentation and editing, shared by parent and subtasks: literally one control set rather than two that drift
  - Subtask bodies take no sortable ref, so they carry their own `role="button"` and `tabIndex` to stay keyboard-reachable and Enter-openable
  - _Requirements: 4.13, 4.13.2, 15.5, 17.1_
- [x] 28.3 Make the count the disclosure
  - The same chip, now a button with `aria-expanded` and the label the table already uses — `"Expand subtasks of X"` — so the phrase is one phrase across both surfaces. No new element, and the progress reading stays visible whether the children are open or shut
  - A coarse-pointer minimum height, since a 1rem chip is not tappable and the board is touch-first (20.9)
  - A subtask renders the inert form of the chip, because a subtask cannot itself have children
  - _Requirements: 4.3, 4.13, 20.9_
- [x] 28.4 Narrow the subtask menu to what the Controller allows
  - Omitted: move-to-list (`moveToList` rejects a subtask outright — "Move the parent task instead"), move up/down (`move` computes position over `columnTasks`, which filters to `parentTaskId === null`, so a subtask has no column index), and duplicate (valid, but the copy's position would derive from that same top-level ordering)
  - Kept: rename, status, priority, due date, assignees, complete, delete. The delete entry reads "Delete subtask", so the target is unambiguous when a parent and a child are both on screen
  - A control whose only outcome is a guaranteed error is worse than no control, which is why these are omitted rather than rendered and refused
  - _Requirements: 2.13, 15.2.1_
- [x] 28.5 Hold expansion on the board and thread it down
  - `expandedIds` plus `toggleExpand` on `KanbanBoard`, passed through `KanbanColumn` to each card — the same arrangement `TaskListView` uses for its table rows
  - Board-level rather than per-card because a card unmounts and remounts when a drag moves it between columns; local state would collapse the group under the user's pointer
  - `TaskCard`'s `isPending` changed from a boolean to a predicate, matching `TaskTable`'s prop exactly, so a subtask dims without subduing its parent
  - _Requirements: 4.13.1, 14.7_
- [x] 28.6 Fix the lookups that could not resolve a subtask id
  - `handleToggleAssignee` and `handleDelete` used `columns.flatMap(c => c.tasks).find(...)`. `selectBoardColumns` filters subtasks out of `column.tasks`, so that returned `undefined` for every subtask id — and both callers bail on `undefined`. Assigning a member to a subtask, or deleting one, would have silently done nothing
  - Replaced with a `findCard` helper that searches children too. The announcements name map had the same blind spot
  - **Latent rather than introduced**: the lookups were already wrong for any subtask id, there was simply no way to pass one in before this task
  - _Requirements: 4.13.3_
- [x] 28.7 Test and verify
  - One jsdom test mirroring the list view's existing disclosure test: the reveal, control parity with the parent, the three omitted menu entries, and that an edit on a subtask writes to the subtask rather than the parent
  - `overlayCard()` in `views.test.tsx` assumed the overlay's first child is the card. It is now the sortable wrapper, so it queries by label instead — which is what the assertion actually meant
  - Browser-verified, since the drag half is not reachable from jsdom: both seeded subtasks reveal under their parent; ticking one moved the badge `1/2 → 2/2`; a priority change landed on the subtask; the subtask menu omitted exactly the three actions and read "Delete subtask"; subtasks were not independently draggable; the clone carried none; and dragging the parent to another column took its expanded children along
  - _Requirements: 4.13, 4.13.2, 18.7_
- [ ] 28.8 Collapse the duplicated nesting in the list view's row model
  - `TaskRowViewModel.subtasks` now sits alongside the new `task.subtasks`, so that path carries the nesting twice. The two types are not identical — `TaskRowViewModel` adds per-row status display fields — and the list view works, so this is redundancy rather than a bug
  - Left open deliberately: collapsing it means touching a working surface the request did not cover. Named here rather than discovered later
  - _Requirements: 21.17_

---

## Phase 13 — Default statuses for a new list

Creating a list from the sidebar produced a list with no statuses, so the board
fell through to its "This list has no statuses" empty state. Nothing errored —
and because task creation refuses with `CONFLICT` when there is no status to
file a task under, and there is no status editor, the list could not be used or
repaired through any affordance the app offers. It appeared in the tree,
selected fine, and did nothing.

- [x] 29. Give a created list the default status set
- [x] 29.1 Declare the default set once, derived from the category table
  - `DEFAULT_STATUS_TEMPLATE` in `src/config/statusCategories.ts`, generated by mapping `STATUS_CATEGORIES` — so a list cannot be short a category, and adding a fourth gives new lists a column for it with no second edit
  - `StatusCategoryConfig` gained `defaultStatusName`. Deliberately a second field rather than a reuse of `label`: the label names the _category_ in UI that groups by it ("Not started"), this names the _status_ a list receives ("To do"). Collapsing them puts "Not started" on a kanban column header
  - The config file was already the right home — it owns the categories, their default tokens, their order and the derived terminal category
  - _Requirements: 3.3, 3.3.2, 21.6, 21.18_
- [x] 29.2 Write the statuses inside `containerSlice.create`
  - A `seedDefaultStatuses` helper in the slice, called from the same `apply` that writes the container, at clean multiples of `POSITION_GAP`
  - **Same mutation, not a follow-up.** A second call is a second chance to fail — a realistic one with failure injection armed — and failing it lands in exactly the dead-end state this task exists to remove. One `apply` means the pipeline's snapshot/restore covers the container and its statuses together
  - Gated on `holdsTasks(input.type)` from the registry, not `type === "list"`, matching how `validateListHoldsTasks` and `taskHoldingType` are written, so moving tasks to a different hierarchy level stays a configuration change
  - Ids are `st-${nanoid(8)}`, matching the `st-` prefix the fixtures use and the `t-`/`li-` convention of the other slices
  - The action still returns `Result<Container>`. Widening it to carry the statuses would change a public surface for data no caller wants
  - _Requirements: 1.4, 3.3.1, 3.3.3, 9.5, 10.6, 21.4_
- [x] 29.3 Have the seed read the same declaration
  - `seed.ts` had the only definition of "the default three" — written out per list, and therefore no definition at all for a list created at runtime. Its ten literal rows are now a `statusesFor(listId, idPrefix, extra?)` helper that expands the template
  - Ids stay exactly as they were — `st-bk-todo`, `st-sp-active`, `st-in-done` — because the fixtures are deliberately deterministic and those strings are referenced as literals across the suite and the stories. The helper builds them from the prefix and the category rather than generating them
  - `extra` splices Sprint 14's "In review" in after "In progress", which keeps per-list sets visibly distinct (3.4) while the three it shares still come from the one declaration. Positions stay the same round multiples, so nothing downstream shifts
  - _Requirements: 3.3, 3.4, 9.3, 21.18_
- [x] 29.4 Leave the downstream guards in place
  - The board's `EmptyState` and `taskSlice.create`'s `CONFLICT` are now unreachable through creation, and both stay. They are the honest rendering of a list whose statuses are missing for some other reason — a hand-edited `localStorage` payload, or a status editor that one day allows removal — and defensive code whose guard moved upstream is worth keeping when the alternative failure is silent
  - _Requirements: 2.5, 4.1_
- [x] 29.5 Test it
  - `containerSlice.test.ts` from three angles: a new list has the three statuses in category order, scoped to the right list and workspace, with three board columns and a task that actually files; a folder gets none; and a create refused for Bob leaves neither the container nor a status, asserted against `domainSnapshot`
  - The third is the one that pins "same mutation". A follow-up write would satisfy the other two and fail only that one
  - `config.test.ts` asserts the template's names, that it covers every category exactly once in order, and that it matches `MIN_STATUSES_PER_LIST` — a constant that until now was exported and read by nothing
  - _Requirements: 18.5.1_

---

## Phase 14 — Access is decided, not defaulted

`containerSlice.create` ended its `apply` with `visibility: input.visibility ?? "public"`, and no caller ever passed the argument — the parameter existed, was threaded through `useContainerActions`, and was dead. So every space, folder and list an admin created arrived visible to the entire workspace. "Who can see this" was a question the product never asked, and the answer was always "everyone".

This phase makes it a decision taken at creation and revisable afterwards. The permission walk is untouched: `private` still resets visibility, the nearest grant still wins, admins still bypass. What changes is what data creation writes, and that there is finally a UI that writes grants at all — before this, `draft.grants` was assigned in exactly two places, both in `sessionSlice` (hydrate, reset-to-seed).

- [x] 30. Translate between the stored shape and the decision
- [x] 30.1 Write `src/model/access.ts`
  - `ContainerAccess` is `{ visibility, memberIds }` — the question as a person asks it, against storage that is a `visibility` enum plus a flat `Grant[]`
  - `accessForContainer` reads, `grantRowsForAccess` writes, and both read one `Record<Visibility, AccessRule>` table: `private` → `{ grantMode: "allow", grantMeansAccess: true }`, `public` → `{ grantMode: "deny", grantMeansAccess: false }`. One boolean drives the read (`flagged === grantMeansAccess`) and the write (`chosen === grantMeansAccess`), which is why the two cannot drift
  - A `Record<Visibility, …>` rather than two ternaries, so a third visibility is a compile error at the declaration instead of a silent fall-through to the `public` branch (21.15)
  - `memberIds` excludes any role holding `workspace:bypass`, read through the capability table rather than compared against `"admin"`. An admin's visibility does not come from this list, so a row for her would imply a control that does not exist
  - `accessForContainer` fails closed for a missing or cross-workspace container, matching `canView`: a stale id must not resolve to something permissive
  - `grantsExcluding` is narrowed twice — to this resource, and to user subjects. The first stops a dialog about one list rewriting the workspace's permissions; the second stops a future team grant being deleted by every access save
  - `isUserSubject` is a `Record<GrantSubjectType, boolean>` lookup, not `=== "user"`. A comparison does the same job today and silently keeps team rows the moment the union widens; the lookup makes that widening a missing key and a compile error. It also reads an out-of-union value as `undefined` → preserved, which matters because the persisted payload is validated for shape and not for subject values
  - **The exhaustive-`switch` form was tried first and was wrong.** `return exhaustive` returns the `never` binding's _runtime_ value, so a subject type outside the union came back as the truthy string `"team"` and the row was dropped — caught by the one test that constructs such a row
  - _Requirements: 8.5.1, 8.15.2, 8.16.1, 21.7, 21.8, 21.15, 21.18_
- [x] 30.2 Add `canReach` to the permission engine
  - `canView` and tree reachability are not the same thing, and the gap is a consequence of nearest-grant-wins: an `allow` on a list overrides a denied ancestor **for that list**, so `canView(list)` is true while `selectVisibleTree` still stops at the ancestor and never builds it
  - Nothing enforces with it — enforcement stays on `canView`, because a node someone holds an explicit grant on is a node they were deliberately given. It exists so the access dialog does not tell an admin that Bob has access to a list Bob cannot find
  - _Requirements: 8.16.6_
- [x] 30.3 Validate an access list
  - `validateAccessMembers` — members of the scoped workspace, each at most once. Copied from `validateAssignees`, which solves the identical problem: an id that is not a member persists as a grant row matching nobody
  - `validateGrantableType` — reads the registry's `grantable` flag, so the workspace refuses an access list rather than accepting grant rows the walk would then honour. **First consumer of that flag**, which had been declared since Phase 0 and read only by `config.test.ts`
  - _Requirements: 8.15.3, 8.15.4, 21.4_
- [x] 30.4 Add `container:share` to the capability table
  - Its own capability rather than folded into `container:update`. Renaming a list and deciding who can see it are different powers, and the second is the one that can hand someone the contents of another person's space
  - Four edits in `src/config/capabilities.ts` — the union, `ALL_CAPABILITIES`, `CAPABILITY_LABELS`, and nothing in `ROLE_CAPABILITIES` because `member` does not get it and `admin` holds it through bypass. That is the documented cost of the table, and this is the first capability added since Phase 0, so it is also the test of 21.7's claim
  - _Requirements: 8.9, 8.9.1, 21.7_

- [x] 31. Write access with the container, and let an admin change it
- [x] 31.1 Replace the creation default
  - `visibility: input.visibility ?? "public"` → `const access = input.access ?? defaultAccessFor(input.type)`. One line, and the whole behaviour change
  - `defaultAccessFor` fails **closed** for a grantable type and stays open for one that is not — a level with no way to carry a grant has no way back from `private`, so locking it down would make it permanently invisible. Resolved from `grantable` rather than `type !== "workspace"`, same reasoning as `holdsTasks` over `type === "list"`
  - `CreateContainerInput.visibility` became `access`. The old field was a dead parameter with a misleading name: it suggested visibility was the whole of the decision when half of it lives in grant rows
  - The fallback is not the UI's path — the create form always sends an explicit value. It exists so a programmatic caller that forgets cannot publish a container to the workspace by omission
  - _Requirements: 8.15, 8.15.2, 8.15.3, 21.4_
- [x] 31.2 Write the grants in the same `apply`
  - A `writeAccess` helper in the slice, called from `create` and from `setAccess`, so an access list chosen at creation and the same list chosen a minute later cannot produce different rows
  - Same recipe as the container and its statuses. The failure a follow-up write would cause here is quieter than the missing-statuses one and worse: a container that exists, appears in the sidebar, works perfectly, and is visible to a set of people nobody chose. No error state, no empty state, no symptom until someone sees something they should not
  - _Requirements: 1.4, 8.15.1, 9.5, 10.6_
- [x] 31.3 Add `containerSlice.setAccess`
  - Validates existence, grantability and the member list; authorizes `container:share`; writes `visibility` and the resource's grant rows in one `apply`
  - Returns `Result<Container>` like `rename`. The grants are not in the result because no caller wants them — the dialog re-reads through the selector
  - _Requirements: 8.16, 8.16.1, 9.5, 10.6_
- [x] 31.4 Add the selectors and the view model
  - `selectContainerAccess` is gated on `canView`: an access list is itself information about a resource, so it should not leak for one the caller cannot see
  - `selectWorkspaceMemberships` pairs each user with the role they hold in the scoped workspace. `selectWorkspaceMembers` already returned the users, but the picker needs the role too, and resolving it per row in the View would be the View deciding permissions (8.12)
  - `useContainerAccess(containerId)` for an existing container, `useAccessMembers(parentId)` for one that does not exist yet. Both share one `buildMembers`, so the list renders identically in either dialog
  - `blockedByAncestor` is computed from `canReach` against the **parent**, so it is answerable before the container exists and is independent of the pending selection
  - `TreeRowViewModel` gained `grantable` and `restricted`. The selector already carried the whole `Container`; the row model had dropped `visibility`
  - _Requirements: 8.12, 8.16, 8.16.6_

- [x] 32. Build the control
- [x] 32.1 `AccessFields` — one control, used in both dialogs
  - A member list where every row means "has access", with "Everyone in the workspace" as the select-all above it. Ticking fills the list, clearing empties it, and a partial selection reports `mixed`
  - `visibility` is derived, not chosen: everyone selected → `public`, anything less → `private` plus an `allow` per tick. That is the honest mapping, because `public` is also what admits members added later — which is what "Everyone" claims and a list of three names does not
  - **Built as a two-option segmented control first, and replaced in 34.1.** Recorded here because the reason is the useful part — a mode control gave the same list two states that looked identical and saved differently
  - A bypassing role's row is ticked, disabled and captioned "always has access". Hidden, it would read as "the admin has no access", which is the opposite of true. Bypassing roles are also excluded from the select-all arithmetic, or "Everyone" would be unreachable
  - A summary line states the consequence in words, including the two notable cases: "Only admins will be able to see this list", and the "including anyone added later" clause the checkboxes cannot show
  - _Requirements: 8.16.3, 8.16.4, 8.16.5, 8.16.6, 20.9_
- [x] 32.2 Put it in the create form
  - `ContainerFormDialog`'s create mode now carries name + access, seeded from `defaultAccessFor` so the form opens restricted and the admin widens it deliberately. Shown only where the registry says the type is grantable
  - **Removed the `sr-only` submit button** while here. It existed so Enter submits, and it put two controls named "Create" in the same dialog — audible to a screen reader, and ambiguous to a test. The footer button now carries `type="submit" form={id}`, which associates it with a form the Dialog renders it outside of, so Enter works with one control (17.1)
  - _Requirements: 8.15, 17.1_
- [x] 32.3 Add the manage-access dialog
  - A third `access` mode on `ContainerFormRequest`, so the sidebar keeps one piece of dialog state and one mount point. `requestKey` became an exhaustive switch over the three
  - Separate form component because it shares no field with create — the name is read-only context here — but it renders the identical `AccessFields`
  - A local draft committed on save. Per-checkbox writes would make a half-made decision live, and would pay the simulated latency three times for one thought
  - _Requirements: 8.16, 8.16.2_
- [x] 32.4 Reach it from the tree, and show the state on the row
  - "Manage access" in `TreeItem`'s context menu, rendered only where `row.grantable`, gated on `container:share` with its own `disabledReason` — kept separate from `canEditStructure` so the two capabilities stay distinguishable in the UI as well as in the table
  - A lock icon and an `sr-only` "Restricted access" on a private row. Without it, restricted access is invisible until someone opens the dialog; with the text, the state is never icon-alone (17.7)
  - _Requirements: 8.16, 8.16.7, 17.7_

- [x] 33. Test it
- [x] 33.1 `access.test.ts` — the round trip, not two mappings
  - Every mode and selection saved and read back, asserted as a property. Two mappings asserted separately both pass while disagreeing with each other, which for a permissions mapping is the one failure that matters
  - Plus: a bypassing role never appears in a list or a written row; `governedMemberIds` follows an injected capability table rather than the name `admin`; a grant on another resource or another subject type survives a save; `defaultAccessFor` is restricted for every grantable type and open for the one that is not
  - The other-subject-type case is what caught 30.1's `return exhaustive` bug. It is the only test in the file that constructs data the type system says cannot exist, and it earned its cast
  - _Requirements: 8.5.1, 8.15.2, 8.16.1, 18.5.2_
- [x] 33.2 `containerSlice.test.ts` — the mutation
  - A new container reaches admins only and writes **no** rows, because restricted means "nothing written" rather than "everyone denied"; a chosen member gets exactly one `allow`; "Everyone" minus someone writes exactly one `deny`; a non-member in the list is `VALIDATION`; a refused create leaves no grant, asserted against `domainSnapshot`; `setAccess` grants, revokes, round-trips through the selector, refuses a member with `FORBIDDEN` on an untouched snapshot, and refuses the workspace itself
  - The old `expect(created?.visibility).toBe("public")` is gone, and the test that passed `visibility: "private"` is now the one that asserts the restricted default — the behaviour it was checking is now the default rather than an option
  - _Requirements: 8.15, 8.15.1, 8.16, 18.4, 18.5.2_
- [x] 33.3 `views/sidebar/access.test.tsx` — the UI reaches it
  - Six cases, each asserted by **switching user and reading the tree** rather than by inspecting grants: the form opens restricted and says so; a space created with Carol ticked is hers and not Bob's; an admin's row is ticked, disabled and captioned; revoking Bob on Backlog leaves Sprint 14 his; the seed's deny on Infra can be lifted; the menu item is disabled with a reason for a member
  - Asserting through the tree is the point. Asserting grant rows would pass with a broken dialog
  - _Requirements: 8.15, 8.16, 18.7.1_
- [ ] 33.4 Re-cut the seed around the new default
  - The fixtures still use `public` for most containers, which is now a choice the seed makes rather than the one creation makes for it. That is defensible — "Everyone" is still a legitimate mode, and the public/private/deny arrangement _is_ the 30-second demo — but it means the seeded tree does not demonstrate the new default, and a reviewer sees it only by creating something
  - Left open deliberately: roughly eight tests assert the exact node sets the current grants produce, and re-cutting it trades a working demo for a consistency nobody can see. Named here rather than discovered later
  - _Requirements: 8.14, 9.2_
- [ ] 33.5 Carry access into the README's permission section
  - 24.4 documents the resolution algorithm, the admin bypass and the view/edit split. It now also needs the access translation, the closed-by-default creation rule and the `container:share` capability — and the extension note should say that teams are additive because a save preserves non-user rows
  - _Requirements: 19.4, 19.12_

---

## Phase 15 — "Everyone" is a checkbox, not a mode

Phase 14 shipped `AccessFields` with a two-option segmented control — Everyone / Selected people — above the member list. It worked, and it was the wrong shape.

A mode control put the same list of checkboxes into two states that looked identical and behaved differently: a ticked row meant an explicit `allow` under one and nothing at all under the other. So the rows on screen did not determine what would be saved, and the control needed an asymmetric rule to stay safe — switching to Everyone had to tick every member, because an unticked member in that mode is an _explicit deny_, and carrying a sparse selection across the switch would have turned "not granted yet" into "actively blocked". That rule was correct and invisible, which is the worst combination for a permissions control.

- [x] 34. Replace the mode with a select-all
- [x] 34.1 Make "Everyone in the workspace" a checkbox over the member list
  - Checking it selects every governed member; clearing it deselects every one. A partial selection reports `mixed` via `Checkbox`'s `indeterminate`, so the next click reads as "include everyone" rather than as a toggle from a state it does not describe
  - `SegmentedControl` is gone from this file, along with the `Globe`/`Lock` icons and the `ariaLabel`. The primitive itself stays — `ViewSwitcher` and the control stories still use it
  - Bypassing roles stay out of the arithmetic. Counting them would make "Everyone" unreachable, since the access list cannot grant what a bypass already gives
  - One control, so it lands on creation and on editing together — `ContainerFormDialog` renders the same component in both and needed no change
  - _Requirements: 8.16.3, 8.16.3.1, 8.16.3.2_
- [x] 34.2 Derive `visibility` from the selection
  - Everyone selected → `public` with no exception rows; anything less → `private` with an `allow` per tick; nothing selected → `private` with no rows, which is admins only
  - **Deliberately not normalised on open.** A container stored as `public` with a deny row — the seed's Infra list — renders correctly and, left untouched, saves back exactly what it read. Only a real interaction re-derives. Without that, opening the dialog and pressing Save would rewrite `public` + deny into `private` + allows: the same access for every current member, a different answer for the next person hired, and caused by an admin who changed nothing
  - The Controller still expresses `public` + `deny` in full, and `containerSlice.test.ts` still covers it. This narrows the control surface, not the model
  - _Requirements: 8.16.4, 8.16.4.1, 8.16.4.2_
- [x] 34.3 Update the tests
  - The two assertions that queried `role="radiogroup"` now query the select-all checkbox, and the restricted-by-default case additionally asserts that every member row starts clear — which the mode control's checked radio was standing in for
  - Two new cases: ticking and clearing Everyone fills and empties the list and swaps the summary copy; and a partially filled list reports `aria-checked="mixed"` and completes in one click
  - No Model or Controller test changed, which is the signal that this was a View change
  - _Requirements: 8.16.3.2, 18.7.1_

---

## Phase 16 — The tooltip avoids the viewport, not just the overflow

`Tooltip` was portalled to `document.body` and positioned `fixed` back in Phase 4, which fixed the overflow clip it was written for. It left a second kind of clipping standing, and the two are easy to confuse: escaping an overflow ancestor gets the tooltip _painted_, and does nothing about it running off the screen.

The portalled version centred on its trigger with a transform — `-translate-x-1/2 -translate-y-full` and friends. Cheap, no measurement, and for exactly that reason incapable of avoiding an edge: a tooltip that does not know its own size cannot know it is about to overflow. A tree row a rem from the left edge, a breadcrumb at the top of the window, an avatar on the rightmost board column all overhung.

Reference taken from shadcn/ui's Tooltip, which is a thin wrapper over Radix's `Tooltip.Content` — so the behaviour being copied is Radix's, and the relevant props are `avoidCollisions`, `sticky: "partial"`, `collisionPadding` and the `data-side` attribute. Confirmed current via context7 against `/shadcn-ui/ui` and `/websites/radix-ui_primitives`.

- [x] 35. Make the tooltip collision-aware
- [x] 35.1 Extract the geometry into `src/lib/tooltipPlacement.ts`
  - `resolveTooltipPlacement(anchor, size, preferred, { gap, padding, viewport })` — pure arithmetic over two rectangles, no React, no DOM reads, no `window`
  - Pure because jsdom has no layout: every rect is zero, so a rendered tooltip can never be asserted to have landed anywhere. The same wall the board's drag arithmetic hit, answered the same way — isolate the maths, test it, and leave the component only the measuring
  - `OPPOSITE` and `CROSS_AXIS` are `Record<TooltipSide, …>` rather than `switch` statements, so adding a side is a missing key and a compile error (21.15, 21.18)
  - _Requirements: 13.4.1.1, 13.4.1.3_
- [x] 35.2 Flip, then shift
  - **Flip** (Radix `avoidCollisions`): the opposite side is used when the preferred one has no room and the opposite does. When neither fits the preference wins — flipping into a second overflow trades one clipped edge for another while moving the tooltip away from where the user is looking, and the cross-axis clamp still limits the damage
  - **Shift** (Radix `sticky: "partial"`): cross axis only, clamped to a collision padding. A trigger in a corner needs the tooltip to slide _along_ the edge; sliding the main axis would put it somewhere other than beside the thing it describes, which is worse than an overhang
  - `collisionPadding` is `0.5rem` where Radix defaults to `0`. Flush against the edge is legible and reads as a rendering accident
  - Both offsets still convert from rem against the real root font size, so a user at 150% gets proportionally more of each (13.4.1, 22.1)
  - _Requirements: 13.4.1.1_
- [x] 35.3 Rework the component around a measurement
  - The `TRANSFORM` record is gone; the tooltip is placed by `top`/`left` alone, which is what lets the maths see its own size. The inline-`style` exception is unchanged in kind and still one of the documented two (13.4)
  - Unplaced, the bubble renders **`invisible`, not `hidden`** — `visibility: hidden` still generates a box, which is what makes it measurable, where `display: none` reports `0×0` and the measurement it is waiting on could never resolve
  - Measured in a `useLayoutEffect`, so the unplaced frame never reaches a paint. No loop: `measure` keeps a stable identity across the render its own `setPlacement` causes, and one measurement stays valid because `max-w-64` makes the bubble's size independent of where it sits
  - A zero-size read is treated as "not rendered" and leaves the placement alone. That covers the coarse-pointer case (`hidden can-hover:block`) and jsdom, and the inference is sound rather than lucky: the bubble carries padding, so a rendered one is never `0×0` even with empty content
  - The bubble is a `useRef` while the trigger stays in state. The trigger's ref callback is passed through `cloneElement` during render, which the React Compiler rejects; the bubble is only read inside a layout effect, after commit, where a ref is correct and state would cost a render
  - `data-side` reports the side actually used, matching the attribute Radix sets, so a direction-aware style reads where the tooltip is rather than where it was asked to go. `side` is now documented as a preference
  - _Requirements: 13.4, 13.4.1.2, 13.4.1.4_
- [x] 35.4 Test the arithmetic, and correct what the old test was really asserting
  - `tooltipPlacement.test.ts`: 14 cases — the four flips, the shift at each of the four edges, the main axis never shifting, neither-side-fits, padding counting toward the fit decision, and the over-wide tie-break
  - `Tooltip.test.tsx`'s side suite asserted the transform classes, which no longer exist. It now asserts `data-side`, plus that an unplaced bubble stays measurable — the one component-level invariant that a regression to `hidden` would break and nothing else would catch
  - The portal and `aria-describedby` tests are untouched and still pass, which is the signal that the overflow fix was not disturbed by the viewport one
  - _Requirements: 13.4.1.3, 18.1_
- [x] 35.5 Decide against adopting Radix, and record why
  - It would have been the smaller diff. Against it: Requirement 13.10 approves Headless UI and dnd-kit, and Headless UI already supplies every overlay here except the tooltip — a second headless kit for one component is a poor trade
  - shadcn's version also needs a `TooltipProvider` at the root and a compound `Root`/`Trigger`/`Content` API, where this project's seven call sites are a single `<Tooltip content side>{child}</Tooltip>`; wrapping Radix back into that shape means owning a wrapper over a wrapper
  - And the one behaviour this tooltip has that Radix does not — coarse-pointer suppression through the `can-hover` variant with no JavaScript check — would have had to be reimplemented on top of it
  - What Radix offers beyond what was built: `align`/`alignOffset`, arrows, and `collisionBoundary` beyond the viewport. None has a call site here. If a second collision-aware popover appears, Floating UI directly beats either option
  - _Requirements: 13.10_
- [ ] 35.6 Verify the flip and the shift in a browser
  - The arithmetic is unit-tested and the placement is not, for the same reason the drag is not: jsdom reports every rect as zero, so the component's measure step resolves to "not rendered" in every test and the collision path is never actually walked there
  - Needs a visual check at the four edges — a sidebar tree row at the left, a breadcrumb at the top, the rightmost board column's avatars, and a card at the bottom of a column — plus one pass at a 150% root font size to confirm the converted gap and padding scale. Folds into 19.6
  - _Requirements: 13.4.1.1, 20.11_

---

## Phase 17 — Close the coverage gaps that are real

`npm run coverage` reported 86.23% statements and 75.57% branches over the Model, Controller and config layers. Reading the per-file breakdown rather than the total turned up one slice with effectively no tests, one behavioural promise kept in only one of the three places that make it, and a long tail that is not a testing gap at all.

The headline: `statusSlice.ts` at **7.4% statements, 0% branches**, while its own doc comment read "the actions exist and are tested". The design doc had already caught a version of that claim once and corrected the prose; this time the fact was corrected instead.

- [x] 36. Cover the untested behaviour
- [x] 36.1 `statusSlice.test.ts` — 7.4% → 100% lines
  - `rename` and `reorder`: success, trimming, the shared container-name field rules, stale-id `NOT_FOUND`, and a member's `FORBIDDEN` against an untouched `domainSnapshot`
  - That statuses are owned per list — renaming Backlog's "To do" leaves Sprint 14's alone, and reordering one list cannot disturb another's order. The bug an unfiltered `Object.values(draft.statuses)` would introduce
  - That a denied list and an insufficient role produce _different_ messages, which is the one place in the suite that proves 8.11 for `status:update`
  - That the slice's surface is exactly `rename` and `reorder`. There is deliberately no `create` or `delete` — creation happens inside `containerSlice.create` so a list and its statuses land together, and nothing may take a list below the per-category minimum. Asserting the surface is what stops either being added without that invariant being reconsidered
  - **Why this one mattered most**: with no status editor in the UI, these actions are the only thing that exercises `status:update` at all. A change to the capability table could have opened or closed status editing and no test would have noticed
  - _Requirements: 3.1, 8.9, 8.11, 18.12.1_
- [x] 36.2 `sessionSlice.test.ts` — 69.8% → 100% statements
  - The guards `persistence.test.ts` does not reach: a user who exists but holds no membership in the scoped workspace is a different failure from one who does not exist, and both must leave `currentUserId` alone. Same for `setActiveWorkspace`, where a workspace can be indexed in `workspaceIds` and still not be one this user belongs to — the guard that makes a workspace switcher safe to build
  - `hydrate` lowering its flag when the adapter resolves `null`. Dropping the flag only inside the `if (stored)` branch would strand the app behind skeletons on a first visit, which is the one run where nothing is stored
  - **`beginListLoad`'s last-write-wins rule needed a transport settled one call at a time.** The obvious test — start both loads, `await` the first — passes whether the guard exists or not, because awaiting flushes both continuations and the flag is already null by the time the assertion runs. Writing it the obvious way first is what surfaced that; the version that ships resolves each transport call by hand
  - _Requirements: 8.2, 8.3, 14.2, 18.12.1_
- [x] 36.3 Cover `moveTaskToList`'s subtask co-move
  - Requirement 2.7 — a subtask follows its parent between lists — is promised by the drag path, the drawer and the card menu, and was kept by one test covering the drag. `moveTaskToList`'s own subtask loop (lines 427-436) was reached by nothing
  - Now asserted from both ends: the subtasks land in the parent's new list with a status that belongs to it, and each keeps its _category_ where the destination has one rather than being dumped into the first status
  - _Requirements: 2.6, 2.7_
- [x] 36.4 Cover every slice's stale-id path
  - A missing container, task or status returns `NOT_FOUND` from every action that takes one — `rename`, `archive`, `unarchive`, `reorder`, `move`, `setAccess`, `update`, `remove`, `moveToList`, `toggleComplete`, `duplicate` — with the domain snapshot unchanged
  - Plus the adjacent cases: a missing create-parent, a missing move destination, a missing destination status, archiving something already archived, unarchiving something that is not, and refusing to restore a child while its parent is still archived
  - `unarchive` authorizes against the _parent_, because `canView` denies an archived node to everyone. That indirection is only correct while the missing-container case still returns `NOT_FOUND` rather than resolving `parentId` off `undefined`, which is what this pins
  - Also: the workspace node refuses rename, archive and `setAccess`, all three resolved from registry flags rather than a type comparison
  - _Requirements: 18.4, 18.12.1, 21.4_
- [x] 36.5 Cover the remaining validators and payload rejections
  - `validatePriority` — the one task field that arrives as an `unknown` from a persisted payload or a URL. Asserted over `PRIORITIES` rather than three literals, so the set stays read from the registry
  - `validateAssignees`' ceiling: exactly `MAX_ASSIGNEES` accepted, one past it refused, and the count reported _before_ the membership complaint so the message is the useful one
  - `validateSubtaskList` with a parent that is gone
  - `deserializeState`'s remaining rejections — non-object payload, missing or non-object state, each named entity map, a map stored as an array, each missing list, a non-string active workspace — plus the case that must still pass: an **empty** workspace id, which is what `createEmptyState` produces and is empty rather than corrupt
  - _Requirements: 2.2, 9.11, 18.5_
- [x] 36.6 Cover the registry's error paths
  - `containerConfig` throwing on a type it does not describe; `taskHoldingType` refusing a registry with zero or two task holders; `isMutableType` and `isGrantableType` reading the flags
  - `isPriority` and `isViewId` over their full registries — both have production callers, and both are why an unknown stored value falls back rather than propagating as a nonexistent key
  - `roleBypassesChecks` denying a role the table does not describe, which is what `canView` relies on to deny rather than throw
  - Reachable only through a synthetic registry, which is the point: the logic takes a registry argument precisely so it is not welded to the production one
  - _Requirements: 18.9, 21.4, 21.7_

- [x] 37. Say what is deliberately uncovered, as categories
  - 86.23% → **91.88% statements, 82.53% branches**, 584 → 645 tests. The remaining gap is now describable rather than a list of line numbers
  - Two categories stay uncovered by design (18.12.2): invariant `throw`s the pipeline makes unreachable — `"vanished mid-mutation"`, `"Cannot reorder a root container"` — and branches the type checker requires but control flow precludes, such as `statusSlice`'s `authorize` re-checking existence after `validate` refused it, `persistence.ts`'s re-narrow of `containers`, and `validateParentType`'s label fallback behind a lookup that throws first
  - Naming them as categories is what keeps the rest readable. Arguing each uncovered line at review time is how a genuine gap ends up filed alongside the harmless ones
  - The View stays outside the measurement: its tests assert behaviour through the real shell, and counting their lines would measure how much JSX a test happened to render
  - _Requirements: 18.12, 18.12.2_

- [ ] 38. Decide what to do about the unused exports
  - The low numbers on `state.ts` (50%), `hierarchy.ts` (62%/38% branches), `result.ts`, `position.ts` line 53, `views.ts` line 36, `priorities.ts` line 123 and `statusCategories.ts` line 160 are **not** missing tests. They are exports with no caller anywhere — not in production, not in tests, not in the e2e suite:
    - `state.ts` — `statusesInWorkspace`, `usersInWorkspace`, `grantsForResource`
    - `hierarchy.ts` — `depthOf`, `siblingsOf`, `canMoveUnder`, `creatableChildTypes`
    - `result.ts` — `isErr`
    - `position.ts` — `byPosition`
    - `views.ts` — `viewMeta`; `priorities.ts` — `priorityConfig`; `statusCategories.ts` — `isStatusCategory`
  - Deliberately **not** tested (18.12.3). A test for an unused export records that dead code behaves as written, lifts the measured number, and makes the code harder to delete afterwards
  - Two are worse than merely unused. `canMoveUnder` re-implements the rule `validateContainerMove` already owns and which is the one actually enforced — a second source of truth for "can this move", which Requirement 21.17's one-vocabulary rule exists to prevent. `grantsForResource` and `usersInWorkspace` are a parallel, unused implementation of scoping that `selectors.ts` does inline
  - `ancestorsOf` is a separate case: used internally by `isDescendantOf`, exported for nobody. Narrowing the export is enough
  - **Requirement 21.20 says lint SHALL fail on unused exports, and it does not** — the rule was never configured, which is why this accumulated silently. Removing the thirteen and wiring the rule is the fix that stops it recurring; `unwrap` went the other way this phase and now has callers in the two new slice tests
  - Left open because deleting exported Model functions is a decision, not a cleanup
  - _Requirements: 18.12.3, 21.13, 21.17, 21.20_

---

## Phase 18 — The two E2E gaps the brief cares about

Reading the brief's section 8 against the suites: its minimum — "unit/store tests for permission filtering on the tree and task access" plus "at least one component test or E2E" — was already met several times over. But the E2E suite had seven specs for drag, drawer, navigation, persistence, smoke, rollback and tree reparenting, and nothing for the one flow the brief singles out twice: "switching users must immediately reflect what the tree and boards show", and "Alice vs Bob difference is demoable in under 30 seconds."

- [x] 39. `e2e/permissions.spec.ts` — the demo, in a browser
- [x] 39.1 Assert through the tree, never the store
  - Nine specs: the switcher names its current user and role; Alice sees the private Marketing space and Bob does not while Carol's allow grant brings it back; Bob's explicit deny on Infra beats public inheritance while Platform stays visible with the "no lists you can access" hint; all three users' complete trees compared as `"{level}:{name}"` strings; a list that becomes invisible explains itself and offers a working way out; structural actions disabled for a member with a reason and enabled for an admin; restricting a list through the dialog removes it for whoever was unticked; and a newly created space reaching admins only
  - Whole-tree comparison rather than probing row by row, and with levels included — so a reparent could not masquerade as a visibility change. A spec that read `localStorage` for grant rows would pass with a sidebar rendering the wrong thing, which is the bug worth catching
  - _Requirements: 8.3, 8.11, 8.12, 8.13, 8.14, 8.15, 8.16_
- [x] 39.2 Fix the `aria-label` defect the first assertion found
  - `UserSwitcher` set a descriptive `aria-label` on its trigger — "Switch user — currently Alice Nguyen, Admin" — and the DOM carried only "Switch user". `Menu` renders its trigger through `MenuButton as={Fragment}`, which merges the menu's own props onto the child, and an explicit prop there wins over one the child set itself. The code's comment said it was "named here rather than relying on the menu wrapper"; the wrapper was overwriting it
  - Invisible to every existing test because they all match the name as a substring, and a substring of the short label is also a substring of the long one
  - It mattered most where it was least visible: below `sm` the name and role are not rendered, so the accessible name is the only thing telling a screen-reader user who they are acting as (Requirement 8.2). Fixed by passing the descriptive string as `Menu`'s `label`
  - _Requirements: 8.2, 17.1_
- [x] 39.3 Add `closeTree` and `checkboxRow`, both for reasons worth recording
  - **`closeTree`** — below `lg` the sidebar is a focus-trapping `Dialog`, and Headless UI hides the rest of the document from the accessibility tree while one is open, so the top bar's switcher is not merely covered but _unfindable by role_. `switchUser` closes the sheet for its caller
  - It must test **attachment, not visibility**: the element carrying `role="dialog"` is `Drawer`'s `relative z-40` wrapper, and every child of it is `fixed`, so its own box collapses to zero height and `isVisible()` reports false while the sheet is plainly on screen. The first version used `isVisible()`, became a silent no-op, and left five specs timing out
  - **`checkboxRow`** — `getByRole("checkbox")` resolves to the `<input>`, which `Checkbox` renders `sr-only` behind a styled `<span>`. Playwright's hit test at its 1px centre never resolves to it, so `check()`/`uncheck()` retries until the test times out. Click the label, assert the role
  - _Requirements: 17.2, 20.4_
- [x] 39.4 Skip the two dialog-driven specs on mobile, with the cause established
  - Chromium's mobile emulation reports `window.innerWidth` 788 while `documentElement.clientWidth` and `visualViewport.width` both report 412 — an initial containing block about 1.9× the visible viewport. Media queries read the real width, so the app renders its phone layout correctly; but `Dialog`'s wrapper is `fixed inset-0 flex items-end`, so the panel lays out against the larger box and its footer lands near y=1533 in a visible area 839 tall. Playwright clicks in visual-viewport coordinates and the wrapper intercepts every attempt
  - **Established as emulation rather than a bug** before skipping anything: with the create dialog open there is exactly one `fixed inset-0` wrapper and exactly one "Create" button, and both flows pass on chromium. A failure screenshot appearing to show two dialog footers was the same artifact, not two dialogs
  - The navigation sheet never hit this because `Drawer` anchors its panel `inset-y-0 left-0`, so top-aligned content stays inside the visible area — which is also why no existing mobile spec caught it first
  - _Requirements: 13.4_

- [x] 40. `e2e/touch-drag.spec.ts` — close the oldest open item
  - Tasks 14.7.1 and 26.10 carried "needs a real phone" across two phases. What they actually needed was a touch event stream: `page.touchscreen` offers only `tap()`, so `helpers/touch.ts` dispatches `Input.dispatchTouchEvent` over CDP
  - The claim under test is a **discrimination**, not a feature. One `PointerSensor` serves mouse, pen and touch and resolves its constraint from `event.pointerType` — 8px of travel for a fine pointer, a 200ms press with 10px tolerance for a touch — so what matters is that the same gesture does different things either side of 200ms. The same 260px of travel pages the board at `holdMs: 30` and drags a card at `holdMs: 400`
  - Three specs: a quick horizontal swipe pages the board and moves no card; a quick vertical swipe moves no card and raises no overlay; a held press reorders the column. **The first two are what would catch a regression** — a suite that only proved dragging works would pass with the activation delay removed entirely, which is precisely the state that makes the mobile board unusable
  - The fixed `holdMs` wait is the one case where a sleep is the subject rather than a smell, since the threshold being straddled is itself a duration. Noted in the helper so it is not "cleaned up" later
  - The vertical case asserts the _absence_ of a drag rather than a scroll offset: the seeded column may not overflow at this viewport, so a zero offset would be a false failure, while "no card moved and no overlay was raised" holds either way
  - _Requirements: 20.8, 20.9_

- [ ] 41. Decide what to do about the seed's reference date
  - Seed dates derive from a fixed `SEED_NOW` of 2026-10-16 while the app reads real wall-clock time (`KanbanBoard.tsx`, `TaskListView.tsx`). The task the seed comments as "Due today — the warning tone on DueDateChip" renders as overdue in the danger tone, and will drift further
  - Requirement 9.3 asks for "one overdue task and one task due today, so the UI and tests are stable across runs". The tests are stable; the UI is not
  - **No test can see this, and that is the interesting part**: both harnesses pin the clock — `TZ=Asia/Kolkata` plus an explicit `SEED_NOW` in jsdom, `page.clock.setFixedTime(SEED_NOW)` in `e2e/fixtures.ts`. The determinism that makes the suites trustworthy is exactly what hides it. The comment in `e2e/fixtures.ts` calls SEED_NOW "a date in the future relative to real today", which was true when written and stopped being true on 2026-10-17
  - Two fixes, and it is a product decision which: derive the seed from real `Date.now()` so the demo is always current, or pin the app's reference time so it always matches the fixtures. Left open because the choice changes what a reviewer sees on first load
  - _Requirements: 9.3, 18.8_

---

## Phase 19 — Subtasks are editable in the drawer too

The drawer's subtask section offered create, toggle, open and delete. Task 16.8
recorded that as a deliberate narrowing: a second full field set nested inside a
drawer would be a drawer inside a drawer.

The comparison was the error. These are inline chips on a row — the same
controls a table cell holds — not a nested panel. What the restriction actually
produced was the one subtask surface that could tick a subtask but not
re-prioritise it, while both surfaces a user reaches that drawer _from_ could:
the list view's nested rows since Phase 6, and the board's subtask cards since
Phase 12. Three views of one subtask, two of them editable.

- [x] 42. Give the drawer's subtask rows the list view's control set
- [x] 42.1 Add a field write that takes a subtask id
  - `onSubtaskUpdate(subtaskId, input)` on `DrawerViewModel`, mirroring `useTaskTable.onQuickUpdate` deliberately so the drawer's rows and the table's rows reach the Controller by the same shaped route
  - **This is the whole reason the feature needed a Controller change.** `onFieldSave` closes over the drawer's own `taskId`, so it can only ever edit the parent. Routing a subtask edit through it would not have thrown — it would have changed the parent's priority while the user watched the child's row. A silent wrong-target write, not a refusal
  - Added to the `callbacks` object, the outer memo's deps, and the `Omit` union on `EMPTY_DRAWER` — that union names every callback, so a new one that is not listed stops the empty-state object type-checking
  - _Requirements: 7.4.1, 7.4.1.2_
- [x] 42.2 Make `DrawerSubtask` the view-model that already exists
  - It was `{ id, title, isComplete }` — enough for a checkbox and nothing else. The rows need `statusId`, `priority`, `dueDate` and resolved `assignees`
  - Now `type DrawerSubtask = TaskCardViewModel`, built by the exported `buildTaskCard` the board and the table already use. Widening it by hand would have made a fourth bespoke shape for one task's display state; this way the overdue tone, the avatar tokens and the priority token resolve once for all three surfaces
  - _Requirements: 7.4.1, 13.6, 21.17_
- [x] 42.3 Rebuild the row on the phone form's layout, not the table's
  - The drawer is `32.5rem` at its widest and a bottom sheet below `md`. Five table columns do not fit that, so the rows follow `TaskCardList`'s stacked idiom — a title line, then a wrapping line of chips. The list view had already solved this exact width problem (20.6)
  - Every control is an existing primitive: `InlineTextField`, `StatusPicker`, `PriorityPicker`, `DueDatePicker`, `AssigneePicker`, `Checkbox`. Nothing new was written at the control level, which is why the chips look and behave identically to the table's
  - Read-only degrades through the primitives: each picker renders an inert badge rather than a disabled button, so nothing absorbs a click meant for something else (7.10, 15.4)
  - The existing `aria-busy` plus `opacity-60` per row still applies, keyed by subtask id through `usePendingAction` — the fixed `h-11 can-hover:h-8` became padding, since the row is now two lines
  - _Requirements: 7.4.1, 7.4.1.3, 7.10, 14.7, 20.6_
- [x] 42.4 Keep the route to the subtask's own drawer
  - The title becoming click-to-edit spends the click that used to open it, so the row gained an explicit open control beside delete, revealed by the same `can-hover` group
  - Not decoration: the subtask's description and its created/updated metadata are the one thing the inline controls do not cover, and 15.10.1 depends on that route existing
  - _Requirements: 7.4.1.4, 15.10, 15.10.1_
- [x] 42.5 Fix the drawer's reference time
  - `TaskDrawer` now fixes `now` at mount and passes it to `useTaskDrawer`, as `KanbanBoard` and `TaskListView` already did
  - Correctness: every subtask row resolves "overdue" against it, so reading the clock per row would let two rows disagree about whether today is today
  - Cost: `useTaskDrawer`'s `data` memo depends on `now` now that it builds card view-models, so a fresh timestamp per render would re-run every selector behind the view-model on every render
  - _Requirements: 15.8_
- [x] 42.6 Test it
  - Five cases in `views.test.tsx`: control parity with a list row; a priority change landing on the subtask **and leaving the parent's priority unchanged**; a status change staying inside the parent's list status set; a rename committing on blur; and a view-only capability table degrading every picker to an inert badge while the open control survives
  - The parent-unchanged assertion is the one that matters — it is the bug 42.1's signature prevents, and it would pass vacuously against a correct implementation while failing loudly against the obvious wrong one
  - Requirement 2.13 needed no handling: move-to-list, reorder and duplicate were never offered by this list, exactly as they are never offered by a table row
  - _Requirements: 7.4.1, 7.4.1.2, 18.7_
- [x] 42.7 Fix the `matchMedia` leak the new tests exposed
  - `the off-canvas sidebar` suite overrode `window.matchMedia` in a `beforeEach` and never restored it. `window` is shared across the file, so every test declared after it ran in off-canvas mode, where the sidebar tree is **absent from the DOM** rather than merely off-screen
  - Nothing failed, because no later test needed the tree. The next one that did — mine, navigating to Sprint 14 — failed with "unable to find role tree", which reads as a bug in the new test rather than in the old one. That is the expensive kind of leak
  - Restored in an `afterEach`, bound to `window` because `matchMedia` needs it as a receiver
  - _Requirements: 18.1, 21.22_

---

## Phase 20 — A column is coloured by its status

Columns were white panels distinguished only by the pill in their header, so a
four-status board read as four identical rectangles until you looked at the
text. The request was a background and a border per status. Most of the work
turned out to be in deciding _which_ colour, and in the three things that broke
once a column stopped being a plain surface.

- [x] 43. Tint the kanban column from its status
- [x] 43.1 Add a `surface` form to `STATUS_TOKEN_CLASSES`
  - Full class strings beside `dot`, `soft` and `text`, in the one declaration `StatusPill` already reads — so the panel and the pill in its header cannot be tinted by two sources (13.6.1)
  - Written out, never interpolated: `bg-${colorToken}` compiles to no CSS at all, and the failure is silent
  - Not a reuse of `soft`. A pill sets its own text colour and a `ring`; a panel sets a `border` and leaves text to the ink ramp, so reusing `soft` would have painted every card's container in the pill's text colour
  - _Requirements: 4.2.1, 13.4, 13.6, 13.6.1_
- [x] 43.2 Derive the wash from the status token, not a semantic ramp
  - **The first version used the `-50` ramps `soft` borrows, and it was wrong.** `soft` pairs `status-active` with `bg-info-50` and `status-review` with `bg-brand-50` — `#eaf2fe` and `#eef4ff`. On a pill the differing text colour carries the distinction; on two full-height columns there is no text colour to help, and the panels were indistinguishable. Which defeats the whole feature
  - A wash of the token cannot have that problem: the tint _is_ the status's colour, so two statuses are as different as their dots. It also means a new status token needs no new ramp entry before it can have a column
  - Caught by looking at it in a browser, not by a test. Worth recording — the test I had written at that point asserted the tints were "visibly different" by luminance, and the blue and the violet differ by `0.0003` there
  - _Requirements: 4.2.2_
- [x] 43.3 Let the border carry the signal and the background hint
  - `status-active` (`#2d7ff9`) and `status-review` (`#8b5cf6`) differ almost entirely in red. At a background alpha subtle enough to sit behind white cards their washes are ~7 RGB units apart; at the border's 25% they are ~25 apart
  - So: `bg-status-x/10 border-status-x/25`. This is what the palette permits rather than a preference — raising the background until the washes separated meant a panel dark enough to compete with the cards on it, and dragged the header's count under AA
  - `STATUS_SURFACE_ALPHA` and `STATUS_BORDER_ALPHA` are exported so the contrast test composites the real values instead of restating them
  - _Requirements: 4.2.3_
- [x] 43.4 Re-verify the ink ramp against the new background
  - `contrast.test.ts` asserted the ramp against `surface`, `surface-sunken` and `surface-hover`. A tinted column is a fourth background, and the column's count and empty state are text on it
  - The test now composites the wash over the shell's own `surface-sunken` — comparing against the opaque token would measure a colour that never reaches a screen
  - **It found one failure**: `ink-400` at 4.47:1 on the `status-todo` wash, two hundredths under AA, that token being a mid grey and so the one that darkens its background most. The header count moved to `ink-600`; nudging a global token for one caller would have been the tail wagging the dog
  - The failing case is kept as an assertion, so raising the alpha or re-pointing the count at `ink-400` has to come back through it — the same shape as the existing "`ink-300` is decorative only" test
  - _Requirements: 4.2.4, 17.7_
- [x] 43.5 Fix the drop highlight, which the tint had quietly broken
  - It was `bg-brand-50/60` with `ring-1 ring-brand-600/30` — legible on white, nearly invisible on `status-active`'s wash, since that is the brand's own blue family
  - Now `bg-brand-100` with `ring-2 ring-inset ring-brand-600`. A full-strength ring is unmistakable on any of the four tints; a pale wash cannot be
  - Written after the base background in the `cn()` call, because tailwind-merge keeps the last of two conflicting classes — the ordering rule `Input` was fixed for in Phase 4
  - _Requirements: 4.2.5, 4.6_
- [x] 43.6 Test and look
  - `KanbanColumn.test.tsx`: the panel carries each token's `surface` classes, class by class so a map entry gaining a utility needs no test edit; two statuses produce two different panels; the header is inside the tinted panel; and the highlight overrides the tint rather than blending into it
  - "Two different panels" is also the interpolation guard — `bg-${colorToken}` would give every column an identical class list
  - `contrast.test.ts`: ink on every composited tint, each wash distinct, each border distinct at 15+ channel units, and the ring clearing 3:1 on all four
  - Verified in a browser at 1440px on Sprint 14, the only seeded list with all four statuses, and at 320px. The grey/blue/violet/green reading was the point and is not something jsdom can confirm
  - One thing noticed and deliberately not fixed: at a 320px viewport the column overflows the screen, because `w-column-mobile` is `22rem` flat while design.md describes `min(88vw, 22rem)`. Pre-existing, unrelated to the tint, and a change to the paging geometry rather than to colour
  - _Requirements: 4.2.1, 17.7, 20.14_

---

## Phase 21 — The switcher's menu looks like the control it is

`UserSwitcher`'s trigger showed avatar, name and role from the start. Its menu
— the thing you actually pick an identity from — showed `"Bob Mensah · Member"`
as one line of text with a tick on the left. So the control the brief singles
out twice presented less than the assignee picker two inches away, and the
role read as part of the name.

- [x] 44. Render the switcher's rows with avatar, name and role
- [x] 44.1 Move the row to `MenuItemSpec.content`
  - Avatar plus a two-line name/role block, mirroring the trigger — so the role is visibly a property of the user rather than more of their name (8.2.1)
  - `label` stays the full `"name · role"` string. `content` is what the item looks like, `label` is what it is called, and `Menu` already keeps them separate so a graphical row is still announced (17.1). Nothing new was needed in the primitive — `content` and `selected` were both already there, used by the drawer's assignee picker and by `StatusPicker`
  - Every existing test matches these rows by a name substring, so none needed changing
  - _Requirements: 8.2.1, 13.6, 17.1_
- [x] 44.2 Mark the current user with `selected`, not a leading icon
  - It was `icon: member.isCurrent ? Check : undefined`. `Menu` renders an item's icon `aria-hidden`, so a screen-reader user was told nothing about which identity was active — the one fact this control exists to convey
  - `selected` appends ", selected" to the accessible name and puts the check on the right, where `StatusPicker`, `PriorityPicker` and the assignee menu all put it. The left-hand tick was also the only such mark in the app
  - Same class of defect as task 39.2 on this component, and from the same direction: the visual read was fine and the accessible name was not
  - _Requirements: 8.2.2, 17.1_
- [x] 44.3 Test and look
  - `AppShell.test.tsx`: each row carries a labelled `role="img"` avatar plus the name and the role as text — the avatar asserted by role rather than by its initials appearing somewhere, which would also pass for plain text; and the selected mark moves to whoever is current, asserted through the accessible name in both directions
  - Checked in a browser at 1440px, which is the only way to confirm the two-line row sits correctly beside the avatar and the check
  - _Requirements: 8.2.1, 8.2.2, 18.7_

---

## Phase 22 — A focus ring that is drawn is not the same as one you can see

A card's focus outline was shaved off on all four sides inside a kanban
column. Neither component was wrong on its own, which is what made it a
reported bug rather than a review catch: the indicator is correct, the scroll
container's padding is reasonable spacing, and the defect is the arithmetic
between them.

- [x] 45. Give the column's card list room for its cards' focus ring
- [x] 45.1 Measure it before changing anything
  - `outline-2 outline-offset-2` paints 4px outside the card's border box; the scroll container had `p-0.5`, which is 2px. So exactly half the ring went under the clip on every side
  - An outline cannot escape an overflow clip any more than a `z-index` can — the same lesson `Tooltip` was portalled for in Phase 4, in a second guise
  - Confirmed in a browser with computed styles and rects rather than inferred from the class list, which is also what turned up the next item
  - _Requirements: 14.8.1_
- [x] 45.2 `p-1 scroll-p-1`, and both halves are needed
  - `p-1` is 4px — exactly the reach. It is clearance, not spacing, and the comment says so, because the next person to tune it for looks needs to know what it is holding up
  - `scroll-p-1` covers the case padding cannot: tabbing down a column long enough to scroll makes the browser bring the next card into view itself, aligned flush to the clip edge. Measured at `0px` of clearance without it — so the ring was clipped at the one moment it is actually being used
  - **Both axes clip, which the class list does not say.** The container declares `overflow-y-auto` only, and CSS computes a `visible` axis to `auto` when the other is not `visible`. The left and right clearance matter as much as the top and bottom
  - _Requirements: 14.8.1, 14.8.2, 14.8.3_
- [x] 45.3 Reject the inset-ring alternative
  - `focus-visible:ring-2 ring-inset` would also have worked and was not taken: `Card` already uses `ring` for its border and its `selected` state, so three ring utilities would collide in tailwind-merge, and it would make the board card the one control in the app with a focus treatment of its own
  - The indicator is right. It needed room
  - _Requirements: 13.6, 14.8_
- [x] 45.4 Sweep every other scroll container
  - The column was the only one short. The sidebar's tree scroller has `px-2 py-2`, the board's horizontal scroller `p-3`, the palette `p-2`, the drawer's `ScrollShadow` `px-4 py-4` — all clear of the same 4px
  - Held as an assertion rather than a note, since any of them could be tightened later for spacing by someone with no idea it is load-bearing
  - _Requirements: 14.8.1_
- [x] 45.5 Test it where it can be tested
  - **Not in jsdom.** This needs `outline-width`, `outline-offset` and `padding` as computed values plus real geometry; jsdom loads no CSS and lays nothing out, so every rect is zero. `e2e/focus-ring.spec.ts`, with the drag specs, for the same reason they are there
  - Four tests: the first card's ring clears its column on every side; the container clips on both axes; a card scrolled into view keeps its clearance; and a sweep of every scroll container in the booted app
  - Asserted against the **measured** reach rather than the literal `4px`, so changing either value on either side keeps the test meaningful instead of needing an edit
  - Verified by reverting the fix: the three geometry assertions failed at 2px, 0px and 254 short control/area pairs. A regression test nobody has seen fail is a regression test nobody has tested
  - _Requirements: 14.8.1, 14.8.2, 14.8.3, 14.8.4_

---

## Phase 23 — The page scrolled sideways on every phone width

Found by the Phase 9 demo walk (task 25.6), not by a test. At 320px the whole
app chrome could be dragged sideways out of view, leaving a blank surface — a
Requirement 20.2 and 16.9 violation that 666 green unit tests could not see,
because jsdom lays nothing out.

It is the third instance of one CSS rule, and the two earlier ones are in this
file already: **an absolutely positioned element is clipped by an ancestor's
`overflow` only where that ancestor is its containing block.** The tooltip hit
it and was portalled (Phase 4, Phase 16). The focus ring hit it and was given
clearance (Phase 22). This one hit it from the far side — the escaping element
was `sr-only`, which nobody thinks about at all.

- [x] 46. Stop the document scrolling horizontally
- [x] 46.1 Measure it before touching anything
  - `documentElement.scrollWidth` 797 against a `clientWidth` of 320, and `scrollLeft` reached 477 — so the page genuinely scrolled rather than merely reporting a wide box. With the chrome scrolled, the top bar's `left` was `-336` and the viewport showed empty surface
  - The shell was not at fault: 320 wide, `overflow: hidden`, clipping correctly. `document.body.scrollWidth` was 320 too. The overflow was on `html`
  - Isolating the absolutely positioned elements whose containing block is the **initial** containing block gave the answer exactly: nine escapees, all `sr-only`, the farthest sitting at 656px — which was precisely `documentElement.scrollWidth` at that point. Not a correlation, an identity
  - _Requirements: 20.2, 20.2.1, 20.2.2_
- [x] 46.2 Make the shell a containing block
  - `AppShell` is now `relative`. Not to position anything — Tailwind's `sr-only` is `position: absolute` with no offsets, so with no positioned ancestor it resolves against the initial containing block and escapes every intermediate `overflow: hidden` on the way up. The visually hidden labels inside cards in the board's horizontally scrolled columns were therefore extending the document's scroll area from outside the shell's clip
  - One class, and it is the fix. Commented at length because `relative` with nothing positioned against it reads as dead code to the next person, and deleting it silently reintroduces this
  - _Requirements: 20.2, 20.2.2_
- [x] 46.3 Cap the mobile column to the viewport
  - `--spacing-column-mobile` from a flat `22rem` to `min(88vw, 22rem)`. `design.md` has specified `min(88vw, 22rem)` since Phase 0 and the code never implemented it — a 22rem column at 320px put a third of every card off screen, which is not 20.5's "a width near the viewport"
  - `min()` rather than a smaller flat value so the column still grows with the root font size: the `22rem` arm scales, the `88vw` arm only caps it. Above ~400px the cap never engages, so the Pixel-7 e2e project and every tablet width are unchanged — which is why this could be done without re-baselining the touch specs
  - **Not sufficient on its own, and that is the lesson.** It took `scrollWidth` from 797 to 656 and the page still scrolled. Fixing the visible symptom moved the number without touching the cause, and stopping there would have shipped a narrower column and the same bug. Noticed in Phase 20 (task 43.6) as "the column overflows the screen" and deliberately deferred — the deferral was reasonable, but it had measured the wrong thing
  - _Requirements: 20.2.3, 20.5, 22.1_
- [x] 46.4 Hold it with a spec that could not live in jsdom
  - `e2e/responsive.spec.ts`, 12 cases per project: no horizontal page scroll at 320/360/414/640/768/1024/1280/1920, with the sheet open, with the drawer open, that the board's own track still scrolls, and that a column fits inside 320px
  - The last two exist so the invariant cannot be satisfied dishonestly. Clipping the board or shrinking the column to nothing would pass the first assertion and break the phone layout
  - Scroll measured by **attempting** it rather than comparing `scrollWidth` to `clientWidth`: a fractional device ratio puts a sub-pixel difference into those numbers that is not a scroll, and a test that fails on it would get relaxed until it stopped meaning anything
  - **Verified by reverting the fix**: six of twelve failed, with the overflow in the message — 336px at 320, 367px at 360, 383px at 414 — and correctly passed at 768 and up where the board's content fits. So the bug was every phone and small-tablet width, and the test knows the difference
  - _Requirements: 20.2, 20.2.1, 20.2.2, 20.2.3_
- [x] 46.5 Record the pattern rather than the instance
  - Requirement 20.2.2 now states the containing-block rule directly, alongside 13.4.1 (the tooltip) and 14.8.1 (the focus ring), because this is the third time one CSS rule has produced a bug that looked like three unrelated ones
  - The shared tell, worth more than any of the three fixes: **the styling of both components was correct in isolation and the defect lived in the relationship between them.** None of the three is findable by reading either file
  - _Requirements: 13.4.1, 14.8.1, 20.2.2_

---

## Phase 24 — The drawer's body would not scroll on a phone

Reported, not found by a test: in the task drawer's mobile bottom-sheet form,
content past the fold was unreachable. The desktop panel was fine and always
had been, which is the detail that makes this interesting — one component, no
conditional in its own source, correct at one width and broken at another.

Fourth member of the family recorded in Phases 4, 16, 22 and 23: **both
components are correct read in isolation and the fault lives in the
relationship between them.** The first three were all about an `overflow`
boundary. This one has no clip in it at all.

- [x] 47. Make `ScrollShadow` size itself from its container, not from a percentage
- [x] 47.1 Measure it in three forms before changing anything
  - `ScrollShadow`'s scroller was `h-full` — `height: 100%` — inside a parent
    that is itself a flex item. A percentage height resolves against the
    containing block, and where that block's height is **indefinite** the
    percentage is dropped and the element sizes itself to its **content**
  - Whether the chain was definite depended on the caller, which is the whole
    bug: the drawer's desktop panel is `md:inset-y-0`, both edges anchored, so
    the height is definite and the percentage resolved. The mobile sheet is
    `bottom-0` with `max-h-[92dvh]` and no `top`, so the height is auto-capped
    rather than definite
  - Driven in a real browser with computed styles and rects:

    ```
    Desktop 1440x900 — slot 798, scroller 798, overflow   0, overhang   0  ← correct
    Pixel 7  412x839 — slot 622, scroller 662, overflow   0, overhang  40
    Phone    360x560 — slot 365, scroller 666, overflow   0, overhang 301
    ```

  - The tell is that the scroller's height barely moves while its slot
    collapses from 798 to 365 — it was tracking content, not space. Confirmed
    from the other side by assigning `scrollTop = 100000` and reading back `0`
  - **The counter-intuitive part, worth keeping:** this was not
    scrollable-but-stuck. A scroll container sized to its own content has
    `scrollHeight === clientHeight`, so there is _no overflow at all_ and
    `overflow-y: auto` has nothing to act on. The excess was clipped by the
    panel and the footer painted over the difference
  - _Requirements: 7.1.1, 16.1.1, 16.1.4_

- [x] 47.2 Replace the percentage with flex sizing
  - Wrapper `relative min-h-0 flex-1` → `relative flex min-h-0 flex-1 flex-col`;
    scroller `h-full` → `min-h-0 flex-1`. The flex algorithm sizes the item from
    the parent's _used_ height and `min-h-0` lets it shrink below its content,
    which is what creates the overflow there is then something to scroll. No
    percentage, so nothing to drop, and no dependency on an ancestor chain the
    component cannot see
  - **The flex-column wrapper is the load-bearing half**, established by
    reverting in two stages rather than assumed: with the wrapper left as a flex
    column, even the original `h-full` passed, because a flex item's height is
    resolved by the flex algorithm. `flex-1 min-h-0` is kept anyway — it states
    the intent directly instead of relying on a percentage that happens to be
    well-defined, which is the condition that silently failed here once already
  - Added `overscroll-contain` with it. The sheet sits over the board, so a
    flick past either end chained and scrolled the board underneath the sheet
    the user was reading
  - _Requirements: 16.1.2, 16.1.5_
- [x] 47.3 Fix it in the primitive, not in the drawer
  - The drawer's own layout was already correct — `shrink-0` header and footer
    around a `flex-1 min-h-0` slot. The defective sizing was one level down, in
    a shared primitive with four consumers, each depending on an invisible
    precondition about its own ancestors
  - The sidebar and the list view happened to satisfy it, because the shell is
    `h-dvh` and their chains are definite — **correct by luck rather than by
    construction**, which is exactly the state that produces a bug report on
    the fifth consumer. All four were re-measured after the change: every one
    sizes to its slot exactly, overhang zero, no console errors
  - Deliberately _not_ fixed by giving the sheet a definite `h-[92dvh]`. That
    would have worked and would have left the primitive still carrying the
    trap, while also forcing every sheet to full height instead of hugging a
    short task's content
  - _Requirements: 16.1.1, 16.1.2_
- [x] 47.4 Hold it with a browser spec, and watch it fail
  - `e2e/drawer-scroll.spec.ts`, 3 cases × 2 projects. Impossible in jsdom for
    the third time in this file: no CSS and no layout, so neither percentage
    resolution nor `scrollHeight` exists there
  - Both halves of the fault are asserted, because they are two things: that an
    overflowing body scrolls to the end of its content, and that its box does
    not extend past its slot or under its footer. Measured relationships, never
    literals, so a viewport or seed change keeps them meaningful
  - Each case asserts its **own precondition** — that the content really does
    overflow at the test viewport. The symptom here is an _absence_ of
    overflow, so a spec that lost the overflow would pass while proving
    nothing, which is the one way this regression test could stop working
    without ever going red
  - The panel case exists to stop the sheet being fixed by breaking the panel
  - **Verified by reverting, and the first attempt at reverting was wrong** —
    restoring only `h-full` while leaving the wrapper as a flex column, which
    still passed. A faithful revert of both lines failed the two sheet cases
    with `overflow: 0` and a 193px overhang while the panel case passed, which
    is exactly the asymmetry 47.1 measured
  - _Requirements: 16.1.3, 7.1.1_
- [x] 47.5 Verify the gesture, not just the geometry
  - Geometry being right does not prove a finger can scroll it: the sheet is a
    Headless UI `Dialog`, which locks scrolling, and the drag-to-dismiss
    handler sits in the same panel
  - Driven as a real touch stream over CDP rather than a mouse wheel: a flick
    inside the body reached 40 of 40 available pixels on a Pixel 7 and 279 of
    301 on a 360x560 phone, and the drawer stayed open — so the gesture is not
    being taken by drag-to-dismiss, which is correctly confined to the handle
  - _Requirements: 16.1.5, 20.8_
