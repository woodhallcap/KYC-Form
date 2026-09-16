(function () {
  'use strict';

  var V = window.WoodhallValidation;
  var form = document.getElementById('kyc-form');
  var steps = Array.prototype.slice.call(document.querySelectorAll('.form-step'));
  var progressSteps = Array.prototype.slice.call(document.querySelectorAll('.progress-step'));
  var confirmation = document.getElementById('confirmation');
  var currentStep = 1;

  function showStep(stepNumber) {
    steps.forEach(function (section) {
      section.classList.toggle('active', Number(section.dataset.step) === stepNumber);
    });
    progressSteps.forEach(function (el) {
      var n = Number(el.dataset.step);
      el.classList.toggle('active', n === stepNumber);
      el.classList.toggle('complete', n < stepNumber);
    });
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
          form.hidden = true;
          document.getElementById('progress').hidden = true;
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

  showStep(1);
})();
