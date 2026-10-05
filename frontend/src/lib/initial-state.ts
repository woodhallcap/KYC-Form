import type { CorporateForm, Director, IndividualForm } from '../types';
import { DOCUMENT_IDS, INDIVIDUAL_DOCUMENT_IDS } from './validation';

export function emptyDirector(): Director {
  return {
    name: '', designation: '', bvn: '', nin: '', shareholdingPercent: '', nationality: '', pep: '', residentialAddress: '',
    files: { id: null, bvn: null, nin: null, proof_of_address: null },
  };
}

export function initialCorporateForm(): CorporateForm {
  const docs: Record<string, File | null> = Object.fromEntries(DOCUMENT_IDS.map((id) => [id, null]));
  return {
    customerType: 'corporate',
    entity: {
      companyName: '', rcNumber: '', dateOfIncorporation: '', registeredAddress: '', businessAddress: '',
      natureOfBusiness: '', tin: '', companyEmail: '', bankAccountNumber: '', bankName: '',
    },
    directors: [emptyDirector()],
    docs,
    consent: false,
    funds: { sourceOfFunds: '', facilityAmount: '' },
    declaration: { signatory1Name: '', signatory1Date: '', signatory2Name: '', signatory2Date: '', signatureAgree: false },
    seal: null,
  };
}

export function initialIndividualForm(): IndividualForm {
  const docs: Record<string, File | null> = Object.fromEntries(INDIVIDUAL_DOCUMENT_IDS.map((id) => [id, null]));
  return {
    customerType: 'individual',
    person: {
      fullName: '', dateOfBirth: '', placeOfBirth: '', nationality: '', countryOfResidence: '', residentialAddress: '', lga: '', state: '',
      phone: '', email: '', idNumber: '', idExpiry: '', bvn: '', nin: '', occupation: '', employerName: '', officeAddress: '',
      sourceOfIncomeOther: '', sourceOfWealth: '', purposeOther: '', expectedMonthlyTurnover: '',
      gender: '', meansOfId: [], sourceOfIncome: '', purposeOfRelationship: '', expectedTransactionTypes: [],
    },
    docs,
    consent: false,
    declaration: { declarationName: '', signatureName: '', signatureDate: '', signatureAgree: false },
  };
}
