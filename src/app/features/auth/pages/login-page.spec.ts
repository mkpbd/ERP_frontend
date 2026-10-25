import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import type { CurrentUser } from '../../../core/auth/auth.models';
import { ApiError } from '../../../core/http/api-error';
import { LoginPage, safeReturnUrl } from './login-page';

describe('safeReturnUrl', () => {
  it('accepts in-app paths', () => {
    expect(safeReturnUrl('/users?page=2')).toBe('/users?page=2');
  });

  it('rejects external, protocol-relative and missing targets', () => {
    expect(safeReturnUrl(undefined)).toBe('/dashboard');
    expect(safeReturnUrl('https://evil.example')).toBe('/dashboard');
    expect(safeReturnUrl('//evil.example')).toBe('/dashboard');
    expect(safeReturnUrl('/\\evil.example')).toBe('/dashboard');
    expect(safeReturnUrl('/login?returnUrl=/x')).toBe('/dashboard');
  });
});

describe('LoginPage', () => {
  function setup(login: AuthService['login']) {
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: { login } }],
    });
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LoginPage);
    return { fixture, router, element: fixture.nativeElement as HTMLElement };
  }

  function fill(element: HTMLElement, identifier: string, password: string) {
    const [id, pw] = Array.from(element.querySelectorAll('input'));
    id!.value = identifier;
    id!.dispatchEvent(new Event('input'));
    pw!.value = password;
    pw!.dispatchEvent(new Event('input'));
  }

  it('does not submit an empty form and shows validation errors', async () => {
    const login = vi.fn();
    const { fixture, element } = setup(login);
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('[data-testid="login-submit"]')!.click();
    await fixture.whenStable();
    expect(login).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Email or username is required.');
  });

  it('signs in and navigates to the return URL', async () => {
    const login = vi.fn(() => of({} as CurrentUser));
    const { fixture, element, router } = setup(login);
    fixture.componentRef.setInput('returnUrl', '/roles');
    await fixture.whenStable();
    fill(element, 'admin@example.com', 'secret');
    element.querySelector<HTMLButtonElement>('[data-testid="login-submit"]')!.click();
    expect(login).toHaveBeenCalledWith({ identifier: 'admin@example.com', password: 'secret' });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/roles');
  });

  it('prevents double submission while signing in', async () => {
    const pending = new Subject<CurrentUser>();
    const login = vi.fn(() => pending.asObservable());
    const { fixture, element } = setup(login);
    await fixture.whenStable();
    fill(element, 'admin', 'secret');
    const submit = element.querySelector<HTMLButtonElement>('[data-testid="login-submit"]')!;
    submit.click();
    await fixture.whenStable();
    submit.click();
    expect(login).toHaveBeenCalledTimes(1);
    expect(submit.disabled).toBe(true);
  });

  it('shows a generic message for invalid credentials and clears the password', async () => {
    const login = vi.fn(() =>
      throwError(() => new ApiError(401, 'invalid_credentials', 'Invalid credentials')),
    );
    const { fixture, element } = setup(login);
    await fixture.whenStable();
    fill(element, 'admin', 'wrong');
    element.querySelector<HTMLButtonElement>('[data-testid="login-submit"]')!.click();
    await fixture.whenStable();
    expect(element.querySelector('[data-testid="login-error"]')?.textContent).toContain(
      'Incorrect email/username or password.',
    );
    expect(element.querySelectorAll('input')[1]!.value).toBe('');
  });
});
