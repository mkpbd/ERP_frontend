import { FormControl, FormGroup } from '@angular/forms';
import { ApiError } from '../../core/http/api-error';
import { applyServerErrors } from './form-errors';

describe('applyServerErrors', () => {
  const createForm = () => new FormGroup({ email: new FormControl(''), password: new FormControl('') });

  it('places Zod field issues on the matching control', () => {
    const form = createForm();
    const error = new ApiError(400, 'validation_failed', 'Request validation failed', [
      { path: 'body.email', message: 'Invalid email' },
    ]);
    expect(applyServerErrors(form, error)).toBeNull();
    expect(form.controls.email.getError('server')).toBe('Invalid email');
    expect(form.controls.email.touched).toBe(true);
  });

  it('places domain errors via the code map', () => {
    const form = createForm();
    expect(
      applyServerErrors(form, new ApiError(409, 'email_taken', 'Taken'), { email_taken: 'email' }),
    ).toBeNull();
    expect(form.controls.email.getError('server')).toBe('Taken');
  });

  it('returns the message when nothing could be placed', () => {
    const form = createForm();
    expect(applyServerErrors(form, new ApiError(403, 'forbidden', 'Nope'))).toBe('Nope');
  });

  it('clears the server error once the user edits the field', () => {
    const form = createForm();
    applyServerErrors(form, new ApiError(409, 'email_taken', 'Taken'), { email_taken: 'email' });
    form.controls.email.setValue('other@example.com');
    expect(form.controls.email.errors).toBeNull();
  });
});
