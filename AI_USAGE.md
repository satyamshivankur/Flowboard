# AI usage log

> **Review note for the author:** this document makes first-person claims about how the project was built. It was drafted from the evidence the repository itself carries — principally `.kiro/specs/flowboard/tasks.md`, which records each correction as it happened — so every specific below is checkable against a file. Please read it as a draft of your own account and adjust anything that misstates your process before submitting.

---

## Tools used

| Tool                                       | Used for                                                                                                                                                                                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kiro** (spec-driven agent)               | The bulk of the work. Requirements, design and task breakdown live in `.kiro/specs/flowboard/` and were written before implementation; most code was then generated and iterated against them.                                                                                    |
| **context7**                               | Library documentation lookup, where a wrong API shape would have been expensive. Used to confirm Radix's tooltip collision props against `/websites/radix-ui_primitives` and shadcn's wrapper against `/shadcn-ui/ui` before deciding not to adopt either (recorded in Phase 16). |
| **Browser automation** (Playwright driver) | Visual verification of things no test in this repo can assert — the kanban column tints, the user-switcher menu rows, and the focus-ring clipping measured with computed styles rather than inferred from class names.                                                            |

The specification documents in `.kiro/specs/flowboard/` are themselves AI-assisted output that was then edited heavily. They are the most honest artifact in the repository about this process: `tasks.md` is not a plan, it is a log, and the corrections recorded in it are the substance of this document.

---

## Where it helped

**Breadth at speed.** 35 design-system primitives, four store slices, a dozen view-model hooks, 666 unit tests and 64 end-to-end cases is more surface than this time budget would otherwise have covered. The work that benefited most was the mechanical-but-tedious kind: typed variant records, prop interfaces, fixture builders, the repetitive half of the test suite.

**Consistency across surfaces.** Once a pattern was established — `usePendingAction` keyed by id, `Result<T>` from every action, inline pickers composed from `components/ui` — applying it to the fifth surface was reliable in a way hand-writing it would not have been. The three subtask-editing surfaces ending up with genuinely one control set rather than three lookalikes is a direct consequence.

**Writing the test that catches the bug.** Several tests in this repo assert the _specific_ wrong thing a plausible implementation would do, rather than only the right thing: a priority change on a subtask leaving the parent's priority untouched; `crossColumnMove` returning the _identical object_ when nothing should change; a refused container create leaving no grant row behind. Those are better than what I would have reached for unprompted.

**Prose that states why.** The comments in this codebase explain reasoning rather than restating code, and the design document carries the failure history rather than only the final shape. That discipline was easier to sustain with assistance than without.

---

## Where it was wrong, and how it was caught

This is the useful half. Each of these is recorded in `tasks.md` at the task that fixed it.

### Confidently wrong about the framework

The most dangerous category, because the output looked idiomatic and failed silently.

| Fault                                                                     | How it failed                                                                                                                                                                                                                                                                                                                                                                                                                                      | Caught by                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bg-${status.color}` to compose a token class                             | Tailwind resolves classes by scanning source text, so an interpolated name is never seen and **no CSS is emitted**. No build error, no type error — unstyled badges at runtime.                                                                                                                                                                                                                                                                    | Inspecting the built stylesheet. Fixed by writing complete class strings into the config beside each token.                                                                                                                                                           |
| `--size-*` for named dimension tokens                                     | Tailwind v4 maps `--spacing-*` onto width/height/padding/margin/gap. A `--size-*` token emits the custom property and generates **no utility**.                                                                                                                                                                                                                                                                                                    | Checking the built CSS during Phase 0.                                                                                                                                                                                                                                |
| `cn("pl-8", …, "px-3")` in `Input`                                        | tailwind-merge keeps the _last_ of two conflicting classes, and a broad class deletes a narrower one it supersedes — so the leading-icon padding was silently dropped and the icon overlapped the text.                                                                                                                                                                                                                                            | Looking at it. Now asserted in `Input.test.tsx` against the resolved `className`.                                                                                                                                                                                     |
| `useShallow((s) => select(s).map(toRow))`                                 | `useShallow` compares one level deep and every element was a freshly built object, so the snapshot was "new" every render. Took down six hooks at once with `Maximum update depth exceeded` thrown from inside React.                                                                                                                                                                                                                              | Running the app. None of the 280 Model and Controller tests touched it, because it only appears once a component subscribes.                                                                                                                                          |
| Reading a calendar-library date with `getUTC*`                            | `@rehookify/datepicker` represents a day as _local midnight_, so a cell labelled "November 4" carried the key `2026-11-03` for anyone east of Greenwich. Shipped for one commit.                                                                                                                                                                                                                                                                   | A failing assertion, once the suite was moved to `TZ=Asia/Kolkata`. The half-hour offset also catches the assumption that offsets are whole hours.                                                                                                                    |
| `h-full` plus `overflow-y-auto` to make a scroll region in `ScrollShadow` | The idiomatic-looking pairing, and it only works if the parent's height is resolvable. Where it is not, the percentage is dropped, the element sizes to its **content**, and a box as tall as its content has no overflow — so `overflow-y: auto` has nothing to act on. The task drawer's phone sheet could not be scrolled and its content was hidden behind the footer; the desktop panel was fine, because its height happened to be definite. | A **user report**, not a test — and that is the finding. 666 unit tests and 88 browser cases were green. Then measured in a browser: the scroller stayed ~660px tall while its slot collapsed from 798px to 365px, which is a box tracking content rather than space. |

### Right-looking code, wrong accessible name

Three separate instances of the same shape — the visual read was fine and the accessible name was not. Worth naming as a category, because automated checks did not catch any of them.

- `UserSwitcher` set a descriptive `aria-label` on its trigger; `Menu` renders its trigger through `MenuButton as={Fragment}`, which merges the menu's own props over the child's. The DOM carried only "Switch user". Invisible to every existing test, because they all matched the name as a _substring_ — and a substring of the short label is also a substring of the long one.
- The same component marked the current user with an `aria-hidden` check icon, so a screen-reader user was told nothing about which identity was active — the one fact the control exists to convey.
- A `Menu` item's disabled reason sat only in `title`, which a touch device can never surface; moving it inline made it part of the accessible _name_ instead of a description, and only on a coarse pointer, so the same item was called two different things on two devices.

### Comments asserting behaviour the code did not have

- `src/index.css` claimed density was "clamped to comfortable below md". The variant was a plain attribute selector with no condition on it. Exactly one consumer was safe, and by accident — it happened to pair `density-compact:` with `can-hover:`.
- `statusSlice`'s doc comment said its actions "exist and are tested". The file had **7.4% statement and 0% branch coverage**. Found by reading the per-file coverage breakdown rather than the total.

Both are the same failure mode: prose generated alongside code, describing the intent rather than the result, and then outliving the gap.

### Subtly wrong ordering and arithmetic

- `canView` had the admin bypass as step 1, returning `true` before any structural check. That let an admin "view" a node that did not exist, one that was archived, and — the serious one — one in another workspace, quietly defeating the whole multi-workspace guarantee. Structural checks now run first and only the grant decision is bypassed.
- The same function checked only the chain's _root_ for workspace membership. `workspaceId` is denormalized, so that lets a node whose own `workspaceId` disagrees with its parent chain inherit into the wrong workspace — precisely the corruption the denormalization risks.
- In `access.ts`, an exhaustive-`switch` guard used `return exhaustive`, which returns the `never` binding's **runtime** value. A subject type outside the union came back as the truthy string `"team"` and the grant row was dropped. Caught by the one test that deliberately constructs data the type system says cannot exist.

### Drag and drop, five times

The single worst area, and the reason the end-to-end layer exists. Three faults under `@dnd-kit/core` 6 and two more after migrating, each of which survived a green suite — because jsdom has no layout, so **every rect is zero** and no test in this repo could run a collision.

The failures were not variations on one mistake. In order: no `onDragOver` handler at all, so nothing moved mid-drag and the index resolved from the dragged card's corners ("it always lands at the top"); then a preview resolved against the store while rendering the plan, which is not a fixed point and ran away into `Maximum update depth exceeded`; then removing the preview, which was stable and threw away the cross-column index. After the migration: a `removeChild` crash from letting the library move DOM nodes React owned, and a _silent no-op_ on dropping into an empty column.

The lesson I would carry forward is not "AI is bad at drag and drop". It is that **a green suite is evidence about the harness, not about the code** — and that the right response to "no test can see this" is to change harness, not to reason harder. `e2e/drag-drop.spec.ts` now covers it.

### Tests that pass for the wrong reason

The category I trust least in generated output, because it is invisible until something else breaks.

- A `beginListLoad` last-write-wins test written the obvious way — start both loads, `await` the first — passes whether the guard exists or not, because awaiting flushes both continuations. The version that ships settles the transport one call at a time.
- A keyboard-drag assertion counted two elements with the same accessible name. The overlay clone renders with registration stubbed out, so it never gets the `role` the real card has; the assertion would have passed for the wrong reason.
- A distinctness assertion on the kanban column tints used **luminance**, and passed a blue and a violet as "different" by 0.0003. They are the same lightness and plainly different colours. Now measured as channel distance.
- A test suite overrode `window.matchMedia` in a `beforeEach` and never restored it. `window` is shared across the file, so every test declared afterwards ran in off-canvas mode where the sidebar tree is _absent from the DOM_. Nothing failed, because no later test needed the tree — the next one that did failed with "unable to find role tree", which reads as a bug in the new test rather than in the old one.

### Plausible designs that were the wrong shape

Not bugs — working code, rejected on review.

- **Access as a mode control.** A two-option Everyone / Selected-people segmented control above a member list put the same checkboxes into two states that looked identical and saved differently: a ticked row meant an explicit `allow` under one and nothing at all under the other. It also needed an asymmetric safety rule that was correct and invisible. Replaced with a select-all checkbox over one list where every row has one meaning.
- **The drawer's subtask section, narrowed on a bad analogy.** Restricted to create/toggle/open/delete on the reasoning that "a second full field set inside a drawer would be a drawer inside a drawer". The comparison was wrong — these are inline chips on a row, the same controls a table cell holds — and the restriction's actual effect was that the drawer was the one subtask surface that could tick a subtask but not re-prioritise it.
- **A `ViewportContext`**, justified by three adaptations being "structural rather than cosmetic". Working through each, Tailwind handled all three; exactly one case survived, and it is about behaviour rather than appearance.
- **A drag-to-resize sidebar.** Built, worked, removed: a 60Hz pointer-event state loop, a clamp duplicated between two CSS tokens and two JavaScript constants, and the only inline `style=` on a static layout element — against a per-user width nobody had asked for.

### Still-open consequences

Generated code accumulates plausible-looking surface that nothing calls. Thirteen Model exports have no caller anywhere — not in production, not in tests. Two are worse than merely unused: `canMoveUnder` re-implements the rule `validateContainerMove` already owns and which is the one actually enforced, and `grantsForResource` is a parallel implementation of scoping that `selectors.ts` does inline. Both are a second source of truth, which is the thing the one-vocabulary rule exists to prevent.

Requirement 21.20 says lint shall fail on unused exports. **That rule was never configured**, which is exactly why this accumulated silently rather than being caught at the first occurrence. It is the top item in the week-two list in the README.

---

## What I would do differently

1. **Pick the harness before writing the feature.** Every expensive fault in this project — four drag bugs, the clipped focus ring, the tooltip overflow, the sideways page scroll, the drawer that would not scroll — was invisible to jsdom by construction, not by oversight. "No test can see this" should have triggered a new test layer immediately rather than after the fourth occurrence.

   The drawer scroll bug sharpens this, because by the time it surfaced the right harness already existed and the invariant simply was not in it. Playwright had been covering drag, focus-ring clearance and horizontal page scroll for two phases — all of them layout facts — and nothing asked the much more basic question "can this scroll region actually scroll". So the lesson is not only _build the harness_; it is **enumerate the invariants that only that harness can hold, and write them down**, rather than adding one each time a bug teaches you it was missing. Each of these was found by a person looking at the app, which does not scale and is not repeatable.

2. **Treat generated prose as an unverified claim.** Two comments in this repository asserted behaviour the code did not have, and both survived review because a confident comment reads as evidence. A comment that states an invariant should come with the assertion that holds it.
3. **Read the per-file coverage breakdown, never the total.** 86% overall concealed a slice at 7%. The total is the least informative number in the report.
4. **Ask what a test would pass against.** The strongest tests here name the specific wrong behaviour they would catch. The weakest were the ones that asserted the happy path and nothing else, and they all looked fine.
