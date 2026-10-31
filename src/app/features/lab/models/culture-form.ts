import { type CultureReport, type CultureRequest, MAX_ORGANISMS, type Sensitivity } from './lab.models';

/** The culture as the entry form holds it: three organism slots, and each antibiotic's result in every slot. */
export interface CultureDraft {
  readonly analyzer: string;
  readonly pusCells: string;
  readonly epithelialCells: string;
  readonly rbc: string;
  readonly microscopyNote: string;
  readonly growth: boolean;
  readonly growthTypeId: string | null;
  readonly organismIds: readonly (string | null)[];
  readonly colonyCount: string;
  readonly incubation: string;
  readonly media: string;
  readonly message: string;
  readonly rows: readonly {
    readonly antibioticId: string | null;
    readonly zone: string;
    readonly results: readonly (Sensitivity | null)[];
  }[];
  readonly comment: string;
}

const slots = <T>(values: readonly T[], empty: T): T[] =>
  Array.from({ length: MAX_ORGANISMS }, (_, index) => values[index] ?? empty);

/** The form's starting point: the culture entered before, or an empty one (growth until said otherwise). */
export function draftOf(culture: CultureReport | null, comment: string | null): CultureDraft {
  return {
    analyzer: culture?.analyzer ?? '',
    pusCells: culture?.pusCells ?? '',
    epithelialCells: culture?.epithelialCells ?? '',
    rbc: culture?.rbc ?? '',
    microscopyNote: culture?.microscopyNote ?? '',
    growth: culture?.growth ?? true,
    growthTypeId: culture?.growthTypeId ?? null,
    organismIds: slots(
      (culture?.organisms ?? []).map((organism) => organism.organismId),
      null,
    ),
    colonyCount: culture?.colonyCount ?? '',
    incubation: culture?.incubation ?? '',
    media: culture?.media ?? '',
    message: culture?.message ?? '',
    rows: (culture?.sensitivity ?? []).map((row) => ({
      antibioticId: row.antibioticId,
      zone: row.zone ?? '',
      results: slots(row.results, null),
    })),
    comment: comment ?? '',
  };
}

const textOrNull = (value: string) => value.trim() || null;

/**
 * The request for the API: the organisms picked, in order (an empty slot closes up, its column of results with it);
 * on no growth, no organisms and no antibiogram; rows without an antibiotic or without any result left out.
 */
export function cultureRequest(draft: CultureDraft): CultureRequest {
  const kept = draft.growth ? draft.organismIds.flatMap((id, slot) => (id ? [{ id, slot }] : [])) : [];
  const sensitivity = kept.length
    ? draft.rows.flatMap((row) => {
        if (!row.antibioticId) return [];
        const results = kept.map(({ slot }) => row.results[slot] ?? null);
        if (results.every((result) => result === null)) return [];
        return [{ antibioticId: row.antibioticId, zone: textOrNull(row.zone), results }];
      })
    : [];
  return {
    analyzer: textOrNull(draft.analyzer),
    pusCells: textOrNull(draft.pusCells),
    epithelialCells: textOrNull(draft.epithelialCells),
    rbc: textOrNull(draft.rbc),
    microscopyNote: textOrNull(draft.microscopyNote),
    growth: draft.growth,
    growthTypeId: draft.growthTypeId,
    organismIds: kept.map(({ id }) => id),
    colonyCount: textOrNull(draft.colonyCount),
    incubation: textOrNull(draft.incubation),
    media: textOrNull(draft.media),
    message: textOrNull(draft.message),
    sensitivity,
    comment: textOrNull(draft.comment),
  };
}

/** Why the draft cannot be saved yet, or null. */
export function cultureProblem(draft: CultureDraft): string | null {
  const ids = draft.organismIds.filter((id): id is string => !!id);
  if (draft.growth && ids.length === 0) return 'Name the organism isolated, or set the culture to no growth.';
  if (new Set(ids).size !== ids.length) return 'An organism is named twice.';
  const antibiotics = draft.rows.flatMap((row) => (row.antibioticId ? [row.antibioticId] : []));
  if (new Set(antibiotics).size !== antibiotics.length) return 'An antibiotic is in the antibiogram twice.';
  return null;
}
