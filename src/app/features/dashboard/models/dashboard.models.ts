export type DashboardUnit = 'money' | 'count';

export interface DashboardDimension {
  readonly key: string;
  readonly label: string;
}

/** One figure of a section (`GET /dashboard`). */
export interface DashboardHead {
  readonly key: string;
  readonly label: string;
  readonly unit: DashboardUnit;
  readonly hint: string | null;
  /** As of now (stock, beds, dues): no previous period. */
  readonly current: boolean;
  readonly value: number;
  readonly previous: number | null;
  readonly dimensions: readonly DashboardDimension[];
}

export interface DashboardOverview {
  readonly from: string;
  readonly to: string;
  readonly previousFrom: string;
  readonly previousTo: string;
  readonly sections: readonly {
    readonly key: string;
    readonly title: string;
    readonly heads: readonly DashboardHead[];
  }[];
}

/** `GET /dashboard/heads/:key?by=`. */
export interface DashboardBreakdown {
  readonly key: string;
  readonly label: string;
  readonly unit: DashboardUnit;
  readonly dimension: string;
  readonly rows: readonly { readonly label: string; readonly value: number }[];
}

export interface DayRange {
  readonly from: string;
  readonly to: string;
}

export const PRESETS = ['today', 'yesterday', 'week', 'month', 'last-month'] as const;
export type Preset = (typeof PRESETS)[number];

export const PRESET_LABELS: Record<Preset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Last 7 days',
  month: 'This month',
  'last-month': 'Last month',
};

/** The local calendar day of a date as YYYY-MM-DD. */
export function toDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The days a preset covers, as of `today`. */
export function presetRange(preset: Preset, today = new Date()): DayRange {
  const day = (offset: number) =>
    toDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset));
  switch (preset) {
    case 'today':
      return { from: day(0), to: day(0) };
    case 'yesterday':
      return { from: day(-1), to: day(-1) };
    case 'week':
      return { from: day(-6), to: day(0) };
    case 'month':
      return { from: toDay(new Date(today.getFullYear(), today.getMonth(), 1)), to: day(0) };
    case 'last-month':
      return {
        from: toDay(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: toDay(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
  }
}

const grouped = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/** Taka with lakh and crore grouping (1,38,77,648.22), or a plain count. */
export function formatFigure(value: number, unit: DashboardUnit): string {
  return unit === 'money' ? `৳ ${grouped.format(value)}` : grouped.format(value);
}

/** The change against the period before, in whole percent; null when there was nothing before to compare. */
export function changePercent(value: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return Math.round(((value - previous) / Math.abs(previous)) * 100);
}
