import { FormControl, FormGroup } from '@angular/forms';
import { fieldsMatch, notContaining, passwordLength } from './password.validators';

describe('password validators', () => {
  it('passwordLength counts code points and ignores empty values', () => {
    expect(passwordLength(new FormControl(''))).toBeNull();
    expect(passwordLength(new FormControl('short'))).toEqual({
      minlength: { requiredLength: 12, actualLength: 5 },
    });
    expect(passwordLength(new FormControl('a'.repeat(12)))).toBeNull();
    // 12 emoji are 24 UTF-16 units but 12 code points.
    expect(passwordLength(new FormControl('😀'.repeat(11)))?.['minlength']).toBeTruthy();
    expect(passwordLength(new FormControl('a'.repeat(129)))?.['maxlength']).toBeTruthy();
  });

  it('fieldsMatch flags a mismatch on the group and the confirm control', () => {
    const form = new FormGroup(
      { password: new FormControl('abc'), confirm: new FormControl('abd') },
      { validators: fieldsMatch('password', 'confirm') },
    );
    expect(form.hasError('mismatch')).toBe(true);
    expect(form.controls.confirm.hasError('mismatch')).toBe(true);

    form.controls.confirm.setValue('abc');
    expect(form.hasError('mismatch')).toBe(false);
    expect(form.controls.confirm.errors).toBeNull();
  });

  it('notContaining rejects passwords containing the email local part', () => {
    const form = new FormGroup(
      { email: new FormControl('jane.doe@example.com'), password: new FormControl('my-jane.doe-secret') },
      { validators: notContaining('email', 'password') },
    );
    expect(form.hasError('containsIdentity')).toBe(true);
    form.controls.password.setValue('correct horse battery');
    expect(form.hasError('containsIdentity')).toBe(false);
  });
});
