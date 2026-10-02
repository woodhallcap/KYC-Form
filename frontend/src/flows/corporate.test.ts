import { describe, it, expect } from 'vitest';
import { corporateFlow } from './corporate';
import { CORPORATE_DOC_IDS, dir, makeForm } from '../test-utils';

describe('corporateFlow', () => {
  it('has five steps in order', () => {
    expect(corporateFlow.steps.map((s) => s.id)).toEqual(['entity', 'directors', 'documents', 'funds', 'declaration']);
  });

  it('ownership maps keys to the right step, and leaves upload keys unmatched', () => {
    const own = (k: string) => corporateFlow.steps.findIndex((s) => s.owns(k)) + 1;
    expect([own('companyName'), own('directors'), own('directors.3.name'), own('consent'), own('sourceOfFunds'), own('signatureAgree')]).toEqual([1, 2, 2, 3, 4, 5]);
    ['directorFile.0.id', 'sealFile', '_total', 'customerType'].forEach((k) => expect(own(k)).toBe(0));
    ['certificate_of_incorporation', 'cac_forms', 'corporate_id_signatories'].forEach((k) => expect(own(k), k).toBe(3));
  });

  it('directors touchKeys cover every row and field', () => {
    const f = makeForm();
    f.directors.push(dir());
    const keys = corporateFlow.steps[1].touchKeys(f);
    expect(keys).toContain('directors');
    expect(keys).toContain('directors.1.residentialAddress');
    expect(keys).toHaveLength(1 + 2 * 8);
  });

  it('each step validates its own slice', () => {
    const f = makeForm();
    expect(Object.keys(corporateFlow.steps[0].validate(f)).length).toBeGreaterThan(0);
    expect(corporateFlow.steps[2].validate(f).consent).toBeTruthy();
    expect(corporateFlow.steps[3].validate(f).sourceOfFunds).toBeTruthy();
    expect(corporateFlow.steps[4].validate(f).signatory1Name).toBeTruthy();
  });
});

describe('corporate documents step', () => {
  it('touches the consent box and every document, so a missing one shows its error after Next', () => {
    expect(corporateFlow.steps[2].touchKeys(makeForm()).sort()).toEqual(['consent', ...CORPORATE_DOC_IDS].sort());
  });

  it('validates every document as required', () => {
    const e = corporateFlow.steps[2].validate(makeForm());
    CORPORATE_DOC_IDS.forEach((id) => expect(e[id], id).toBe('This document is required.'));
  });
});
