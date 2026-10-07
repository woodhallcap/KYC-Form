import type {
  CorporateEntity, CorporateForm, CorporateFunds, Director, DirectorFileId, Errors,
  ImageName, IncomeSource, IndividualForm, IndividualPerson, MeansOfId, Purpose,
} from '../types';
import { CORPORATE_DOCUMENTS, INDIVIDUAL_DOCUMENTS } from './documents';
import type { DocumentSpec } from './documents';

export const ALLOWED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'docx'];
export const IMAGE_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_TOTAL_SIZE = 20 * 1024 * 1024;
export const MAX_DIRECTORS = 25;

export const DOCUMENT_IDS: readonly string[] = CORPORATE_DOCUMENTS.map((d) => d.id);
export const INDIVIDUAL_DOCUMENT_IDS: readonly string[] = INDIVIDUAL_DOCUMENTS.map((d) => d.id);

export const DIRECTOR_FILE_IDS: readonly DirectorFileId[] = ['id', 'bvn', 'nin', 'proof_of_address'];

interface FileMeta {
  name: string;
  size: number;
}

export function isBlank(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

export function validateImageMeta(file: FileMeta): { valid: boolean; error: string | null } {
  const ext = (file.name || '').split('.').pop()!.toLowerCase();
  if (!IMAGE_FILE_EXTENSIONS.includes(ext)) return { valid: false, error: 'Upload a JPG or PNG image.' };
  if (file.size > MAX_FILE_SIZE) return { valid: false, error: 'File exceeds 5MB limit: ' + file.name };
  return { valid: true, error: null };
}

export interface ImageSpec {
  name: ImageName;
  label: string;
  missing: string;
}

export const CORPORATE_IMAGES: readonly ImageSpec[] = [
  { name: 'signatory1SignatureFile', label: 'Authorized Signatory 1 — Handwritten Signature', missing: 'Authorized signatory 1 signature is required.' },
  { name: 'signatory2SignatureFile', label: 'Authorized Signatory 2 — Handwritten Signature', missing: 'Authorized signatory 2 signature is required.' },
  { name: 'sealFile', label: 'Company Seal or Stamp', missing: 'Company seal or stamp is required.' },
];
export const INDIVIDUAL_IMAGES: readonly ImageSpec[] = [
  { name: 'signatureFile', label: 'Handwritten Signature', missing: 'Handwritten signature is required.' },
];

function imageErrors(images: Partial<Record<ImageName, File | null>>, specs: readonly ImageSpec[]): Errors {
  const errors: Errors = {};
  specs.forEach(({ name, missing }) => {
    const file = images[name];
    if (!file) errors[name] = missing;
    else {
      const meta = validateImageMeta(file);
      if (!meta.valid) errors[name] = meta.error as string;
    }
  });
  return errors;
}

/** Only the size matters for the total; per-file problems are reported by their own step. */
function totalError(files: File[]): Errors {
  const total = files.reduce((sum, f) => sum + f.size, 0);
  return total > MAX_TOTAL_SIZE ? { _total: 'Total attachments exceed the 20MB limit.' } : {};
}

function imageUploads(images: Partial<Record<ImageName, File | null>>): { key: string; file: File }[] {
  return Object.entries(images).flatMap(([key, file]) => (file ? [{ key, file }] : []));
}

function directorFileErrors(rows: Director[]): Errors {
  const errors: Errors = {};
  rows.forEach((row, i) => {
    DIRECTOR_FILE_IDS.forEach((id) => {
      const file = row.files[id];
      if (!file) return;
      const meta = validateFileMeta(file);
      if (!meta.valid) errors[`directorFile.${i}.${id}`] = meta.error as string;
    });
  });
  return errors;
}

/** Every file that will be sent: attached documents, directors' files, signature and seal images. */
export function collectUploads(form: CorporateForm): { key: string; file: File }[] {
  const uploads: { key: string; file: File }[] = [];
  DOCUMENT_IDS.forEach((id) => {
    const file = form.docs[id];
    if (file) uploads.push({ key: id, file });
  });
  form.directors.forEach((row, i) => {
    DIRECTOR_FILE_IDS.forEach((fid) => {
      const file = row.files[fid];
      if (file) uploads.push({ key: `directorFile.${i}.${fid}`, file });
    });
  });
  return [...uploads, ...imageUploads(form.images)];
}

/** The individual flow's attached documents. */
export function collectIndividualUploads(form: IndividualForm): { key: string; file: File }[] {
  const docs = INDIVIDUAL_DOCUMENT_IDS.flatMap((id) => {
    const file = form.docs[id];
    return file ? [{ key: id, file }] : [];
  });
  return [...docs, ...imageUploads(form.images)];
}

export function validateEntity(d: Partial<CorporateEntity>): Errors {
  const errors: Errors = {};
  const required: [keyof CorporateEntity, string][] = [
    ['companyName', 'Company name is required.'],
    ['rcNumber', 'Business registration number is required.'],
    ['dateOfIncorporation', 'Date of incorporation is required.'],
    ['registeredAddress', 'Registered address is required.'],
    ['natureOfBusiness', 'Nature of business is required.'],
    ['tin', 'Tax identification number is required.'],
  ];
  required.forEach(([key, message]) => {
    if (isBlank(d[key])) errors[key] = message;
  });
  if (isBlank(d.companyEmail)) errors.companyEmail = 'Company email is required.';
  else if (!isValidEmail(d.companyEmail as string)) errors.companyEmail = 'Enter a valid email address.';
  if (isBlank(d.bankAccountNumber)) errors.bankAccountNumber = 'Corporate bank account number is required.';
  if (isBlank(d.bankName)) errors.bankName = 'Bank name is required.';
  return errors;
}

export function validateDirectors(rows: Director[]): Errors {
  if (rows.length === 0) return { directors: 'Add at least one director, signatory or UBO.' };
  if (rows.length > MAX_DIRECTORS) return { directors: `Too many directors listed (maximum ${MAX_DIRECTORS}).` };
  const errors: Errors = {};
  const required: [keyof Director, string][] = [
    ['name', 'Name is required.'],
    ['designation', 'Designation is required.'],
    ['bvn', 'BVN is required.'],
    ['nin', 'NIN is required.'],
    ['nationality', 'Nationality is required.'],
    ['residentialAddress', 'Residential address is required.'],
  ];
  rows.forEach((row, i) => {
    required.forEach(([key, message]) => {
      if (isBlank(row[key])) errors[`directors.${i}.${key}`] = message;
    });
    const pct = row.shareholdingPercent;
    if (isBlank(pct)) errors[`directors.${i}.shareholdingPercent`] = '% shareholding is required.';
    else if (!/^\d+(\.\d+)?$/.test(pct.trim()) || Number(pct) > 100) {
      errors[`directors.${i}.shareholdingPercent`] = 'Enter a percentage between 0 and 100.';
    }
    if (row.pep !== 'yes' && row.pep !== 'no') errors[`directors.${i}.pep`] = 'Select Yes or No.';
  });
  return { ...errors, ...directorFileErrors(rows) };
}

/** Missing required files and bad files, keyed by document id. */
export function documentErrors(docs: Record<string, File | null>, specs: readonly DocumentSpec[]): Errors {
  const errors: Errors = {};
  specs.forEach(({ id, label, required }) => {
    const file = docs[id];
    if (!file) {
      if (required) errors[id] = `${label} is required.`;
      return;
    }
    const meta = validateFileMeta(file);
    if (!meta.valid) errors[id] = meta.error as string;
  });
  return errors;
}

const consentError = (consent: boolean): Errors => (consent ? {} : { consent: 'Consent to processing is required.' });

export function validateDocuments(form: CorporateForm): Errors {
  return { ...documentErrors(form.docs, CORPORATE_DOCUMENTS), ...consentError(form.consent) };
}

export function validateFunds(d: Partial<CorporateFunds>): Errors {
  const errors: Errors = {};
  if (isBlank(d.sourceOfFunds)) errors.sourceOfFunds = 'Source of funds is required.';
  if (isBlank(d.facilityAmount)) errors.facilityAmount = 'Facility amount requested is required.';
  return errors;
}

export function validateDeclaration(form: CorporateForm): Errors {
  const d = form.declaration;
  const errors: Errors = {};
  ([1, 2] as const).forEach((n) => {
    if (isBlank(d[`signatory${n}Name`])) errors[`signatory${n}Name`] = `Authorized signatory ${n} name is required.`;
    if (isBlank(d[`signatory${n}Date`])) errors[`signatory${n}Date`] = `Authorized signatory ${n} date is required.`;
  });
  if (!d.signatureAgree) errors.signatureAgree = 'You must confirm the attached images are your signatures.';
  return { ...errors, ...imageErrors(form.images, CORPORATE_IMAGES), ...totalError(collectUploads(form).map((u) => u.file)) };
}

export const MEANS_OF_ID_OPTIONS: { value: MeansOfId; label: string }[] = [
  { value: 'nin', label: 'NIN' },
  { value: 'passport', label: "Int'l Passport" },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'voters_card', label: "Voter's Card" },
];

export const INCOME_OPTIONS: { value: Exclude<IncomeSource, ''>; label: string }[] = [
  { value: 'salary', label: 'Salary' },
  { value: 'business', label: 'Business' },
  { value: 'investment', label: 'Investment' },
  { value: 'inheritance', label: 'Inheritance' },
  { value: 'other', label: 'Other' },
];

export const PURPOSE_OPTIONS: { value: Exclude<Purpose, ''>; label: string }[] = [
  { value: 'loan', label: 'Loan' },
  { value: 'lease', label: 'Lease' },
  { value: 'investment', label: 'Investment' },
  { value: 'other', label: 'Other' },
];

export function validateIndividualPerson(p: Partial<IndividualPerson>): Errors {
  const errors: Errors = {};
  const required: [keyof IndividualPerson, string][] = [
    ['fullName', 'Full name is required.'],
    ['dateOfBirth', 'Date of birth is required.'],
    ['placeOfBirth', 'Place of birth is required.'],
    ['nationality', 'Nationality is required.'],
    ['countryOfResidence', 'Country of residence is required.'],
    ['residentialAddress', 'Residential address is required.'],
    ['lga', 'LGA is required.'],
    ['state', 'State is required.'],
    ['phone', 'Phone number is required.'],
    ['bvn', 'BVN is required.'],
    ['nin', 'NIN is required.'],
    ['occupation', 'Occupation is required.'],
    ['employerName', 'Employer/business name is required.'],
    ['officeAddress', 'Office address is required.'],
    ['sourceOfWealth', 'Source of wealth is required.'],
  ];
  required.forEach(([key, message]) => {
    if (isBlank(p[key])) errors[key] = message;
  });
  if (p.gender !== 'M' && p.gender !== 'F') errors.gender = 'Select a gender.';
  if (isBlank(p.email)) errors.email = 'Email is required.';
  else if (!isValidEmail(p.email as string)) errors.email = 'Enter a valid email address.';
  if (isBlank(p.officialEmail)) errors.officialEmail = 'Official email is required.';
  else if (!isValidEmail(p.officialEmail as string)) errors.officialEmail = 'Enter a valid email address.';
  if (!p.meansOfId || p.meansOfId.length === 0) errors.meansOfId = 'Select at least one means of ID.';
  if (!p.sourceOfIncome) errors.sourceOfIncome = 'Select a source of income.';
  else if (p.sourceOfIncome === 'other' && isBlank(p.sourceOfIncomeOther)) {
    errors.sourceOfIncomeOther = 'Please specify the source of income.';
  }
  if (!p.purposeOfRelationship) errors.purposeOfRelationship = 'Select the purpose of the relationship.';
  else if (p.purposeOfRelationship === 'other' && isBlank(p.purposeOther)) {
    errors.purposeOther = 'Please specify the purpose.';
  }
  return errors;
}

export function validateIndividualDocuments(form: IndividualForm): Errors {
  return { ...documentErrors(form.docs, INDIVIDUAL_DOCUMENTS), ...consentError(form.consent) };
}

export function validateIndividualDeclaration(form: IndividualForm): Errors {
  const d = form.declaration;
  const errors: Errors = {};
  if (isBlank(d.declarationName)) errors.declarationName = 'Name is required.';
  if (isBlank(d.signatureDate)) errors.signatureDate = 'Signature date is required.';
  if (!d.signatureAgree) errors.signatureAgree = 'You must confirm the attached image is your signature.';
  return { ...errors, ...imageErrors(form.images, INDIVIDUAL_IMAGES), ...totalError(collectIndividualUploads(form).map((u) => u.file)) };
}
