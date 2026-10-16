import type { Result } from '@/model/result'

/**
 * The transport seam.
 *
 * Controller actions call `transport.run(...)` and contain no latency, retry or
 * failure-rate logic of their own. Replacing the simulated implementation with
 * a real HTTP client is therefore a one-line change at store construction
 * rather than a diff across every slice (Requirement 21.11).
 *
 * `run` is async even where an implementation would not need to be, because a
 * synchronous signature cannot later become asynchronous without changing every
 * caller.
 */
export interface Transport {
  /**
   * Runs an operation through the transport. The operation itself is a plain
   * function; the transport decides only whether and when it resolves.
   */
  run<T>(operation: () => T): Promise<Result<T>>
}
