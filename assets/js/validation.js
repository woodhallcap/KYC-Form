(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WoodhallValidation = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ALLOWED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'docx'];
  var MAX_FILE_SIZE = 5 * 1024 * 1024;
  var MAX_TOTAL_SIZE = 20 * 1024 * 1024;

  var DOCUMENT_IDS = [
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
    'aml_certificate'
  ];

  function isBlank(value) {
    return value === undefined || value === null || String(value).trim() === '';
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validateStep1(data) {
    var errors = {};
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
    } else if (!isValidEmail(data.companyEmail)) {
      errors.companyEmail = 'Enter a valid email address.';
    }
    if (isBlank(data.bankAccountNumber)) errors.bankAccountNumber = 'Corporate bank account number is required.';
    if (isBlank(data.bankName)) errors.bankName = 'Bank name is required.';
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  function validateFileMeta(file) {
    var name = file.name || '';
    var ext = name.split('.').pop().toLowerCase();
    if (ALLOWED_FILE_EXTENSIONS.indexOf(ext) === -1) {
      return { valid: false, error: 'File type not allowed: ' + name };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: 'File exceeds 5MB limit: ' + name };
    }
    return { valid: true, error: null };
  }

  function validateStep2(documents, consent) {
    var errors = {};
    var totalSize = 0;
    documents.forEach(function (doc) {
      if (doc.submitted && doc.file) {
        var result = validateFileMeta(doc.file);
        if (!result.valid) {
          errors[doc.id] = result.error;
        } else {
          totalSize += doc.file.size;
        }
      }
    });
    if (totalSize > MAX_TOTAL_SIZE) {
      errors._total = 'Total attachments exceed the 20MB limit.';
    }
    if (!consent) {
      errors.consent = 'Consent to processing is required.';
    }
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  function validateStep3(data) {
    var errors = {};
    if (isBlank(data.certifyingName)) errors.certifyingName = 'Certifying name is required.';
    if (isBlank(data.designation)) errors.designation = 'Designation is required.';
    if (isBlank(data.signatureName)) errors.signatureName = 'Typed signature is required.';
    if (!data.signatureAgree) errors.signatureAgree = 'You must confirm this constitutes your signature.';
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  return {
    ALLOWED_FILE_EXTENSIONS: ALLOWED_FILE_EXTENSIONS,
    MAX_FILE_SIZE: MAX_FILE_SIZE,
    MAX_TOTAL_SIZE: MAX_TOTAL_SIZE,
    DOCUMENT_IDS: DOCUMENT_IDS,
    isBlank: isBlank,
    isValidEmail: isValidEmail,
    validateStep1: validateStep1,
    validateFileMeta: validateFileMeta,
    validateStep2: validateStep2,
    validateStep3: validateStep3
  };
});
