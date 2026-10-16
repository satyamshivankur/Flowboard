import { Menu as MenuIcon, MoreVertical, Search } from "lucide-react";

import { IconButton } from "@/components/ui/IconButton";
import { Menu } from "@/components/ui/Menu";
import { VIEW_IDS, VIEW_REGISTRY } from "@/config/views";
import { useNavigation } from "@/contexts/NavigationContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { cn } from "@/lib/cn";

import { Breadcrumbs, type BreadcrumbNode } from "./Breadcrumbs";
import { DevPanel } from "./DevPanel";
import { UserSwitcher } from "./UserSwitcher";
import { ViewSwitcher } from "./ViewSwitcher";

export interface TopBarProps {
  readonly breadcrumb: readonly BreadcrumbNode[];
}

/**
 * The app's single chrome row.
 *
 * Progressive disclosure upward, per Requirement 20.4:
 *
 *   base  menu button · current list · search · overflow · avatar
 *   md    adds the inline view switcher
 *   lg    adds the full breadcrumb path and the dev panel; drops the menu
 *         button, since the sidebar is part of the layout at that width
 *
 * Every variation is a Tailwind prefix. Nothing here reads a breakpoint from
 * JavaScript.
 */
export function TopBar({ breadcrumb }: TopBarProps) {
  const { isModal, openSheet } = useSidebar();
  const { view, setView, setSearchOpen } = useNavigation();

  return (
    <header
      className={cn(
        "flex h-topbar shrink-0 items-center gap-2 border-b border-border bg-surface px-3",
        "lg:px-4",
      )}
    >
      {/*
        Only rendered while the sidebar is modal. Conditioned on `isModal`
        rather than `lg:hidden` because the button must not exist at all when
        the sidebar is part of the layout — a hidden-but-present trigger could
        still be reached by a screen reader.
      */}
      {isModal && (
        <IconButton
          icon={MenuIcon}
          label="Open navigation"
          size="md"
          onClick={openSheet}
        />
      )}

      <Breadcrumbs path={breadcrumb} className="min-w-0 flex-1" />

      <ViewSwitcher className="hidden md:inline-flex" />

      <IconButton
        icon={Search}
        label="Search tasks"
        size="md"
        onClick={() => {
          setSearchOpen(true);
        }}
      />

      {/* The dev panel has room of its own from `lg`; below that it lives in
          the overflow menu alongside the view switcher. */}
      <span className="hidden lg:inline-flex">
        <DevPanel />
      </span>

      <span className="inline-flex lg:hidden">
        <Menu
          align="end"
          label="More"
          trigger={<IconButton icon={MoreVertical} label="More" size="md" />}
          items={[
            ...VIEW_IDS.map((id) => ({
              id: `view-${id}`,
              label: `${VIEW_REGISTRY[id].label} view`,
              icon: VIEW_REGISTRY[id].icon,
              onSelect: () => {
                setView(id);
              },
            })),
            {
              id: "current-view",
              label: `Currently: ${VIEW_REGISTRY[view].label}`,
              disabled: true,
              separatorBefore: true,
              onSelect: () => undefined,
            },
          ]}
        />
      </span>

      <UserSwitcher />
    </header>
  );
}
