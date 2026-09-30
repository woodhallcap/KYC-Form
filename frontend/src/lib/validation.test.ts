import { describe, it, expect } from 'vitest';
import {
  validateDeclaration, validateDirectors, validateDocuments, validateEntity, validateFileMeta, validateFunds,
} from './validation';
import { bigFile, dir, makeForm, validEntity } from '../test-utils';

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

describe('validateDocuments', () => {
  it('requires consent', () => {
    expect(validateDocuments(makeForm()).consent).toBe('Consent to processing is required.');
  });

  it('ignores an unticked document even with a bad file', () => {
    const f = makeForm({ consent: true });
    f.docs.cac_forms = { submitted: false, file: bigFile('x.exe', 9) };
    expect(validateDocuments(f)).toEqual({});
  });

  it('blocks a ticked document with a bad file, keyed by document id', () => {
    const f = makeForm({ consent: true });
    f.docs.cac_forms = { submitted: true, file: new File(['x'], 'a.exe') };
    expect(validateDocuments(f).cac_forms).toBe('File type not allowed: a.exe');
  });

  it('totals ALL uploads (documents, directors, seal) against 20MB', () => {
    const g = makeForm({ consent: true });
    g.docs.certificate_of_incorporation = { submitted: true, file: bigFile('a.pdf', 4.5) };
    g.directors[0].files.id = bigFile('b.pdf', 4.5);
    g.directors[0].files.nin = bigFile('c.pdf', 4.5);
    g.directors[0].files.bvn = bigFile('d.pdf', 4.5);
    g.seal = bigFile('e.png', 4.5);
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
