import { parseFragmentToken } from './fragment-token';

describe('parseFragmentToken', () => {
  it('reads token= from the fragment', () => {
    expect(parseFragmentToken('token=abcdefghijklmnop1234')).toBe('abcdefghijklmnop1234');
  });

  it('rejects missing or implausible tokens', () => {
    expect(parseFragmentToken(null)).toBeNull();
    expect(parseFragmentToken('other=1')).toBeNull();
    expect(parseFragmentToken('token=short')).toBeNull();
  });
});
