import { describe, it, expect } from 'vitest';
import {
  validateDeclaration, validateDirectors, validateDocuments, validateEntity, validateFileMeta, validateFunds,
  validateIndividualDeclaration, validateIndividualDocuments, validateIndividualPerson,
} from './validation';
import { CORPORATE_DOCUMENTS, INDIVIDUAL_DOCUMENTS } from './documents';
import { bigFile, dir, makeForm, makeIndividual, validEntity, validPerson } from '../test-utils';

describe('validateFileMeta', () => {
  it('rejects disallowed extensions', () => {
    expect(validateFileMeta({ name: 'virus.exe', size: 100 }).valid).toBe(false);
  });
  it('rejects oversized files', () => {
    expect(validateFileMeta({ name: 'doc.pdf', size: 6 * 1024 * 1024 }).valid).toBe(false);
  });
  it('accepts a valid pdf under the limit', () => {
    expect(validateFileMeta({ name: 'doc.pdf', size: 1024 }).valid).toBe(true);
  });
});

describe('validateEntity', () => {
  it('flags required fields, allows empty businessAddress, checks email', () => {
    const e = validateEntity({});
    ['companyName', 'rcNumber', 'dateOfIncorporation', 'registeredAddress', 'natureOfBusiness', 'tin', 'companyEmail', 'bankAccountNumber', 'bankName']
      .forEach((k) => expect(e[k]).toBeTruthy());
    expect(e.businessAddress).toBeUndefined();
    expect(validateEntity(validEntity)).toEqual({});
    expect(validateEntity({ ...validEntity, companyEmail: 'nope' }).companyEmail).toBe('Enter a valid email address.');
    expect(validateEntity({ ...validEntity, companyName: '   ' }).companyName).toBe('Company name is required.');
  });
});

describe('validateDirectors', () => {
  it('needs a row, keys errors by index, caps the list', () => {
    expect(validateDirectors([]).directors).toBe('Add at least one director, signatory or UBO.');
    const e = validateDirectors([dir(), dir({ name: '', pep: '' })]);
    expect(e['directors.1.name']).toBe('Name is required.');
    expect(e['directors.1.pep']).toBe('Select Yes or No.');
    expect(e['directors.0.name']).toBeUndefined();
    expect(validateDirectors(Array.from({ length: 26 }, () => dir())).directors).toBe('Too many directors listed (maximum 25).');
  });

  it('checks percentage boundaries identically to the server', () => {
    ['0', '100', '12.5'].forEach((v) => expect(validateDirectors([dir({ shareholdingPercent: v })])).toEqual({}));
    ['abc', '-1', '101', '1e2'].forEach((v) =>
      expect(validateDirectors([dir({ shareholdingPercent: v })])['directors.0.shareholdingPercent']).toBe('Enter a percentage between 0 and 100.'));
    expect(validateDirectors([dir({ shareholdingPercent: '' })])['directors.0.shareholdingPercent']).toBe('% shareholding is required.');
  });

  it('reports a bad director file under directorFile.<i>.<id>', () => {
    const r = dir();
    r.files.nin = new File(['x'], 'a.exe');
    expect(validateDirectors([r])['directorFile.0.nin']).toBe('File type not allowed: a.exe');
  });
});

const pdf = (name = 'a.pdf') => new File(['x'], name);
const allDocs = (specs: readonly { id: string }[]) => Object.fromEntries(specs.map((d) => [d.id, pdf()]));

describe('validateDocuments (corporate)', () => {
  it('requires every required document and consent, keyed by document id', () => {
    const errors = validateDocuments(makeForm());
    CORPORATE_DOCUMENTS.filter((d) => d.required).forEach((d) => expect(errors[d.id]).toBe(`${d.label} is required.`));
    expect(errors.corporate_id_signatories).toBeUndefined();
    expect(errors.consent).toBeTruthy();
  });
  it('passes with every required file and consent, and checks the type of an optional file', () => {
    const docs = allDocs(CORPORATE_DOCUMENTS.filter((d) => d.required));
    expect(validateDocuments(makeForm({ docs, consent: true }))).toEqual({});
    const bad = validateDocuments(makeForm({ docs: { ...docs, corporate_id_signatories: pdf('x.exe') }, consent: true }));
    expect(bad.corporate_id_signatories).toBe('File type not allowed: x.exe');
  });
  it('rejects an oversized file', () => {
    const docs = { ...allDocs(CORPORATE_DOCUMENTS.filter((d) => d.required)), cac_forms: bigFile('big.pdf', 5.01) };
    expect(validateDocuments(makeForm({ docs, consent: true })).cac_forms).toBe('File exceeds 5MB limit: big.pdf');
  });
});

describe('validateFunds and validateDeclaration', () => {
  it('requires both funds fields', () => {
    expect(Object.keys(validateFunds({}))).toEqual(['sourceOfFunds', 'facilityAmount']);
    expect(validateFunds({ sourceOfFunds: 'Sales', facilityAmount: '5,000,000' })).toEqual({});
  });

  it('requires both signatories, dates and agreement, and checks the seal', () => {
    const e = validateDeclaration({}, null);
    ['signatory1Name', 'signatory1Date', 'signatory2Name', 'signatory2Date', 'signatureAgree'].forEach((k) => expect(e[k]).toBeTruthy());
    const ok = { signatory1Name: 'A', signatory1Date: '2026-01-01', signatory2Name: 'B', signatory2Date: '2026-01-01', signatureAgree: true };
    expect(validateDeclaration(ok, null)).toEqual({});
    expect(validateDeclaration(ok, new File(['x'], 's.exe')).sealFile).toBe('File type not allowed: s.exe');
  });
});

describe('validateIndividualPerson', () => {
  it('flags every required field, but not the optional ones', () => {
    const e = validateIndividualPerson({});
    ['fullName', 'dateOfBirth', 'placeOfBirth', 'gender', 'nationality', 'countryOfResidence', 'residentialAddress', 'lga', 'state', 'phone', 'email',
      'meansOfId', 'idNumber', 'bvn', 'nin', 'occupation', 'sourceOfIncome', 'sourceOfWealth', 'purposeOfRelationship', 'expectedMonthlyTurnover',
      'expectedTransactionTypes'].forEach((k) => expect(e[k], k).toBeTruthy());
    ['idExpiry', 'employerName', 'officeAddress', 'sourceOfIncomeOther', 'purposeOther'].forEach((k) => expect(e[k], k).toBeUndefined());
  });

  it('passes a complete person and checks the email', () => {
    expect(validateIndividualPerson(validPerson)).toEqual({});
    expect(validateIndividualPerson({ ...validPerson, email: 'nope' }).email).toBe('Enter a valid email address.');
  });

  it('requires text for Other, and drops that error when another option is chosen', () => {
    expect(validateIndividualPerson({ ...validPerson, sourceOfIncome: 'other' }).sourceOfIncomeOther).toBe('Please specify the source of income.');
    expect(validateIndividualPerson({ ...validPerson, purposeOfRelationship: 'other' }).purposeOther).toBe('Please specify the purpose.');
    expect(validateIndividualPerson({ ...validPerson, sourceOfIncome: 'other', sourceOfIncomeOther: 'Gift', purposeOfRelationship: 'other', purposeOther: 'Trade' })).toEqual({});
    expect(validateIndividualPerson({ ...validPerson, sourceOfIncome: 'salary', sourceOfIncomeOther: '' }).sourceOfIncomeOther).toBeUndefined();
  });

  it('requires a gender and at least one means of ID and transaction type', () => {
    expect(validateIndividualPerson({ ...validPerson, gender: '' }).gender).toBe('Select a gender.');
    expect(validateIndividualPerson({ ...validPerson, meansOfId: [] }).meansOfId).toBe('Select at least one means of ID.');
    expect(validateIndividualPerson({ ...validPerson, expectedTransactionTypes: [] }).expectedTransactionTypes).toBe('Select at least one transaction type.');
  });
});

describe('validateIndividualDocuments', () => {
  it('requires the five required documents but not work ID, employment letter or mandate card', () => {
    const errors = validateIndividualDocuments(makeIndividual());
    expect(Object.keys(errors).filter((k) => k !== 'consent').sort()).toEqual(
      ['bank_statement_12_months', 'passport_photograph', 'proof_of_address_statement', 'proof_of_address_utility', 'valid_means_of_id'],
    );
    expect(errors.consent).toBeTruthy();
  });
  it('passes with the required files, and blocks a bad optional file', () => {
    const docs = allDocs(INDIVIDUAL_DOCUMENTS.filter((d) => d.required));
    expect(validateIndividualDocuments(makeIndividual({ docs, consent: true }))).toEqual({});
    expect(validateIndividualDocuments(makeIndividual({ docs: { ...docs, work_id: pdf('a.exe') }, consent: true })).work_id).toBe('File type not allowed: a.exe');
  });
});

describe('validateIndividualDeclaration', () => {
  it('requires name, signature, date and agreement', () => {
    const e = validateIndividualDeclaration({});
    ['declarationName', 'signatureName', 'signatureDate', 'signatureAgree'].forEach((k) => expect(e[k]).toBeTruthy());
    expect(validateIndividualDeclaration({ declarationName: 'A', signatureName: 'A', signatureDate: '2026-01-01', signatureAgree: true })).toEqual({});
  });
});
