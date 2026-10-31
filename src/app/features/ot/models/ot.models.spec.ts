import { addDays, atTime, fromDay, timeOf, toDay } from './ot.models';

describe('OT day helpers', () => {
  it('reads and writes local calendar days', () => {
    expect(toDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(fromDay('2026-03-09').getDate()).toBe(9);
    expect(toDay(fromDay('2026-12-31'))).toBe('2026-12-31');
  });

  it('moves across months and years', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('builds an instant from a day and a time, and back', () => {
    const at = atTime('2026-10-31', '14:05');
    expect([at.getHours(), at.getMinutes(), toDay(at)]).toEqual([14, 5, '2026-10-31']);
    expect(timeOf(at)).toBe('14:05');
    expect(timeOf(at.toISOString())).toBe('14:05');
  });
});
