import { DOCUMENT, effect, inject, Injectable, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'erp.theme';

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** Light / dark / system colour scheme. The preference is not sensitive, so it is kept in localStorage. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly preference = signal<ThemePreference>(readStoredPreference());

  constructor() {
    // Side effect on the DOM and storage, which is what effect() is for.
    effect(() => {
      const preference = this.preference();
      const root = this.document.documentElement;
      if (preference === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', preference);
      try {
        localStorage.setItem(STORAGE_KEY, preference);
      } catch {
        // Storage can be unavailable (private mode); the preference then lasts for this page only.
      }
    });
  }
}
