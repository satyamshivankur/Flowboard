import { CornerDownLeft, FileText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CommandPalette,
  type CommandPaletteGroup,
} from "@/components/ui/CommandPalette";
import { Highlight } from "@/components/ui/Highlight";
import { Kbd } from "@/components/ui/Kbd";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { SEARCH_DEBOUNCE_MS } from "@/config/limits";
import { useNavigation } from "@/contexts/NavigationContext";
import { useTaskSearch } from "@/controllers/hooks/useTaskSearch";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

/**
 * Task search.
 *
 * Connects the debounced query to `useTaskSearch` and renders the results
 * through `CommandPalette`. The division of labour is the point: the Model
 * decides what is visible, the hook shapes it, the primitive knows about
 * neither tasks nor permissions (Requirement 23.2).
 *
 * Opening is owned by `NavigationContext`, so the top bar's button and the
 * keyboard shortcut drive the same state rather than each holding their own.
 */
export function TaskSearch() {
  const { searchOpen, setSearchOpen, selectList, openTask } = useNavigation();

  const [query, setQuery] = useState("");
  const settled = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  /*
   * An empty input means no results *now*, not in 200ms. Reading `settled`
   * alone let the previous query's hits linger — most visibly on reopen, where
   * the palette came back empty-looking but still listing the last search's
   * results until the debounce caught up.
   *
   * Clearing is immediate; only searching is debounced.
   */
  const effectiveQuery = query.trim().length === 0 ? "" : settled;
  const results = useTaskSearch(searchOpen ? effectiveQuery : "");

  /*
   * ⌘K / Ctrl+K. Registered on the document because the shortcut has to work
   * from anywhere in the app, including while focus sits inside the board.
   *
   * Not suppressed inside text fields: ⌘K is not a text-editing chord, and a
   * user typing a task title who wants to jump elsewhere should not have to
   * click away first.
   */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;

      event.preventDefault();
      setSearchOpen(true);
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [setSearchOpen]);

  const close = useCallback(() => {
    setSearchOpen(false);
    /*
     * The query is cleared on close rather than kept. A palette that reopens
     * showing stale results for a search the user has forgotten making is
     * worse than one that starts empty.
     */
    setQuery("");
  }, [setSearchOpen]);

  const groups = useMemo(
    (): CommandPaletteGroup[] =>
      results.groups.map((group) => ({
        id: group.listId,
        label: group.listPath,
        items: group.hits.map((hit) => ({
          id: hit.taskId,
          icon: FileText,
          label: <Highlight text={hit.title} query={settled} />,
          description:
            hit.descriptionExcerpt === undefined ? undefined : (
              <Highlight text={hit.descriptionExcerpt} query={settled} />
            ),
          meta: (
            <span className="flex items-center gap-1.5">
              <PriorityBadge priority={hit.priority} />
              <StatusPill name={hit.statusName} colorToken={hit.statusToken} />
            </span>
          ),
        })),
      })),
    [results.groups, settled],
  );

  /** Navigating to a hit means both selecting its list and opening the task. */
  const handleSelect = useCallback(
    (taskId: string) => {
      const group = results.groups.find((candidate) =>
        candidate.hits.some((hit) => hit.taskId === taskId),
      );

      if (!group) return;

      /*
       * Order matters. `selectList` clears the open task — it has to, or
       * changing list would leave the drawer showing something from the list
       * you just left — so opening the task second is what makes this work.
       */
      selectList(group.listId);
      openTask(taskId);
      close();
    },
    [results.groups, selectList, openTask, close],
  );

  return (
    <CommandPalette
      open={searchOpen}
      onClose={close}
      query={query}
      onQueryChange={setQuery}
      groups={groups}
      onSelect={handleSelect}
      label="Search tasks"
      placeholder="Search tasks by title or description…"
      // The spinner shows only while the debounce is still settling, so it
      // reflects "still typing" rather than a fake network round trip.
      isSearching={query.trim() !== settled.trim()}
      hintLabel="Search every task you can see in this workspace."
      emptyLabel={`No tasks match “${settled.trim()}”.`}
      footer={
        <>
          <span className="flex items-center gap-1 text-xs text-ink-400">
            <Kbd keys={["↑", "↓"]} /> to navigate
          </span>
          <span className="flex items-center gap-1 text-xs text-ink-400">
            <CornerDownLeft
              className="size-icon-sm"
              strokeWidth={1.75}
              aria-hidden
            />
            to open
          </span>

          <span className="ml-auto text-xs tabular-nums text-ink-400">
            {results.total > 0 &&
              `${String(results.total)} result${results.total === 1 ? "" : "s"}`}
            {results.isTruncated && " (showing the first 50)"}
          </span>
        </>
      }
    />
  );
}
