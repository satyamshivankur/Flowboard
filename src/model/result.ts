/**
 * The single result shape every Controller action returns.
 *
 * One shape for every mutation means error surfacing lives in one place — the
 * view-model hooks push failures into ToastContext — instead of each component
 * inventing its own handling (Requirement 9.5).
 */

export type ErrorCode =
  /** Input failed a field, parent-type or depth rule. */
  | 'VALIDATION'
  /** The current user may not see or mutate the resource. Treated as 403. */
  | 'FORBIDDEN'
  /** The referenced entity does not exist, or is archived. */
  | 'NOT_FOUND'
  /** The mutation conflicts with current state. */
  | 'CONFLICT'
  /** The simulated transport failed. Retryable. */
  | 'NETWORK'

export interface AppError {
  readonly code: ErrorCode
  readonly message: string
  /**
   * The input field responsible, when one is. Lets the task drawer attach a
   * validation message to the exact control that caused it (Requirement 2.4).
   */
  readonly field?: string
  /** True when retrying the same operation is safe and likely to succeed. */
  readonly retryable?: boolean
}

export type Result<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: AppError }

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function err<T = never>(
  code: ErrorCode,
  message: string,
  options: { field?: string; retryable?: boolean } = {},
): Result<T> {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(options.field === undefined ? {} : { field: options.field }),
      ...(options.retryable === undefined
        ? {}
        : { retryable: options.retryable }),
    },
  }
}

/** Narrowing helper, so call sites read as `if (isErr(result))`. */
export function isErr<T>(
  result: Result<T>,
): result is { ok: false; error: AppError } {
  return !result.ok
}

/** Unwraps a result in tests and in code paths that have already checked it. */
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected ok result, got ${result.error.code}: ${result.error.message}`)
  }

  return result.data
}
