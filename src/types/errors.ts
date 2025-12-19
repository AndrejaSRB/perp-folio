/**
 * Custom error classes for API errors
 */

/**
 * Lighter API error with code and message from the response
 */
export class LighterApiError extends Error {
  /** Marker to identify LighterApiError (for duck-typing when instanceof fails) */
  readonly __isLighterApiError = true;
  /** HTTP status code */
  readonly status: number;
  /** Lighter-specific error code */
  readonly code: number;
  /** Whether this is an authentication error */
  readonly isAuthError: boolean;

  constructor(status: number, code: number, message: string) {
    super(message);
    this.name = 'LighterApiError';
    this.status = status;
    this.code = code;
    // Auth errors: 401 status or code 20013 (invalid auth)
    this.isAuthError = status === 401 || code === 20013;
  }
}

/**
 * Check if an error is a LighterApiError
 * Uses duck-typing to handle cases where instanceof fails (multiple module instances)
 */
export const isLighterApiError = (error: unknown): error is LighterApiError => {
  if (error instanceof LighterApiError) return true;
  // Duck-typing fallback for when instanceof fails due to multiple module instances
  if (
    error !== null &&
    typeof error === 'object' &&
    '__isLighterApiError' in error &&
    (error as { __isLighterApiError: unknown }).__isLighterApiError === true
  ) {
    return true;
  }
  return false;
};
