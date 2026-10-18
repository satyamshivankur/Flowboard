import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Flag,
  FolderInput,
  List,
  Lock,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useCallback, useMemo } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { AvatarGroup } from "@/components/ui/AvatarGroup";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Drawer } from "@/components/ui/Drawer";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, type MenuItemSpec } from "@/components/ui/Menu";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { ScrollShadow } from "@/components/ui/ScrollShadow";
import { Select } from "@/components/ui/Select";
import { StatusPill } from "@/components/ui/StatusPill";
import { MAX_TITLE_LEN } from "@/config/limits";
import {
  PRIORITIES,
  PRIORITY_CONFIG,
  type Priority,
} from "@/config/priorities";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useNavigation } from "@/contexts/NavigationContext";
import { useToast } from "@/contexts/ToastContext";
import { usePendingAction } from "@/controllers/hooks/usePendingAction";
import {
  useTaskDrawer,
  type UpdateTaskInput,
} from "@/controllers/hooks/useTaskDrawer";
import { cn } from "@/lib/cn";
import { useLatched } from "@/lib/useLatched";

import { InlineTextField } from "../../components/ui/InlineTextField";

import { PropertyRow } from "./PropertyRow";
import { SubtaskList } from "./SubtaskList";

export interface TaskDrawerProps {
  /** Ids in the current view's order, for previous/next triage. */
  readonly orderedTaskIds: readonly string[];
}

/**
 * The task detail drawer.
 *
 * A bottom sheet below `md` and a right-side panel above, with identical
 * content either way — the difference is positioning, not behaviour
 * (Requirement 7.1, 20.7). Headless UI supplies the focus trap, Escape
 * handling and focus restoration to the card that opened it
 * (Requirement 7.2, 7.3, 17.2).
 */
/** The fields that show their own pending indicator. */
type PendingField = "status" | "priority" | "assignees" | "dueDate" | "list";

export function TaskDrawer({ orderedTaskIds }: TaskDrawerProps) {
  const { openTaskId, openTask, closeTask } = useNavigation();
  const { confirm } = useConfirm();
  /*
   * One reference time for the whole drawer, fixed at mount — as the board and
   * the list view already do. It feeds the created/updated labels and the
   * overdue tone on every subtask row, so reading the clock per render would
   * let two rows disagree about whether today is today.
   *
   * It also matters for cost: `useTaskDrawer` resolves its subtask cards
   * against `now`, so a fresh timestamp each render would re-run every
   * selector behind the view-model on every render.
   */
  const now = useMemo(() => new Date().toISOString(), []);
  /*
   * Which field is saving, not merely whether something is. A single global
   * spinner cannot tell a user that their status change landed while the
   * assignee change is still in flight (Requirement 7.7, 14.7).
   *
   * Same hook the board uses, keyed by field name instead of task id — the
   * shape of the problem is identical, so it should not have two solutions.
   */
  const { run, isPending } = usePendingAction();
  const toast = useToast();
  const drawer = useTaskDrawer(openTaskId, now);

  const open = openTaskId !== null && drawer.exists;

  /*
   * The content is latched to what it was while open. `closeTask()` sets
   * `openTaskId` to null, which empties the view-model in the same commit that
   * starts the close — so without this the drawer would blank itself for the
   * 200ms it spends sliding out.
   */
  const view = useLatched(drawer, open);

  const index = openTaskId === null ? -1 : orderedTaskIds.indexOf(openTaskId);
  const previousId = index > 0 ? orderedTaskIds[index - 1] : undefined;
  const nextId =
    index >= 0 && index < orderedTaskIds.length - 1
      ? orderedTaskIds[index + 1]
      : undefined;

  /**
   * Saves one field, marking it pending for the duration.
   *
   * Every write goes through `run`, so a rejection becomes a toast and the
   * Model's rollback is visible rather than silent — which is what makes the
   * dev panel's "fail the next operation" switch worth having
   * (Requirement 7.7, 14.4, 14.7, 18.5).
   */
  const save = useCallback(
    (field: PendingField | null, input: UpdateTaskInput) => {
      void run(field, () => view.onFieldSave(input), { retryable: true });
    },
    [run, view],
  );

  /*
   * The subtask rows' inline editors, keyed by subtask id so the row that was
   * edited is the row that dims — the parent's own fields key by field name
   * instead, since there is only ever one parent on screen.
   *
   * Grouped into one object for the same reason `TaskListView` does it: the
   * table and the phone cards would otherwise have grown two subtly different
   * sets of handlers, and this is now the third surface that edits a subtask.
   */
  const subtaskHandlers = useMemo(
    () => ({
      onRename: (subtaskId: string, title: string) => {
        void run(subtaskId, () => view.onSubtaskUpdate(subtaskId, { title }), {
          retryable: true,
        });
      },
      onSetStatus: (subtaskId: string, statusId: string) => {
        void run(
          subtaskId,
          () => view.onSubtaskUpdate(subtaskId, { statusId }),
          { retryable: true },
        );
      },
      onSetPriority: (subtaskId: string, priority: Priority) => {
        void run(
          subtaskId,
          () => view.onSubtaskUpdate(subtaskId, { priority }),
          { retryable: true },
        );
      },
      onSetDueDate: (subtaskId: string, dueDate: string | null) => {
        void run(
          subtaskId,
          () => view.onSubtaskUpdate(subtaskId, { dueDate }),
          { retryable: true },
        );
      },
      onToggleAssignee: (subtaskId: string, userId: string) => {
        const subtask = view.subtasks.find(
          (candidate) => candidate.id === subtaskId,
        );

        if (subtask === undefined) return;

        const current = subtask.assignees.map((user) => user.id);
        const next = current.includes(userId)
          ? current.filter((id) => id !== userId)
          : [...current, userId];

        void run(
          subtaskId,
          () => view.onSubtaskUpdate(subtaskId, { assigneeIds: next }),
          { retryable: true },
        );
      },
    }),
    [run, view],
  );

  const handleMoveToList = useCallback(
    (listId: string) => {
      void (async () => {
        const result = await run("list", () => view.onMoveToList(listId), {
          successTitle: "Task moved",
        });

        /*
         * A move between lists can land the task on a different status, since
         * status sets are per-list. Saying so is the difference between a
         * surprise and an explanation (Requirement 2.6, 7.9).
         */
        if (result.ok && result.data.statusRemapped) {
          toast.push({
            tone: "info",
            title: "Status remapped",
            description:
              "The destination list had no matching status, so the task took that list's first one.",
          });
        }
      })();
    },
    [run, toast, view],
  );

  /*
   * Deleting a subtask is as destructive as deleting a task, and it was going
   * through unconfirmed — the only unguarded destructive path left in the app
   * (Requirement 14.9, 2.12). No cascade to name, since depth is capped at 1.
   */
  const handleDeleteSubtask = useCallback(
    (subtaskId: string) => {
      void (async () => {
        const subtask = view.subtasks.find(
          (candidate) => candidate.id === subtaskId,
        );

        if (!subtask) return;

        const confirmed = await confirm({
          title: `Delete "${subtask.title}"?`,
          body: "This cannot be undone.",
          confirmLabel: "Delete",
          tone: "danger",
        });

        if (!confirmed) return;

        void run(subtaskId, () => view.onDeleteSubtask(subtaskId));
      })();
    },
    [confirm, run, view],
  );

  const handleDelete = useCallback(() => {
    void (async () => {
      const confirmed = await confirm({
        title: `Delete "${view.title}"?`,
        body:
          view.cascadeCount === 0
            ? "This cannot be undone."
            : `${String(view.cascadeCount)} subtask(s) will be deleted too. This cannot be undone.`,
        confirmLabel: "Delete",
        tone: "danger",
      });

      if (!confirmed) return;

      const result = await run(view.taskId, () => view.onDelete(), {
        successTitle: "Task deleted",
      });

      if (result.ok) closeTask();
    })();
  }, [confirm, run, view, closeTask]);

  const moveItems: MenuItemSpec[] = view.moveTargets.map((list) => ({
    id: list.id,
    label: list.name,
    icon: List,
    disabled: !view.canEdit,
    onSelect: () => {
      handleMoveToList(list.id);
    },
  }));

  return (
    <Drawer
      open={open}
      onClose={closeTask}
      side="right"
      label={view.title.length > 0 ? view.title : "Task details"}
      widthClassName="md:w-drawer xl:w-drawer-xl"
    >
      <header className="flex shrink-0 items-center gap-1 border-b border-border px-4 py-2 md:px-5">
        <nav
          aria-label="Task path"
          className="min-w-0 flex-1 truncate text-xs text-ink-400"
        >
          {view.breadcrumb.map((node) => node.name).join(" / ")}
        </nav>

        {/* Previous/next lets a user triage a column without closing the
            drawer between tasks (Requirement 7.11). */}
        <IconButton
          icon={ChevronUp}
          label="Previous task"
          size="sm"
          disabled={previousId === undefined}
          onClick={() => {
            if (previousId !== undefined) openTask(previousId);
          }}
        />
        <IconButton
          icon={ChevronDown}
          label="Next task"
          size="sm"
          disabled={nextId === undefined}
          onClick={() => {
            if (nextId !== undefined) openTask(nextId);
          }}
        />
        <IconButton
          icon={X}
          label="Close"
          size="sm"
          tooltip={false}
          onClick={closeTask}
        />
      </header>

      {/*
        Read-only is decided up front rather than on submit. A disabled control
        explains itself; a rejected save after the fact does not
        (Requirement 7.10).
      */}
      {!view.canEdit && view.readOnlyReason !== undefined && (
        <p className="flex shrink-0 items-center gap-1.5 bg-warning-50 px-4 py-2 text-xs text-warning-700 md:px-5">
          <Lock
            className="size-icon-sm shrink-0"
            strokeWidth={1.75}
            aria-hidden
          />
          {view.readOnlyReason} — this task is read-only.
        </p>
      )}

      <ScrollShadow className="px-4 py-4 md:px-5">
        <div className="flex flex-col gap-5">
          <InlineTextField
            key={`title-${view.taskId ?? "none"}`}
            label="Title"
            value={view.title}
            placeholder="Untitled task"
            disabled={!view.canEdit}
            maxLength={MAX_TITLE_LEN}
            textClassName="text-base font-semibold text-ink-900"
            onCommit={(next) => {
              save(null, { title: next });
            }}
          />

          <div className="flex flex-col gap-2.5">
            <PropertyRow
              label="Status"
              icon={CircleDot}
              pending={isPending("status")}
            >
              <Select
                label="Status"
                value={view.statusId}
                disabled={!view.canEdit}
                /*
                 * The pill travels with the option, so the closed trigger and
                 * the open list render the same thing. The previous version
                 * supplied only `renderValue`, which showed a pill on the
                 * button and plain text in the dropdown.
                 */
                options={view.statuses.map((status) => ({
                  value: status.id,
                  label: status.name,
                  content: (
                    <StatusPill
                      name={status.name}
                      colorToken={status.colorToken}
                      variant="dot-label"
                    />
                  ),
                }))}
                onChange={(statusId) => {
                  save("status", { statusId });
                }}
              />
            </PropertyRow>

            <PropertyRow
              label="Priority"
              icon={Flag}
              pending={isPending("priority")}
            >
              <Select<Priority>
                label="Priority"
                value={view.priority}
                disabled={!view.canEdit}
                /*
                 * `PRIORITY_CONFIG` has carried an icon and a colour token all
                 * along; this picker was rendering neither, so the one control
                 * whose whole job is choosing a priority was the only place
                 * that showed it as bare text.
                 */
                options={PRIORITIES.map((priority) => ({
                  value: priority,
                  label: PRIORITY_CONFIG[priority].label,
                  content: <PriorityBadge priority={priority} showLabel />,
                }))}
                onChange={(priority) => {
                  save("priority", { priority });
                }}
              />
            </PropertyRow>

            <PropertyRow
              label="Assignees"
              icon={Users}
              pending={isPending("assignees")}
            >
              <Menu
                align="start"
                label="Assignees"
                items={view.members.map((member) => ({
                  id: member.id,
                  label: member.name,
                  /*
                   * Was `✓ ${member.name}`, which put the selection state
                   * inside the label — so a screen reader announced a tick
                   * character and the menu showed no avatar at all. `selected`
                   * now renders the check and appends ", selected" to the
                   * accessible name instead.
                   */
                  selected: view.assigneeIds.includes(member.id),
                  content: (
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar
                        name={member.name}
                        avatarToken={member.avatarToken}
                        size="xs"
                        showTooltip={false}
                      />
                      <span className="truncate">{member.name}</span>
                    </span>
                  ),
                  disabled: !view.canEdit,
                  onSelect: () => {
                    const next = view.assigneeIds.includes(member.id)
                      ? view.assigneeIds.filter((id) => id !== member.id)
                      : [...view.assigneeIds, member.id];

                    save("assignees", { assigneeIds: next });
                  },
                }))}
                trigger={
                  <button
                    type="button"
                    disabled={!view.canEdit}
                    /*
                     * No `aria-label` here: `Menu` renders its trigger with
                     * `as={Fragment}` and merges its own `label` onto this
                     * element, so anything set here is silently overridden.
                     * The name comes from the `Menu`'s `label` prop.
                     */
                    className={cn(
                      "flex h-9 w-full items-center gap-2 rounded-md px-2 text-left",
                      "coarse-pointer:h-touch",
                      "can-hover:hover:bg-surface-hover",
                      "focus-visible:outline-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2",
                      "disabled:cursor-default",
                    )}
                  >
                    {view.assignees.length === 0 ? (
                      <span className="text-sm text-ink-400">Unassigned</span>
                    ) : (
                      <>
                        <AvatarGroup users={view.assignees} max={4} size="xs" />
                        <span className="truncate text-sm text-ink-900">
                          {view.assignees.map((user) => user.name).join(", ")}
                        </span>
                      </>
                    )}
                  </button>
                }
              />
            </PropertyRow>

            <PropertyRow
              label="Due date"
              icon={CalendarClock}
              pending={isPending("dueDate")}
            >
              {/*
                A styled calendar rather than `<input type="date">`. The native
                input was the one control in the app that ignored the token
                system — it is barely styleable and renders differently in
                every browser — and it cannot show which day is today.
                Selection is calendar-only, so there is no half-written or
                ambiguous date to validate.
              */}
              <DatePicker
                key={`due-${view.taskId ?? "none"}`}
                label="Due date"
                value={view.dueDate}
                disabled={!view.canEdit}
                onChange={(dueDate) => {
                  save("dueDate", { dueDate });
                }}
              />
            </PropertyRow>

            <PropertyRow
              label="List"
              icon={FolderInput}
              pending={isPending("list")}
            >
              <Menu
                align="start"
                label="Move to list"
                items={
                  moveItems.length > 0
                    ? moveItems
                    : [
                        {
                          id: "none",
                          label: "No other lists available",
                          disabled: true,
                          onSelect: () => undefined,
                        },
                      ]
                }
                trigger={
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={FolderInput}
                    disabled={!view.canEdit}
                    fullWidth
                  >
                    Move to another list
                  </Button>
                }
              />
            </PropertyRow>
          </div>

          <section className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold text-ink-900">Description</h3>
            <InlineTextField
              key={`description-${view.taskId ?? "none"}`}
              label="Description"
              value={view.description ?? ""}
              placeholder="Add a description…"
              disabled={!view.canEdit}
              textClassName="text-sm text-ink-600"
              onCommit={(next) => {
                save(null, {
                  description: next.length === 0 ? null : next,
                });
              }}
            />
          </section>

          {/*
            Editable in place, with the same controls the list view's nested
            rows and the board's subtask cards carry — so the drawer is no
            longer the one subtask surface that can tick a subtask but not
            re-prioritise it (Requirement 7.4.1).
          */}
          <SubtaskList
            subtasks={view.subtasks}
            now={now}
            canEdit={view.canEdit}
            readOnlyReason={view.readOnlyReason}
            statuses={view.statuses}
            members={view.members}
            onToggle={(subtaskId) => {
              void run(subtaskId, () => view.onToggleSubtask(subtaskId), {
                retryable: true,
              });
            }}
            onCreate={(title) => {
              void run(null, () => view.onAddSubtask(title), {
                retryable: true,
              });
            }}
            onOpen={openTask}
            onDelete={handleDeleteSubtask}
            {...subtaskHandlers}
            isPending={isPending}
          />
        </div>
      </ScrollShadow>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3 md:px-5">
        <p className="min-w-0 truncate text-xs text-ink-400">
          Created {view.createdLabel} · Updated {view.updatedLabel}
        </p>

        <Button
          size="sm"
          variant="ghost"
          icon={Trash2}
          disabled={!view.canEdit}
          onClick={handleDelete}
          className="shrink-0 text-danger-600"
        >
          Delete
        </Button>
      </footer>
    </Drawer>
  );
}
