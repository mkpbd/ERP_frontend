import { cultureProblem, cultureRequest, draftOf } from './culture-form';
import type { CultureReport } from './lab.models';

const entered: CultureReport = {
  analyzer: null,
  pusCells: '8-10',
  epithelialCells: null,
  rbc: null,
  microscopyNote: null,
  growth: true,
  growthTypeId: 'g1',
  growthType: 'Heavy growth',
  organisms: [
    { organismId: 'o1', name: 'E. coli' },
    { organismId: 'o2', name: 'Klebsiella' },
  ],
  colonyCount: null,
  incubation: null,
  media: null,
  message: null,
  sensitivity: [{ antibioticId: 'a1', antibiotic: 'Ciprofloxacin', zone: '22', results: ['S', 'R'] }],
};

describe('the culture form', () => {
  it('starts from what was entered, with three organism slots', () => {
    const draft = draftOf(entered, 'Seen twice');
    expect(draft.organismIds).toEqual(['o1', 'o2', null]);
    expect(draft.rows[0]).toEqual({ antibioticId: 'a1', zone: '22', results: ['S', 'R', null] });
    expect(draft.comment).toBe('Seen twice');
    expect(draftOf(null, null).growth).toBe(true);
  });

  it('closes up an empty organism slot together with its column of results', () => {
    const draft = {
      ...draftOf(entered, null),
      organismIds: ['o1', null, 'o3'],
      rows: [
        { antibioticId: 'a1', zone: ' ', results: ['S', 'R', 'I'] as const },
        { antibioticId: 'a2', zone: '', results: [null, 'S', null] as const },
        { antibioticId: null, zone: '', results: ['S', null, null] as const },
      ],
    };
    const request = cultureRequest(draft);
    expect(request.organismIds).toEqual(['o1', 'o3']);
    // a2 was tested only against the empty slot: left out; the row without an antibiotic too.
    expect(request.sensitivity).toEqual([{ antibioticId: 'a1', zone: null, results: ['S', 'I'] }]);
  });

  it('sends no organisms and no antibiogram on no growth', () => {
    const request = cultureRequest({ ...draftOf(entered, null), growth: false });
    expect([request.organismIds, request.sensitivity, request.pusCells]).toEqual([[], [], '8-10']);
  });

  it('says what is missing before saving', () => {
    expect(cultureProblem({ ...draftOf(null, null) })).toMatch(/Name the organism/);
    expect(cultureProblem({ ...draftOf(entered, null), organismIds: ['o1', 'o1', null] })).toMatch(/twice/);
    expect(cultureProblem(draftOf(entered, null))).toBeNull();
    expect(cultureProblem({ ...draftOf(null, null), growth: false })).toBeNull();
  });
});
