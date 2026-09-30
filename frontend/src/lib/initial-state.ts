import type { Director, DocState, FormState } from '../types';
import { DOCUMENT_IDS } from './validation';

export function emptyDirector(): Director {
  return {
    name: '', designation: '', bvn: '', nin: '', shareholdingPercent: '', nationality: '', pep: '', residentialAddress: '',
    files: { id: null, bvn: null, nin: null, proof_of_address: null },
  };
}

export function initialState(): FormState {
  const docs: Record<string, DocState> = {};
  DOCUMENT_IDS.forEach((id) => {
    docs[id] = { submitted: false, file: null };
  });
  return {
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
