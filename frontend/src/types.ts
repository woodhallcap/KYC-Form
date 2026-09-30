export type Errors = Record<string, string>;

export interface Step1Data {
  companyName: string;
  rcNumber: string;
  dateOfIncorporation: string;
  legalStatus: string;
  legalStatusOther: string;
  registeredAddress: string;
  businessAddress: string;
  natureOfBusiness: string;
  tin: string;
  companyEmail: string;
  website: string;
  bankAccountNumber: string;
  bankName: string;
}

export interface Step3Data {
  certifyingName: string;
  designation: string;
  signatureName: string;
  signatureAgree: boolean;
}

export interface DocState {
  submitted: boolean;
  file: File | null;
}

export interface FormState {
  step1: Step1Data;
  docs: Record<string, DocState>;
  consent: boolean;
  step3: Step3Data;
}
