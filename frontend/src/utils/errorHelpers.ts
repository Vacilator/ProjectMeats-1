/**
 * Shared error-handling utilities for type-safe catch blocks.
 *
 * Usage:
 *   } catch (error: unknown) {
 *     const info = getAxiosErrorInfo(error);
 *     if (info.status === 404) { ... }
 *     message.error(info.message);
 *   }
 */

interface AxiosErrorInfo {
  /** HTTP status code (0 if not an HTTP error) */
  status: number;
  /** Human-readable error message */
  message: string;
  /** Raw response data (if available) */
  data: unknown;
}

/**
 * Safely extract HTTP error information from an unknown catch value.
 * Works with Axios errors, native Errors, and arbitrary values.
 */
export function getAxiosErrorInfo(error: unknown, fallbackMessage = 'An unexpected error occurred'): AxiosErrorInfo {
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;

    // Axios-style error: error.response.status / error.response.data
    if (err.response && typeof err.response === 'object') {
      const resp = err.response as Record<string, unknown>;
      const status = typeof resp.status === 'number' ? resp.status : 0;
      const data = resp.data;
      let message = fallbackMessage;

      if (data && typeof data === 'object') {
        const d = data as Record<string, unknown>;
        if (typeof d.error === 'string') message = d.error;
        else if (typeof d.detail === 'string') message = d.detail;
        else if (typeof d.message === 'string') message = d.message;
      } else if (typeof data === 'string') {
        message = data;
      }

      return { status, message, data };
    }

    // Standard Error with message
    if (typeof err.message === 'string') {
      return { status: 0, message: err.message, data: null };
    }
  }

  if (typeof error === 'string') {
    return { status: 0, message: error, data: null };
  }

  return { status: 0, message: fallbackMessage, data: null };
}

/**
 * Extract a simple error message string from an unknown catch value.
 * Shorthand for `getAxiosErrorInfo(error, fallback).message`.
 */
export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  return getAxiosErrorInfo(error, fallback).message;
}
