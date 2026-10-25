import { readCookie } from './cookies';

describe('readCookie', () => {
  it('finds a cookie among several', () => {
    expect(readCookie('erp_csrf', 'a=1; erp_csrf=abc%3D; b=2')).toBe('abc=');
  });

  it('does not match on a name suffix', () => {
    expect(readCookie('csrf', 'erp_csrf=abc')).toBeNull();
  });

  it('returns null when absent', () => {
    expect(readCookie('erp_csrf', '')).toBeNull();
  });
});
