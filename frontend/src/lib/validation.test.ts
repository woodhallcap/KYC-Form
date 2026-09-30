import { describe, it, expect } from 'vitest';
import { DOCUMENT_IDS, validateFileMeta, validateStep1, validateStep2, validateStep3 } from './validation';

const validStep1 = {
  companyName: 'Acme Ltd', rcNumber: 'RC123', dateOfIncorporation: '2020-01-01', legalStatus: 'private',
  registeredAddress: '1 Main St', natureOfBusiness: 'Trading', tin: 'TIN123', companyEmail: 'info@acme.com',
  bankAccountNumber: '0123456789', bankName: 'First Bank',
};

describe('validateStep1', () => {
  it('flags all required fields when empty', () => {
    const r = validateStep1({});
    expect(r.valid).toBe(false);
    expect(r.errors.companyName).toBeTruthy();
    expect(r.errors.companyEmail).toBeTruthy();
  });
  it('passes with all required fields present', () => {
    expect(validateStep1(validStep1).valid).toBe(true);
  });
  it('rejects invalid email', () => {
    expect(validateStep1({ companyEmail: 'not-an-email' }).errors.companyEmail).toBe('Enter a valid email address.');
  });
  it('requires legalStatusOther when legalStatus is other', () => {
    expect(validateStep1({ legalStatus: 'other' }).errors.legalStatusOther).toBeTruthy();
  });
  it('treats whitespace-only values as blank', () => {
    expect(validateStep1({ companyName: '   ' }).errors.companyName).toBe('Company name is required.');
  });
});

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

describe('validateStep2', () => {
  it('requires consent', () => {
    const r = validateStep2([], false);
    expect(r.valid).toBe(false);
    expect(r.errors.consent).toBeTruthy();
  });
  it('flags total attachment size over 20MB', () => {
    const docs = DOCUMENT_IDS.slice(0, 5).map((id) => ({ id, submitted: true, file: { name: id + '.pdf', size: 4.5 * 1024 * 1024 } }));
    expect(validateStep2(docs, true).errors._total).toBeTruthy();
  });
  it('does not count an unsubmitted document toward the total', () => {
    const docs = DOCUMENT_IDS.map((id) => ({ id, submitted: false, file: { name: id + '.pdf', size: 6 * 1024 * 1024 } }));
    expect(validateStep2(docs, true).valid).toBe(true);
  });
  it('attaches file-type errors to the document id', () => {
    const r = validateStep2([{ id: 'utility_bill', submitted: true, file: { name: 'a.exe', size: 1 } }], true);
    expect(r.errors.utility_bill).toBe('File type not allowed: a.exe');
  });
});

describe('validateStep3', () => {
  const base = { certifyingName: 'Jane Doe', designation: 'CEO', signatureName: 'Jane Doe' };
  it('requires signature agreement', () => {
    const r = validateStep3({ ...base, signatureAgree: false });
    expect(r.valid).toBe(false);
    expect(r.errors.signatureAgree).toBeTruthy();
  });
  it('passes with all fields valid', () => {
    expect(validateStep3({ ...base, signatureAgree: true }).valid).toBe(true);
  });
});
