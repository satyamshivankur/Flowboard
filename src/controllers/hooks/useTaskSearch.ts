import { useMemo } from "react";

import { SEARCH_RESULT_LIMIT } from "@/config/limits";
import { PRIORITY_CONFIG, type Priority } from "@/config/priorities";
import type { StatusColorToken } from "@/config/statusCategories";
import { selectBreadcrumb, selectSearchResults } from "@/model/selectors";

import { useStore } from "../store";

import { useScope } from "./useScope";

export interface SearchHitViewModel {
  readonly taskId: string;
  readonly title: string;
  readonly priority: Priority;
  readonly priorityLabel: string;
  readonly statusName: string;
  readonly statusToken: StatusColorToken;
  /**
   * The matched slice of the description, or undefined when the match was in
   * the title. Showing the line that matched is the difference between a
   * result list and a list of titles.
   */
  readonly descriptionExcerpt: string | undefined;
}

/** Hits for one list, so results group by where the tasks live. */
export interface SearchGroupViewModel {
  readonly listId: string;
  readonly listName: string;
  /** Ancestor names, so two lists called "Backlog" are tellable apart. */
  readonly listPath: string;
  readonly hits: readonly SearchHitViewModel[];
}

export interface SearchViewModel {
  readonly groups: readonly SearchGroupViewModel[];
  readonly total: number;
  /** True when the result set was capped. */
  readonly isTruncated: boolean;
}

/** Characters of context either side of a description match. */
const EXCERPT_PADDING = 30;

/**
 * A one-line excerpt around the match, with ellipses where text was dropped.
 */
function excerptAround(description: string, needle: string): string {
  const at = description.toLowerCase().indexOf(needle.toLowerCase());

  if (at === -1) return description.slice(0, EXCERPT_PADDING * 2);

  const start = Math.max(0, at - EXCERPT_PADDING);
  const end = Math.min(description.length, at + needle.length + EXCERPT_PADDING);

  return [
    start > 0 ? "…" : "",
    // Collapse newlines: this renders on a single truncated line.
    description.slice(start, end).replace(/\s+/g, " "),
    end < description.length ? "…" : "",
  ].join("");
}

/**
 * Client-side task search.
 *
 * The Model decides *what* is visible — `selectSearchResults` scopes to the
 * current user's visible lists, so a denied list cannot leak a task title
 * through the search box, which is the obvious way to get permissions wrong
 * (Requirement 8.8, 23.2).
 *
 * This hook only shapes those hits for display: grouping by list, resolving
 * status and priority through the shared config, and cutting a description
 * excerpt around the match.
 *
 * `query` is expected to be already debounced by the caller. Debouncing here
 * would make the hook lie about its own result for a few frames, and the View
 * is what knows whether the user is still typing.
 */
export function useTaskSearch(query: string): SearchViewModel {
  const scope = useScope();
  const state = useStore();

  return useMemo(() => {
    const needle = query.trim();
    const hits = selectSearchResults(state, scope, needle);

    // Grouped with a Map so list order follows first appearance, which is tree
    // order — the same order the sidebar shows.
    const byList = new Map<string, SearchGroupViewModel>();
    let total = 0;

    for (const hit of hits) {
      if (total >= SEARCH_RESULT_LIMIT) break;

      total += 1;

      const status = state.statuses[hit.task.statusId];
      const titleMatched = hit.task.title
        .toLowerCase()
        .includes(needle.toLowerCase());

      const row: SearchHitViewModel = {
        taskId: hit.task.id,
        title: hit.task.title,
        priority: hit.task.priority,
        priorityLabel: PRIORITY_CONFIG[hit.task.priority].label,
        statusName: status?.name ?? "Unknown",
        statusToken: status?.color ?? "status-todo",
        descriptionExcerpt:
          titleMatched || hit.task.description === null
            ? undefined
            : excerptAround(hit.task.description, needle),
      };

      const group = byList.get(hit.list.id);

      if (group) {
        byList.set(hit.list.id, { ...group, hits: [...group.hits, row] });
        continue;
      }

      byList.set(hit.list.id, {
        listId: hit.list.id,
        listName: hit.list.name,
        /*
         * The ancestor chain, not just the leaf name. Two spaces can both hold
         * a list called "Backlog", and a result grouped under a bare "Backlog"
         * would be ambiguous about which one it came from.
         */
        listPath: selectBreadcrumb(state, scope, hit.list.id)
          .map((node) => node.name)
          .join(" / "),
        hits: [row],
      });
    }

    return {
      groups: [...byList.values()],
      total,
      isTruncated: hits.length > total,
    };
  }, [state, scope, query]);
}
