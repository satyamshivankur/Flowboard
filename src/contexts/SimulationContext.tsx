import { useCallback, useMemo, useState, type ReactNode } from "react";

import {
  DEFAULT_SIMULATION,
  failNextOperation,
  getSimulationSettings,
  setSimulationSettings,
  type SimulationSettings,
} from "@/adapters/transport/simulated";

import { createSafeContext } from "./createSafeContext";

/**
 * The dev panel's settings.
 *
 * The transport is not a React module, so this context writes through to the
 * adapter's module-level settings rather than the adapter subscribing to React
 * state. That keeps the panel declarative without making the adapter depend on
 * React (Requirement 9.8).
 */

export interface SimulationContextValue {
  readonly settings: SimulationSettings;
  readonly setLatency: (minMs: number, maxMs: number) => void;
  readonly setFailureRate: (rate: number) => void;
  readonly failNext: () => void;
  readonly reset: () => void;
}

const { Provider, useValue } =
  createSafeContext<SimulationContextValue>("Simulation");

export const useSimulation = useValue;

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SimulationSettings>(() =>
    getSimulationSettings(),
  );

  /** Writes to the adapter and mirrors into React state for the panel's UI. */
  const apply = useCallback((patch: Partial<SimulationSettings>) => {
    setSimulationSettings(patch);
    setSettings(getSimulationSettings());
  }, []);

  const setLatency = useCallback(
    (minMs: number, maxMs: number) => {
      // Clamp rather than reject: a slider that can produce min > max should
      // not be able to put the transport into an impossible state.
      const min = Math.max(0, Math.min(minMs, maxMs));
      const max = Math.max(min, maxMs);

      apply({ minLatencyMs: min, maxLatencyMs: max });
    },
    [apply],
  );

  const setFailureRate = useCallback(
    (rate: number) => {
      apply({ failureRate: Math.min(1, Math.max(0, rate)) });
    },
    [apply],
  );

  const failNext = useCallback(() => {
    failNextOperation();
    setSettings(getSimulationSettings());
  }, []);

  const reset = useCallback(() => {
    apply(DEFAULT_SIMULATION);
  }, [apply]);

  const value = useMemo(
    () => ({ settings, setLatency, setFailureRate, failNext, reset }),
    [settings, setLatency, setFailureRate, failNext, reset],
  );

  return <Provider value={value}>{children}</Provider>;
}
