import type { BadgeTone } from '../../../shared/components/status-badge';

export const ADMISSION_STATUSES = ['admitted', 'discharged', 'cancelled'] as const;
export type AdmissionStatus = (typeof ADMISSION_STATUSES)[number];
export const ADMISSION_KINDS = ['emergency', 'elective'] as const;
export type AdmissionKind = (typeof ADMISSION_KINDS)[number];
export const DISCHARGE_TYPES = ['normal', 'lama', 'referred', 'absconded', 'death'] as const;
export type DischargeType = (typeof DISCHARGE_TYPES)[number];
export const BED_STATUSES = ['available', 'occupied', 'housekeeping', 'out_of_order'] as const;
export type BedStatus = (typeof BED_STATUSES)[number];
export const PAYMENT_METHODS = ['cash', 'card', 'mobile'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** `GET /hospital/admissions` item. */
export interface AdmissionSummary {
  readonly id: string;
  readonly number: string;
  readonly patientId: string;
  readonly uhid: number;
  readonly patientName: string;
  readonly admittedAt: string;
  readonly kind: AdmissionKind;
  readonly status: AdmissionStatus;
  readonly dischargedAt: string | null;
  readonly dischargeType: DischargeType | null;
  readonly bedCode: string | null;
  readonly wardName: string | null;
  readonly doctorName: string | null;
  readonly version: number;
}

/** `GET /hospital/admissions/:id`. */
export interface Admission extends AdmissionSummary {
  readonly sex: string;
  readonly dateOfBirth: string;
  readonly mobileNo: string | null;
  readonly reason: string | null;
  readonly referredById: string | null;
  readonly referredByName: string | null;
  readonly corporateClientId: string | null;
  readonly corporateClientName: string | null;
  readonly staffId: string | null;
  readonly admissionFee: number;
  readonly dischargeNote: string | null;
  readonly cancelReason: string | null;
  readonly stays: readonly {
    readonly bedId: string;
    readonly bedCode: string;
    readonly wardName: string;
    readonly categoryName: string;
    readonly fromAt: string;
    readonly toAt: string | null;
    readonly dailyRate: number;
    readonly reason: string | null;
  }[];
  readonly doctors: readonly {
    readonly doctorId: string;
    readonly doctorName: string;
    readonly role: 'primary' | 'additional';
    readonly fromAt: string;
    readonly toAt: string | null;
  }[];
}

export interface AdmissionQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly q?: string;
  readonly status?: AdmissionStatus;
}

/** `GET /hospital/bed-board`. */
export interface BedBoard {
  readonly wards: readonly {
    readonly id: string;
    readonly name: string;
    readonly floor: string | null;
    readonly beds: readonly BoardBed[];
  }[];
  readonly counts: Readonly<Record<BedStatus, number>>;
}

export interface BoardBed {
  readonly id: string;
  readonly code: string;
  readonly categoryName: string;
  readonly isIntensive: boolean;
  readonly status: BedStatus;
  readonly dailyRate: number;
  readonly admission: {
    readonly id: string;
    readonly number: string;
    readonly patientName: string;
    readonly uhid: number;
    readonly since: string;
    readonly doctorName: string | null;
  } | null;
}

export interface AccountLine {
  readonly head: string;
  readonly description: string;
  readonly doctorName: string | null;
  readonly fromOn: string | null;
  readonly toOn: string | null;
  readonly qty: number;
  readonly rate: number;
  readonly amount: number;
  readonly serviceCharge: number;
}

/** `GET /hospital/admissions/:id/account`: the bill in force, or what it would be today. */
export interface IpdAccount {
  readonly admissionId: string;
  readonly admissionStatus: AdmissionStatus;
  readonly asOf: string;
  readonly nights: number;
  readonly lines: readonly AccountLine[];
  readonly gross: number;
  readonly serviceCharge: number;
  readonly total: number;
  readonly held: number;
  readonly balance: number;
  readonly bill: {
    readonly id: string;
    readonly number: string;
    readonly billedOn: string;
    readonly discount: number;
    readonly net: number;
    readonly deposit: number;
    readonly paid: number;
    readonly collected: number;
    readonly due: number;
    readonly version: number;
  } | null;
  readonly charges: readonly {
    readonly id: string;
    readonly serviceName: string;
    readonly doctorName: string | null;
    readonly chargedOn: string;
    readonly qty: number;
    readonly rate: number;
    readonly amount: number;
    readonly note: string | null;
    readonly status: 'active' | 'cancelled';
    readonly cancelReason: string | null;
  }[];
  readonly payments: readonly {
    readonly number: string;
    readonly kind: 'advance' | 'refund' | 'payment' | 'collection';
    readonly method: PaymentMethod;
    readonly reference: string | null;
    readonly amount: number;
    readonly paidOn: string;
    readonly billNumber: string | null;
  }[];
  readonly openIndents: number;
}

/** `GET /hospital/admissions/:id/visitor-passes` item. */
export interface VisitorPass {
  readonly id: string;
  readonly number: string;
  readonly visitorName: string;
  readonly relation: string | null;
  readonly mobileNo: string | null;
  readonly status: 'active' | 'returned';
  readonly issuedAt: string;
  readonly issuedByName: string | null;
  readonly returnedAt: string | null;
  readonly valid: boolean;
}

/** `GET /hospital/patients` item, as far as admitting needs it. */
export interface PatientOption {
  readonly id: string;
  readonly uhid: number;
  readonly fullName: string;
  readonly sex: string;
  readonly mobileNo: string | null;
}

export interface NamedOption {
  readonly id: string;
  readonly name: string;
}

export interface MoneyInput {
  readonly amount: number;
  readonly method: PaymentMethod;
  readonly reference: string | null;
}

export interface AdmitRequest {
  readonly patientId: string;
  readonly bedId: string;
  readonly doctorId: string;
  readonly kind: AdmissionKind;
  readonly reason: string | null;
  readonly referredById: string | null;
  /** Null: the patient pays; left out: the patient's own client. */
  readonly corporateClientId?: string | null;
  readonly advance: MoneyInput | null;
}

export interface CorrectionRequest {
  readonly kind: AdmissionKind;
  readonly reason: string | null;
  readonly referredById: string | null;
  readonly corporateClientId: string | null;
  readonly staffId: string | null;
}

export const STATUS_LABELS: Record<AdmissionStatus, string> = {
  admitted: 'Admitted',
  discharged: 'Discharged',
  cancelled: 'Cancelled',
};

export const STATUS_TONES: Record<AdmissionStatus, BadgeTone> = {
  admitted: 'info',
  discharged: 'success',
  cancelled: 'neutral',
};

export const BED_LABELS: Record<BedStatus, string> = {
  available: 'Free',
  occupied: 'Occupied',
  housekeeping: 'Housekeeping',
  out_of_order: 'Out of order',
};

export const DISCHARGE_LABELS: Record<DischargeType, string> = {
  normal: 'Normal',
  lama: 'Left against medical advice',
  referred: 'Referred',
  absconded: 'Absconded',
  death: 'Death',
};

export const KIND_LABELS: Record<AdmissionKind, string> = { emergency: 'Emergency', elective: 'Elective' };

export const PAYMENT_LABELS: Record<string, string> = {
  advance: 'Advance',
  refund: 'Refund',
  payment: 'Payment',
  collection: 'Due collected',
};
