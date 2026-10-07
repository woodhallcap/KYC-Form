import { describe, it, expect } from 'vitest';
import { activeForm, fieldStep, flowOf, initialAppState, reducer, stepErrors } from './reducer';
import type { Action, AppState } from './reducer';
import { serialize } from './autosave';
import { DIRECTOR_FIELDS } from '../types';
import type { DirectorField } from '../types';
import { FLOWS, corporateFlow } from '../flows/corporate';
import { CORPORATE_DOC_IDS, INDIVIDUAL_DOC_IDS, validEntity, validPerson } from '../test-utils';

const run = (s: AppState, ...actions: Action[]) => actions.reduce(reducer, s);
const corp = () => run(initialAppState(), { type: 'selectType', customerType: 'corporate' });
const indiv = () => run(initialAppState(), { type: 'selectType', customerType: 'individual' });
const atStep = (s: AppState, step: number) => run(s, { type: 'goTo', step });

const fillEntity = (s: AppState) =>
  run(s, ...Object.entries(validEntity).map(([name, value]): Action => ({ type: 'setField', group: 'entity', name, value })));

const DIRECTOR_VALUES: Record<DirectorField, string> = {
  name: 'Jane', designation: 'MD', bvn: '1', nin: '2', shareholdingPercent: '60', nationality: 'Nigerian',
  pep: 'no', residentialAddress: '1 Rd',
};
const fillDirector = (s: AppState, index: number) =>
  run(s, ...DIRECTOR_FIELDS.map((name): Action => ({ type: 'setDirectorField', index, name, value: DIRECTOR_VALUES[name] })));

const SCALARS = Object.entries(validPerson).filter(([, v]) => typeof v === 'string' && v !== '');
const fillPerson = (s: AppState) =>
  run(
    s,
    ...SCALARS.map(([name, value]): Action => ({ type: 'setField', group: 'person', name, value: value as string })),
    ...validPerson.meansOfId.map((value): Action => ({ type: 'toggleChoice', name: 'meansOfId', value })),
    ...validPerson.expectedTransactionTypes.map((value): Action => ({ type: 'toggleChoice', name: 'expectedTransactionTypes', value })),
  );

describe('reducer: customer type', () => {
  it('starts with no customer type, and ignores form actions until one is chosen', () => {
    const s = initialAppState();
    expect(s.customerType).toBeNull();
    expect(activeForm(s)).toBeNull();
    [
      { type: 'next' }, { type: 'back' }, { type: 'setConsent', value: true }, { type: 'addDirector' },
      { type: 'setField', group: 'entity', name: 'companyName', value: 'x' }, { type: 'touch', name: 'companyName' },
      { type: 'toggleChoice', name: 'meansOfId', value: 'nin' },
    ].forEach((a) => expect(reducer(s, a as Action)).toBe(s));
  });

  it('selectType sets the type and step 1 and clears touched/errors', () => {
    const s = run(initialAppState(), { type: 'selectType', customerType: 'individual' });
    expect(s.customerType).toBe('individual');
    expect(s.step).toBe(1);
    expect(s.touched).toEqual({});
    expect(s.errors).toEqual({});
    expect(activeForm(s)?.customerType).toBe('individual');
  });

  it('keeps each form\'s data across type switches and never leaks errors or touched keys', () => {
    let s = run(corp(), { type: 'setField', group: 'entity', name: 'companyName', value: 'Acme' }, { type: 'next' });
    expect(Object.keys(s.errors).length).toBeGreaterThan(0);
    s = run(s, { type: 'clearType' }, { type: 'selectType', customerType: 'individual' });
    expect(s.errors).toEqual({});
    expect(s.touched).toEqual({});
    s = run(s, { type: 'setField', group: 'person', name: 'fullName', value: 'Jane' }, { type: 'clearType' }, { type: 'selectType', customerType: 'corporate' });
    expect(s.corporate.entity.companyName).toBe('Acme');
    expect(s.individual.person.fullName).toBe('Jane');
    expect(s.errors).toEqual({});
  });

  it('flowOf and step bounds follow the active flow', () => {
    expect(flowOf(corp())).toBe(FLOWS.corporate);
    expect(flowOf(indiv())).toBe(FLOWS.individual);
    expect(atStep(corp(), 99).step).toBe(5);
    expect(atStep(indiv(), 99).step).toBe(3);
    expect(run(atStep(indiv(), 3), { type: 'next' }).step).toBe(3);
    expect(run(indiv(), { type: 'back' }).step).toBe(1);
  });
});

describe('reducer: corporate entity step', () => {
  it('next on empty step 1 stays and sets errors', () => {
    const s = run(corp(), { type: 'next' });
    expect(s.step).toBe(1);
    expect(s.errors.companyName).toBe('Company name is required.');
  });

  it('next on a valid step 1 advances and clears errors', () => {
    const s = run(fillEntity(corp()), { type: 'next' });
    expect(s.step).toBe(2);
    expect(s.errors).toEqual({});
  });

  it('shows an error only after touch, and clears it when fixed', () => {
    let s = run(corp(), { type: 'setField', group: 'entity', name: 'companyName', value: '' });
    expect(s.errors.companyName).toBeUndefined();
    s = run(s, { type: 'touch', name: 'companyName' });
    expect(s.errors.companyName).toBeTruthy();
    s = run(s, { type: 'setField', group: 'entity', name: 'companyName', value: 'Acme' });
    expect(s.errors.companyName).toBeUndefined();
  });

  it('setField ignores a group the active form does not have', () => {
    const s = corp();
    expect(run(s, { type: 'setField', group: 'person', name: 'fullName', value: 'x' })).toBe(s);
  });
});

describe('reducer: corporate directors', () => {
  it('next with an empty row sets row errors; a filled row advances', () => {
    let s = run(atStep(corp(), 2), { type: 'next' });
    expect(s.step).toBe(2);
    expect(s.errors['directors.0.name']).toBe('Name is required.');
    s = run(fillDirector(s, 0), { type: 'next' });
    expect(s.step).toBe(3);
  });

  it('addDirector then next touches the new row while the first stays valid', () => {
    let s = fillDirector(atStep(corp(), 2), 0);
    s = run(s, { type: 'addDirector' }, { type: 'next' });
    expect(s.step).toBe(2);
    expect(s.errors['directors.1.name']).toBe('Name is required.');
    expect(s.errors['directors.0.name']).toBeUndefined();
  });

  it('removeDirector is a no-op with one row', () => {
    const s = atStep(corp(), 2);
    expect(run(s, { type: 'removeDirector', index: 0 })).toBe(s);
  });

  it('removeDirector drops the chosen row and clears director touched/errors', () => {
    let s = run(atStep(corp(), 2), { type: 'setDirectorField', index: 0, name: 'name', value: 'First' }, { type: 'addDirector' },
      { type: 'setDirectorField', index: 1, name: 'name', value: 'Second' }, { type: 'next' });
    expect(Object.keys(s.errors).some((k) => k.startsWith('directors.'))).toBe(true);
    s = run(s, { type: 'removeDirector', index: 0 });
    expect(s.corporate.directors.map((d) => d.name)).toEqual(['Second']);
    expect(Object.keys(s.touched).some((k) => k.startsWith('directors'))).toBe(false);
    expect(Object.keys(s.errors).some((k) => k.startsWith('directors'))).toBe(false);
  });

  it('addDirector no-ops at 25 rows', () => {
    let s = atStep(corp(), 2);
    for (let i = 0; i < 30; i++) s = run(s, { type: 'addDirector' });
    expect(s.corporate.directors).toHaveLength(25);
  });

  it('setDirectorFile stores a file on the right row', () => {
    const f = new File(['x'], 'id.pdf');
    const s = run(atStep(corp(), 2), { type: 'addDirector' }, { type: 'setDirectorFile', index: 1, fileId: 'id', file: f });
    expect(s.corporate.directors[1].files.id).toBe(f);
    expect(s.corporate.directors[0].files.id).toBeNull();
  });

  it('director and seal actions are ignored when the individual form is active', () => {
    const s = indiv();
    expect(run(s, { type: 'addDirector' })).toBe(s);
    expect(run(s, { type: 'setSeal', file: new File(['x'], 's.png') })).toBe(s);
  });
});

describe('reducer: corporate documents and seal', () => {
  it('blocks the documents step until every document is attached, then lets the user through', () => {
    let s = run(atStep(corp(), 3), { type: 'setConsent', value: true }, { type: 'next' });
    expect(s.step).toBe(3);
    CORPORATE_DOC_IDS.forEach((id) => expect(s.errors[id], id).toBe('This document is required.'));
    s = run(s, ...CORPORATE_DOC_IDS.slice(0, 5).map((id): Action => ({ type: 'setDocFile', id, file: new File(['x'], id + '.pdf') })), { type: 'next' });
    expect(s.step).toBe(3);
    expect(Object.keys(s.errors)).toEqual([CORPORATE_DOC_IDS[5]]);
    s = run(s, { type: 'setDocFile', id: CORPORATE_DOC_IDS[5], file: new File(['x'], 'last.pdf') }, { type: 'next' });
    expect(s.errors).toEqual({});
    expect(s.step).toBe(4);
  });

  it('a bad file type blocks, and attaching a file marks a corporate document as provided', () => {
    const bad = new File(['x'], 'a.exe');
    let s = run(atStep(corp(), 3), { type: 'setDocFile', id: 'cac_forms', file: bad });
    expect(s.corporate.docs.cac_forms).toEqual({ submitted: true, file: bad });
    s = run(s, ...CORPORATE_DOC_IDS.filter((id) => id !== 'cac_forms').map((id): Action => ({ type: 'setDocFile', id, file: new File(['x'], id + '.pdf') })), { type: 'setConsent', value: true }, { type: 'next' });
    expect(s.step).toBe(3);
    expect(s.errors.cac_forms).toBe('File type not allowed: a.exe');
    s = run(s, { type: 'setDocFile', id: 'cac_forms', file: null });
    expect(s.corporate.docs.cac_forms).toEqual({ submitted: false, file: null });
  });

  it('a bad seal blocks the declaration step', () => {
    const s = run(atStep(corp(), 5), { type: 'setSeal', file: new File(['x'], 's.exe') }, { type: 'next' });
    expect(s.errors.sealFile).toBe('File type not allowed: s.exe');
  });

  it('declaration group edits the active form\'s own declaration', () => {
    const c = run(corp(), { type: 'setField', group: 'declaration', name: 'signatory1Name', value: 'A' });
    expect(c.corporate.declaration.signatory1Name).toBe('A');
    const i = run(indiv(), { type: 'setField', group: 'declaration', name: 'declarationName', value: 'B' });
    expect(i.individual.declaration.declarationName).toBe('B');
    expect(i.corporate.declaration.signatory1Name).toBe('');
  });
});

describe('reducer: individual flow', () => {
  it('next on an empty person sets errors; a fully filled person advances through all steps', () => {
    let s = run(indiv(), { type: 'next' });
    expect(s.step).toBe(1);
    expect(s.errors.fullName).toBe('Full name is required.');
    expect(s.errors.meansOfId).toBe('Select at least one means of ID.');
    s = fillPerson(indiv());
    s = run(s, { type: 'setField', group: 'person', name: 'gender', value: 'F' }, { type: 'setField', group: 'person', name: 'sourceOfIncome', value: 'salary' },
      { type: 'setField', group: 'person', name: 'purposeOfRelationship', value: 'loan' }, { type: 'next' });
    expect(s.errors).toEqual({});
    expect(s.step).toBe(2);
    s = run(s, { type: 'next' });
    expect(s.step).toBe(2);
    expect(s.errors.consent).toBeTruthy();
    INDIVIDUAL_DOC_IDS.forEach((id) => expect(s.errors[id], id).toBe('This document is required.'));
    s = run(s, { type: 'setConsent', value: true }, { type: 'next' });
    expect(s.step).toBe(2);
    s = run(s, ...INDIVIDUAL_DOC_IDS.map((id): Action => ({ type: 'setDocFile', id, file: new File(['x'], id + '.pdf') })), { type: 'next' });
    expect(s.errors).toEqual({});
    expect(s.step).toBe(3);
  });

  it('attaching a file marks an individual document as provided, and removing it un-provides it', () => {
    const file = new File(['x'], 'bill.pdf');
    let s = run(indiv(), { type: 'setDocFile', id: 'utility_bill', file });
    expect(s.individual.docs.utility_bill).toEqual({ submitted: true, file });
    s = run(s, { type: 'setDocFile', id: 'utility_bill', file: null });
    expect(s.individual.docs.utility_bill).toEqual({ submitted: false, file: null });
  });

  it('the Next button on the documents step stays blocked until the last document is attached', () => {
    let s = atStep(indiv(), 2);
    s = run(s, { type: 'setConsent', value: true }, ...INDIVIDUAL_DOC_IDS.slice(0, 4).map((id): Action => ({ type: 'setDocFile', id, file: new File(['x'], id + '.pdf') })), { type: 'next' });
    expect(s.step).toBe(2);
    expect(Object.keys(s.errors)).toEqual([INDIVIDUAL_DOC_IDS[4]]);
    s = run(s, { type: 'setDocFile', id: INDIVIDUAL_DOC_IDS[4], file: new File(['x'], 'last.pdf') });
    expect(s.errors).toEqual({});
    expect(run(s, { type: 'next' }).step).toBe(3);
  });

  it('toggleChoice adds, removes, and is ignored while corporate is active', () => {
    let s = run(indiv(), { type: 'toggleChoice', name: 'meansOfId', value: 'nin' }, { type: 'toggleChoice', name: 'meansOfId', value: 'bvn' });
    expect(s.individual.person.meansOfId).toEqual(['nin', 'bvn']);
    s = run(s, { type: 'toggleChoice', name: 'meansOfId', value: 'nin' });
    expect(s.individual.person.meansOfId).toEqual(['bvn']);
    const c = corp();
    expect(run(c, { type: 'toggleChoice', name: 'meansOfId', value: 'nin' })).toBe(c);
  });

  it('leaves no stale Other-text error after switching to another option', () => {
    let s = run(indiv(), { type: 'setField', group: 'person', name: 'sourceOfIncome', value: 'other' }, { type: 'touch', name: 'sourceOfIncomeOther' });
    expect(s.errors.sourceOfIncomeOther).toBe('Please specify the source of income.');
    s = run(s, { type: 'setField', group: 'person', name: 'sourceOfIncome', value: 'salary' });
    expect(s.errors.sourceOfIncomeOther).toBeUndefined();
  });

  it('consent and documents write to the individual form only', () => {
    const s = run(indiv(), { type: 'setConsent', value: true }, { type: 'setDocFile', id: 'valid_means_of_id', file: new File(['x'], 'id.pdf') });
    expect(s.individual.consent).toBe(true);
    expect(s.individual.docs.valid_means_of_id.submitted).toBe(true);
    expect(s.corporate.consent).toBe(false);
  });

  it('serverErrors jump to the earliest owning step, and leave unmatched keys alone', () => {
    expect(run(atStep(indiv(), 3), { type: 'serverErrors', errors: { meansOfId: 'x' } }).step).toBe(1);
    expect(run(atStep(indiv(), 3), { type: 'serverErrors', errors: { signatureDate: 'x', consent: 'y' } }).step).toBe(2);
    expect(run(atStep(indiv(), 3), { type: 'serverErrors', errors: { _total: 'x', customerType: 'z' } }).step).toBe(3);
    expect(run(atStep(indiv(), 3), { type: 'serverErrors', errors: { utility_bill: 'This document is required.' } }).step).toBe(2);
  });

  it('fieldStep maps individual keys', () => {
    expect([fieldStep(FLOWS.individual, 'email'), fieldStep(FLOWS.individual, 'consent'), fieldStep(FLOWS.individual, 'signatureDate')]).toEqual([1, 2, 3]);
    expect(fieldStep(FLOWS.individual, '_total')).toBeNull();
    expect(fieldStep(FLOWS.individual, 'bank_statement')).toBe(2);
  });
});

describe('reducer: drafts, status and corporate server errors', () => {
  it('restoreDraft selects the draft\'s type and applies its values; reset returns to the selector', () => {
    const base = corp();
    base.corporate.entity.companyName = 'Draft Co';
    base.corporate.directors[0].name = 'Jane';
    let s = run(initialAppState(), { type: 'restoreDraft', draft: serialize(base.corporate) });
    expect(s.customerType).toBe('corporate');
    expect(s.corporate.entity.companyName).toBe('Draft Co');
    expect(s.corporate.directors[0].name).toBe('Jane');
    expect(s.draftRestored).toBe(true);

    const ind = indiv();
    ind.individual.person.fullName = 'Jane Doe';
    ind.individual.person.meansOfId = ['nin'];
    s = run(initialAppState(), { type: 'restoreDraft', draft: serialize(ind.individual) });
    expect(s.customerType).toBe('individual');
    expect(s.individual.person.fullName).toBe('Jane Doe');
    expect(s.individual.person.meansOfId).toEqual(['nin']);
    expect(s.draftRestored).toBe(true);

    s = run(s, { type: 'reset' });
    expect(s.customerType).toBeNull();
    expect(s.draftRestored).toBe(false);
    expect(s.individual.person.fullName).toBe('');
  });

  it('corporate serverErrors jump to the earliest step owning an errored field', () => {
    expect(run(atStep(corp(), 5), { type: 'serverErrors', errors: { 'directors.0.name': 'x' } }).step).toBe(2);
    expect(run(atStep(corp(), 5), { type: 'serverErrors', errors: { consent: 'x', tin: 'y' } }).step).toBe(1);
    expect(run(atStep(corp(), 5), { type: 'serverErrors', errors: { tin: 'bad' } }).errors.tin).toBe('bad');
    expect(run(atStep(corp(), 5), { type: 'serverErrors', errors: { _total: 'a', 'directorFile.0.id': 'b', sealFile: 'c', customerType: 'd' } }).step).toBe(5);
    expect(run(atStep(corp(), 5), { type: 'serverErrors', errors: { board_resolution: 'This document is required.' } }).step).toBe(3);
  });

  it('submitting and done update status', () => {
    expect(run(corp(), { type: 'submitting', value: true }).status).toBe('submitting');
    expect(run(corp(), { type: 'submitting', value: true }, { type: 'submitting', value: false }).status).toBe('idle');
    expect(run(corp(), { type: 'done' }).status).toBe('done');
  });

  it('fieldStep and stepErrors map corporate keys to the step validators', () => {
    const flow = corporateFlow;
    expect([fieldStep(flow, 'signatureAgree'), fieldStep(flow, 'consent'), fieldStep(flow, 'directors.7.pep')]).toEqual([5, 3, 2]);
    expect(fieldStep(flow, 'directorFile.0.id')).toBeNull();
    const s = corp();
    expect(stepErrors(s.corporate, flow, 5).signatory1Name).toBeTruthy();
  });
});
