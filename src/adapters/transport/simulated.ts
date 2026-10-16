import { err, ok, type Result } from '@/model/result'

import type { Transport } from './types'

/**
 * Simulated transport: latency plus injectable failures.
 *
 * There is no backend, but loading states, error toasts and optimistic rollback
 * are only worth building if something can actually be slow or fail. This shim
 * provides both, so those paths are real rather than theoretical
 * (Requirement 9.6, 9.7).
 */

export interface SimulationSettings {
  readonly minLatencyMs: number
  readonly maxLatencyMs: number
  /**
   * Probability in [0, 1] that an operation fails. Defaults to 0 — normal use
   * is never randomly broken (Requirement 9.9). The dev panel raises it when a
   * failure path needs demonstrating.
   */
  readonly failureRate: number
  /** One-shot trigger from the dev panel's "fail next operation" control. */
  readonly failNext: boolean
}

export const DEFAULT_SIMULATION: SimulationSettings = {
  minLatencyMs: 120,
  maxLatencyMs: 380,
  failureRate: 0,
  failNext: false,
}

/** Zero latency and no failures, so the test suite is fast and deterministic. */
export const TEST_SIMULATION: SimulationSettings = {
  minLatencyMs: 0,
  maxLatencyMs: 0,
  failureRate: 0,
  failNext: false,
}

/*
 * Settings live in a module-level cell rather than in React state because the
 * transport is not a React module. SimulationContext writes here; the transport
 * reads. That keeps the dev panel declarative without making the adapter
 * depend on React.
 */
let settings: SimulationSettings = DEFAULT_SIMULATION

export function getSimulationSettings(): SimulationSettings {
  return settings
}

export function setSimulationSettings(next: Partial<SimulationSettings>): void {
  settings = { ...settings, ...next }
}

export function resetSimulationSettings(): void {
  settings = DEFAULT_SIMULATION
}

/** Arms the one-shot failure used by the dev panel. */
export function failNextOperation(): void {
  settings = { ...settings, failNext: true }
}

function jitter(min: number, max: number): number {
  if (max <= min) return min
  return min + Math.random() * (max - min)
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function shouldFail(current: SimulationSettings): boolean {
  if (current.failNext) return true
  if (current.failureRate <= 0) return false
  return Math.random() < current.failureRate
}

/**
 * The simulated Transport implementation.
 *
 * Note the ordering: latency resolves first, then the failure check, then the
 * operation runs. A failed operation therefore never touches the Model, which
 * is what lets the pipeline treat NETWORK failures the same way it treats a
 * rejected validation.
 */
export const simulatedTransport: Transport = {
  async run<T>(operation: () => T): Promise<Result<T>> {
    const current = settings

    await delay(jitter(current.minLatencyMs, current.maxLatencyMs))

    if (shouldFail(current)) {
      // Consume the one-shot trigger whether or not it was what fired.
      if (current.failNext) {
        settings = { ...settings, failNext: false }
      }

      return err<T>('NETWORK', 'Network request failed. Please try again.', {
        retryable: true,
      })
    }

    return ok(operation())
  },
}

/** An immediate, never-failing transport, for tests that assert pure logic. */
export const immediateTransport: Transport = {
  run<T>(operation: () => T): Promise<Result<T>> {
    return Promise.resolve(ok(operation()))
  },
}
