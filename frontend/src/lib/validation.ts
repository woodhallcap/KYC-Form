import type {
  CorporateDeclaration, CorporateEntity, CorporateFunds, Director, DirectorFileId, Errors, FormState,
} from '../types';

export const ALLOWED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'docx'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_TOTAL_SIZE = 20 * 1024 * 1024;
export const MAX_DIRECTORS = 25;

export const DOCUMENT_IDS: readonly string[] = [
  'certificate_of_incorporation',
  'cac_forms',
  'memorandum_articles',
  'board_resolution',
  'company_bank_statement',
  'corporate_id_signatories',
];

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

/** Every file that will be sent: ticked documents, directors' files, the seal. */
export function collectUploads(form: FormState): { key: string; file: File }[] {
  const uploads: { key: string; file: File }[] = [];
  DOCUMENT_IDS.forEach((id) => {
    const doc = form.docs[id];
    if (doc && doc.submitted && doc.file) uploads.push({ key: id, file: doc.file });
  });
  form.directors.forEach((row, i) => {
    DIRECTOR_FILE_IDS.forEach((fid) => {
      const file = row.files[fid];
      if (file) uploads.push({ key: `directorFile.${i}.${fid}`, file });
    });
  });
  if (form.seal) uploads.push({ key: 'sealFile', file: form.seal });
  return uploads;
}

export function validateEntity(d: Partial<CorporateEntity>): Errors {
  const errors: Errors = {};
  const required: [keyof CorporateEntity, string][] = [
    ['companyName', 'Company name is required.'],
    ['rcNumber', 'RC number is required.'],
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

export function validateDocuments(form: FormState): Errors {
  const errors: Errors = {};
  let total = 0;
  collectUploads(form).forEach(({ key, file }) => {
    const meta = validateFileMeta(file);
    if (!meta.valid) errors[key] = meta.error as string;
    else total += file.size;
  });
  if (total > MAX_TOTAL_SIZE) errors._total = 'Total attachments exceed the 20MB limit.';
  if (!form.consent) errors.consent = 'Consent to processing is required.';
  return errors;
}

export function validateFunds(d: Partial<CorporateFunds>): Errors {
  const errors: Errors = {};
  if (isBlank(d.sourceOfFunds)) errors.sourceOfFunds = 'Source of funds is required.';
  if (isBlank(d.facilityAmount)) errors.facilityAmount = 'Facility amount requested is required.';
  return errors;
}

export function validateDeclaration(d: Partial<CorporateDeclaration>, seal: File | null): Errors {
  const errors: Errors = {};
  ([1, 2] as const).forEach((n) => {
    if (isBlank(d[`signatory${n}Name`])) errors[`signatory${n}Name`] = `Authorized signatory ${n} name is required.`;
    if (isBlank(d[`signatory${n}Date`])) errors[`signatory${n}Date`] = `Authorized signatory ${n} date is required.`;
  });
  if (!d.signatureAgree) errors.signatureAgree = 'You must confirm this constitutes your signature.';
  if (seal) {
    const meta = validateFileMeta(seal);
    if (!meta.valid) errors.sealFile = meta.error as string;
  }
  return errors;
}
