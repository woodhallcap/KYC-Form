import { describe, it, expect } from 'vitest';
import { individualFlow } from './individual';
import { asCorporate, asIndividual } from './narrow';
import { FLOWS } from './corporate';
import { INDIVIDUAL_DOC_IDS, makeForm, makeIndividual } from '../test-utils';

const PERSON_KEYS = [
  'fullName', 'dateOfBirth', 'placeOfBirth', 'gender', 'nationality', 'countryOfResidence', 'residentialAddress', 'lga', 'state', 'phone', 'email',
  'meansOfId', 'idNumber', 'idExpiry', 'bvn', 'nin', 'occupation', 'employerName', 'officeAddress', 'sourceOfIncome', 'sourceOfIncomeOther',
  'sourceOfWealth', 'purposeOfRelationship', 'purposeOther', 'expectedMonthlyTurnover', 'expectedTransactionTypes',
];

describe('individualFlow', () => {
  it('has three steps in order and is registered in FLOWS', () => {
    expect(individualFlow.steps.map((s) => s.id)).toEqual(['person', 'documents', 'declaration']);
    expect(FLOWS.individual).toBe(individualFlow);
  });

  it('ownership maps every person field to step 1, and leaves upload keys unowned', () => {
    const own = (k: string) => individualFlow.steps.findIndex((s) => s.owns(k)) + 1;
    PERSON_KEYS.forEach((k) => expect(own(k), k).toBe(1));
    expect([own('consent'), own('signatureAgree'), own('declarationName'), own('signatureDate')]).toEqual([2, 3, 3, 3]);
    ['_total', 'customerType'].forEach((k) => expect(own(k)).toBe(0));
    INDIVIDUAL_DOC_IDS.forEach((id) => expect(own(id), id).toBe(2));
  });

  it('each step validates its own slice', () => {
    const f = makeIndividual();
    expect(individualFlow.steps[0].validate(f).fullName).toBeTruthy();
    expect(individualFlow.steps[1].validate(f).consent).toBeTruthy();
    expect(individualFlow.steps[2].validate(f).declarationName).toBeTruthy();
  });

  it('touchKeys for the person step cover every person field', () => {
    expect(individualFlow.steps[0].touchKeys(makeIndividual()).sort()).toEqual([...PERSON_KEYS].sort());
  });
});

describe('narrowing helpers', () => {
  it('return the matching form and throw on a mismatch', () => {
    expect(asIndividual(makeIndividual()).customerType).toBe('individual');
    expect(asCorporate(makeForm()).customerType).toBe('corporate');
    expect(() => asCorporate(makeIndividual())).toThrow();
    expect(() => asIndividual(makeForm())).toThrow();
  });
});

describe('individual documents step', () => {
  it('touches the consent box and every document, so a missing one shows its error after Next', () => {
    expect(individualFlow.steps[1].touchKeys(makeIndividual()).sort()).toEqual(['consent', ...INDIVIDUAL_DOC_IDS].sort());
  });

  it('validates every document as required', () => {
    const e = individualFlow.steps[1].validate(makeIndividual());
    INDIVIDUAL_DOC_IDS.forEach((id) => expect(e[id], id).toBe('This document is required.'));
  });
});
