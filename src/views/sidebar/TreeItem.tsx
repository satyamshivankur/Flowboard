import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, MoreHorizontal, Plus } from "lucide-react";

import { IconButton } from "@/components/ui/IconButton";
import { Menu, type MenuItemSpec } from "@/components/ui/Menu";
import { CONTAINER_REGISTRY } from "@/config/containers";
import {
  isExpandable,
  type TreeRowViewModel,
} from "@/controllers/hooks/useVisibleTree";
import { cn } from "@/lib/cn";

export interface TreeItemProps {
  readonly row: TreeRowViewModel;
  readonly isSelected: boolean;
  readonly isExpanded: boolean;
  readonly isFocused: boolean;
  readonly collapsed: boolean;
  readonly canEditStructure: boolean;
  readonly structureReason: string | undefined;
  readonly onSelect: (row: TreeRowViewModel) => void;
  readonly onToggle: (id: string) => void;
  readonly onRename: (row: TreeRowViewModel) => void;
  readonly onCreateChild: (row: TreeRowViewModel, childType: string) => void;
  readonly onArchive: (row: TreeRowViewModel) => void;
  readonly onFocus: (id: string) => void;
}

/*
 * Indentation per depth as a lookup rather than a computed inline width.
 * Depth 1 is a top-level space; the registry's four levels bottom out at 4.
 */
const INDENT: Record<number, string> = {
  1: "pl-2",
  2: "pl-6",
  3: "pl-10",
  4: "pl-14",
};

export function TreeItem({
  row,
  isSelected,
  isExpanded,
  isFocused,
  collapsed,
  canEditStructure,
  structureReason,
  onSelect,
  onToggle,
  onRename,
  onCreateChild,
  onArchive,
  onFocus,
}: TreeItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.id,
    data: { type: row.type, parentId: row.parentId },
    disabled: !canEditStructure,
  });

  const Icon = CONTAINER_REGISTRY[row.type].icon;
  const expandable = isExpandable(row);

  const actions: MenuItemSpec[] = [
    ...row.childTypes.map((childType) => ({
      id: `create-${childType}`,
      label: `New ${CONTAINER_REGISTRY[childType].label.toLowerCase()}`,
      icon: Plus,
      disabled: !canEditStructure,
      ...(structureReason === undefined
        ? {}
        : { disabledReason: structureReason }),
      onSelect: () => {
        onCreateChild(row, childType);
      },
    })),
    {
      id: "rename",
      label: "Rename",
      disabled: !canEditStructure || !row.mutable,
      ...(structureReason === undefined
        ? {}
        : { disabledReason: structureReason }),
      separatorBefore: row.childTypes.length > 0,
      onSelect: () => {
        onRename(row);
      },
    },
    {
      id: "archive",
      label: "Archive",
      tone: "danger" as const,
      disabled: !canEditStructure || !row.mutable,
      ...(structureReason === undefined
        ? {}
        : { disabledReason: structureReason }),
      onSelect: () => {
        onArchive(row);
      },
    },
  ];

  return (
    <li
      ref={setNodeRef}
      /*
       * The one inline `style` in this component, and one of the two documented
       * exceptions in the project: dnd-kit computes a transform per frame, so
       * it cannot be a class (Requirement 13.4). px-exception — these are
       * dnd-kit's own pixel transforms, not an authored dimension.
       */
      style={{ transform: CSS.Transform.toString(transform), transition }}
      role="treeitem"
      aria-expanded={expandable ? isExpanded : undefined}
      aria-selected={isSelected}
      aria-level={row.depth}
      className={cn(
        "group relative list-none",
        isDragging && "z-10 opacity-50",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1 rounded-md pr-1",
          // h-11 on touch for the target minimum, denser with a fine pointer.
          "h-11 can-hover:h-8 density-compact:can-hover:h-7",
          "transition-colors motion-reduce:transition-none",
          isSelected
            ? "bg-brand-50 text-brand-700"
            : "text-ink-600 can-hover:hover:bg-surface-hover can-hover:hover:text-ink-900",
          collapsed ? "justify-center px-0" : (INDENT[row.depth] ?? "pl-2"),
        )}
      >
        {!collapsed && (
          <button
            type="button"
            tabIndex={-1}
            aria-hidden={!expandable}
            onClick={() => {
              if (expandable) onToggle(row.id);
            }}
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded",
              expandable
                ? "text-ink-400 can-hover:hover:text-ink-900"
                : "invisible",
            )}
          >
            <ChevronRight
              className={cn(
                "size-icon-sm transition-transform motion-reduce:transition-none",
                isExpanded && "rotate-90",
              )}
              strokeWidth={2}
            />
          </button>
        )}

        <button
          type="button"
          {...attributes}
          {...listeners}
          tabIndex={isFocused ? 0 : -1}
          onFocus={() => {
            onFocus(row.id);
          }}
          onClick={() => {
            onSelect(row);
          }}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded text-left",
            "focus-visible:outline-brand-600 focus-visible:outline-2 focus-visible:outline-offset-1",
            collapsed && "flex-none justify-center",
          )}
          title={row.name}
        >
          <Icon
            className={cn(
              "size-icon-md shrink-0",
              isSelected ? "text-brand-600" : "text-ink-400",
            )}
            strokeWidth={1.75}
            aria-hidden
          />

          {!collapsed && (
            <span
              className={cn("truncate text-sm", isSelected && "font-medium")}
            >
              {row.name}
            </span>
          )}
        </button>

        {!collapsed && (
          <span
            className={cn(
              "shrink-0",
              // Hidden until hover only where hover exists; always visible on
              // touch, where there is nothing to hover (Requirement 20.10).
              "can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:group-focus-within:opacity-100",
            )}
          >
            <Menu
              align="end"
              label={`${row.name} actions`}
              items={actions}
              trigger={
                <IconButton
                  icon={MoreHorizontal}
                  label={`${row.name} actions`}
                  size="xs"
                  tooltip={false}
                />
              }
            />
          </span>
        )}
      </div>

      {/*
        A folder the current user can see but whose only children they cannot is
        otherwise an expandable dead end. Bob's Platform folder is exactly this
        case (Requirement 6.8).
      */}
      {!collapsed &&
        isExpanded &&
        row.hasHiddenChildren &&
        !row.hasChildren && (
          <p
            className={cn(
              "py-1 text-xs italic text-ink-400",
              INDENT[row.depth + 1] ?? "pl-6",
            )}
          >
            No lists you can access
          </p>
        )}
    </li>
  );
}
