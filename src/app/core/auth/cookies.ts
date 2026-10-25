/** Double-submit CSRF cookie set by the backend next to the HttpOnly refresh-token cookie. */
export const CSRF_COOKIE = 'erp_csrf';
export const CSRF_HEADER = 'X-CSRF-Token';

export function readCookie(name: string, source: string = document.cookie): string | null {
  for (const part of source.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}
