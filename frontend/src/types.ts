export type Errors = Record<string, string>;

export type CustomerType = 'corporate';

export const DIRECTOR_FIELDS = [
  'name', 'designation', 'bvn', 'nin', 'shareholdingPercent', 'nationality', 'pep', 'residentialAddress',
] as const;
export type DirectorField = (typeof DIRECTOR_FIELDS)[number];
export type DirectorFileId = 'id' | 'bvn' | 'nin' | 'proof_of_address';

export interface CorporateEntity {
  companyName: string;
  rcNumber: string;
  dateOfIncorporation: string;
  registeredAddress: string;
  businessAddress: string;
  natureOfBusiness: string;
  tin: string;
  companyEmail: string;
  bankAccountNumber: string;
  bankName: string;
}

export interface Director {
  name: string;
  designation: string;
  bvn: string;
  nin: string;
  shareholdingPercent: string;
  nationality: string;
  residentialAddress: string;
  pep: '' | 'yes' | 'no';
  files: Record<DirectorFileId, File | null>;
}

export interface CorporateFunds {
  sourceOfFunds: string;
  facilityAmount: string;
}

export interface CorporateDeclaration {
  signatory1Name: string;
  signatory1Date: string;
  signatory2Name: string;
  signatory2Date: string;
  signatureAgree: boolean;
}

export interface DocState {
  submitted: boolean;
  file: File | null;
}

export interface FormState {
  entity: CorporateEntity;
  directors: Director[];
  docs: Record<string, DocState>;
  consent: boolean;
  funds: CorporateFunds;
  declaration: CorporateDeclaration;
  seal: File | null;
}
