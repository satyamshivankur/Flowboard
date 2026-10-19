import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { useState } from "react";

import { Drawer } from "@/components/ui/Drawer";
import { IconButton } from "@/components/ui/IconButton";
import { Menu } from "@/components/ui/Menu";
import { ScrollShadow } from "@/components/ui/ScrollShadow";
import { CONTAINER_REGISTRY } from "@/config/containers";
import { useSidebar } from "@/contexts/SidebarContext";
import { usePermissions } from "@/controllers/hooks/usePermissions";
import {
  useVisibleTree,
  type TreeRowViewModel,
} from "@/controllers/hooks/useVisibleTree";
import { cn } from "@/lib/cn";

import {
  ContainerFormDialog,
  type ContainerFormRequest,
} from "./ContainerFormDialog";
import { SidebarTree } from "./SidebarTree";

/** The tree plus its header, shared by both sidebar forms. */
function SidebarBody({ onAfterSelect }: { onAfterSelect?: () => void }) {
  const tree = useVisibleTree();
  const { collapsed } = useSidebar();
  const permissions = usePermissions();

  const [request, setRequest] = useState<ContainerFormRequest | null>(null);

  const workspaceChildTypes = CONTAINER_REGISTRY.workspace.childTypes;

  return (
    <>
      <div
        className={cn(
          "flex h-topbar shrink-0 items-center border-b border-border",
          collapsed ? "justify-center px-1" : "justify-between px-3",
        )}
      >
        {!collapsed && (
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-ink-400">
            Flowboard
          </span>
        )}

        <Menu
          align="start"
          label="Create"
          items={workspaceChildTypes.map((childType) => ({
            id: childType,
            label: `New ${CONTAINER_REGISTRY[childType].label.toLowerCase()}`,
            icon: Plus,
            disabled: !permissions.can("container:create", "ws-acme"),
            ...(permissions.reasonFor("container:create", "ws-acme") ===
            undefined
              ? {}
              : {
                  disabledReason: permissions.reasonFor(
                    "container:create",
                    "ws-acme",
                  ),
                }),
            onSelect: () => {
              setRequest({
                mode: "create",
                parentId: "ws-acme",
                type: childType,
                parentName: "Acme",
              });
            },
          }))}
          trigger={<IconButton icon={Plus} label="Create" size="sm" />}
        />
      </div>

      <ScrollShadow className="px-2 py-2">
        <SidebarTree
          rows={tree.nodes}
          isLoading={tree.isLoading}
          {...(onAfterSelect ? { onAfterSelect } : {})}
          onRename={(row: TreeRowViewModel) => {
            setRequest({
              mode: "rename",
              containerId: row.id,
              currentName: row.name,
              type: row.type,
            });
          }}
          onCreateChild={(row, childType) => {
            setRequest({
              mode: "create",
              parentId: row.id,
              type: childType as TreeRowViewModel["type"],
              parentName: row.name,
            });
          }}
          onManageAccess={(row: TreeRowViewModel) => {
            setRequest({ mode: "access", containerId: row.id });
          }}
        />
      </ScrollShadow>

      <ContainerFormDialog
        request={request}
        onClose={() => {
          setRequest(null);
        }}
      />
    </>
  );
}

/**
 * The sidebar, in its two forms.
 *
 * Below `lg` it is a focus-trapping `Drawer`; at `lg` and above a static
 * `aside` that is part of the layout. That difference is *behaviour*, not
 * appearance, which is why `SidebarContext` observes the breakpoint in
 * JavaScript — a media query cannot stop trapping focus, and a sheet left open
 * while the viewport widens would become an invisible focus trap
 * (Requirement 20.7.1).
 *
 * Both forms render the same `SidebarBody`, so there is one tree, one set of
 * actions and one dialog regardless of which shell is showing.
 */
export function Sidebar() {
  const { collapsed, toggleCollapsed, isModal, isSheetOpen, closeSheet } =
    useSidebar();

  if (isModal) {
    return (
      <Drawer
        open={isSheetOpen}
        onClose={closeSheet}
        side="left"
        label="Workspace navigation"
        widthClassName="w-sidebar"
      >
        <SidebarBody onAfterSelect={closeSheet} />
      </Drawer>
    );
  }

  return (
    <aside
      /*
       * Two fixed widths, both from `--spacing-*` tokens, so the sidebar is
       * styled entirely in CSS.
       *
       * This replaced a drag-to-resize handle. That handle was the reason this
       * element carried an inline `style`: a user-dragged width is a value per
       * pointer event, which no utility class can express, so it was one of the
       * documented `style=` exceptions (Requirement 13.4). Fixed widths retire
       * the exception along with the handle.
       */
      className={cn(
        "relative hidden shrink-0 flex-col border-r border-border bg-surface lg:flex",
        collapsed ? "w-sidebar-rail" : "w-sidebar",
      )}
    >
      <SidebarBody />

      <div
        className={cn(
          "absolute bottom-2 z-10",
          collapsed ? "left-1/2 -translate-x-1/2" : "right-2",
        )}
      >
        <IconButton
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          size="sm"
          variant="secondary"
          onClick={toggleCollapsed}
        />
      </div>
    </aside>
  );
}
