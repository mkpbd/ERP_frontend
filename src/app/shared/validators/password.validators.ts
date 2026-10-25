import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Mirrors the backend's transport bounds (12–128 code points). The backend's policy stays authoritative. */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordLength: ValidatorFn = (
  control: AbstractControl<string | null>,
): ValidationErrors | null => {
  const value = control.value ?? '';
  if (!value) return null;
  const length = [...value].length;
  if (length < PASSWORD_MIN_LENGTH)
    return { minlength: { requiredLength: PASSWORD_MIN_LENGTH, actualLength: length } };
  if (length > PASSWORD_MAX_LENGTH)
    return { maxlength: { requiredLength: PASSWORD_MAX_LENGTH, actualLength: length } };
  return null;
};

/**
 * Group validator: `confirmKey` must equal `sourceKey`. The error is set on the confirm control too, so
 * `mat-error` can show it next to the field.
 */
export function fieldsMatch(sourceKey: string, confirmKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const source = group.get(sourceKey);
    const confirm = group.get(confirmKey);
    if (!source || !confirm) return null;

    const mismatch = !!confirm.value && source.value !== confirm.value;
    const { mismatch: _previous, ...otherErrors } = confirm.errors ?? {};
    if (mismatch) confirm.setErrors({ ...otherErrors, mismatch: true });
    else confirm.setErrors(Object.keys(otherErrors).length ? otherErrors : null);
    return mismatch ? { mismatch: true } : null;
  };
}

/** Rejects passwords that contain the account's email local part (part of the backend policy). */
export function notContaining(sourceKey: string, passwordKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const source = String(group.get(sourceKey)?.value ?? '').toLowerCase();
    const password = String(group.get(passwordKey)?.value ?? '').toLowerCase();
    const localPart = source.split('@')[0] ?? '';
    return localPart.length >= 3 && password.includes(localPart) ? { containsIdentity: true } : null;
  };
}
