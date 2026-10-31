import { changePercent, formatFigure, presetRange } from './dashboard.models';

describe('dashboard figures', () => {
  const today = new Date(2026, 2, 15);

  it('works out the days of each preset', () => {
    expect(presetRange('today', today)).toEqual({ from: '2026-03-15', to: '2026-03-15' });
    expect(presetRange('yesterday', today)).toEqual({ from: '2026-03-14', to: '2026-03-14' });
    expect(presetRange('week', today)).toEqual({ from: '2026-03-09', to: '2026-03-15' });
    expect(presetRange('month', today)).toEqual({ from: '2026-03-01', to: '2026-03-15' });
    expect(presetRange('last-month', today)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(presetRange('last-month', new Date(2026, 0, 10))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('writes taka with lakh and crore grouping', () => {
    expect(formatFigure(13877648.22, 'money')).toBe('৳ 1,38,77,648.22');
    expect(formatFigure(1250, 'count')).toBe('1,250');
  });

  it('compares with the days before, but not with nothing', () => {
    expect(changePercent(115, 100)).toBe(15);
    expect(changePercent(40, 50)).toBe(-20);
    expect(changePercent(10, 0)).toBeNull();
    expect(changePercent(10, null)).toBeNull();
  });
});
