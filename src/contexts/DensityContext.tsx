import { useCallback, useMemo, useState, type ReactNode } from "react";

import { readPreference, writePreference } from "@/lib/uiStorage";

import { createSafeContext } from "./createSafeContext";

/**
 * UI density.
 *
 * Applied as `data-density` on the shell, which the `density-compact` Tailwind
 * variant reads — so one attribute retunes spacing app-wide rather than every
 * component subscribing to this context (Requirement 16.3).
 */

export type Density = "comfortable" | "compact";

export interface DensityContextValue {
  readonly density: Density;
  readonly setDensity: (density: Density) => void;
  readonly toggleDensity: () => void;
}

const STORAGE_KEY = "density";

const { Provider, useValue } = createSafeContext<DensityContextValue>("Density");

export const useDensity = useValue;

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<Density>(() =>
    readPreference<Density>(STORAGE_KEY, "comfortable"),
  );

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    writePreference(STORAGE_KEY, next);
  }, []);

  const toggleDensity = useCallback(() => {
    setDensityState((current) => {
      const next = current === "comfortable" ? "compact" : "comfortable";
      writePreference(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ density, setDensity, toggleDensity }),
    [density, setDensity, toggleDensity],
  );

  return <Provider value={value}>{children}</Provider>;
}
