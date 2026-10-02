import { describe, it, expect } from 'vitest';
import {
  validateDeclaration, validateDirectors, validateDocuments, validateEntity, validateFileMeta, validateFunds,
  validateIndividualDeclaration, validateIndividualDocuments, validateIndividualPerson,
} from './validation';
import { INDIVIDUAL_DOCUMENT_IDS } from './validation';
import { CORPORATE_DOC_IDS, bigFile, dir, makeForm, makeIndividual, validEntity, validPerson, withCorporateDocuments, withDocuments } from '../test-utils';

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

describe('validateDocuments (corporate)', () => {
  it('asks for every document, and for consent, when nothing has been attached', () => {
    const e = validateDocuments(makeForm());
    CORPORATE_DOC_IDS.forEach((id) => expect(e[id], id).toBe('This document is required.'));
    expect(e.consent).toBe('Consent to processing is required.');
  });

  it('passes once all six documents are attached and consent is given', () => {
    expect(validateDocuments(withCorporateDocuments(makeForm({ consent: true })))).toEqual({});
  });

  it('names only the documents that are still missing', () => {
    const f = withCorporateDocuments(makeForm({ consent: true }), ['certificate_of_incorporation', 'cac_forms', 'board_resolution']);
    expect(Object.keys(validateDocuments(f)).sort()).toEqual(['company_bank_statement', 'corporate_id_signatories', 'memorandum_articles']);
  });

  it('counts a document as provided when its file is attached, whatever the ticked flag says', () => {
    const f = withCorporateDocuments(makeForm({ consent: true }));
    f.docs.cac_forms = { submitted: false, file: new File(['x'], 'forms.pdf') };
    expect(validateDocuments(f)).toEqual({});
    f.docs.cac_forms = { submitted: true, file: null };
    expect(validateDocuments(f).cac_forms).toBe('This document is required.');
  });

  it('reports a bad file type or size on the document itself, not as missing', () => {
    const f = withCorporateDocuments(makeForm({ consent: true }));
    f.docs.cac_forms = { submitted: true, file: new File(['x'], 'a.exe') };
    f.docs.board_resolution = { submitted: true, file: bigFile('b.pdf', 5.01) };
    const e = validateDocuments(f);
    expect(e.cac_forms).toBe('File type not allowed: a.exe');
    expect(e.board_resolution).toBe('File exceeds 5MB limit: b.pdf');
  });

  it('totals ALL uploads (documents, directors, seal) against 20MB', () => {
    const g = makeForm({ consent: true });
    CORPORATE_DOC_IDS.forEach((id) => {
      g.docs[id] = { submitted: true, file: bigFile(id + '.pdf', 2) };
    });
    g.directors[0].files.id = bigFile('b.pdf', 2.5);
    g.directors[0].files.nin = bigFile('c.pdf', 2.5);
    g.directors[0].files.bvn = bigFile('d.pdf', 2.5);
    expect(validateDocuments(g)._total).toBeUndefined();
    g.seal = bigFile('e.png', 2.5);
    expect(validateDocuments(g)._total).toBe('Total attachments exceed the 20MB limit.');
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
      'meansOfId', 'idNumber', 'bvn', 'nin', 'occupation', 'employerName', 'officeAddress', 'sourceOfIncome', 'sourceOfWealth', 'purposeOfRelationship',
      'expectedMonthlyTurnover', 'expectedTransactionTypes'].forEach((k) => expect(e[k], k).toBeTruthy());
    ['idExpiry', 'sourceOfIncomeOther', 'purposeOther'].forEach((k) => expect(e[k], k).toBeUndefined());
  });

  it('requires employer and office address, so only the ID expiry date is optional in items 1 to 8', () => {
    const e = validateIndividualPerson({ ...validPerson, employerName: '', officeAddress: '   ' });
    expect(e.employerName).toBe('Employer or business name is required.');
    expect(e.officeAddress).toBe('Office address is required.');
    expect(validateIndividualPerson({ ...validPerson, idExpiry: '' })).toEqual({});
    expect(validateIndividualPerson({ ...validPerson, idExpiry: '2030-06-30' })).toEqual({});
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
  it('lists the five documents, with utility bill and bank statement separate', () => {
    expect(INDIVIDUAL_DOCUMENT_IDS).toEqual(['valid_means_of_id', 'utility_bill', 'bank_statement', 'passport_photograph', 'signature_mandate_card']);
  });

  it('asks for every document, and for consent, when nothing has been attached', () => {
    const e = validateIndividualDocuments(makeIndividual());
    INDIVIDUAL_DOCUMENT_IDS.forEach((id) => expect(e[id], id).toBe('This document is required.'));
    expect(e.consent).toBe('Consent to processing is required.');
  });

  it('passes once every document is attached and consent is given', () => {
    expect(validateIndividualDocuments(withDocuments(makeIndividual({ consent: true })))).toEqual({});
  });

  it('names only the documents that are still missing', () => {
    const f = withDocuments(makeIndividual({ consent: true }), ['valid_means_of_id', 'bank_statement', 'signature_mandate_card']);
    const e = validateIndividualDocuments(f);
    expect(Object.keys(e).sort()).toEqual(['passport_photograph', 'utility_bill']);
  });

  it('counts a document as provided when its file is attached, whatever the ticked flag says', () => {
    const f = withDocuments(makeIndividual({ consent: true }));
    f.docs.utility_bill = { submitted: false, file: new File(['x'], 'bill.pdf') };
    expect(validateIndividualDocuments(f)).toEqual({});
    f.docs.utility_bill = { submitted: true, file: null };
    expect(validateIndividualDocuments(f).utility_bill).toBe('This document is required.');
  });

  it('reports a bad file type or size on the document itself, not as missing', () => {
    const f = withDocuments(makeIndividual({ consent: true }));
    f.docs.valid_means_of_id = { submitted: true, file: new File(['x'], 'a.exe') };
    f.docs.passport_photograph = { submitted: true, file: bigFile('p.pdf', 5.01) };
    const e = validateIndividualDocuments(f);
    expect(e.valid_means_of_id).toBe('File type not allowed: a.exe');
    expect(e.passport_photograph).toBe('File exceeds 5MB limit: p.pdf');
  });

  it('applies the 20MB total: five 3.9MB files pass, five 4.5MB files do not', () => {
    const sized = (mb: number) => {
      const f = makeIndividual({ consent: true });
      INDIVIDUAL_DOCUMENT_IDS.forEach((id) => {
        f.docs[id] = { submitted: true, file: bigFile(id + '.pdf', mb) };
      });
      return f;
    };
    expect(validateIndividualDocuments(sized(3.9))).toEqual({});
    expect(validateIndividualDocuments(sized(4.5))._total).toBe('Total attachments exceed the 20MB limit.');
  });
});

describe('validateIndividualDeclaration', () => {
  it('requires name, signature, date and agreement', () => {
    const e = validateIndividualDeclaration({});
    ['declarationName', 'signatureName', 'signatureDate', 'signatureAgree'].forEach((k) => expect(e[k]).toBeTruthy());
    expect(validateIndividualDeclaration({ declarationName: 'A', signatureName: 'A', signatureDate: '2026-01-01', signatureAgree: true })).toEqual({});
  });
});
