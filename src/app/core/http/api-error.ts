import { HttpErrorResponse } from '@angular/common/http';

/** One validation issue from an RFC 9457 problem document, for example `{ path: 'body.email', ... }`. */
export interface FieldError {
  readonly path: string;
  readonly message: string;
}

/** RFC 9457 Problem Details, as returned by the backend for every error. */
export interface ProblemDetails {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly code?: string;
  readonly detail?: string;
  readonly instance?: string;
  readonly errors?: readonly FieldError[];
  readonly requestId?: string;
  readonly correlationId?: string;
}

/** Normalized error for every failed API call. Components never see raw HttpErrorResponse objects. */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: readonly FieldError[] = [],
    readonly requestId?: string,
  ) {
    super(message);
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

const NETWORK_MESSAGE = 'Cannot reach the server. Check your connection and try again.';
const SERVER_MESSAGE = 'Something went wrong on the server. Please try again later.';

function isProblemDetails(value: unknown): value is ProblemDetails {
  return (
    typeof value === 'object' && value !== null && ('code' in value || 'detail' in value || 'title' in value)
  );
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!(error instanceof HttpErrorResponse)) {
    return new ApiError(-1, 'client_error', error instanceof Error ? error.message : 'Unexpected error');
  }
  if (error.status === 0) return new ApiError(0, 'network_error', NETWORK_MESSAGE);

  const body: unknown = error.error;
  const problem = isProblemDetails(body) ? body : undefined;
  const code = problem?.code ?? `http_${error.status}`;
  // 5xx details are never meaningful to users (the backend hides them anyway); keep the request id for support.
  const message =
    error.status >= 500
      ? SERVER_MESSAGE
      : (problem?.detail ?? problem?.title ?? error.statusText ?? 'Request failed');
  return new ApiError(error.status, code, message, problem?.errors ?? [], problem?.requestId);
}
