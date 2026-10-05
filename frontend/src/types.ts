export type Errors = Record<string, string>;

export type CustomerType = 'corporate' | 'individual';

export const DIRECTOR_FIELDS = [
  'name', 'designation', 'bvn', 'nin', 'shareholdingPercent', 'nationality', 'pep', 'residentialAddress',
] as const;
export type DirectorField = (typeof DIRECTOR_FIELDS)[number];
export type ImageName = 'signatureFile' | 'signatory1SignatureFile' | 'signatory2SignatureFile' | 'sealFile';
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

export interface CorporateForm {
  customerType: 'corporate';
  entity: CorporateEntity;
  directors: Director[];
  docs: Record<string, File | null>;
  consent: boolean;
  funds: CorporateFunds;
  declaration: CorporateDeclaration;
  images: Record<'signatory1SignatureFile' | 'signatory2SignatureFile' | 'sealFile', File | null>;
}

export type MeansOfId = 'nin' | 'bvn' | 'passport' | 'drivers_license' | 'voters_card';
export type TransactionType = 'cash' | 'transfer' | 'cheque';
export type Gender = '' | 'M' | 'F';
export type IncomeSource = '' | 'salary' | 'business' | 'investment' | 'inheritance' | 'other';
export type Purpose = '' | 'loan' | 'lease' | 'investment' | 'other';

export interface IndividualPerson {
  fullName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  countryOfResidence: string;
  residentialAddress: string;
  lga: string;
  state: string;
  phone: string;
  email: string;
  idNumber: string;
  idExpiry: string;
  bvn: string;
  nin: string;
  occupation: string;
  employerName: string;
  officeAddress: string;
  sourceOfIncomeOther: string;
  sourceOfWealth: string;
  purposeOther: string;
  expectedMonthlyTurnover: string;
  gender: Gender;
  meansOfId: MeansOfId[];
  sourceOfIncome: IncomeSource;
  purposeOfRelationship: Purpose;
  expectedTransactionTypes: TransactionType[];
}

export interface IndividualDeclaration {
  declarationName: string;
  signatureDate: string;
  signatureAgree: boolean;
}

export interface IndividualForm {
  customerType: 'individual';
  person: IndividualPerson;
  docs: Record<string, File | null>;
  consent: boolean;
  declaration: IndividualDeclaration;
  images: Record<'signatureFile', File | null>;
}

export type FormState = CorporateForm | IndividualForm;
