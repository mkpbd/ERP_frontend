import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, toApiError } from './api-error';

describe('toApiError', () => {
  it('maps an RFC 9457 problem document', () => {
    const error = toApiError(
      new HttpErrorResponse({
        status: 409,
        error: {
          status: 409,
          code: 'email_taken',
          detail: 'A user with this email already exists',
          errors: [{ path: 'body.email', message: 'taken' }],
          requestId: 'req-1',
        },
      }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.code).toBe('email_taken');
    expect(error.message).toBe('A user with this email already exists');
    expect(error.fieldErrors).toEqual([{ path: 'body.email', message: 'taken' }]);
    expect(error.requestId).toBe('req-1');
  });

  it('treats status 0 as a network error', () => {
    const error = toApiError(new HttpErrorResponse({ status: 0 }));
    expect(error.isNetworkError).toBe(true);
    expect(error.code).toBe('network_error');
  });

  it('hides server error details but keeps the request id', () => {
    const error = toApiError(
      new HttpErrorResponse({
        status: 500,
        error: { code: 'internal', detail: 'stack trace', requestId: 'r-9' },
      }),
    );
    expect(error.isServerError).toBe(true);
    expect(error.message).not.toContain('stack trace');
    expect(error.requestId).toBe('r-9');
  });

  it('falls back to an http_<status> code for non-problem bodies', () => {
    expect(toApiError(new HttpErrorResponse({ status: 404, error: 'Not Found' })).code).toBe('http_404');
  });

  it('returns ApiError instances unchanged', () => {
    const original = new ApiError(400, 'x', 'y');
    expect(toApiError(original)).toBe(original);
  });
});
