import { AbstractControl, FormGroup } from '@angular/forms';
import { ApiError } from '../../core/http/api-error';

/** Maps backend error codes (e.g. `email_taken`) to the form control they concern. */
export type ErrorCodeMap = Readonly<Record<string, string>>;

/**
 * Puts server-side validation errors on the matching form controls as `{ server: message }` so they render
 * in `mat-error`. Handles both Zod issues (`path: "body.email"`) and domain error codes via `codeMap`.
 * Returns the message for errors that belong to no field, or `null` when every error was placed.
 */
export function applyServerErrors(
  form: FormGroup,
  error: ApiError,
  codeMap: ErrorCodeMap = {},
): string | null {
  let placed = false;

  for (const issue of error.fieldErrors) {
    const control = controlForPath(form, issue.path);
    if (control) {
      setServerError(control, issue.message);
      placed = true;
    }
  }

  const mapped = codeMap[error.code];
  const control = mapped ? form.get(mapped) : null;
  if (control) {
    setServerError(control, error.message);
    placed = true;
  }

  return placed ? null : error.message;
}

function controlForPath(form: FormGroup, path: string): AbstractControl | null {
  const [location, ...rest] = path.split('.');
  return location === 'body' && rest.length ? form.get(rest.join('.')) : null;
}

function setServerError(control: AbstractControl, message: string): void {
  control.setErrors({ ...control.errors, server: message });
  control.markAsTouched();
}
