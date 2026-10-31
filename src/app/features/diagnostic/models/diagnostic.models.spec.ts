import { addDays, servedDays, servesOn, sumRates, toCollect, windowTime } from './diagnostic.models';

describe('diagnostic bookings', () => {
  it('moves days across a month and adds rates in paisa', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(sumRates([0.1, 0.2])).toBe(0.3);
    expect(sumRates([1300, 200])).toBe(1500);
  });

  it('serves an area on its days, every day when none are listed', () => {
    // 2026-10-31 is a Saturday.
    expect(servesOn({ days: ['saturday'] }, '2026-10-31')).toBe(true);
    expect(servesOn({ days: ['monday'] }, '2026-10-31')).toBe(false);
    expect(servesOn({ days: [] }, '2026-10-31')).toBe(true);
    expect(servedDays([])).toBe('Every day');
    expect(servedDays(['monday', 'saturday'])).toBe('Sat, Mon');
  });

  it("collects the bill's due once billed, else the quote; reads a window's times", () => {
    expect(toCollect({ billDue: null, total: 1500 })).toBe(1500);
    expect(toCollect({ billDue: 0, total: 1500 })).toBe(0);
    expect(windowTime({ startTime: '08:00', endTime: '10:00' })).toBe('08:00–10:00');
    expect(windowTime({ startTime: '08:00', endTime: null })).toBe('from 08:00');
  });
});
