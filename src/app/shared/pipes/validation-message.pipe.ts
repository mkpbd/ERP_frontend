import { Pipe, PipeTransform } from '@angular/core';
import { ValidationErrors } from '@angular/forms';

/** Human-readable text for the first validation error of a control. */
export function validationMessage(errors: ValidationErrors | null | undefined, label = 'This field'): string {
  if (!errors) return '';
  if (typeof errors['server'] === 'string') return errors['server'];
  if (errors['required']) return `${label} is required.`;
  if (errors['email']) return 'Enter a valid email address.';
  if (errors['minlength'])
    return `${label} must be at least ${errors['minlength'].requiredLength} characters.`;
  if (errors['maxlength'])
    return `${label} must be at most ${errors['maxlength'].requiredLength} characters.`;
  if (errors['pattern']) return `${label} has an invalid format.`;
  if (errors['mismatch']) return 'The values do not match.';
  if (errors['matDatepickerParse']) return 'Enter a valid date.';
  return `${label} is invalid.`;
}

/**
 * `{{ form.controls.email.errors | validationMessage: 'Email' }}`. Pure: Angular creates a new errors
 * object whenever validation changes, so the pipe re-runs exactly when needed.
 */
@Pipe({ name: 'validationMessage' })
export class ValidationMessagePipe implements PipeTransform {
  transform(errors: ValidationErrors | null | undefined, label?: string): string {
    return validationMessage(errors, label);
  }
}
