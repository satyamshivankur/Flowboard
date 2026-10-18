import { DragDropProvider } from "@dnd-kit/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AvatarGroupMember } from "@/components/ui/AvatarGroup";
import {
  STATUS_TOKEN_CLASSES,
  STATUS_COLOR_TOKENS,
  type StatusColorToken,
} from "@/config/statusCategories";
import type { TaskCardViewModel } from "@/controllers/hooks/useBoard";

import { KanbanColumn } from "./KanbanColumn";
import type { TaskCardStatusOption } from "./TaskCard";

/**
 * The column's drop highlight.
 *
 * The reported bug: dragging into a *non-empty* column showed no highlight.
 * The cause was reading this column's own `useDroppable().isDropTarget`, which
 * is false whenever one of its cards wins the collision — so only empty
 * columns, having no cards to lose to, ever lit up.
 *
 * The highlight is now a prop the board resolves from the same drop target it
 * commits, which is what these assert: highlighted when told to be, whether or
 * not the column holds cards (Requirement 4.6).
 */

const STATUSES: TaskCardStatusOption[] = [
  { id: "todo", name: "To do", colorToken: "status-todo" },
  { id: "active", name: "In progress", colorToken: "status-active" },
];

const MEMBERS: AvatarGroupMember[] = [
  { id: "u-alice", name: "Alice Nguyen", avatarToken: "avatar-indigo" },
];

function task(id: string, title: string): TaskCardViewModel {
  return {
    id,
    statusId: "todo",
    title,
    priority: "normal",
    priorityLabel: "Normal",
    priorityToken: "priority-normal",
    dueDate: null,
    dueDateTone: "none",
    assignees: [],
    subtasks: [],
    subtaskCount: 0,
    completedSubtaskCount: 0,
    isComplete: false,
    hasDescription: false,
  };
}

const noop = () => undefined;

function renderColumn({
  tasks,
  isDragOver,
  colorToken = "status-todo",
}: {
  tasks: readonly TaskCardViewModel[];
  isDragOver: boolean;
  colorToken?: StatusColorToken;
}) {
  return render(
    <DragDropProvider>
      <KanbanColumn
        statusId="todo"
        name="To do"
        colorToken={colorToken}
        count={tasks.length}
        tasks={tasks}
        now="2026-10-16T09:00:00.000Z"
        canEdit
        readOnlyReason={undefined}
        statuses={STATUSES}
        moveTargets={[]}
        members={MEMBERS}
        isDragOver={isDragOver}
        isPending={() => false}
        expandedIds={new Set()}
        onToggleExpand={noop}
        onOpen={noop}
        onToggleComplete={noop}
        onRename={noop}
        onSetPriority={noop}
        onSetStatus={noop}
        onToggleAssignee={noop}
        onSetDueDate={noop}
        onReorderInColumn={noop}
        onDuplicate={noop}
        onMoveToList={noop}
        onDelete={noop}
        onCreate={noop}
      />
    </DragDropProvider>,
  );
}

/** The scrolling card container, which carries the highlight. */
function dropArea(): HTMLElement {
  const region = screen.getByRole("region", { name: "To do" });
  const area = region.querySelector<HTMLElement>(".overflow-y-auto");

  if (area === null) throw new Error("No drop area");

  return area;
}

describe("the drop highlight", () => {
  it("highlights a non-empty column — the reported bug", () => {
    renderColumn({
      tasks: [task("a", "First"), task("b", "Second")],
      isDragOver: true,
    });

    expect(dropArea().className).toMatch(/ring-brand-600/);
  });

  it("does not highlight a non-empty column when the drag is elsewhere", () => {
    renderColumn({
      tasks: [task("a", "First"), task("b", "Second")],
      isDragOver: false,
    });

    expect(dropArea().className).not.toMatch(/ring-brand-600/);
  });

  it("highlights an empty column too", () => {
    renderColumn({ tasks: [], isDragOver: true });

    expect(dropArea().className).toMatch(/ring-brand-600/);
  });

  /*
   * An empty column's own empty state doubles as the drop affordance, so it
   * has to follow the same flag rather than the column's `isOver`
   * (Requirement 4.9).
   */
  it("passes the state through to an empty column's drop affordance", () => {
    renderColumn({ tasks: [], isDragOver: true });

    const empty = screen.getByText("No tasks").closest("div");

    expect(empty?.className).toMatch(/border-brand-600/);
  });

  /*
   * The highlight sits on top of the column's own status tint now. A wash of
   * another `-50` was indistinguishable from `info-50` behind it, so it is a
   * solid `brand-100` — and a background, which tailwind-merge resolves by
   * keeping the last conflicting class, has to be written after the one it
   * overrides.
   */
  it("overrides the status tint rather than blending into it", () => {
    renderColumn({
      tasks: [task("a", "First")],
      isDragOver: true,
      colorToken: "status-active",
    });

    expect(dropArea().className).toMatch(/bg-brand-100/);
  });
});

/**
 * The column's panel colour.
 *
 * Read from `STATUS_TOKEN_CLASSES`, the same map `StatusPill` uses, so the
 * panel and the pill in its header cannot be tinted by two declarations
 * (Requirement 13.6).
 */
describe("the status tint", () => {
  /** The outer panel, which carries the background and border. */
  function panel(): HTMLElement {
    return screen.getByRole("region", { name: "To do" });
  }

  it.each([...STATUS_COLOR_TOKENS])(
    "paints the panel from the %s entry",
    (colorToken) => {
      renderColumn({ tasks: [], isDragOver: false, colorToken });

      // Asserted class by class, so a map entry gaining a third utility does
      // not need this test edited.
      for (const className of STATUS_TOKEN_CLASSES[colorToken].surface.split(
        " ",
      )) {
        expect(panel().className).toContain(className);
      }
    },
  );

  /*
   * The point of the feature: two statuses must not look the same. This would
   * catch the interpolation trap too — `bg-${colorToken}` compiles to no CSS,
   * and every column would then carry an identical class list.
   */
  it("gives two different statuses two different panels", () => {
    const first = renderColumn({
      tasks: [],
      isDragOver: false,
      colorToken: "status-active",
    });

    const active = panel().className;

    // Unmounted rather than detached from the DOM: pulling the node out from
    // under Testing Library leaves its cleanup unable to find it, and the next
    // test then renders a second region with the same name.
    first.unmount();

    renderColumn({ tasks: [], isDragOver: false, colorToken: "status-done" });

    expect(panel().className).not.toBe(active);
  });

  it("keeps the header inside the tinted panel", () => {
    renderColumn({
      tasks: [],
      isDragOver: false,
      colorToken: "status-active",
    });

    // The count and the add control label the cards below them, so they have
    // to sit on the same surface rather than float above it.
    expect(
      panel().contains(
        screen.getByRole("button", { name: "Add task to To do" }),
      ),
    ).toBe(true);
    expect(panel().className).toContain(
      STATUS_TOKEN_CLASSES["status-active"].surface,
    );
  });
});
