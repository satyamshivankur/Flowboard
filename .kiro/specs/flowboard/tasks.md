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
  - `lib/uiStorage` for density, sidebar width and collapsed state — deliberately separate from `PersistenceAdapter`, which carries domain state. Losing a preference is an annoyance, not data loss, so every failure path there degrades silently
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
- [x] 13.4 Collapse-to-rail and drag-to-resize at `lg` and above
  - Both persisted; the resizer's live width is the second documented inline-`style` exception
  - The resizer writes `rem` (`${px / 16}rem`), clamped between `--spacing-sidebar-min` and `--spacing-sidebar-max`, so even the one dynamic dimension obeys the unit rule
  - _Requirements: 6.6, 13.4, 16.2, 22.1, 22.3_
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
  - _Requirements: 4.3, 15.9, 16.6_
- [x] 14.4 Card interactions
  - Hover elevation; reveal of secondary affordances via `can-hover:group-hover` and `can-hover:group-focus-within`, so coarse pointers get them persistently visible instead of unreachable
  - Body click opens the drawer with `stopPropagation` on interactive children; inline complete checkbox at `2.75rem` on touch
  - _Requirements: 15.1, 15.4, 15.7, 20.9, 20.10_
- [x] 14.5 Card overflow quick-action menu
  - Open, change status, change priority, assign, set due date, move to list, duplicate, delete — all applied inline, all permission-checked, all also present in the drawer
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
- [ ] 14.7.1 Verify touch drag against mobile column paging
  - Confirm a vertical swipe scrolls, a horizontal swipe pages columns, and only a long press starts a drag
  - Confirm status change and reorder are both reachable without dragging, from the card menu and the drawer
  - **Second bullet done**: the card menu carries "Move up", "Move down" and a status item per sibling status, all covered by tests. Reordering no longer requires a drag of any kind
  - **First bullet unverified**: the `TouchSensor` delay and tolerance are configured and reasoned about, but jsdom has no touch model and no device was available here. This needs a real phone, so it stays unchecked rather than claimed
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
  - _Requirements: 2.11, 2.12_
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
  - Three, not four: `views/sidebar/Sidebar.tsx` (resizer live width), `components/ui/Tooltip.tsx` (portalled overlay coordinates), `components/ui/Drawer.tsx` (bottom sheet drag-to-dismiss offset)
  - dnd-kit's sortable transform was the fourth and is gone — `@dnd-kit/dom` writes it to the element directly, so neither `TaskCard` nor `TreeItem` carries an inline style (Requirement 13.4.2)
  - _Requirements: 13.4, 13.4.2, 19.9_
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
  - No `.css` file other than `src/index.css`; no `styled`/`emotion`/`sass` dependencies; every `style=` occurrence is one of the three documented exceptions
  - _Requirements: 13.1, 13.2, 13.4_
- [ ] 25.3 Run the `px` audit and confirm every hit is an allowed exception
  - `rg -n '\bpx\b' src` — remaining matches must be hairline borders, shadow offsets, pointer-travel thresholds (the sensor activation distance and touch tolerance, and the sheet's drag-to-dismiss threshold) or raster intrinsic sizes, and each must be annotated in code
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
- [ ] 26.10 Re-check the touch gesture on a device
  - Same gap as 14.7.1, now with a different mechanism behind it: one `PointerSensor` resolving its constraint from `event.pointerType` rather than a separate `TouchSensor`. Confirm a vertical swipe scrolls, a horizontal swipe pages columns, and only a long press starts a drag
  - Unchecked for the same reason as before — jsdom has no touch model and no device was available
  - _Requirements: 20.8_
