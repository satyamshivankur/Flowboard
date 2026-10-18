import { SortableKeyboardPlugin } from "@dnd-kit/dom/sortable";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  Archive,
  ChevronRight,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Users,
} from "lucide-react";

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
  /** Position in the flattened visible tree, which is this row's sort order. */
  readonly index: number;
  readonly isSelected: boolean;
  readonly isExpanded: boolean;
  readonly isFocused: boolean;
  readonly collapsed: boolean;
  readonly canEditStructure: boolean;
  readonly structureReason: string | undefined;
  /** `container:share` — kept separate from structure edits (Req 8.16). */
  readonly canManageAccess: boolean;
  readonly accessReason: string | undefined;
  readonly onSelect: (row: TreeRowViewModel) => void;
  readonly onToggle: (id: string) => void;
  readonly onRename: (row: TreeRowViewModel) => void;
  readonly onCreateChild: (row: TreeRowViewModel, childType: string) => void;
  readonly onManageAccess: (row: TreeRowViewModel) => void;
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
  index,
  isSelected,
  isExpanded,
  isFocused,
  collapsed,
  canEditStructure,
  structureReason,
  canManageAccess,
  accessReason,
  onSelect,
  onToggle,
  onRename,
  onCreateChild,
  onManageAccess,
  onArchive,
  onFocus,
}: TreeItemProps) {
  /*
   * The row is the sortable, but the *handle* is the label button inside it.
   *
   * Without that split the whole `li` is the drag activator, which means the
   * chevron and the actions menu sit inside it — dnd-kit's pointer sensor
   * ignores presses that start on an interactive descendant, so they still
   * work, but a press on the row's padding would start a drag from dead space.
   */
  const { ref, handleRef, isDragSource } = useSortable({
    id: row.id,
    index,
    type: row.type,
    accept: Object.keys(CONTAINER_REGISTRY),
    disabled: !canEditStructure,
    /*
     * Keyboard support, but no optimistic sorting — React stays the only
     * thing that writes to this list.
     *
     * `OptimisticSortingPlugin` previews a sort by moving the DOM node itself.
     * The board wants that preview and pays for it by mirroring the move into
     * React state, which makes dnd-kit stand down (see `dragDrop.ts`). The
     * tree cannot do the same: a drop here is not a sort at all but one of
     * three outcomes — reorder among siblings, reparent into a container, or
     * refuse — so there is no single list for a preview to rearrange.
     *
     * Leaving the plugin on meant dnd-kit shuffled the `<li>`s while React's
     * model was untouched. A successful drop happened to come out right,
     * because the commit re-rendered the tree in the new order. A *rejected*
     * one did not: the store rolled back, React re-rendered nothing, and the
     * sidebar was left showing an order the store disagreed with.
     */
    plugins: [SortableKeyboardPlugin],
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
    /*
     * Only where the registry says a grant may attach, so the workspace row
     * does not offer an access list it cannot hold (Requirement 21.4).
     */
    ...(row.grantable
      ? [
          {
            id: "access",
            label: "Manage access",
            icon: Users,
            disabled: !canManageAccess,
            ...(accessReason === undefined
              ? {}
              : { disabledReason: accessReason }),
            separatorBefore: row.childTypes.length > 0,
            onSelect: () => {
              onManageAccess(row);
            },
          },
        ]
      : []),
    {
      id: "rename",
      label: "Rename",
      icon: Pencil,
      disabled: !canEditStructure || !row.mutable,
      ...(structureReason === undefined
        ? {}
        : { disabledReason: structureReason }),
      separatorBefore: !row.grantable && row.childTypes.length > 0,
      onSelect: () => {
        onRename(row);
      },
    },
    {
      id: "archive",
      label: "Archive",
      tone: "danger" as const,
      icon: Archive,
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
      /*
       * No inline transform style, and the documented `style` exception that
       * went with it is gone (Requirement 13.4): dnd-kit writes the per-frame
       * transform straight to this element, outside React.
       */
      ref={ref}
      role="treeitem"
      aria-expanded={expandable ? isExpanded : undefined}
      aria-selected={isSelected}
      aria-level={row.depth}
      className={cn(
        "group relative list-none",
        isDragSource && "z-10 opacity-50",
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
            /*
             * Named even though it is skipped in the tab order: the row is
             * reachable by pointer and by assistive tech, and "button" alone
             * says nothing about what it does. Also the only way to address
             * the chevron from a browser test without a DOM query.
             */
            aria-label={
              isExpanded ? `Collapse ${row.name}` : `Expand ${row.name}`
            }
            onClick={() => {
              if (expandable) onToggle(row.id);
            }}
            className={cn(
              // `self-stretch` so the chevron's hit area is the full row
              // height. Centred within it, the icon still reads as 1rem.
              "flex w-4 shrink-0 self-stretch items-center justify-center rounded",
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
          ref={handleRef}
          tabIndex={isFocused ? 0 : -1}
          onFocus={() => {
            onFocus(row.id);
          }}
          onClick={() => {
            onSelect(row);
          }}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded text-left",
            /*
             * `self-stretch` is what makes the row's `h-11` the actual target.
             * Without it the button is only as tall as its text, so the top
             * and bottom of a tree row look tappable and are not
             * (Requirement 20.9).
             */
            "self-stretch",
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

          {/*
            Restricted access is otherwise invisible until someone opens the
            dialog. The icon is decorative and the state is carried in text for
            assistive technology, so the distinction is never colour or shape
            alone (Requirement 17.7).
          */}
          {!collapsed && row.restricted && (
            <>
              <Lock
                className="size-icon-sm shrink-0 text-ink-400"
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="sr-only">Restricted access</span>
            </>
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
