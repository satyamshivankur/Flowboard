import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  BREAKPOINT_REM,
  minWidthQuery,
  SIDEBAR_STATIC_BREAKPOINT,
} from "@/config/breakpoints";
import { readPreference, writePreference } from "@/lib/uiStorage";

import { createSafeContext } from "./createSafeContext";

/**
 * Sidebar chrome: collapsed state, width, which nodes are expanded, and whether
 * the sidebar is currently a modal sheet.
 *
 * `isModal` is the **only** breakpoint this app observes from JavaScript.
 * Everything else responsive is a Tailwind variant. It exists because the two
 * sidebar forms differ in *behaviour*, not appearance: below `lg` it is a
 * focus-trapping, scroll-locking dialog, and at `lg` it is a static region. A
 * media query cannot express "stop trapping focus", and a sheet left open while
 * the viewport widens would become an invisible focus trap
 * (Requirement 20.7.1, 12.7).
 */

const MIN_WIDTH_REM = 12;
const MAX_WIDTH_REM = 24;
const DEFAULT_WIDTH_REM = 16;

export interface SidebarContextValue {
  /** Icon-rail mode, at `lg` and above only. */
  readonly collapsed: boolean;
  readonly toggleCollapsed: () => void;
  /** Expanded width in rem, clamped to the token range. */
  readonly widthRem: number;
  readonly setWidthRem: (rem: number) => void;
  readonly expandedIds: ReadonlySet<string>;
  readonly toggleExpanded: (id: string) => void;
  readonly expand: (ids: readonly string[]) => void;
  /** True below `lg`: the sidebar is a dialog, not part of the layout. */
  readonly isModal: boolean;
  /** Whether the mobile sheet is open. Always false when not modal. */
  readonly isSheetOpen: boolean;
  readonly openSheet: () => void;
  readonly closeSheet: () => void;
}

const COLLAPSED_KEY = "sidebarCollapsed";
const WIDTH_KEY = "sidebarWidth";

const { Provider, useValue } = createSafeContext<SidebarContextValue>("Sidebar");

export const useSidebar = useValue;

/** Reads the `lg` media query, defaulting to desktop where unavailable. */
function matchesStatic(): boolean {
  if (typeof window === "undefined" || !("matchMedia" in window)) return true;

  return window.matchMedia(minWidthQuery(SIDEBAR_STATIC_BREAKPOINT)).matches;
}

export function SidebarProvider({
  children,
  initialExpandedIds = [],
}: {
  children: ReactNode;
  initialExpandedIds?: readonly string[];
}) {
  const [collapsed, setCollapsed] = useState(() =>
    readPreference(COLLAPSED_KEY, false),
  );
  const [widthRem, setWidthState] = useState(() =>
    readPreference(WIDTH_KEY, DEFAULT_WIDTH_REM),
  );
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(initialExpandedIds),
  );
  const [isStatic, setIsStatic] = useState(matchesStatic);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  /*
   * The single matchMedia subscription. Crossing into the static breakpoint
   * closes the sheet, which is the whole reason this lives in JavaScript —
   * otherwise a sheet opened at phone width survives a resize as an invisible
   * focus trap over the desktop layout.
   */
  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return;

    const query = window.matchMedia(minWidthQuery(SIDEBAR_STATIC_BREAKPOINT));

    const onChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsStatic(event.matches);

      if (event.matches) setIsSheetOpen(false);
    };

    onChange(query);
    query.addEventListener("change", onChange);

    return () => {
      query.removeEventListener("change", onChange);
    };
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      writePreference(COLLAPSED_KEY, !current);
      return !current;
    });
  }, []);

  const setWidthRem = useCallback((rem: number) => {
    const clamped = Math.min(MAX_WIDTH_REM, Math.max(MIN_WIDTH_REM, rem));

    setWidthState(clamped);
    writePreference(WIDTH_KEY, clamped);
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }, []);

  /** Expands a path without collapsing anything already open. */
  const expand = useCallback((ids: readonly string[]) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const openSheet = useCallback(() => {
    setIsSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setIsSheetOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      collapsed,
      toggleCollapsed,
      widthRem,
      setWidthRem,
      expandedIds,
      toggleExpanded,
      expand,
      isModal: !isStatic,
      // Guard rather than trust: a stale `true` here would render a modal over
      // the desktop layout.
      isSheetOpen: !isStatic && isSheetOpen,
      openSheet,
      closeSheet,
    }),
    [
      collapsed,
      toggleCollapsed,
      widthRem,
      setWidthRem,
      expandedIds,
      toggleExpanded,
      expand,
      isStatic,
      isSheetOpen,
      openSheet,
      closeSheet,
    ],
  );

  return <Provider value={value}>{children}</Provider>;
}

/** Exported for the resizer, so it clamps to the same range as the context. */
export const SIDEBAR_WIDTH_RANGE_REM = {
  min: MIN_WIDTH_REM,
  max: MAX_WIDTH_REM,
  default: DEFAULT_WIDTH_REM,
  /** The breakpoint at which the sidebar stops being modal, in rem. */
  staticAt: BREAKPOINT_REM[SIDEBAR_STATIC_BREAKPOINT],
} as const;
