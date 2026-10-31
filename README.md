# ERP Frontend

Angular administration console for the ERP backend (NestJS, `/api/v1`). Standalone components,
Angular Signals, Angular Material 3 and Tailwind CSS 4, organised as a feature-based modular monolith.

| Component                      | Version                                                        |
| ------------------------------ | -------------------------------------------------------------- |
| Angular / CLI / Material / CDK | 22.2                                                           |
| TypeScript                     | 6.0 (strict, strict templates, extended diagnostics as errors) |
| Tailwind CSS                   | 4.3 (PostCSS plugin)                                           |
| Unit tests                     | Vitest 5 via `@angular/build:unit-test` (jsdom)                |
| End-to-end tests               | Playwright 1.64 + axe-core                                     |
| Node.js                        | **≥ 24.15** (Angular 22 refuses older 24.x)                    |

## Getting started

```bash
npm ci
npm start                 # http://localhost:5173
```

`npm start` serves on **port 5173** and proxies `/api` to `http://localhost:3000` (`proxy.conf.json`).
Port 5173 matches the backend's default `CORS_ORIGINS` and `APP_PUBLIC_URL`, so password-reset and
email-verification links from the backend open this app. Because of the proxy the browser only ever talks
to one origin, which is what the backend's `SameSite=Strict` refresh cookie needs.

Start the backend first (see its README): `npm run db:migrate`, `npm run db:seed:dev`, `npm run start:dev`.
For local HTTP set `COOKIE_SECURE=false` in the backend `.env`; otherwise the browser drops the
`__Secure-` refresh cookie and sessions do not survive a reload.

Development seed accounts (from the backend): `admin@example.com` / `Dev-Root-Passw0rd!` (super-admin),
`auditor@example.com`, `manager@example.com`, `member@example.com` / `DevUser-Passw0rd!`.

## Scripts

| Command                           | What it does                                                               |
| --------------------------------- | -------------------------------------------------------------------------- |
| `npm start`                       | Dev server on :5173 with the API proxy                                     |
| `npm run build`                   | Production build → `dist/erp-frontend/browser`                             |
| `npm test`                        | Unit tests once (`npm run test:watch` to watch, `npm run test:coverage`)   |
| `npm run e2e`                     | Playwright tests against a mocked API (starts its own dev server on :4310) |
| `npm run lint`                    | ESLint: TypeScript, templates, template accessibility rules                |
| `npm run lint:arch`               | Fails on imports that cross module boundaries (see below)                  |
| `npm run typecheck`               | `tsc --noEmit` for app and spec sources                                    |
| `npm run format` / `format:check` | Prettier                                                                   |
| `npm run check`                   | Everything above except e2e, then a production build                       |

## Architecture

```text
src/app/
├── core/            application-wide infrastructure (no UI)
│   ├── auth/            session: AuthService, AuthApi, cookie + cross-tab helpers
│   ├── authorization/   permission keys, Authorization service, permission catalog API
│   ├── interceptors/    correlation id → retry + error normalization → auth (refresh on 401)
│   ├── guards/          authGuard (canMatch), guestGuard, requirePermissions(...)
│   ├── http/            ApiError (RFC 9457 Problem Details), SKIP_AUTH context, params helper
│   ├── config/          API_BASE_URL token
│   └── services/        notifications (snackbar), theme, page-title strategy
├── shared/          reusable UI with no business logic
│   ├── components/      page header, loading/empty/error states, confirm and reason dialogs, status badge,
│   │                    option picker (searchable select), master table and dialog (any record endpoint; text,
│                    numbers, a choice of fixed values or of another master's records, several choices)
│   ├── services/        RecordsApi (the backend's simple record endpoints)
│   ├── directives/      *appHasPermission
│   ├── pipes/ validators/ utils/ models/
├── layout/          application frame: shell, header, sidebar, breadcrumbs, footer, auth layout,
│                    navigation config (typed, permission-filtered)
└── features/        one folder per business capability, each lazy-loaded
    ├── auth/            login, forgot/reset password, verify email
    ├── dashboard/       greeting, the hospital's figures by section (days, change on the days before, a split
    │                    on a click), admin counters, recent activity (@defer)
    ├── diagnostic/      test appointments (a day's windows and places, booking, no-show, cancel, the slip,
    │                    billing on the day), home collections (booking by area, collectors, collected, billing
    │                    the visit, the run sheet; a collector's own visits), booking setup (windows, areas,
    │                    preparation guides, card providers) and the visit's service
    ├── users/           list (search, filter, sort, paginate), create, detail, roles, deactivate, expiry
    ├── roles/           list, create, rename, permission matrix, delete
    ├── permissions/     permission catalog
    ├── audit/           audit log with filters and date range
    ├── ipd/             inpatients: admissions, admitting, the bed board, a stay (moves, doctors, corrections,
    │                    discharge, reopening), its account (charges, advances, final bill, dues), visitor passes
    ├── lab/             laboratory: worklist, collecting, samples, results as values, culture (antibiogram)
    │                    or written report, verification, lab setup (report forms, culture masters, templates)
    ├── nursing/         ward nursing: the rounds' observation board, a stay's observation sheet (flags, strike
    │                    through), medicine and care charts (order, given/done, missed, hold/stop), rounds setup
    ├── ot/              operation theatre: day board, operations, request/schedule/start/finish/cancel,
    │                    operation note and signing, charges, prints, OT masters
    ├── settings/        own profile, password change, signed-in devices
    └── system/          403 and 404 pages
```

A feature contains `pages/` (routed), `components/` (feature-local UI), `services/` (typed data access,
no state), `state/` (signal stores), `models/` and a `*.routes.ts` file loaded with `loadChildren`.

**Boundaries** (enforced by `npm run lint:arch`, `scripts/check-architecture.mjs`):

- `core/` imports nothing from `shared/`, `layout/` or `features/`.
- `shared/` may use `core/`; never `layout/` or `features/`.
- `layout/` may use `core/` and `shared/`; never `features/`.
- A feature may use `core/` and `shared/`, never `layout/` or another feature. When two features need the
  same endpoint, either it is infrastructure (the permission catalog lives in `core/authorization`) or each
  feature asks for its own projection (the dashboard has its own small `DashboardApi`).

### State management

- Server data is loaded with `rxResource()` keyed on a query signal: changing the query refetches and
  cancels the previous request; `isLoading()`, `error()` and `hasValue()` drive the loading, error and empty
  states explicitly.
- Page state lives in a store provided by the page (`providers: [UsersListStore]`), so it is created with
  the page and discarded with it. Nothing about another user's data outlives the page or the session.
- Derived values are `computed()`. `linkedSignal()` is used where a value follows a source but may be edited
  (role permission working copy, sidenav open state) or must keep its previous value (table rows while the
  next page loads). `effect()` is only used for DOM/storage/form side effects.
- Writes return Observables from the store; components add confirmation, notifications and form error
  mapping. A `pending` signal disables buttons and prevents double submits.
- No global state library: the only cross-feature state is the session in `AuthService`.

### API integration

- `API_BASE_URL` comes from `src/environments/environment*.ts` (`/api/v1` in both; same origin).
- Every error reaches components as an `ApiError` with `status`, the backend's stable `code`, a safe
  `message`, `fieldErrors` and `requestId`. 5xx messages are replaced by a generic text plus the request id.
- `applyServerErrors(form, error, { email_taken: 'email' })` puts Zod issues (`body.email`) and domain error
  codes onto the matching form controls.
- GET/HEAD/OPTIONS are retried twice with backoff on network errors and 502/503/504. Writes are never
  retried automatically.
- Each request carries an `X-Correlation-Id` (kept across retries) that the backend logs and audits.

## Authentication and authorization

**Token storage.** The access token (15 minutes) is kept **only in memory**. The refresh token is the
backend's `HttpOnly; SameSite=Strict; Path=/api/v1/auth` cookie, which scripts cannot read. After a reload
the app calls `/auth/refresh` with the cookie plus the double-submit CSRF header (`erp_csrf` cookie echoed
as `X-CSRF-Token`) before the first navigation. Nothing sensitive goes to localStorage or sessionStorage.

Trade-offs: an XSS bug could still use the in-memory token while the page is open, but cannot steal a
long-lived credential. Each reload costs one refresh round trip. The scheme requires the API on the same
site as the app (dev proxy, or the reverse proxy in production).

**Refresh.** On a 401 the auth interceptor refreshes once and replays the request. Concurrent 401s share
one refresh; tabs take turns through the Web Locks API, because the backend treats two simultaneous uses of
a refresh token as token theft and revokes the session. The refresh request is excluded from the
interceptor and replays go straight to the next handler, so a rejected token cannot loop. If the refresh is
rejected the session ends and the user lands on `/login?reason=expired&returnUrl=…`; a network failure
during refresh does not sign the user out.

**Sign-out** revokes the session server-side (best effort), clears memory, tells other tabs via
`BroadcastChannel`, and returns to `/login`. "Sign out everywhere" and password change are in Settings.

**Authorization in the UI.** Navigation items, routes (`canMatch: [requirePermissions('users:read')]`) and
buttons (`*appHasPermission="'users:create'"`) use the effective permissions from `GET /users/me`. These
checks only shape the UI. **The backend authorizes every request**; a 403 still shows an error.
`core/authorization/permissions.ts` mirrors the backend permission catalog and must be kept in sync.

**Open redirects.** `returnUrl` is accepted only for in-app paths (`safeReturnUrl`).

## UI conventions

- Material components for controls, Tailwind for layout and spacing. Material's system colours are exposed
  as Tailwind tokens (`bg-surface`, `text-on-surface-variant`, `border-outline-variant`, …) in `styles.css`,
  so both share one palette, including dark mode (`light-dark()`; system/light/dark switch in the header).
- Tailwind output sits in cascade layers and Material is unlayered, so Material always wins conflicts and
  no `!important` is needed. Component overrides use Material's CSS tokens (`--mat-…`).
- Accessibility: skip link, labelled landmarks, `aria-current` in navigation and breadcrumbs, live regions
  for loading and errors, focus trapping and restoration in dialogs (Cancel focused first for destructive
  ones), reduced motion respected (Material animations disabled, CSS transitions shortened). Template
  accessibility lint rules run in `npm run lint`; e2e tests run axe (WCAG 2.2 AA) on key pages.
- Change detection is OnPush (the Angular 22 default) and zoneless throughout.

## Testing

- **Unit (Vitest, `npm test`)**: error mapping, cookies, permission helpers, navigation filtering,
  validators, server-error mapping, guards, the `*appHasPermission` directive, users list store,
  breadcrumbs, login page, and the full session flow (login, refresh-and-replay, shared refresh, expiry
  without loops, network failure, restore on startup, logout, retry policy) against `HttpTestingController`.
- **End-to-end (Playwright, `npm run e2e`)**: sign-in redirect and return, validation, wrong credentials,
  keyboard-only sign-in, sign-out, session expiry, forgot password, permission-based navigation for three
  roles, 403/404 pages, user search, create with client and server validation, deactivate with confirmation,
  error state with retry, settings, mobile navigation, axe scans. The API is mocked in
  `e2e/support/mock-api.ts` with the backend's response shapes, cookies and CSRF check, so runs are
  deterministic and never touch a database.
- **Live smoke (opt-in)**: `e2e/live-backend.spec.ts` signs in against a running backend, reads users and
  roles, reloads (cookie restore) and signs out. It does not write data.

  ```bash
  E2E_PORT=5173 E2E_LIVE=1 E2E_LIVE_EMAIL=admin@example.com E2E_LIVE_PASSWORD='…' \
    npx playwright test live-backend --project=desktop
  ```

## Configuration

`src/environments/environment.ts` (production) and `environment.development.ts` (used by `ng serve` and
development builds through `fileReplacements`):

```ts
export const environment: AppEnvironment = {
  production: true,
  apiBaseUrl: '/api/v1',
};
```

Everything in these files ships to the browser. **Never put secrets, keys or credentials in them.**

## Deployment

1. `npm ci && npm run build` → static files in `dist/erp-frontend/browser`.
2. Serve them with any static server that has an **SPA fallback** (unknown paths → `index.html`) and
   **reverse-proxy `/api` to the backend on the same origin**. `deploy/nginx.conf` is a complete example with
   long-term caching for hashed bundles, `no-cache` for `index.html`, and security headers including a CSP.
   Production builds do not inline critical CSS, so the HTML has no inline scripts and that CSP works.
3. Backend settings that must match: `COOKIE_SECURE=true` behind HTTPS, `APP_PUBLIC_URL` = the public URL of
   this app (email links), `TRUST_PROXY=true` behind the proxy. CORS is not needed with same-origin serving.

If the API must live on another origin, set `apiBaseUrl` to its absolute URL, add the app origin to the
backend's `CORS_ORIGINS`, and note that a `SameSite=Strict` cookie is only sent to a _same-site_ API (for
example `app.example.com` → `api.example.com`).

CI (`.github/workflows/ci.yml`) runs type checks, lint, boundary check, format check, unit tests,
production build and the e2e suite.

## Known limitations

- Self-registration (`/auth/register`) is supported by the backend but has no page yet.
- Of the HealthCare modules of the backend the operation theatre, the laboratory, the inpatient front desk, nursing,
  the dashboard figures and diagnostic bookings have screens so far; the others (menus, masters, locations, tenants,
  settings, reports, OPD, diagnostic billing beyond a booking's bill, imaging, pharmacy, HR, payroll, ...) follow.
  Navigation is defined in the frontend; `GET /menus/me` (role-granted menus) is not used yet.
- Reports are downloaded as files (`core/services/report-download.service.ts`); which ones a user may run is
  granted per role on the backend, so a refused report shows as an error.
- `permissions.ts` must be updated by hand when the backend catalog changes.
- A role's permission changes are applied as one grant call plus one revoke call per removed permission;
  the backend has no single "replace" endpoint, so a failure part-way leaves a partial update (the page
  reloads the role to show the real state).
- If the API is unreachable during a full page reload, the session cannot be restored and the user is shown
  the sign-in page.
