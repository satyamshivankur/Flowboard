import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges Tailwind class strings, resolving conflicts in favour of the last
 * value. Every design-system primitive accepts a `className` that is merged
 * last, so callers can adjust layout without forking the component
 * (Requirement 11.3).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
