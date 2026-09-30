import type { Errors, Step1Data, Step3Data } from '../types';

export const ALLOWED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'docx'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_TOTAL_SIZE = 20 * 1024 * 1024;

export const DOCUMENT_IDS: readonly string[] = [
  'certificate_of_incorporation',
  'cac_status_report',
  'memorandum_articles',
  'directors_id',
  'bvn_nin',
  'utility_bill',
  'corporate_profile',
  'regulatory_licences',
  'bank_statements',
  'audited_financials',
  'personal_financial_info',
  'aml_certificate',
];

interface Result {
  valid: boolean;
  errors: Errors;
}

interface FileMeta {
  name: string;
  size: number;
}

const result = (errors: Errors): Result => ({ valid: Object.keys(errors).length === 0, errors });

export function isBlank(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateStep1(data: Partial<Step1Data>): Result {
  const errors: Errors = {};
  if (isBlank(data.companyName)) errors.companyName = 'Company name is required.';
  if (isBlank(data.rcNumber)) errors.rcNumber = 'RC number is required.';
  if (isBlank(data.dateOfIncorporation)) errors.dateOfIncorporation = 'Date of incorporation is required.';
  if (isBlank(data.legalStatus)) {
    errors.legalStatus = 'Legal status is required.';
  } else if (data.legalStatus === 'other' && isBlank(data.legalStatusOther)) {
    errors.legalStatusOther = 'Please specify the legal status.';
  }
  if (isBlank(data.registeredAddress)) errors.registeredAddress = 'Registered address is required.';
  if (isBlank(data.natureOfBusiness)) errors.natureOfBusiness = 'Nature of business is required.';
  if (isBlank(data.tin)) errors.tin = 'Tax identification number is required.';
  if (isBlank(data.companyEmail)) {
    errors.companyEmail = 'Company email is required.';
  } else if (!isValidEmail(data.companyEmail as string)) {
    errors.companyEmail = 'Enter a valid email address.';
  }
  if (isBlank(data.bankAccountNumber)) errors.bankAccountNumber = 'Corporate bank account number is required.';
  if (isBlank(data.bankName)) errors.bankName = 'Bank name is required.';
  return result(errors);
}

export function validateFileMeta(file: FileMeta): { valid: boolean; error: string | null } {
  const name = file.name || '';
  const ext = name.split('.').pop()!.toLowerCase();
  if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
    return { valid: false, error: 'File type not allowed: ' + name };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File exceeds 5MB limit: ' + name };
  }
  return { valid: true, error: null };
}

export function validateStep2(
  documents: { id: string; submitted: boolean; file: FileMeta | null }[],
  consent: boolean,
): Result {
  const errors: Errors = {};
  let totalSize = 0;
  documents.forEach((doc) => {
    if (doc.submitted && doc.file) {
      const meta = validateFileMeta(doc.file);
      if (!meta.valid) {
        errors[doc.id] = meta.error as string;
      } else {
        totalSize += doc.file.size;
      }
    }
  });
  if (totalSize > MAX_TOTAL_SIZE) errors._total = 'Total attachments exceed the 20MB limit.';
  if (!consent) errors.consent = 'Consent to processing is required.';
  return result(errors);
}

export function validateStep3(data: Partial<Step3Data>): Result {
  const errors: Errors = {};
  if (isBlank(data.certifyingName)) errors.certifyingName = 'Certifying name is required.';
  if (isBlank(data.designation)) errors.designation = 'Designation is required.';
  if (isBlank(data.signatureName)) errors.signatureName = 'Typed signature is required.';
  if (!data.signatureAgree) errors.signatureAgree = 'You must confirm this constitutes your signature.';
  return result(errors);
}
