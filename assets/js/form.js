(function () {
  'use strict';

  var V = window.WoodhallValidation;
  var form = document.getElementById('kyc-form');
  var steps = Array.prototype.slice.call(document.querySelectorAll('.form-step'));
  var progressSteps = Array.prototype.slice.call(document.querySelectorAll('.progress-step'));
  var confirmation = document.getElementById('confirmation');
  var currentStep = 1;
  var touchedFields = {};
  var STEP_NAMES = { 1: 'Entity Information', 2: 'KYC / CDD Documents', 3: 'Declaration' };
  var progressMobileCurrent = document.getElementById('progress-mobile-current');
  var progressMobileName = document.getElementById('progress-mobile-name');
  var progressMobileFill = document.getElementById('progress-mobile-fill');

  function showStep(stepNumber) {
    steps.forEach(function (section) {
      section.classList.toggle('active', Number(section.dataset.step) === stepNumber);
    });
    progressSteps.forEach(function (el) {
      var n = Number(el.dataset.step);
      el.classList.toggle('active', n === stepNumber);
      el.classList.toggle('complete', n < stepNumber);
    });
    if (progressMobileCurrent) progressMobileCurrent.textContent = stepNumber;
    if (progressMobileName) progressMobileName.textContent = STEP_NAMES[stepNumber] || '';
    if (progressMobileFill) progressMobileFill.style.width = (stepNumber / steps.length * 100) + '%';
    currentStep = stepNumber;
  }

  function stepSection(stepNumber) {
    return steps[stepNumber - 1];
  }

  function clearErrors(stepNumber) {
    stepSection(stepNumber).querySelectorAll('.field').forEach(function (field) {
      field.classList.remove('has-error');
      var errorEl = field.querySelector('.error');
      if (errorEl) errorEl.textContent = '';
    });
  }

  function showErrors(stepNumber, errors) {
    var section = stepSection(stepNumber);
    var unmatched = [];
    Object.keys(errors).forEach(function (key) {
      var field = section.querySelector('[data-field="' + key + '"]');
      if (!field) {
        unmatched.push(errors[key]);
        return;
      }
      field.classList.add('has-error');
      var errorEl = field.querySelector('.error');
      if (errorEl) errorEl.textContent = errors[key];
    });
    if (unmatched.length > 0) {
      alert(unmatched.join('\n'));
    }
  }

  function findStepForField(fieldName) {
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].querySelector('[data-field="' + fieldName + '"]')) return i + 1;
    }
    return null;
  }

  function stepErrors(stepNumber) {
    if (stepNumber === 1) return V.validateStep1(collectStep1()).errors;
    if (stepNumber === 2) {
      var step2Data = collectStep2();
      return V.validateStep2(step2Data.documents, step2Data.consent).errors;
    }
    if (stepNumber === 3) return V.validateStep3(collectStep3()).errors;
    return {};
  }

  function touchAllFieldsInStep(stepNumber) {
    stepSection(stepNumber).querySelectorAll('[data-field]').forEach(function (fieldWrapper) {
      touchedFields[fieldWrapper.dataset.field] = true;
    });
  }

  function revalidateTouchedFields(stepNumber) {
    var errors = stepErrors(stepNumber);
    stepSection(stepNumber).querySelectorAll('[data-field]').forEach(function (fieldWrapper) {
      var key = fieldWrapper.dataset.field;
      if (!touchedFields[key]) return;
      var message = errors[key] || '';
      fieldWrapper.classList.toggle('has-error', !!message);
      var errorEl = fieldWrapper.querySelector('.error');
      if (errorEl) errorEl.textContent = message;
    });
  }

  function attachInlineValidation(stepNumber) {
    stepSection(stepNumber).querySelectorAll('[data-field]').forEach(function (fieldWrapper) {
      var key = fieldWrapper.dataset.field;
      fieldWrapper.querySelectorAll('input, textarea, select').forEach(function (input) {
        input.addEventListener('blur', function () {
          touchedFields[key] = true;
          revalidateTouchedFields(stepNumber);
        });
        input.addEventListener('input', function () {
          if (touchedFields[key]) revalidateTouchedFields(stepNumber);
        });
        if (input.type === 'checkbox' || input.type === 'radio') {
          input.addEventListener('change', function () {
            touchedFields[key] = true;
            revalidateTouchedFields(stepNumber);
          });
        }
      });
    });
  }

  function collectStep1() {
    return {
      companyName: form.companyName.value,
      rcNumber: form.rcNumber.value,
      dateOfIncorporation: form.dateOfIncorporation.value,
      legalStatus: (form.querySelector('input[name="legalStatus"]:checked') || {}).value || '',
      legalStatusOther: form.legalStatusOther.value,
      registeredAddress: form.registeredAddress.value,
      businessAddress: form.businessAddress.value,
      natureOfBusiness: form.natureOfBusiness.value,
      tin: form.tin.value,
      companyEmail: form.companyEmail.value,
      website: form.website.value,
      bankAccountNumber: form.bankAccountNumber.value,
      bankName: form.bankName.value
    };
  }

  function collectStep2() {
    var documents = V.DOCUMENT_IDS.map(function (id) {
      var row = form.querySelector('.document-row[data-doc-id="' + id + '"]');
      var checkbox = row.querySelector('.doc-checkbox');
      var fileInput = row.querySelector('input[type="file"]');
      var file = fileInput.files[0] || null;
      return { id: id, submitted: checkbox.checked, file: file };
    });
    return { documents: documents, consent: form.consent.checked };
  }

  function collectStep3() {
    return {
      certifyingName: form.certifyingName.value,
      designation: form.designation.value,
      signatureName: form.signatureName.value,
      signatureAgree: form.signatureAgree.checked
    };
  }

  function validateCurrentStep() {
    touchAllFieldsInStep(currentStep);
    clearErrors(currentStep);
    if (currentStep === 1) {
      var result1 = V.validateStep1(collectStep1());
      if (!result1.valid) showErrors(1, result1.errors);
      return result1.valid;
    }
    if (currentStep === 2) {
      var step2Data = collectStep2();
      var result2 = V.validateStep2(step2Data.documents, step2Data.consent);
      if (!result2.valid) showErrors(2, result2.errors);
      return result2.valid;
    }
    if (currentStep === 3) {
      var result3 = V.validateStep3(collectStep3());
      if (!result3.valid) showErrors(3, result3.errors);
      return result3.valid;
    }
    return true;
  }

  document.querySelectorAll('[data-action="next"]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (validateCurrentStep()) showStep(currentStep + 1);
    });
  });

  document.querySelectorAll('[data-action="back"]').forEach(function (button) {
    button.addEventListener('click', function () {
      showStep(currentStep - 1);
    });
  });

  var legalStatusOtherInput = document.getElementById('legalStatusOther');
  form.querySelectorAll('input[name="legalStatus"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      legalStatusOtherInput.style.display = radio.checked && radio.value === 'other' ? 'block' : 'none';
    });
  });

  form.querySelectorAll('.document-row').forEach(function (row) {
    var checkbox = row.querySelector('.doc-checkbox');
    checkbox.addEventListener('change', function () {
      row.classList.toggle('checked', checkbox.checked);
    });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!validateCurrentStep()) return;

    var submitButton = form.querySelector('[data-action="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting…';

    var submitterEmail = collectStep1().companyEmail;
    var formData = new FormData(form);

    fetch('submit.php', { method: 'POST', body: formData })
      .then(function (response) { return response.json(); })
      .then(function (payload) {
        if (payload.success) {
          if (autosave) autosave.clearDraft();
          form.hidden = true;
          document.getElementById('progress').hidden = true;
          document.getElementById('progress-mobile').hidden = true;
          document.getElementById('confirmation-email').textContent = submitterEmail;
          confirmation.hidden = false;
        } else {
          submitButton.disabled = false;
          submitButton.textContent = 'Submit Form';
          if (payload.errors && Object.keys(payload.errors).length > 0) {
            var firstStep = null;
            Object.keys(payload.errors).forEach(function (field) {
              var stepNum = findStepForField(field);
              if (stepNum && (firstStep === null || stepNum < firstStep)) firstStep = stepNum;
            });
            if (firstStep) {
              showStep(firstStep);
              clearErrors(firstStep);
              showErrors(firstStep, payload.errors);
            }
          }
          alert(payload.message || 'Submission failed. Please check the form and try again.');
        }
      })
      .catch(function () {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Form';
        alert('Network error. Please try again.');
      });
  });

  attachInlineValidation(1);
  attachInlineValidation(2);
  attachInlineValidation(3);

  var autosave = window.WoodhallAutosave ? window.WoodhallAutosave.init(form) : null;
  if (autosave) {
    var draft = autosave.loadDraft();
    if (autosave.hasAnyContent(draft)) {
      autosave.applyToForm(form, draft);
      var draftBanner = document.getElementById('draft-banner');
      draftBanner.hidden = false;
      document.getElementById('draft-clear').addEventListener('click', function () {
        form.reset();
        form.querySelectorAll('.document-row.checked').forEach(function (row) {
          row.classList.remove('checked');
        });
        legalStatusOtherInput.style.display = 'none';
        autosave.clearDraft();
        draftBanner.hidden = true;
      });
    }
  }

  showStep(1);
})();
