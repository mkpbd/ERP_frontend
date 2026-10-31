import type { BadgeTone } from '../../../shared/components/status-badge';

export const OT_CASE_STATUSES = ['requested', 'scheduled', 'in_progress', 'done', 'cancelled'] as const;
export type OtCaseStatus = (typeof OT_CASE_STATUSES)[number];

export const OT_TEAM_ROLES = ['assistant', 'anaesthesia_assistant'] as const;
export type OtTeamRole = (typeof OT_TEAM_ROLES)[number];

/** `GET /hospital/ot-cases` item, and each operation on the board. */
export interface OtCaseSummary {
  readonly id: string;
  readonly number: string;
  readonly status: OtCaseStatus;
  readonly admissionId: string;
  readonly admissionNumber: string;
  readonly patientId: string;
  readonly uhid: number;
  readonly patientName: string;
  readonly operationName: string;
  readonly surgeonName: string;
  /** The day it is asked for (YYYY-MM-DD). */
  readonly requestedFor: string;
  readonly otRoomId: string | null;
  readonly otRoomName: string | null;
  readonly scheduledFrom: string | null;
  readonly scheduledTo: string | null;
}

export interface OtTeamMember {
  readonly doctorId: string;
  readonly doctorName: string;
  readonly role: OtTeamRole;
}

export interface OtNote {
  readonly incision: string | null;
  readonly findings: string | null;
  readonly procedureDone: string | null;
  readonly specimen: string | null;
  readonly postOpOrders: string | null;
}

export interface OtCharge {
  readonly id: string;
  readonly serviceName: string;
  readonly doctorName: string | null;
  readonly qty: number;
  readonly rate: number;
  readonly amount: number;
  readonly status: 'active' | 'cancelled';
}

/** `GET /hospital/ot-cases/:id`. */
export interface OtCase extends OtCaseSummary, OtNote {
  readonly operationId: string;
  readonly otTypeId: string | null;
  readonly otTypeName: string | null;
  readonly anaesthesiaTypeId: string | null;
  readonly anaesthesiaTypeName: string | null;
  readonly surgeonId: string;
  readonly anaesthetistId: string | null;
  readonly anaesthetistName: string | null;
  readonly indication: string | null;
  readonly team: readonly OtTeamMember[];
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly cancelReason: string | null;
  readonly noteSignedAt: string | null;
  readonly noteSignedByName: string | null;
  readonly charges: readonly OtCharge[];
  readonly chargedTotal: number;
  readonly version: number;
}

/** `GET /hospital/ot-board?day=`. */
export interface OtBoard {
  readonly day: string;
  readonly rooms: readonly {
    readonly id: string;
    readonly name: string;
    readonly floor: string | null;
    readonly cases: readonly OtCaseSummary[];
  }[];
  /** Asked for on or before the day and not given a room yet. */
  readonly waiting: readonly OtCaseSummary[];
}

export interface OtCaseQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: OtCaseStatus;
  readonly from?: string;
  readonly to?: string;
  readonly roomId?: string;
}

/** What is operated and who operates: asked for, and changed until it is done. */
export interface OtClinicalRequest {
  readonly operationId: string;
  readonly otTypeId: string | null;
  readonly anaesthesiaTypeId: string | null;
  readonly surgeonId: string;
  readonly anaesthetistId: string | null;
  readonly indication: string | null;
  readonly team: readonly { readonly doctorId: string; readonly role: OtTeamRole }[];
}

export interface RequestOtRequest extends OtClinicalRequest {
  readonly admissionId: string;
  readonly requestedFor: string;
}

export interface ChargeRequest {
  readonly serviceId: string;
  readonly doctorId: string | null;
  readonly qty: number;
  readonly note: string | null;
  readonly otCaseId: string;
}

export interface OtRoom {
  readonly id: string;
  readonly name: string;
  readonly floor: string | null;
  readonly description: string | null;
  readonly isActive: boolean;
}

/** An OT master record: rooms, operations, OT and anaesthesia types, surgery procedures. */
export type OtMasterRecord = { readonly id: string } & Readonly<Record<string, unknown>>;

/** `GET /hospital/admissions` item, as far as choosing a stay needs it. */
export interface AdmissionOption {
  readonly id: string;
  readonly number: string;
  readonly uhid: number;
  readonly patientName: string;
  readonly bedCode: string | null;
  readonly wardName: string | null;
}

/** `GET /hospital/doctors` item, as far as choosing a doctor needs it. */
export interface DoctorOption {
  readonly id: string;
  readonly name: string;
  readonly degrees: string | null;
  readonly isActive: boolean;
}

/** `GET /hospital/services` item, as far as charging needs it. */
export interface ServiceOption {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly rate: number;
  readonly sharePercent: number | null;
}

export interface NamedOption {
  readonly id: string;
  readonly name: string;
}

export const STATUS_LABELS: Record<OtCaseStatus, string> = {
  requested: 'Requested',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const STATUS_TONES: Record<OtCaseStatus, BadgeTone> = {
  requested: 'warning',
  scheduled: 'info',
  in_progress: 'danger',
  done: 'success',
  cancelled: 'neutral',
};

export const ROLE_LABELS: Record<OtTeamRole, string> = {
  assistant: 'Assistant',
  anaesthesia_assistant: 'Anaesthesia assistant',
};

/** The local calendar day of a date as YYYY-MM-DD (the backend's `day` format). */
export function toDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** YYYY-MM-DD to a local Date at midnight. */
export function fromDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1);
}

/** The day `days` after `day`. */
export function addDays(day: string, days: number): string {
  const date = fromDay(day);
  date.setDate(date.getDate() + days);
  return toDay(date);
}

/** A local day and an `HH:mm` time as an instant. */
export function atTime(day: string, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = fromDay(day);
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date;
}

/** `HH:mm` of an instant, in local time. */
export function timeOf(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
