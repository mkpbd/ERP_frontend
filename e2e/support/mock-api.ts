import type { Page, Route } from '@playwright/test';

/**
 * In-memory stand-in for the backend's /api/v1 surface, shaped exactly like the real responses
 * (see the backend OpenAPI document). Each test gets its own instance, so tests are isolated.
 */

export interface MockUser {
  id: string;
  email: string;
  username: string | null;
  displayName: string;
  status: 'active' | 'deactivated';
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  password: string;
  roleIds: string[];
}

export interface MockRole {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

const NOW = '2026-10-01T09:00:00.000Z';
const CATALOG = [
  ['users:read', 'View user accounts'],
  ['users:create', 'Create user accounts'],
  ['users:update', "Edit other users' profiles"],
  ['users:deactivate', 'Deactivate and reactivate user accounts'],
  ['sessions:revoke', "Revoke other users' sessions"],
  ['roles:read', 'View roles and their permissions'],
  ['roles:create', 'Create roles'],
  ['roles:update', 'Rename and describe roles'],
  ['roles:delete', 'Delete roles'],
  ['permissions:read', 'View permissions and user assignments'],
  ['permissions:assign', 'Assign roles to users and permissions to roles'],
  ['audit:read', 'Read the audit log'],
].map(([key, description]) => ({ key: key!, description: description! }));

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const PASSWORDS = { admin: 'Dev-Root-Passw0rd!', user: 'DevUser-Passw0rd!' };

function problem(status: number, code: string, detail: string, errors?: { path: string; message: string }[]) {
  return {
    type: `urn:problem-type:${code}`,
    title: 'Error',
    status,
    code,
    detail,
    errors,
    requestId: 'req-e2e',
  };
}

export class MockApi {
  readonly roles: MockRole[] = [
    {
      id: uuid(101),
      name: 'super-admin',
      description: 'Everything',
      isSystem: true,
      permissions: CATALOG.map((p) => p.key),
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: uuid(102),
      name: 'auditor',
      description: 'Read-only oversight',
      isSystem: false,
      permissions: ['users:read', 'audit:read'],
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: uuid(103),
      name: 'user-manager',
      description: 'Manages accounts',
      isSystem: false,
      permissions: ['users:read', 'users:create', 'users:update', 'users:deactivate'],
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];

  readonly users: MockUser[] = [
    this.user(1, 'admin@example.com', 'Ada Admin', PASSWORDS.admin, [uuid(101)]),
    this.user(2, 'auditor@example.com', 'Audrey Auditor', PASSWORDS.user, [uuid(102)]),
    this.user(3, 'manager@example.com', 'Manny Manager', PASSWORDS.user, [uuid(103)]),
    this.user(4, 'member@example.com', 'Mel Member', PASSWORDS.user, []),
  ];

  private currentUserId: string | null = null;
  private tokenCounter = 0;
  private validTokens = new Set<string>();
  /** When set, every authenticated call answers with this status (e.g. 500) until cleared. */
  failWith: number | null = null;
  /** When true, access tokens are rejected and refresh fails: the session has ended server-side. */
  sessionRevoked = false;
  readonly calls: string[] = [];

  private user(n: number, email: string, displayName: string, password: string, roleIds: string[]): MockUser {
    return {
      id: uuid(n),
      email,
      username: null,
      displayName,
      status: 'active',
      emailVerified: true,
      lastLoginAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
      password,
      roleIds,
    };
  }

  private permissionsOf(user: MockUser): string[] {
    return [
      ...new Set(this.roles.filter((r) => user.roleIds.includes(r.id)).flatMap((r) => r.permissions)),
    ].sort();
  }

  private publicUser({ password: _password, roleIds: _roleIds, ...rest }: MockUser) {
    return rest;
  }

  private issueTokens() {
    const accessToken = `token-${++this.tokenCounter}`;
    this.validTokens.add(accessToken);
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      accessTokenExpiresAt: '2030-01-01T00:00:00.000Z',
      refreshTokenExpiresAt: '2030-01-31T00:00:00.000Z',
    };
  }

  private sessionCookies(): string[] {
    const csrf = `csrf-${this.tokenCounter}`;
    return [
      `erp_rt=rt-${this.tokenCounter}; Path=/api/v1/auth; HttpOnly; SameSite=Strict`,
      `erp_csrf=${csrf}; Path=/; SameSite=Strict`,
    ];
  }

  private clearCookies(): string[] {
    return ['erp_rt=; Path=/api/v1/auth; Max-Age=0', 'erp_csrf=; Path=/; Max-Age=0'];
  }

  async install(page: Page): Promise<void> {
    await page.route('**/api/v1/**', (route) => this.handle(route));
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = request.method();
    this.calls.push(`${method} ${path}`);
    const json = (status: number, body?: unknown, cookies: string[] = []) =>
      route.fulfill({
        status,
        contentType: status >= 400 ? 'application/problem+json' : 'application/json',
        // Several Set-Cookie values are separated by newlines in Playwright's fulfill headers.
        headers: cookies.length ? { 'set-cookie': cookies.join('\n') } : {},
        body: body === undefined ? '' : JSON.stringify(body),
      });
    const body = (): Record<string, unknown> => (request.postData() ? JSON.parse(request.postData()!) : {});

    // --- Public endpoints -------------------------------------------------------------------------
    if (method === 'POST' && path === '/auth/login') {
      const { identifier, password } = body() as { identifier: string; password: string };
      const user = this.users.find((u) => u.email === identifier || u.username === identifier);
      if (!user || user.password !== password || user.status !== 'active') {
        return json(401, problem(401, 'invalid_credentials', 'Invalid credentials'));
      }
      this.currentUserId = user.id;
      this.sessionRevoked = false;
      return json(200, this.issueTokens(), this.sessionCookies());
    }
    if (method === 'POST' && path === '/auth/refresh') {
      // Like the backend: the refresh cookie must come with the double-submit CSRF header.
      const cookies = request.headers()['cookie'] ?? '';
      const csrf = /(?:^|; )erp_csrf=([^;]+)/.exec(cookies)?.[1];
      if (!csrf || request.headers()['x-csrf-token'] !== csrf) {
        return json(401, problem(401, 'csrf_token_invalid', 'Missing or invalid CSRF token'));
      }
      if (this.sessionRevoked || !this.currentUserId) {
        return json(
          401,
          problem(401, 'invalid_refresh_token', 'Refresh token is invalid or expired'),
          this.clearCookies(),
        );
      }
      return json(200, this.issueTokens(), this.sessionCookies());
    }
    if (method === 'POST' && path === '/auth/forgot-password') {
      return json(202, { message: 'If an account exists for that address, we sent a password reset link.' });
    }

    // --- Authenticated endpoints ------------------------------------------------------------------
    const token = request.headers()['authorization']?.replace('Bearer ', '');
    if (!token || !this.validTokens.has(token) || this.sessionRevoked) {
      return json(401, problem(401, 'token_expired', 'Access token has expired'));
    }
    const me = this.users.find((u) => u.id === this.currentUserId)!;
    const held = new Set(this.permissionsOf(me));
    const deny = () =>
      json(403, problem(403, 'forbidden', 'You do not have permission to perform this action'));
    if (this.failWith)
      return json(this.failWith, problem(this.failWith, 'internal', 'Internal Server Error'));

    if (method === 'POST' && path === '/auth/logout') {
      this.validTokens.clear();
      this.currentUserId = null;
      return json(204, undefined, this.clearCookies());
    }
    if (method === 'GET' && path === '/users/me') {
      return json(200, {
        ...this.publicUser(me),
        roles: this.roles.filter((r) => me.roleIds.includes(r.id)).map((r) => r.name),
        permissions: [...held],
      });
    }
    if (method === 'GET' && path === '/auth/sessions') {
      return json(200, [
        {
          id: uuid(900),
          createdAt: NOW,
          lastUsedAt: NOW,
          expiresAt: '2030-01-01T00:00:00.000Z',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/140',
          ipAddress: '127.0.0.1',
          current: true,
        },
      ]);
    }

    if (method === 'GET' && path === '/users') {
      if (!held.has('users:read')) return deny();
      const search = url.searchParams.get('search')?.toLowerCase();
      const status = url.searchParams.get('status');
      const pageNo = Number(url.searchParams.get('page') ?? 1);
      const pageSize = Number(url.searchParams.get('pageSize') ?? 20);
      const items = this.users
        .filter((u) => !search || u.email.includes(search) || u.displayName.toLowerCase().includes(search))
        .filter((u) => !status || u.status === status);
      return json(200, {
        items: items.slice((pageNo - 1) * pageSize, pageNo * pageSize).map((u) => this.publicUser(u)),
        page: pageNo,
        pageSize,
        total: items.length,
        totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
      });
    }
    if (method === 'POST' && path === '/users') {
      if (!held.has('users:create')) return deny();
      const input = body() as { email: string; password: string; displayName: string; username?: string };
      if (this.users.some((u) => u.email === input.email)) {
        return json(409, problem(409, 'email_taken', 'A user with this email already exists'));
      }
      const created = this.user(this.users.length + 1, input.email, input.displayName, input.password, []);
      created.lastLoginAt = null;
      this.users.push(created);
      return json(201, { id: created.id });
    }
    const userMatch = path.match(/^\/users\/([^/]+)(\/.*)?$/);
    if (userMatch) {
      const target = this.users.find((u) => u.id === userMatch[1]);
      if (!target) return json(404, problem(404, 'user_not_found', 'User not found'));
      const sub = userMatch[2] ?? '';
      if (method === 'GET' && sub === '')
        return held.has('users:read') ? json(200, this.publicUser(target)) : deny();
      if (method === 'GET' && sub === '/roles') {
        return json(
          200,
          this.roles
            .filter((r) => target.roleIds.includes(r.id))
            .map((r) => ({ roleId: r.id, name: r.name, assignedAt: NOW })),
        );
      }
      if (method === 'GET' && sub === '/permissions') {
        return json(200, { userId: target.id, roles: [], permissions: this.permissionsOf(target) });
      }
      if (method === 'POST' && (sub === '/deactivate' || sub === '/activate')) {
        if (!held.has('users:deactivate')) return deny();
        target.status = sub === '/activate' ? 'active' : 'deactivated';
        return json(204);
      }
    }

    if (method === 'GET' && path === '/roles') {
      return held.has('roles:read') ? json(200, this.roles) : deny();
    }
    if (method === 'GET' && path === '/permissions') {
      return held.has('permissions:read') ? json(200, CATALOG) : deny();
    }
    if (method === 'GET' && path === '/audit-logs') {
      if (!held.has('audit:read')) return deny();
      return json(200, {
        items: [
          {
            id: uuid(500),
            occurredAt: NOW,
            actorUserId: uuid(1),
            action: 'auth.login',
            resourceType: 'session',
            resourceId: null,
            outcome: 'success',
            ipAddress: '127.0.0.1',
            userAgent: null,
            requestId: 'r1',
            correlationId: 'c1',
            metadata: {},
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      });
    }

    return json(404, problem(404, 'not_found', `No mock for ${method} ${path}`));
  }
}

/** Installs a fresh mock API on the page and returns it for per-test tweaks and assertions. */
export async function mockApi(page: Page): Promise<MockApi> {
  const api = new MockApi();
  await api.install(page);
  return api;
}

export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
}
