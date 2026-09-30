import { describe, it, expect } from 'vitest';
import { fieldStep, flowOf, initialAppState, reducer, stepErrors } from './reducer';
import type { Action, AppState } from './reducer';
import { serialize } from './autosave';
import { DIRECTOR_FIELDS } from '../types';
import type { DirectorField } from '../types';
import { corporateFlow } from '../flows/corporate';
import { validEntity } from '../test-utils';

const run = (s: AppState, ...actions: Action[]) => actions.reduce(reducer, s);

const fillEntity = (s: AppState) =>
  run(s, ...Object.entries(validEntity).map(([name, value]): Action => ({ type: 'setField', group: 'entity', name, value })));

const DIRECTOR_VALUES: Record<DirectorField, string> = {
  name: 'Jane', designation: 'MD', bvn: '1', nin: '2', shareholdingPercent: '60', nationality: 'Nigerian',
  pep: 'no', residentialAddress: '1 Rd',
};
const fillDirector = (s: AppState, index: number) =>
  run(s, ...DIRECTOR_FIELDS.map((name): Action => ({ type: 'setDirectorField', index, name, value: DIRECTOR_VALUES[name] })));

const atStep = (step: number) => run(initialAppState(), { type: 'goTo', step });

describe('reducer: entity step', () => {
  it('next on empty step 1 stays and sets errors', () => {
    const s = run(initialAppState(), { type: 'next' });
    expect(s.step).toBe(1);
    expect(s.errors.companyName).toBe('Company name is required.');
  });

  it('next on a valid step 1 advances and clears errors', () => {
    const s = run(fillEntity(initialAppState()), { type: 'next' });
    expect(s.step).toBe(2);
    expect(s.errors).toEqual({});
  });

  it('shows an error only after touch, and clears it when fixed', () => {
    let s = run(initialAppState(), { type: 'setField', group: 'entity', name: 'companyName', value: '' });
    expect(s.errors.companyName).toBeUndefined();
    s = run(s, { type: 'touch', name: 'companyName' });
    expect(s.errors.companyName).toBeTruthy();
    s = run(s, { type: 'setField', group: 'entity', name: 'companyName', value: 'Acme' });
    expect(s.errors.companyName).toBeUndefined();
  });
});

describe('reducer: directors', () => {
  it('next with an empty row sets row errors; a filled row advances', () => {
    let s = run(atStep(2), { type: 'next' });
    expect(s.step).toBe(2);
    expect(s.errors['directors.0.name']).toBe('Name is required.');
    s = run(fillDirector(s, 0), { type: 'next' });
    expect(s.step).toBe(3);
  });

  it('addDirector then next touches the new row while the first stays valid', () => {
    let s = fillDirector(atStep(2), 0);
    s = run(s, { type: 'addDirector' }, { type: 'next' });
    expect(s.step).toBe(2);
    expect(s.errors['directors.1.name']).toBe('Name is required.');
    expect(s.errors['directors.0.name']).toBeUndefined();
  });

  it('removeDirector is a no-op with one row', () => {
    const s = atStep(2);
    expect(run(s, { type: 'removeDirector', index: 0 })).toBe(s);
  });

  it('removeDirector drops the chosen row and clears director touched/errors so nothing lands on the wrong row', () => {
    let s = run(atStep(2), { type: 'setDirectorField', index: 0, name: 'name', value: 'First' }, { type: 'addDirector' },
      { type: 'setDirectorField', index: 1, name: 'name', value: 'Second' }, { type: 'next' });
    expect(Object.keys(s.errors).some((k) => k.startsWith('directors.'))).toBe(true);
    s = run(s, { type: 'removeDirector', index: 0 });
    expect(s.form.directors.map((d) => d.name)).toEqual(['Second']);
    expect(Object.keys(s.touched).some((k) => k.startsWith('directors'))).toBe(false);
    expect(Object.keys(s.errors).some((k) => k.startsWith('directors'))).toBe(false);
  });

  it('addDirector no-ops at 25 rows', () => {
    let s = atStep(2);
    for (let i = 0; i < 30; i++) s = run(s, { type: 'addDirector' });
    expect(s.form.directors).toHaveLength(25);
  });

  it('setDirectorFile stores a file on the right row', () => {
    const f = new File(['x'], 'id.pdf');
    const s = run(atStep(2), { type: 'addDirector' }, { type: 'setDirectorFile', index: 1, fileId: 'id', file: f });
    expect(s.form.directors[1].files.id).toBe(f);
    expect(s.form.directors[0].files.id).toBeNull();
  });
});

describe('reducer: documents, seal and navigation', () => {
  it('a ticked document with a bad file blocks; unticking lets the user through', () => {
    let s = run(atStep(3), { type: 'setDocSubmitted', id: 'certificate_of_incorporation', value: true },
      { type: 'setDocFile', id: 'certificate_of_incorporation', file: new File(['x'], 'a.exe') },
      { type: 'setConsent', value: true }, { type: 'next' });
    expect(s.step).toBe(3);
    expect(s.errors.certificate_of_incorporation).toBe('File type not allowed: a.exe');
    s = run(s, { type: 'setDocSubmitted', id: 'certificate_of_incorporation', value: false }, { type: 'next' });
    expect(s.step).toBe(4);
  });

  it('a bad seal blocks the declaration step', () => {
    const s = run(atStep(5), { type: 'setSeal', file: new File(['x'], 's.exe') }, { type: 'next' });
    expect(s.errors.sealFile).toBe('File type not allowed: s.exe');
  });

  it('back never goes below 1 and next never exceeds the last step', () => {
    expect(run(initialAppState(), { type: 'back' }).step).toBe(1);
    const last = corporateFlow.steps.length;
    expect(run(atStep(99), { type: 'next' }).step).toBeLessThanOrEqual(last);
    expect(atStep(99).step).toBe(last);
  });
});

describe('reducer: drafts, status and server errors', () => {
  it('restoreDraft applies values and flags the banner; reset clears both', () => {
    const base = initialAppState();
    base.form.entity.companyName = 'Draft Co';
    base.form.directors[0].name = 'Jane';
    let s = run(initialAppState(), { type: 'restoreDraft', draft: serialize(base.form) });
    expect(s.form.entity.companyName).toBe('Draft Co');
    expect(s.form.directors[0].name).toBe('Jane');
    expect(s.draftRestored).toBe(true);
    s = run(s, { type: 'reset' });
    expect(s.form.entity.companyName).toBe('');
    expect(s.draftRestored).toBe(false);
  });

  it('serverErrors jumps to the earliest step owning an errored field', () => {
    expect(run(atStep(5), { type: 'serverErrors', errors: { 'directors.0.name': 'x' } }).step).toBe(2);
    expect(run(atStep(5), { type: 'serverErrors', errors: { consent: 'x', tin: 'y' } }).step).toBe(1);
    const s = run(atStep(5), { type: 'serverErrors', errors: { tin: 'bad' } });
    expect(s.errors.tin).toBe('bad');
  });

  it('serverErrors with only unmatched keys does not change the step', () => {
    const s = run(atStep(5), { type: 'serverErrors', errors: { _total: 'a', 'directorFile.0.id': 'b', sealFile: 'c', customerType: 'd' } });
    expect(s.step).toBe(5);
  });

  it('submitting and done update status', () => {
    expect(run(initialAppState(), { type: 'submitting', value: true }).status).toBe('submitting');
    expect(run(initialAppState(), { type: 'submitting', value: true }, { type: 'submitting', value: false }).status).toBe('idle');
    expect(run(initialAppState(), { type: 'done' }).status).toBe('done');
  });
});

describe('fieldStep and stepErrors', () => {
  it('maps owning steps and null for unmatched keys', () => {
    const flow = flowOf(initialAppState());
    expect(fieldStep(flow, 'signatureAgree')).toBe(5);
    expect(fieldStep(flow, 'consent')).toBe(3);
    expect(fieldStep(flow, 'directors.7.pep')).toBe(2);
    expect(fieldStep(flow, 'directorFile.0.id')).toBeNull();
    expect(fieldStep(flow, '_total')).toBeNull();
  });

  it('stepErrors maps to the step validators', () => {
    const s = initialAppState();
    expect(stepErrors(s.form, flowOf(s), 5).signatory1Name).toBeTruthy();
  });
});
