import type { CorporateEntity, Director, FormState } from './types';

export const validEntity: CorporateEntity = {
  companyName: 'Acme Ltd', rcNumber: 'RC1', dateOfIncorporation: '2020-01-01', registeredAddress: '1 Main St',
  businessAddress: '', natureOfBusiness: 'Trading', tin: 'T1', companyEmail: 'info@acme.com',
  bankAccountNumber: '01', bankName: 'First Bank',
};

const DOC_IDS = ['certificate_of_incorporation', 'cac_forms', 'memorandum_articles', 'board_resolution', 'company_bank_statement', 'corporate_id_signatories'];

/** A valid director row (pep answered, no files). */
export function dir(o: Partial<Director> = {}): Director {
  return {
    name: 'Jane', designation: 'MD', bvn: '1', nin: '2', shareholdingPercent: '50', nationality: 'Nigerian',
    residentialAddress: '1 Rd', pep: 'no', files: { id: null, bvn: null, nin: null, proof_of_address: null }, ...o,
  };
}

/** A complete but EMPTY form (one blank-valued director row that is otherwise valid). */
export function makeForm(o: Partial<FormState> = {}): FormState {
  const docs: FormState['docs'] = {};
  DOC_IDS.forEach((id) => { docs[id] = { submitted: false, file: null }; });
  return {
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

export { initialState as emptyState } from './lib/initial-state';
