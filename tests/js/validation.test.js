const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../../assets/js/validation.js');

test('validateStep1 flags all required fields when empty', () => {
  const result = V.validateStep1({});
  assert.equal(result.valid, false);
  assert.ok(result.errors.companyName);
  assert.ok(result.errors.companyEmail);
});

test('validateStep1 passes with all required fields present', () => {
  const result = V.validateStep1({
    companyName: 'Acme Ltd',
    rcNumber: 'RC123',
    dateOfIncorporation: '2020-01-01',
    legalStatus: 'private',
    registeredAddress: '1 Main St',
    natureOfBusiness: 'Trading',
    tin: 'TIN123',
    companyEmail: 'info@acme.com',
    bankAccountNumber: '0123456789',
    bankName: 'First Bank'
  });
  assert.equal(result.valid, true);
});

test('validateStep1 rejects invalid email', () => {
  const result = V.validateStep1({ companyEmail: 'not-an-email' });
  assert.equal(result.errors.companyEmail, 'Enter a valid email address.');
});

test('validateStep1 requires legalStatusOther when legalStatus is other', () => {
  const result = V.validateStep1({ legalStatus: 'other' });
  assert.ok(result.errors.legalStatusOther);
});

test('validateFileMeta rejects disallowed extensions', () => {
  const result = V.validateFileMeta({ name: 'virus.exe', size: 100 });
  assert.equal(result.valid, false);
});

test('validateFileMeta rejects oversized files', () => {
  const result = V.validateFileMeta({ name: 'doc.pdf', size: 6 * 1024 * 1024 });
  assert.equal(result.valid, false);
});

test('validateFileMeta accepts a valid pdf under the limit', () => {
  const result = V.validateFileMeta({ name: 'doc.pdf', size: 1024 });
  assert.equal(result.valid, true);
});

test('validateStep2 requires consent', () => {
  const result = V.validateStep2([], false);
  assert.equal(result.valid, false);
  assert.ok(result.errors._consent);
});

test('validateStep2 flags total attachment size over 20MB', () => {
  const documents = V.DOCUMENT_IDS.slice(0, 5).map((id) => ({
    id,
    submitted: true,
    file: { name: id + '.pdf', size: 4.5 * 1024 * 1024 }
  }));
  const result = V.validateStep2(documents, true);
  assert.ok(result.errors._total);
});

test('validateStep3 requires signature agreement', () => {
  const result = V.validateStep3({
    certifyingName: 'Jane Doe',
    designation: 'CEO',
    signatureName: 'Jane Doe',
    signatureAgree: false
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.signatureAgree);
});

test('validateStep3 passes with all fields valid', () => {
  const result = V.validateStep3({
    certifyingName: 'Jane Doe',
    designation: 'CEO',
    signatureName: 'Jane Doe',
    signatureAgree: true
  });
  assert.equal(result.valid, true);
});
