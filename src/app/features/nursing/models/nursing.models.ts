import type { BadgeTone } from '../../../shared/components/status-badge';

export const ORDER_KINDS = ['medicine', 'care'] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];
export const ROUTES = ['oral', 'iv', 'im', 'sc', 'topical', 'inhaled', 'rectal', 'other'] as const;
export type Route = (typeof ROUTES)[number];
export const SCHEDULES = ['times', 'interval', 'once', 'prn'] as const;
export type Schedule = (typeof SCHEDULES)[number];
export type OrderStatus = 'active' | 'held' | 'stopped';
export type SlotState = 'given' | 'missed' | 'due' | 'overdue';
export const CONSCIOUSNESS = ['alert', 'voice', 'pain', 'unresponsive'] as const;
export type Consciousness = (typeof CONSCIOUSNESS)[number];
export type RoundState = 'done' | 'due' | 'missed' | 'upcoming';

export type VitalFlag =
  | 'fever'
  | 'hypothermia'
  | 'tachycardia'
  | 'bradycardia'
  | 'tachypnoea'
  | 'bradypnoea'
  | 'low_spo2'
  | 'hypotension'
  | 'hypertension'
  | 'hypoglycaemia'
  | 'hyperglycaemia'
  | 'not_alert';

/** `GET /clinical/observation-board?day=`. */
export interface ObservationBoard {
  readonly day: string;
  readonly rounds: readonly {
    readonly id: string;
    readonly name: string;
    readonly startTime: string;
    readonly endTime: string;
  }[];
  readonly patients: readonly {
    readonly admissionId: string;
    readonly admissionNumber: string;
    readonly patientName: string;
    readonly uhid: number;
    readonly wardName: string;
    readonly bedCode: string;
    readonly rounds: readonly (RoundState | null)[];
    readonly lastAt: string | null;
    readonly lastFlags: readonly VitalFlag[];
  }[];
}

export interface Vitals {
  readonly temperatureF: number | null;
  readonly pulse: number | null;
  readonly respRate: number | null;
  readonly systolic: number | null;
  readonly diastolic: number | null;
  readonly spo2: number | null;
  readonly painScore: number | null;
  readonly bloodSugar: number | null;
  readonly intakeMl: number | null;
  readonly outputMl: number | null;
  readonly consciousness: Consciousness | null;
}

/** `GET /clinical/admissions/:id/observations` item. */
export interface Observation extends Vitals {
  readonly id: string;
  readonly takenAt: string;
  readonly roundName: string | null;
  readonly note: string | null;
  readonly recordedByName: string;
  readonly struckAt: string | null;
  readonly struckByName: string | null;
  readonly struckReason: string | null;
  readonly flags: readonly VitalFlag[];
}

export interface ObservationRequest extends Vitals {
  readonly note: string | null;
  /** Null: now. */
  readonly takenAt: string | null;
}

export interface DoseRecord {
  readonly id: string;
  readonly dueAt: string | null;
  readonly outcome: 'given' | 'missed';
  readonly givenAt: string | null;
  readonly reason: string | null;
}

/** A treatment order (a medicine, or nursing care). */
export interface Order {
  readonly id: string;
  readonly kind: OrderKind;
  readonly drugName: string;
  readonly dose: string | null;
  readonly route: Route | null;
  readonly schedule: Schedule;
  readonly times: readonly string[];
  readonly intervalHours: number | null;
  readonly startAt: string;
  readonly note: string | null;
  readonly status: OrderStatus;
  readonly doctorName: string;
  readonly version: number;
}

/** `GET /clinical/admissions/:id/chart?day=&kind=`. */
export interface Chart {
  readonly day: string;
  readonly admission: {
    readonly id: string;
    readonly number: string;
    readonly patientName: string;
    readonly status: string;
  };
  readonly orders: readonly (Order & {
    readonly slots: readonly {
      readonly dueAt: string;
      readonly state: SlotState;
      readonly record: DoseRecord | null;
    }[];
    readonly doses: readonly DoseRecord[];
  })[];
}

export interface OrderRequest {
  readonly kind: OrderKind;
  /** Medicine: the product, or none with a name written. */
  readonly productId: string | null;
  /** The medicine's name, or the care ordered. */
  readonly name: string;
  /** The dose, or how the care is done. */
  readonly dose: string | null;
  readonly route: Route | null;
  readonly schedule: Schedule;
  readonly times: readonly string[];
  readonly intervalHours: number | null;
  readonly note: string | null;
}

export const ROUND_LABELS: Record<RoundState, string> = {
  done: 'Done',
  due: 'Due',
  missed: 'Missed',
  upcoming: 'To come',
};

export const ROUND_TONES: Record<RoundState, BadgeTone> = {
  done: 'success',
  due: 'warning',
  missed: 'danger',
  upcoming: 'neutral',
};

export const FLAG_LABELS: Record<VitalFlag, string> = {
  fever: 'Fever',
  hypothermia: 'Low temperature',
  tachycardia: 'Fast pulse',
  bradycardia: 'Slow pulse',
  tachypnoea: 'Fast breathing',
  bradypnoea: 'Slow breathing',
  low_spo2: 'Low SpO2',
  hypotension: 'Low BP',
  hypertension: 'High BP',
  hypoglycaemia: 'Low sugar',
  hyperglycaemia: 'High sugar',
  not_alert: 'Not alert',
};

export const ROUTE_LABELS: Record<Route, string> = {
  oral: 'Oral',
  iv: 'IV',
  im: 'IM',
  sc: 'SC',
  topical: 'Topical',
  inhaled: 'Inhaled',
  rectal: 'Rectal',
  other: 'Other',
};

export const ORDER_LABELS: Record<OrderStatus, string> = {
  active: 'Active',
  held: 'Held',
  stopped: 'Stopped',
};

export const ORDER_TONES: Record<OrderStatus, BadgeTone> = {
  active: 'success',
  held: 'warning',
  stopped: 'neutral',
};

/** When the order is due, as words. */
export function scheduleText(order: Pick<Order, 'schedule' | 'times' | 'intervalHours'>): string {
  if (order.schedule === 'times') return order.times.join(', ');
  if (order.schedule === 'interval') return `Every ${order.intervalHours} h`;
  if (order.schedule === 'once') return 'Once';
  return 'When needed';
}

/** The local calendar day of a date as YYYY-MM-DD. */
export function toDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Blood pressure as written, or nothing. */
export function bloodPressure(vitals: Pick<Vitals, 'systolic' | 'diastolic'>): string {
  return vitals.systolic === null ? '' : `${vitals.systolic}/${vitals.diastolic}`;
}
