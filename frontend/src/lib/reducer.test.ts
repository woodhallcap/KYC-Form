import { describe, it, expect } from 'vitest';
import { fieldStep, initialAppState, reducer, stepErrors } from './reducer';
import type { Action, AppState } from './reducer';
import { serialize } from './autosave';

const run = (s: AppState, ...actions: Action[]) => actions.reduce(reducer, s);

const fillStep1 = (s: AppState) =>
  run(
    s,
    ...Object.entries({
      companyName: 'Acme', rcNumber: 'RC1', dateOfIncorporation: '2020-01-01', legalStatus: 'private',
      registeredAddress: 'x', natureOfBusiness: 'y', tin: 't', companyEmail: 'a@b.co',
      bankAccountNumber: '1', bankName: 'B',
    }).map(([name, value]): Action => ({ type: 'setField', group: 'step1', name, value })),
  );

describe('reducer', () => {
  it('next on empty step 1 stays and sets errors', () => {
    const s = run(initialAppState(), { type: 'next' });
    expect(s.step).toBe(1);
    expect(s.errors.companyName).toBe('Company name is required.');
  });

  it('next on valid step 1 advances and clears errors', () => {
    const s = run(fillStep1(initialAppState()), { type: 'next' });
    expect(s.step).toBe(2);
    expect(s.errors).toEqual({});
  });

  it('shows an error only after touch, and clears it when fixed', () => {
    let s = run(initialAppState(), { type: 'setField', group: 'step1', name: 'companyName', value: '' });
    expect(s.errors.companyName).toBeUndefined();
    s = run(s, { type: 'touch', name: 'companyName' });
    expect(s.errors.companyName).toBeTruthy();
    s = run(s, { type: 'setField', group: 'step1', name: 'companyName', value: 'Acme' });
    expect(s.errors.companyName).toBeUndefined();
  });

  it('step 2 errors are keyed by document id for bad files', () => {
    let s = fillStep1(initialAppState());
    s = run(s, { type: 'next' }, { type: 'setConsent', value: true },
      { type: 'setDocSubmitted', id: 'utility_bill', value: true },
      { type: 'setDocFile', id: 'utility_bill', file: new File(['x'], 'a.exe') },
      { type: 'next' });
    expect(s.step).toBe(2);
    expect(s.errors.utility_bill).toBe('File type not allowed: a.exe');
  });

  it('back never goes below step 1', () => {
    expect(run(initialAppState(), { type: 'back' }).step).toBe(1);
  });

  it('restoreDraft applies fields and flags the banner; reset clears both', () => {
    const base = initialAppState();
    base.form.step1.companyName = 'Draft Co';
    base.form.step1.legalStatus = 'other';
    const draft = serialize(base.form);
    let s = run(initialAppState(), { type: 'restoreDraft', draft });
    expect(s.form.step1.companyName).toBe('Draft Co');
    expect(s.form.step1.legalStatus).toBe('other');
    expect(s.draftRestored).toBe(true);
    s = run(s, { type: 'reset' });
    expect(s.form.step1.companyName).toBe('');
    expect(s.draftRestored).toBe(false);
  });

  it('serverErrors jumps to the earliest step owning an errored field', () => {
    let s = run(initialAppState(), { type: 'goTo', step: 3 }, { type: 'serverErrors', errors: { tin: 'x' } });
    expect(s.step).toBe(1);
    expect(s.errors.tin).toBe('x');
    s = run(initialAppState(), { type: 'goTo', step: 3 }, { type: 'serverErrors', errors: { consent: 'x', tin: 'y' } });
    expect(s.step).toBe(1);
  });

  it('serverErrors with only unmatched keys does not change step', () => {
    const s = run(initialAppState(), { type: 'goTo', step: 3 }, { type: 'serverErrors', errors: { utility_bill: 'x', _total: 'y' } });
    expect(s.step).toBe(3);
  });

  it('fieldStep maps owning steps and null for unmatched keys', () => {
    expect(fieldStep('signatureAgree')).toBe(3);
    expect(fieldStep('consent')).toBe(2);
    expect(fieldStep('bankName')).toBe(1);
    expect(fieldStep('_total')).toBeNull();
    expect(fieldStep('utility_bill')).toBeNull();
  });

  it('stepErrors maps to the step validators', () => {
    expect(stepErrors(initialAppState().form, 3).certifyingName).toBeTruthy();
  });
});
