export type AuditOutcome = 'success' | 'failure' | 'denied';

/** `GET /audit-logs` item. */
export interface AuditLogEntry {
  readonly id: string;
  readonly occurredAt: string;
  readonly actorUserId: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly outcome: AuditOutcome;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly requestId: string | null;
  readonly correlationId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface AuditLogQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly action?: string;
  readonly resourceType?: string;
  readonly outcome?: AuditOutcome;
  readonly from?: Date;
  readonly to?: Date;
}
