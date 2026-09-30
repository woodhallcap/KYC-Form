import type { Action } from '../lib/reducer';

const step1: Record<string, string> = {
  companyName: 'Acme Trading Ltd',
  rcNumber: 'RC1234567',
  dateOfIncorporation: '2015-04-01',
  legalStatus: 'private',
  registeredAddress: '12 Marina Road, Lagos Island, Lagos',
  natureOfBusiness: 'Import/export trade finance',
  tin: '12345678-0001',
  companyEmail: 'finance@acmetrading.com',
  website: 'https://acmetrading.com',
  bankAccountNumber: '0123456789',
  bankName: 'First Bank of Nigeria',
};

const step3: Record<string, string> = {
  certifyingName: 'Jane Doe',
  designation: 'Managing Director',
  signatureName: 'Jane Doe',
};

export function prefillActions(): Action[] {
  return [
    ...Object.entries(step1).map(([name, value]): Action => ({ type: 'setField', group: 'step1', name, value })),
    { type: 'setDocSubmitted', id: 'certificate_of_incorporation', value: true },
    { type: 'setDocSubmitted', id: 'cac_status_report', value: true },
    { type: 'setConsent', value: true },
    ...Object.entries(step3).map(([name, value]): Action => ({ type: 'setField', group: 'step3', name, value })),
    { type: 'setField', group: 'step3', name: 'signatureAgree', value: true },
  ];
}
