# AI Usage Log

**Tool used:** Kiro with Claude Opus 5

AI was used throughout this project as a pair-programming assistant. Below is an honest
account of where it helped and where I had to step in and correct it.

## Where AI helped

- **Turning the brief into a plan.** Fed it the assignment document and had it produce
  structured requirements, design, and task breakdown markdown files. That gave the build a
  clear order of work instead of jumping straight into code.
- **Component identification and isolation.** It helped identify the key reusable components
  and wired them up in Storybook so each one could be built and verified on its own before
  being dropped into the app.
- **Tests alongside the feature work.** Unit tests for the store/permission layer and
  Playwright E2E specs were written in parallel with the features rather than bolted on at
  the end.
- **Responsive layout.** It handled a good chunk of the Tailwind breakpoint work to keep the
  sidebar, board, and list view usable at smaller widths.

## Where I corrected AI

- **Inconsistent input styling.** Input fields came out with mismatched padding, borders, and
  focus treatment across forms. I standardized them.
- **Modal/drawer state resetting on close.** Dialog state was being reset to its default
  while the close animation was still running, so the Task Details Drawer opened from the
  right but slid out to the left. Fixed the teardown order so the exit animation matches the
  entry direction.
- **Tooltip clipping at viewport edges.** Tooltips on components near the edge of the screen
  had their content cut off. Needed proper positioning/collision handling.
- **Plain-text dropdown items.** User, status, and priority menus were rendering options as
  plain strings. I replaced them with proper JSX item components (avatars, status dots,
  priority badges) so the menus match the rest of the visual system.
- **Cards were not interactive enough.** The original cards were read-only and forced a
  drawer open for every edit. I made status, priority, and assignee editable directly on the
  card.
- **New lists had no statuses.** Newly created lists/boards were created with an empty status
  set, which meant no task could be created in them at all — the spec requires every list to
  start with at least To Do, In Progress, and Done. Fixed so new lists are seeded with the
  default status set.
- **Container creation ignored access control.** The first version of create/update for
  spaces, folders, and lists only captured a name and silently granted access to every
  member. I integrated the user selection module into both the create and the edit flows so
  grants are explicit.

## Takeaway

AI was genuinely fast at scaffolding, test coverage, and documentation structure. The gaps
were consistently in product detail: interaction polish, animation correctness, and business
rules from the spec that it quietly skipped. Every one of those needed a human read of the
requirements to catch.
