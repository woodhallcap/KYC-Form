import { DIRECTOR_FIELDS } from '../types';
import type { CustomerType, DirectorField } from '../types';
import type { Action, FieldGroup } from '../lib/reducer';
import { INDIVIDUAL_DOCUMENT_IDS } from '../lib/validation';

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

function corporateActions(): Action[] {
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

const person: Record<string, string> = {
  fullName: 'Jane Doe',
  dateOfBirth: '1990-01-01',
  placeOfBirth: 'Lagos',
  gender: 'F',
  nationality: 'Nigerian',
  countryOfResidence: 'Nigeria',
  residentialAddress: '1 Banana Island Road, Ikoyi, Lagos',
  lga: 'Eti-Osa',
  state: 'Lagos',
  phone: '08012345678',
  email: 'jane@example.com',
  idNumber: 'A12345678',
  idExpiry: '2030-06-30',
  bvn: '22212345678',
  nin: '12345678901',
  occupation: 'Engineer',
  employerName: 'Acme Engineering',
  officeAddress: '4 Adeola Odeku Street, Victoria Island, Lagos',
  sourceOfIncome: 'salary',
  sourceOfWealth: 'Savings and property rental',
  purposeOfRelationship: 'loan',
  expectedMonthlyTurnover: '500,000',
};

const individualDeclaration: Record<string, string> = {
  declarationName: 'Jane Doe',
  signatureName: 'Jane Doe',
  signatureDate: '2026-09-15',
};

function individualActions(): Action[] {
  return [
    ...fields('person', person),
    { type: 'toggleChoice', name: 'meansOfId', value: 'nin' },
    { type: 'toggleChoice', name: 'meansOfId', value: 'passport' },
    { type: 'toggleChoice', name: 'expectedTransactionTypes', value: 'transfer' },
    ...INDIVIDUAL_DOCUMENT_IDS.map((id): Action => ({
      type: 'setDocFile',
      id,
      file: new File(['dev test file'], `${id}.pdf`, { type: 'application/pdf' }),
    })),
    { type: 'setConsent', value: true },
    ...fields('declaration', individualDeclaration),
    { type: 'setField', group: 'declaration', name: 'signatureAgree', value: true },
  ];
}

export function prefillActions(type: CustomerType): Action[] {
  return type === 'individual' ? individualActions() : corporateActions();
}
