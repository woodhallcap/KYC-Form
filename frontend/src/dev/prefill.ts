import { DIRECTOR_FIELDS } from '../types';
import type { DirectorField } from '../types';
import type { Action, FieldGroup } from '../lib/reducer';

const entity: Record<string, string> = {
  companyName: 'Acme Trading Ltd',
  rcNumber: 'RC1234567',
  dateOfIncorporation: '2015-04-01',
  registeredAddress: '12 Marina Road, Lagos Island, Lagos',
  natureOfBusiness: 'Import/export trade finance',
  tin: '12345678-0001',
  companyEmail: 'finance@acmetrading.com',
  bankAccountNumber: '0123456789',
  bankName: 'First Bank of Nigeria',
};

const director: Record<DirectorField, string> = {
  name: 'Jane Doe',
  designation: 'Managing Director',
  bvn: '22212345678',
  nin: '12345678901',
  shareholdingPercent: '60',
  nationality: 'Nigerian',
  pep: 'no',
  residentialAddress: '1 Banana Island Road, Ikoyi, Lagos',
};

const funds: Record<string, string> = { sourceOfFunds: 'Proceeds from import/export trade', facilityAmount: '5,000,000' };

const declaration: Record<string, string> = {
  signatory1Name: 'Jane Doe',
  signatory1Date: '2026-09-15',
  signatory2Name: 'John Roe',
  signatory2Date: '2026-09-15',
};

const fields = (group: FieldGroup, values: Record<string, string>): Action[] =>
  Object.entries(values).map(([name, value]): Action => ({ type: 'setField', group, name, value }));

export function prefillActions(): Action[] {
  return [
    ...fields('entity', entity),
    ...DIRECTOR_FIELDS.map((name): Action => ({ type: 'setDirectorField', index: 0, name, value: director[name] })),
    { type: 'setDocSubmitted', id: 'certificate_of_incorporation', value: true },
    { type: 'setDocSubmitted', id: 'cac_forms', value: true },
    { type: 'setConsent', value: true },
    ...fields('funds', funds),
    ...fields('declaration', declaration),
    { type: 'setField', group: 'declaration', name: 'signatureAgree', value: true },
  ];
}
