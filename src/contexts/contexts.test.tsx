import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetSimulationSettings } from "@/adapters/transport/simulated";

import { AppProviders } from "./AppProviders";
import { ConfirmProvider, useConfirm } from "./ConfirmContext";
import { DensityProvider, useDensity } from "./DensityContext";
import { NavigationProvider, useNavigation } from "./NavigationContext";
import { SidebarProvider, useSidebar } from "./SidebarContext";
import { SimulationProvider, useSimulation } from "./SimulationContext";
import { ToastProvider, useToast } from "./ToastContext";

afterEach(() => {
  resetSimulationSettings();
  window.localStorage.clear();
});

/** Replaces matchMedia so a test can choose the viewport. */
function stubViewport(isDesktop: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const query = {
    matches: isDesktop,
    media: "",
    onchange: null,
    addEventListener: (
      _: string,
      listener: (e: MediaQueryListEvent) => void,
    ) => {
      listeners.add(listener);
    },
    removeEventListener: (
      _: string,
      listener: (e: MediaQueryListEvent) => void,
    ) => {
      listeners.delete(listener);
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: () => query as unknown as MediaQueryList,
  });

  return {
    /** Simulates crossing the breakpoint. */
    resize(nextIsDesktop: boolean) {
      query.matches = nextIsDesktop;
      for (const listener of listeners) {
        listener({ matches: nextIsDesktop } as MediaQueryListEvent);
      }
    },
  };
}

describe("the shared context contract", () => {
  /*
   * Every consumer hook must fail loudly outside its provider. The alternative
   * — returning undefined — surfaces three frames later as "cannot read
   * property of undefined", pointing at the wrong file (Requirement 12.3).
   */
  it("throws a useful error when each hook is used outside its provider", () => {
    const cases: [string, () => unknown][] = [
      ["Toast", useToast],
      ["Density", useDensity],
      ["Navigation", useNavigation],
      ["Confirm", useConfirm],
      ["Simulation", useSimulation],
      ["Sidebar", useSidebar],
    ];

    for (const [name, hook] of cases) {
      expect(() => renderHook(() => hook())).toThrow(
        new RegExp(`use${name} must be used inside <${name}Provider>`),
      );
    }
  });

  it("exposes every context through AppProviders", () => {
    const { result } = renderHook(
      () => ({
        toast: useToast(),
        density: useDensity(),
        navigation: useNavigation(),
        confirm: useConfirm(),
        simulation: useSimulation(),
        sidebar: useSidebar(),
      }),
      { wrapper: AppProviders },
    );

    expect(result.current.toast.toasts).toEqual([]);
    expect(result.current.density.density).toBe("comfortable");
    expect(result.current.navigation.view).toBe("board");
    expect(result.current.confirm.pending).toBeNull();
    expect(result.current.sidebar.expandedIds.size).toBe(0);
  });

  /*
   * An unmemoized provider value re-renders every consumer on every parent
   * render, which is the failure mode Context is most often blamed for
   * (Requirement 12.4).
   */
  it("keeps the value identity stable across unrelated re-renders", () => {
    const { result, rerender } = renderHook(() => useDensity(), {
      wrapper: DensityProvider,
    });

    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });
});

describe("ToastContext", () => {
  it("pushes and dismisses", () => {
    const { result } = renderHook(() => useToast(), { wrapper: ToastProvider });

    let id = "";

    act(() => {
      id = result.current.push({ tone: "info", title: "Hello" });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.title).toBe("Hello");

    act(() => {
      result.current.dismiss(id);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("stacks multiple toasts in order", () => {
    const { result } = renderHook(() => useToast(), { wrapper: ToastProvider });

    act(() => {
      result.current.push({ tone: "info", title: "First" });
      result.current.push({ tone: "error", title: "Second" });
    });

    expect(result.current.toasts.map((toast) => toast.title)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("auto-dismisses after its duration", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useToast(), { wrapper: ToastProvider });

    act(() => {
      result.current.push({ tone: "info", title: "Transient", duration: 1000 });
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.toasts).toHaveLength(0);

    vi.useRealTimers();
  });

  it("keeps a toast with a null duration until dismissed", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useToast(), { wrapper: ToastProvider });

    act(() => {
      result.current.push({ tone: "error", title: "Sticky", duration: null });
    });

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.toasts).toHaveLength(1);

    vi.useRealTimers();
  });

  /*
   * Permission denials and network failures must read differently: one is a
   * dead end, the other is worth retrying (Requirement 14.5).
   */
  it("words permission denials differently from network failures", () => {
    const { result } = renderHook(() => useToast(), { wrapper: ToastProvider });

    act(() => {
      result.current.pushError({
        code: "FORBIDDEN",
        message: "You don't have permission to archive lists.",
      });
      result.current.pushError({
        code: "NETWORK",
        message: "Network request failed.",
        retryable: true,
      });
    });

    const [forbidden, network] = result.current.toasts;

    expect(forbidden?.title).toBe("Not allowed");
    expect(forbidden?.tone).toBe("warning");
    expect(network?.title).toBe("Connection problem");
    expect(network?.tone).toBe("error");
  });

  it("offers retry only for a retryable error with a retry handler", () => {
    const { result } = renderHook(() => useToast(), { wrapper: ToastProvider });

    act(() => {
      result.current.pushError(
        { code: "NETWORK", message: "Failed.", retryable: true },
        { retry: () => undefined },
      );
      result.current.pushError(
        { code: "FORBIDDEN", message: "Nope." },
        { retry: () => undefined },
      );
    });

    expect(result.current.toasts[0]?.action?.label).toBe("Try again");
    expect(result.current.toasts[1]?.action).toBeUndefined();
  });

  it("announces toasts in a polite live region", () => {
    function Pusher() {
      const toast = useToast();

      return (
        <button
          type="button"
          onClick={() => {
            toast.push({ tone: "info", title: "Announced" });
          }}
        >
          push
        </button>
      );
    }

    render(
      <ToastProvider>
        <Pusher />
      </ToastProvider>,
    );

    const region = screen.getByRole("status");

    expect(region).toHaveAttribute("aria-live", "polite");
  });
});

describe("ConfirmContext", () => {
  it("resolves true when confirmed and false when cancelled", async () => {
    const { result } = renderHook(() => useConfirm(), {
      wrapper: ConfirmProvider,
    });

    let confirmed: Promise<boolean> | undefined;

    act(() => {
      confirmed = result.current.confirm({ title: "Archive Sprint 14?" });
    });

    expect(result.current.pending?.title).toBe("Archive Sprint 14?");

    act(() => {
      result.current.resolvePending(true);
    });

    await expect(confirmed).resolves.toBe(true);
    expect(result.current.pending).toBeNull();

    let cancelled: Promise<boolean> | undefined;

    act(() => {
      cancelled = result.current.confirm({ title: "Delete task?" });
    });

    act(() => {
      result.current.resolvePending(false);
    });

    await expect(cancelled).resolves.toBe(false);
  });

  /*
   * Two stacked confirmations would leave the user approving something whose
   * context is hidden behind another dialog.
   */
  it("cancels an open request when a second one arrives", async () => {
    const { result } = renderHook(() => useConfirm(), {
      wrapper: ConfirmProvider,
    });

    let first: Promise<boolean> | undefined;

    act(() => {
      first = result.current.confirm({ title: "First" });
    });

    act(() => {
      void result.current.confirm({ title: "Second" });
    });

    await expect(first).resolves.toBe(false);
    expect(result.current.pending?.title).toBe("Second");
  });
});

describe("DensityContext", () => {
  it("toggles and persists the choice", () => {
    const { result, unmount } = renderHook(() => useDensity(), {
      wrapper: DensityProvider,
    });

    act(() => {
      result.current.toggleDensity();
    });

    expect(result.current.density).toBe("compact");

    unmount();

    const remounted = renderHook(() => useDensity(), {
      wrapper: DensityProvider,
    });

    expect(remounted.result.current.density).toBe("compact");
  });
});

describe("NavigationContext", () => {
  it("holds ids, not entities", () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: NavigationProvider,
    });

    act(() => {
      result.current.selectList("li-backlog");
      result.current.openTask("t-001");
    });

    expect(result.current.selectedListId).toBe("li-backlog");
    expect(result.current.openTaskId).toBe("t-001");
  });

  /*
   * A drawer left open across a list change would be showing a task from the
   * list the user just navigated away from.
   */
  it("closes the open task when the list changes", () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: NavigationProvider,
    });

    act(() => {
      result.current.selectList("li-backlog");
      result.current.openTask("t-001");
    });

    act(() => {
      result.current.selectList("li-sprint14");
    });

    expect(result.current.openTaskId).toBeNull();
  });

  it("persists the active view", () => {
    const { result, unmount } = renderHook(() => useNavigation(), {
      wrapper: NavigationProvider,
    });

    act(() => {
      result.current.setView("list");
    });

    unmount();

    const remounted = renderHook(() => useNavigation(), {
      wrapper: NavigationProvider,
    });

    expect(remounted.result.current.view).toBe("list");
  });
});

describe("SimulationContext", () => {
  it("clamps the failure rate to 0..1", () => {
    const { result } = renderHook(() => useSimulation(), {
      wrapper: SimulationProvider,
    });

    act(() => {
      result.current.setFailureRate(5);
    });

    expect(result.current.settings.failureRate).toBe(1);

    act(() => {
      result.current.setFailureRate(-1);
    });

    expect(result.current.settings.failureRate).toBe(0);
  });

  /*
   * A two-handled slider can produce min > max. Clamping rather than rejecting
   * keeps the transport out of an impossible state.
   */
  it("clamps latency so min never exceeds max", () => {
    const { result } = renderHook(() => useSimulation(), {
      wrapper: SimulationProvider,
    });

    act(() => {
      result.current.setLatency(900, 100);
    });

    expect(result.current.settings.minLatencyMs).toBeLessThanOrEqual(
      result.current.settings.maxLatencyMs,
    );
  });

  it("arms the one-shot failure trigger", () => {
    const { result } = renderHook(() => useSimulation(), {
      wrapper: SimulationProvider,
    });

    act(() => {
      result.current.failNext();
    });

    expect(result.current.settings.failNext).toBe(true);
  });
});

describe("SidebarContext", () => {
  it("toggles expansion without disturbing other nodes", () => {
    const { result } = renderHook(() => useSidebar(), {
      wrapper: SidebarProvider,
    });

    act(() => {
      result.current.toggleExpanded("sp-eng");
      result.current.toggleExpanded("fo-q2");
    });

    expect([...result.current.expandedIds].sort()).toEqual(["fo-q2", "sp-eng"]);

    act(() => {
      result.current.toggleExpanded("sp-eng");
    });

    expect([...result.current.expandedIds]).toEqual(["fo-q2"]);
  });

  it("expands a path additively", () => {
    const { result } = renderHook(() => useSidebar(), {
      wrapper: SidebarProvider,
    });

    act(() => {
      result.current.toggleExpanded("existing");
      result.current.expand(["a", "b"]);
    });

    expect([...result.current.expandedIds].sort()).toEqual([
      "a",
      "b",
      "existing",
    ]);
  });

  it("is not modal at desktop width", () => {
    stubViewport(true);

    const { result } = renderHook(() => useSidebar(), {
      wrapper: SidebarProvider,
    });

    expect(result.current.isModal).toBe(false);
    expect(result.current.isSheetOpen).toBe(false);
  });

  it("is modal below the lg breakpoint", () => {
    stubViewport(false);

    const { result } = renderHook(() => useSidebar(), {
      wrapper: SidebarProvider,
    });

    expect(result.current.isModal).toBe(true);

    act(() => {
      result.current.openSheet();
    });

    expect(result.current.isSheetOpen).toBe(true);
  });

  /*
   * The bug this whole context exists to prevent: a sheet opened on a phone
   * surviving a resize to desktop as an invisible focus trap over the layout
   * (Requirement 20.7.1).
   */
  it("closes the sheet when the viewport grows past the breakpoint", () => {
    const viewport = stubViewport(false);

    const { result } = renderHook(() => useSidebar(), {
      wrapper: SidebarProvider,
    });

    act(() => {
      result.current.openSheet();
    });

    expect(result.current.isSheetOpen).toBe(true);

    act(() => {
      viewport.resize(true);
    });

    expect(result.current.isModal).toBe(false);
    expect(result.current.isSheetOpen).toBe(false);
  });

  it("reports the sheet closed whenever the sidebar is static", () => {
    const viewport = stubViewport(false);

    const { result } = renderHook(() => useSidebar(), {
      wrapper: SidebarProvider,
    });

    act(() => {
      result.current.openSheet();
      viewport.resize(true);
    });

    expect(result.current.isSheetOpen).toBe(false);
  });
});

describe("density toggle through the UI", () => {
  it("responds to a real click", async () => {
    const user = userEvent.setup();

    function Toggle() {
      const { density, toggleDensity } = useDensity();

      return (
        <button type="button" onClick={toggleDensity}>
          {density}
        </button>
      );
    }

    render(
      <DensityProvider>
        <Toggle />
      </DensityProvider>,
    );

    expect(screen.getByRole("button")).toHaveTextContent("comfortable");

    await user.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveTextContent("compact");
  });
});
