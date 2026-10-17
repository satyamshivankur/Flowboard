import { DndContext } from "@dnd-kit/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AvatarGroupMember } from "@/components/ui/AvatarGroup";
import type { TaskCardViewModel } from "@/controllers/hooks/useBoard";

import { KanbanColumn } from "./KanbanColumn";
import type { TaskCardStatusOption } from "./TaskCard";

/**
 * The column's drop highlight.
 *
 * The reported bug: dragging into a *non-empty* column showed no highlight.
 * The cause was reading this column's own `useDroppable().isOver`, which is
 * false whenever one of its cards wins the collision — so only empty columns,
 * having no cards to lose to, ever lit up.
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
}: {
  tasks: readonly TaskCardViewModel[];
  isDragOver: boolean;
}) {
  return render(
    <DndContext>
      <KanbanColumn
        statusId="todo"
        name="To do"
        colorToken="status-todo"
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
    </DndContext>,
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
});
