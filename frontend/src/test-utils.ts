import { DOCUMENT_IDS, INDIVIDUAL_DOCUMENT_IDS } from './lib/validation';
import type { CorporateEntity, CorporateForm, Director, IndividualForm, IndividualPerson } from './types';

export const validEntity: CorporateEntity = {
  companyName: 'Acme Ltd', rcNumber: 'RC1', dateOfIncorporation: '2020-01-01', registeredAddress: '1 Main St',
  businessAddress: '', natureOfBusiness: 'Trading', tin: 'T1', companyEmail: 'info@acme.com',
  bankAccountNumber: '01', bankName: 'First Bank',
};

/** A valid director row (pep answered, no files). */
export function dir(o: Partial<Director> = {}): Director {
  return {
    name: 'Jane', designation: 'MD', bvn: '1', nin: '2', shareholdingPercent: '50', nationality: 'Nigerian',
    residentialAddress: '1 Rd', pep: 'no', files: { id: null, bvn: null, nin: null, proof_of_address: null }, ...o,
  };
}

/** A complete but EMPTY form (one blank-valued director row that is otherwise valid). */
export function makeForm(o: Partial<CorporateForm> = {}): CorporateForm {
  const docs: CorporateForm['docs'] = Object.fromEntries(DOCUMENT_IDS.map((id) => [id, null]));
  return {
    customerType: 'corporate',
    entity: { companyName: '', rcNumber: '', dateOfIncorporation: '', registeredAddress: '', businessAddress: '', natureOfBusiness: '', tin: '', companyEmail: '', bankAccountNumber: '', bankName: '' },
    directors: [dir()],
    docs, consent: false,
    funds: { sourceOfFunds: '', facilityAmount: '' },
    declaration: { signatory1Name: '', signatory1Date: '', signatory2Name: '', signatory2Date: '', signatureAgree: false },
    seal: null,
    ...o,
  };
}

export const bigFile = (name: string, mb: number) => new File([new Uint8Array(Math.floor(mb * 1024 * 1024))], name);

export { initialCorporateForm as emptyState, initialIndividualForm as emptyIndividual } from './lib/initial-state';

/** A complete, valid person. */
export const validPerson: IndividualPerson = {
  fullName: 'Jane Doe', dateOfBirth: '1990-01-01', placeOfBirth: 'Lagos', nationality: 'Nigerian', countryOfResidence: 'Nigeria',
  residentialAddress: '1 Rd', lga: 'Ikeja', state: 'Lagos', phone: '08000000000', email: 'jane@example.com',
  idNumber: 'A123', idExpiry: '', bvn: '222', nin: '333', occupation: 'Engineer', employerName: '', officeAddress: '',
  sourceOfIncomeOther: '', sourceOfWealth: 'Savings', purposeOther: '', expectedMonthlyTurnover: '500,000',
  gender: 'F', meansOfId: ['nin', 'passport'], sourceOfIncome: 'salary', purposeOfRelationship: 'loan', expectedTransactionTypes: ['transfer'],
};

/** A blank individual form. */
export function makeIndividual(o: Partial<IndividualForm> = {}): IndividualForm {
  const docs: IndividualForm['docs'] = Object.fromEntries(INDIVIDUAL_DOCUMENT_IDS.map((id) => [id, null]));
  return {
    customerType: 'individual',
    person: {
      fullName: '', dateOfBirth: '', placeOfBirth: '', nationality: '', countryOfResidence: '', residentialAddress: '', lga: '', state: '', phone: '', email: '',
      idNumber: '', idExpiry: '', bvn: '', nin: '', occupation: '', employerName: '', officeAddress: '', sourceOfIncomeOther: '', sourceOfWealth: '',
      purposeOther: '', expectedMonthlyTurnover: '', gender: '', meansOfId: [], sourceOfIncome: '', purposeOfRelationship: '', expectedTransactionTypes: [],
    },
    docs, consent: false,
    declaration: { declarationName: '', signatureName: '', signatureDate: '', signatureAgree: false },
    ...o,
  };
}
