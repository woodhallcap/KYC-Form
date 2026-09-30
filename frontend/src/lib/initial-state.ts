import type { DocState, FormState } from '../types';
import { DOCUMENT_IDS } from './validation';

export function initialState(): FormState {
  const docs: Record<string, DocState> = {};
  DOCUMENT_IDS.forEach((id) => {
    docs[id] = { submitted: false, file: null };
  });
  return {
    step1: {
      companyName: '', rcNumber: '', dateOfIncorporation: '', legalStatus: '', legalStatusOther: '',
      registeredAddress: '', businessAddress: '', natureOfBusiness: '', tin: '', companyEmail: '',
      website: '', bankAccountNumber: '', bankName: '',
    },
    docs,
    consent: false,
    step3: { certifyingName: '', designation: '', signatureName: '', signatureAgree: false },
  };
}
