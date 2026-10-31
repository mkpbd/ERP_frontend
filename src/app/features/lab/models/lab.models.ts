import type { BadgeTone } from '../../../shared/components/status-badge';

/** How a lab test is reported: values against its parameters, a culture with its antibiogram, or written text. */
export const REPORT_FORMS = ['values', 'culture', 'descriptive'] as const;
export type ReportForm = (typeof REPORT_FORMS)[number];

export const RESULT_STATUSES = ['pending', 'entered', 'verified', 'delivered', 'rejected'] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const SAMPLE_STATUSES = ['collected', 'received', 'rejected'] as const;
export type SampleStatus = (typeof SAMPLE_STATUSES)[number];

export const SENSITIVITIES = ['S', 'I', 'R'] as const;
export type Sensitivity = (typeof SENSITIVITIES)[number];
export const MAX_ORGANISMS = 3;

/** What the hospital's bill says about a lab document. */
interface OrderRef {
  readonly billNumber: string | null;
  readonly patientName: string | null;
  readonly uhid: number | null;
  readonly departmentName: string | null;
}

/** `GET /lab/results` item: the worklist. */
export interface ResultSummary extends OrderRef {
  readonly id: string;
  readonly sampleId: string;
  readonly labNumber: string;
  readonly billId: string;
  readonly line: number;
  readonly testId: string;
  readonly testName: string | null;
  readonly status: ResultStatus;
  readonly collectedAt: string;
  readonly version: number;
}

export interface ResultValue {
  readonly parameterId: string | null;
  readonly name: string;
  readonly unit: string | null;
  readonly method: string | null;
  readonly value: string | null;
  readonly low: number | null;
  readonly high: number | null;
  readonly normalText: string | null;
  readonly flag: 'low' | 'high' | null;
}

export interface CultureReport {
  readonly analyzer: string | null;
  readonly pusCells: string | null;
  readonly epithelialCells: string | null;
  readonly rbc: string | null;
  readonly microscopyNote: string | null;
  readonly growth: boolean;
  readonly growthTypeId: string | null;
  readonly growthType: string | null;
  readonly organisms: readonly { readonly organismId: string | null; readonly name: string }[];
  readonly colonyCount: string | null;
  readonly incubation: string | null;
  readonly media: string | null;
  readonly message: string | null;
  readonly sensitivity: readonly {
    readonly antibioticId: string | null;
    readonly antibiotic: string;
    readonly zone: string | null;
    readonly results: readonly (Sensitivity | null)[];
  }[];
}

/** A result as kept, in a sample or on its own. */
export interface ResultRecord extends ResultSummary {
  readonly comment: string | null;
  readonly enteredBy: string | null;
  readonly enteredAt: string | null;
  readonly verifiedBy: string | null;
  readonly verifiedAt: string | null;
  readonly deliveredTo: string | null;
  readonly deliveredAt: string | null;
  readonly values: readonly ResultValue[];
  readonly culture: CultureReport | null;
  readonly narrative: string | null;
}

/** `GET /lab/results/:id`: the result with the form to enter it in and, for values, the patient's ranges. */
export interface LabResult extends ResultRecord {
  readonly form: ReportForm;
  readonly template: readonly {
    readonly parameterId: string;
    readonly name: string;
    readonly unit: string | null;
    readonly kind: 'numeric' | 'text';
    readonly low: number | null;
    readonly high: number | null;
    readonly normalText: string | null;
  }[];
}

/** `GET /lab/samples` item. */
export interface SampleSummary extends OrderRef {
  readonly id: string;
  readonly labNumber: string;
  readonly billId: string;
  readonly departmentId: string;
  readonly collectedOn: string;
  readonly collectedAt: string;
  readonly status: SampleStatus;
  readonly tests: number;
  readonly verified: number;
  readonly version: number;
}

/** `GET /lab/samples/:id`. */
export interface Sample extends SampleSummary {
  readonly rejectReason: string | null;
  readonly results: readonly ResultRecord[];
}

/** `GET /lab/orders/:number`: what a bill's lab departments can collect. */
export interface CollectableOrder {
  readonly billId: string;
  readonly billNumber: string;
  readonly billedAt: string;
  readonly patientName: string;
  readonly uhid: number;
  readonly sex: string;
  readonly dateOfBirth: string;
  readonly departments: readonly {
    readonly departmentId: string;
    readonly departmentName: string;
    readonly tests: readonly { readonly line: number; readonly testName: string; readonly inWork: boolean }[];
  }[];
}

export interface LabTest {
  readonly id: string;
  readonly name: string;
  readonly form: ReportForm;
}

export interface ResultQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: ResultStatus;
  readonly from?: string;
  readonly to?: string;
}

export interface SampleQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: SampleStatus;
  readonly from?: string;
  readonly to?: string;
}

/** `PUT /lab/results/:id/culture`. */
export interface CultureRequest {
  readonly analyzer: string | null;
  readonly pusCells: string | null;
  readonly epithelialCells: string | null;
  readonly rbc: string | null;
  readonly microscopyNote: string | null;
  readonly growth: boolean;
  readonly growthTypeId: string | null;
  readonly organismIds: readonly string[];
  readonly colonyCount: string | null;
  readonly incubation: string | null;
  readonly media: string | null;
  readonly message: string | null;
  readonly sensitivity: readonly {
    readonly antibioticId: string;
    readonly zone: string | null;
    readonly results: readonly (Sensitivity | null)[];
  }[];
  readonly comment: string | null;
}

export interface Antibiotic {
  readonly id: string;
  readonly name: string;
  readonly groupName: string | null;
}

export interface NamedRecord {
  readonly id: string;
  readonly name: string;
}

export interface CultureMessage {
  readonly id: string;
  readonly text: string;
}

export interface ReportTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly body: string;
}

export const FORM_LABELS: Record<ReportForm, string> = {
  values: 'Values',
  culture: 'Culture and sensitivity',
  descriptive: 'Written report',
};

export const RESULT_LABELS: Record<ResultStatus, string> = {
  pending: 'To enter',
  entered: 'To verify',
  verified: 'Verified',
  delivered: 'Handed over',
  rejected: 'Rejected',
};

export const RESULT_TONES: Record<ResultStatus, BadgeTone> = {
  pending: 'warning',
  entered: 'info',
  verified: 'success',
  delivered: 'neutral',
  rejected: 'danger',
};

export const SAMPLE_LABELS: Record<SampleStatus, string> = {
  collected: 'Collected',
  received: 'In the lab',
  rejected: 'Rejected',
};

export const SAMPLE_TONES: Record<SampleStatus, BadgeTone> = {
  collected: 'warning',
  received: 'info',
  rejected: 'danger',
};

/** The local calendar day of a date as YYYY-MM-DD (the backend's `day` format). */
export function toDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
