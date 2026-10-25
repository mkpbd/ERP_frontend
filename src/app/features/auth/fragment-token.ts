import { inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/** Parses `token=…` from a URL fragment (`/reset-password#token=…`). */
export function parseFragmentToken(fragment: string | null): string | null {
  if (!fragment) return null;
  const token = new URLSearchParams(fragment).get('token');
  return token && token.length >= 16 && token.length <= 256 ? token : null;
}

/**
 * Reads the single-use token that email links carry in the fragment (never sent to servers or in
 * Referer), then removes it from the address bar and history. Call in an injection context.
 */
export function takeFragmentToken(): string | null {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const token = parseFragmentToken(route.snapshot.fragment);
  if (token) void router.navigate([], { relativeTo: route, replaceUrl: true, fragment: undefined });
  return token;
}
