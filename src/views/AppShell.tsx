import { useEffect, type ReactNode } from "react";

import { useDensity } from "@/contexts/DensityContext";
import { useNavigation } from "@/contexts/NavigationContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { useSelectedList } from "@/controllers/hooks/useSelectedList";
import { useSession } from "@/controllers/hooks/useSession";

import { ConfirmHost } from "./hosts/ConfirmHost";
import { ToastHost } from "./hosts/ToastHost";
import { Sidebar } from "./sidebar/Sidebar";
import {
  NoListSelectedState,
  PermissionDeniedState,
} from "./states/EmptyStates";
import { TopBar } from "./topbar/TopBar";
import { VIEW_COMPONENTS } from "./viewComponents";

/**
 * The app chrome.
 *
 * `h-dvh` with `overflow-hidden` and independently scrolling regions, so the
 * page itself never scrolls and the chrome stays put while content moves
 * (Requirement 16.1). `dvh` rather than `vh`, because mobile browser chrome
 * overlaps a `vh`-sized shell and pushes its footer out of view
 * (Requirement 20.13).
 *
 * Single pane below `lg`, sidebar plus content at `lg` and above. This layout
 * does not branch on a breakpoint — the sidebar decides its own form.
 */
export function AppShell() {
  const { density } = useDensity();
  const { isHydrating } = useSession();
  const { selectedListId, selectList, view } = useNavigation();
  const { expand } = useSidebar();
  const selected = useSelectedList(selectedListId);

  /*
   * Open the first visible list once hydration settles. Deliberately not a
   * default in NavigationContext: which list is "first" depends on who is
   * looking, and that is not known until the store has loaded.
   */
  useEffect(() => {
    if (selectedListId !== null || isHydrating) return;
    if (selected.firstListId === undefined) return;

    selectList(selected.firstListId);
  }, [selectedListId, isHydrating, selected.firstListId, selectList]);

  /* Expand the path to the selection, or it sits inside collapsed parents. */
  useEffect(() => {
    if (selected.expansionPath.length > 0) {
      expand(selected.expansionPath);
    }
  }, [selected.expansionPath, expand]);

  /* Early returns rather than nested ternaries in the markup (Req 21.14). */
  function renderContent(): ReactNode {
    if (selectedListId === null) {
      return (
        <NoListSelectedState
          suggestions={selected.suggestions}
          onNavigate={selectList}
        />
      );
    }

    /*
     * The state a user switch lands in: Bob cannot see Infra, so if it was
     * open, switching must say so and offer a way out rather than rendering an
     * empty board that reads as broken (Requirement 8.13).
     */
    if (!selected.isVisible) {
      return (
        <PermissionDeniedState
          resourceName={selected.name}
          suggestions={selected.suggestions}
          onNavigate={selectList}
        />
      );
    }

    const ViewComponent = VIEW_COMPONENTS[view];

    return <ViewComponent listId={selectedListId} />;
  }

  return (
    <div
      data-density={density}
      className="flex h-dvh overflow-hidden bg-surface-sunken"
    >
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar breadcrumb={selected.breadcrumb} />

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {renderContent()}
        </main>
      </div>

      <ToastHost />
      <ConfirmHost />
    </div>
  );
}
