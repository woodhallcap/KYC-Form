import { describe, it, expect } from 'vitest';
import { individualFlow } from './individual';
import { asCorporate, asIndividual } from './narrow';
import { FLOWS } from './corporate';
import { makeForm, makeIndividual } from '../test-utils';

const PERSON_KEYS = [
  'fullName', 'dateOfBirth', 'placeOfBirth', 'gender', 'nationality', 'countryOfResidence', 'residentialAddress', 'lga', 'state', 'phone', 'email',
  'meansOfId', 'idNumber', 'idExpiry', 'bvn', 'nin', 'occupation', 'employerName', 'officeAddress', 'officialEmail', 'sourceOfIncome', 'sourceOfIncomeOther',
  'sourceOfWealth', 'purposeOfRelationship', 'purposeOther',
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
    expect(own('signatureFile')).toBe(3);
    ['_total', 'customerType'].forEach((k) => expect(own(k)).toBe(0));
  });

  it('ownership maps document ids to the documents step', () => {
    const own = (k: string) => individualFlow.steps.findIndex((s) => s.owns(k)) + 1;
    expect(own('proof_of_address_utility')).toBe(2);
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
