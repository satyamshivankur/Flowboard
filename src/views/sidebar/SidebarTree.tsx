import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useCallback, useMemo, useState, type KeyboardEvent } from "react";

import { Skeleton } from "@/components/ui/Skeleton";
import { canContain } from "@/config/containers";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useNavigation } from "@/contexts/NavigationContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { useToast } from "@/contexts/ToastContext";
import { useAction } from "@/controllers/hooks/useAction";
import { useContainerActions } from "@/controllers/hooks/useContainerActions";
import { usePermissions } from "@/controllers/hooks/usePermissions";
import {
  flattenRows,
  isExpandable,
  type TreeRowViewModel,
} from "@/controllers/hooks/useVisibleTree";

import { TreeItem } from "./TreeItem";

export interface SidebarTreeProps {
  readonly rows: readonly TreeRowViewModel[];
  readonly isLoading: boolean;
  readonly onRename: (row: TreeRowViewModel) => void;
  readonly onCreateChild: (row: TreeRowViewModel, childType: string) => void;
  /** Called after a list is selected, so the mobile sheet can close itself. */
  readonly onAfterSelect?: () => void;
}

/** Index of a row among its own siblings, for resolving a drop position. */
function siblingIndex(
  all: readonly TreeRowViewModel[],
  row: TreeRowViewModel,
): number {
  const siblings = all.filter(
    (candidate) => candidate.parentId === row.parentId,
  );
  return siblings.findIndex((candidate) => candidate.id === row.id);
}

/** Every row in the tree, flattened regardless of expansion, for lookups. */
function allRows(
  rows: readonly TreeRowViewModel[],
): readonly TreeRowViewModel[] {
  return rows.flatMap((row) => [row, ...allRows(row.children)]);
}

export function SidebarTree({
  rows,
  isLoading,
  onRename,
  onCreateChild,
  onAfterSelect,
}: SidebarTreeProps) {
  const { selectedListId, selectList } = useNavigation();
  const { expandedIds, toggleExpanded, collapsed } = useSidebar();
  const permissions = usePermissions();
  const containers = useContainerActions();
  const { run } = useAction();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [focusedId, setFocusedId] = useState<string | null>(null);

  const visible = useMemo(
    () => flattenRows(rows, expandedIds),
    [rows, expandedIds],
  );
  const lookup = useMemo(() => allRows(rows), [rows]);

  const sensors = useSensors(
    // 8px before a drag starts, so a click on a tree row still selects it.
    // px-exception: a pointer-movement threshold, not a rendered dimension.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // A press delay is what separates "long-press to drag" from "scroll the
    // sidebar" on touch (Requirement 20.8).
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleSelect = useCallback(
    (row: TreeRowViewModel) => {
      if (row.holdsTasks) {
        selectList(row.id);
        onAfterSelect?.();
        return;
      }

      // A space or folder is not a destination; clicking it expands it.
      toggleExpanded(row.id);
    },
    [selectList, toggleExpanded, onAfterSelect],
  );

  /**
   * Resolves a drop into either a reorder or a reparent.
   *
   * Three cases, in order of preference:
   *   1. Dropped onto a container that accepts this type → move inside it.
   *   2. Dropped onto a sibling → reorder to that sibling's index.
   *   3. Dropped onto a node whose parent accepts this type → move there.
   *
   * Anything else is an invalid drop and says so, rather than silently doing
   * nothing and leaving the user wondering whether the gesture registered.
   */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      const dragged = lookup.find((row) => row.id === active.id);
      const target = lookup.find((row) => row.id === over.id);

      if (!dragged || !target) return;

      if (canContain(target.type, dragged.type)) {
        void run(
          () => containers.move(dragged.id, target.id, Number.MAX_SAFE_INTEGER),
          { successTitle: `Moved "${dragged.name}" into "${target.name}"` },
        );
        return;
      }

      if (target.parentId === dragged.parentId) {
        void run(() =>
          containers.reorder(dragged.id, siblingIndex(lookup, target)),
        );
        return;
      }

      const newParent = lookup.find((row) => row.id === target.parentId);

      if (newParent && canContain(newParent.type, dragged.type)) {
        void run(
          () =>
            containers.move(
              dragged.id,
              newParent.id,
              siblingIndex(lookup, target),
            ),
          { successTitle: `Moved "${dragged.name}" into "${newParent.name}"` },
        );
        return;
      }

      toast.push({
        tone: "warning",
        title: "Can't drop there",
        description: `A ${dragged.type} cannot go inside a ${target.type}.`,
      });
    },
    [lookup, containers, run, toast],
  );

  /**
   * Archive, with the cascade stated before it happens.
   *
   * Archiving a space takes its folders, lists and their tasks out of every
   * view at once, so the dialog names the count rather than leaving the user to
   * discover it (Requirement 14.9).
   */
  const handleArchive = useCallback(
    (row: TreeRowViewModel) => {
      void (async () => {
        const descendants = allRows(row.children).length;

        const confirmed = await confirm({
          title: `Archive "${row.name}"?`,
          body:
            descendants === 0
              ? "It will be hidden from the sidebar. You can restore it later."
              : `${String(descendants)} item(s) inside it will be hidden too. You can restore them later.`,
          confirmLabel: "Archive",
          tone: "danger",
        });

        if (!confirmed) return;

        const result = await run(() => containers.archive(row.id), {
          successTitle: `Archived "${row.name}"`,
        });

        // Archiving the open list leaves the content region pointing at
        // something invisible; drop the selection so the shell can recover.
        if (result.ok && selectedListId !== null) {
          const archived = [row, ...allRows(row.children)];

          if (archived.some((node) => node.id === selectedListId)) {
            selectList(null);
          }
        }
      })();
    },
    [confirm, run, containers, selectedListId, selectList],
  );

  /**
   * Arrow-key navigation over the flattened visible rows.
   *
   * Right expands a collapsed node then steps into it; Left collapses an
   * expanded one then steps out to the parent. That is the behaviour a tree
   * widget is expected to have, and it comes from the flat row list rather than
   * from walking the nested structure (Requirement 6.7, 17.3).
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLUListElement>) => {
      const index = visible.findIndex((row) => row.id === focusedId);
      const current = index >= 0 ? visible[index] : undefined;

      if (!current) return;

      const moveTo = (nextIndex: number) => {
        const next =
          visible[Math.max(0, Math.min(nextIndex, visible.length - 1))];

        if (next) setFocusedId(next.id);
      };

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          moveTo(index + 1);
          break;

        case "ArrowUp":
          event.preventDefault();
          moveTo(index - 1);
          break;

        case "ArrowRight":
          event.preventDefault();

          if (isExpandable(current) && !expandedIds.has(current.id)) {
            toggleExpanded(current.id);
          } else if (current.hasChildren) {
            moveTo(index + 1);
          }
          break;

        case "ArrowLeft":
          event.preventDefault();

          if (isExpandable(current) && expandedIds.has(current.id)) {
            toggleExpanded(current.id);
          } else if (current.parentId !== null) {
            setFocusedId(current.parentId);
          }
          break;

        case "Enter":
        case " ":
          event.preventDefault();
          handleSelect(current);
          break;

        default:
          break;
      }
    },
    [visible, focusedId, expandedIds, toggleExpanded, handleSelect],
  );

  if (isLoading) {
    return <Skeleton variant="tree" lines={6} className="px-2" />;
  }

  const focused = focusedId ?? visible[0]?.id ?? null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={visible.map((row) => row.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul
          role="tree"
          aria-label="Workspace"
          onKeyDown={handleKeyDown}
          className="flex flex-col gap-0.5"
        >
          {visible.map((row) => (
            <TreeItem
              key={row.id}
              row={row}
              isSelected={row.id === selectedListId}
              isExpanded={expandedIds.has(row.id)}
              isFocused={row.id === focused}
              collapsed={collapsed}
              canEditStructure={permissions.can("container:update", row.id)}
              structureReason={permissions.reasonFor(
                "container:update",
                row.id,
              )}
              onSelect={handleSelect}
              onToggle={toggleExpanded}
              onRename={onRename}
              onCreateChild={onCreateChild}
              onArchive={handleArchive}
              onFocus={setFocusedId}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
