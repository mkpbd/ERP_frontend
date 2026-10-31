import type { BadgeTone } from '../../../shared/components/status-badge';

export const APPOINTMENT_STATUSES = ['booked', 'billed', 'no_show', 'cancelled'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const COLLECTION_STATUSES = ['booked', 'assigned', 'collected', 'cancelled'] as const;
export type CollectionStatus = (typeof COLLECTION_STATUSES)[number];
export const PAYMENT_METHODS = ['cash', 'card', 'mobile'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** By `getDay()`: Sunday first, as the backend stores them. */
export const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;
export const WEEKDAY_LABELS: Record<string, string> = {
  saturday: 'Sat',
  sunday: 'Sun',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
};
/** How far ahead a day may be booked (the backend's limit). */
export const BOOKING_DAYS_AHEAD = 60;
export const MAX_BOOKING_TESTS = 20;

export const APPOINTMENT_LABELS: Record<AppointmentStatus, string> = {
  booked: 'Booked',
  billed: 'Billed',
  no_show: 'No-show',
  cancelled: 'Cancelled',
};
export const APPOINTMENT_TONES: Record<AppointmentStatus, BadgeTone> = {
  booked: 'info',
  billed: 'success',
  no_show: 'warning',
  cancelled: 'neutral',
};
export const COLLECTION_LABELS: Record<CollectionStatus, string> = {
  booked: 'Booked',
  assigned: 'Collector given',
  collected: 'Collected',
  cancelled: 'Cancelled',
};
export const COLLECTION_TONES: Record<CollectionStatus, BadgeTone> = {
  booked: 'info',
  assigned: 'warning',
  collected: 'success',
  cancelled: 'neutral',
};
export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  mobile: 'Mobile wallet',
};

export interface BookedTest {
  readonly testId: string;
  readonly testName: string;
  readonly departmentName: string;
  readonly rate: number;
}

export interface BoardCount {
  readonly key: string;
  readonly live: number;
  readonly cancelled: number;
}

export interface TestAppointment {
  readonly id: string;
  readonly number: string;
  readonly appointmentDate: string;
  readonly windowId: string;
  readonly windowLabel: string;
  readonly startTime: string;
  readonly endTime: string | null;
  readonly serial: number;
  readonly patientId: string | null;
  readonly uhid: number | null;
  readonly patientName: string;
  readonly mobileNo: string;
  readonly tests: readonly BookedTest[];
  readonly amount: number;
  readonly status: AppointmentStatus;
  readonly statusReason: string | null;
  readonly billId: string | null;
  readonly billNumber: string | null;
  readonly remarks: string | null;
  readonly bookedVia: 'desk' | 'portal';
  readonly bookedByName: string | null;
  readonly createdAt: string;
  readonly version: number;
}

export interface AppointmentBoard {
  readonly items: readonly TestAppointment[];
  readonly summary: {
    readonly total: number;
    readonly booked: number;
    readonly billed: number;
    readonly noShow: number;
    readonly cancelled: number;
    readonly amount: number;
    readonly byDepartment: readonly BoardCount[];
    readonly byTest: readonly BoardCount[];
    readonly byWindow: readonly BoardCount[];
  };
}

export interface HomeCollection {
  readonly id: string;
  readonly number: string;
  readonly collectionDate: string;
  readonly windowId: string;
  readonly windowLabel: string;
  readonly areaId: string;
  readonly areaName: string;
  readonly address: string;
  readonly landmark: string | null;
  readonly patientId: string | null;
  readonly uhid: number | null;
  readonly patientName: string;
  readonly mobileNo: string;
  readonly tests: readonly BookedTest[];
  readonly amount: number;
  readonly charge: number;
  readonly total: number;
  readonly status: CollectionStatus;
  readonly statusReason: string | null;
  readonly collectorId: string | null;
  readonly collectorName: string | null;
  readonly assignedAt: string | null;
  readonly collectedAt: string | null;
  readonly collectedByName: string | null;
  readonly collectionNote: string | null;
  readonly billId: string | null;
  readonly billNumber: string | null;
  readonly billDue: number | null;
  readonly patientNote: string | null;
  readonly bookedVia: 'desk' | 'portal';
  readonly bookedByName: string | null;
  readonly createdAt: string;
  readonly version: number;
}

export interface CollectionBoard {
  readonly items: readonly HomeCollection[];
  readonly summary: {
    readonly total: number;
    readonly booked: number;
    readonly assigned: number;
    readonly collected: number;
    readonly cancelled: number;
    readonly unbilled: number;
    readonly amount: number;
    readonly byArea: readonly BoardCount[];
    readonly byCollector: readonly BoardCount[];
    readonly byWindow: readonly BoardCount[];
  };
}

/** A window of a day with its places. */
export interface WindowDay {
  readonly id: string;
  readonly label: string;
  readonly startTime: string;
  readonly endTime: string | null;
  readonly departmentId: string | null;
  readonly departmentName: string | null;
  readonly capacity: number;
  readonly booked: number;
  readonly left: number;
  readonly over: boolean;
}

export interface Department {
  readonly id: string;
  readonly name: string;
  readonly kind: 'lab' | 'imaging' | 'other';
}

/** `GET /hospital/diagnostic-tests` item, as far as booking needs it. */
export interface TestOption {
  readonly id: string;
  readonly name: string;
  readonly shortName: string | null;
  readonly code: string | null;
  readonly departmentId: string;
  readonly rate: number;
  readonly isActive: boolean;
}

/** A test chosen for a booking, with its department. */
export interface ChosenTest {
  readonly id: string;
  readonly name: string;
  readonly rate: number;
  readonly departmentId: string;
  readonly departmentName: string;
  readonly departmentKind: Department['kind'];
}

export interface CollectionArea {
  readonly id: string;
  readonly name: string;
  readonly charge: number;
  readonly minimumOrder: number;
  readonly days: readonly string[];
  readonly isActive: boolean;
}

export interface NamedOption {
  readonly id: string;
  readonly label: string;
}

/** `GET /hospital/patients` item, as far as booking needs it. */
export interface PatientOption {
  readonly id: string;
  readonly uhid: number;
  readonly fullName: string;
  readonly mobileNo: string | null;
}

/** A registered patient, or a name and mobile number until they register. */
export interface BookingPatient {
  readonly patientId: string | null;
  readonly patientName: string | null;
  readonly mobileNo: string | null;
}

export interface BookAppointmentRequest extends BookingPatient {
  readonly appointmentDate: string;
  readonly windowId: string;
  readonly testIds: readonly string[];
  readonly remarks: string | null;
}

export interface BookCollectionRequest extends BookingPatient {
  readonly collectionDate: string;
  readonly windowId: string;
  readonly areaId: string;
  readonly address: string;
  readonly landmark: string | null;
  readonly testIds: readonly string[];
  readonly note: string | null;
}

export interface DiagnosticPolicy {
  readonly counterDiscountPercent: number;
  readonly defaultReferralPercent: number;
  readonly homeCollectionTestId: string | null;
}

export interface BillRequest {
  readonly patientId: string;
  readonly testIds: readonly string[];
  readonly testAppointmentId?: string;
  readonly homeCollectionId?: string;
  readonly payment: {
    readonly amount: number;
    readonly method: PaymentMethod;
    readonly reference: string | null;
  } | null;
}

/** A booking as the bill dialog takes it: its patient, its tests and, for a home visit, its charge. */
export interface BillableBooking {
  readonly kind: 'appointment' | 'home_collection';
  readonly id: string;
  readonly number: string;
  readonly patientId: string | null;
  readonly patientName: string;
  readonly mobileNo: string;
  readonly tests: readonly BookedTest[];
  readonly charge: number;
}

/** `YYYY-MM-DD` of a local date. */
export function toDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A local date of `YYYY-MM-DD`. */
export function fromDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, date);
}

export function addDays(day: string, days: number): string {
  const date = fromDay(day);
  date.setDate(date.getDate() + days);
  return toDay(date);
}

/** Paisa-safe sum of rates. */
export function sumRates(rates: readonly number[]): number {
  return rates.reduce((total, rate) => total + Math.round(rate * 100), 0) / 100;
}

/** Whether an area is served that day (no days listed: every day). */
export function servesOn(area: Pick<CollectionArea, 'days'>, day: string): boolean {
  return area.days.length === 0 || area.days.includes(WEEKDAYS[fromDay(day).getDay()]!);
}

/** The days an area is served, as read on a screen. */
export function servedDays(days: readonly string[]): string {
  if (days.length === 0) return 'Every day';
  const order = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  return order
    .filter((day) => days.includes(day))
    .map((day) => WEEKDAY_LABELS[day])
    .join(', ');
}

/** What a home visit still needs from the patient: the bill's due once billed, else the quote. */
export function toCollect(collection: Pick<HomeCollection, 'billDue' | 'total'>): number {
  return collection.billDue ?? collection.total;
}

export function windowTime(window: { startTime: string; endTime: string | null }): string {
  return window.endTime ? `${window.startTime}–${window.endTime}` : `from ${window.startTime}`;
}
