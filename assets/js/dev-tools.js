(function () {
  'use strict';

  var isDevHost = ['localhost', '127.0.0.1', ''].indexOf(window.location.hostname) !== -1;
  if (!isDevHost) return;

  var form = document.getElementById('kyc-form');
  if (!form) return;

  function setValue(name, value) {
    if (form[name]) form[name].value = value;
  }

  function check(el) {
    if (!el) return;
    el.checked = true;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'dev-prefill-button';
  button.textContent = 'Fill test data (dev only)';

  button.addEventListener('click', function () {
    setValue('companyName', 'Acme Trading Ltd');
    setValue('rcNumber', 'RC1234567');
    setValue('dateOfIncorporation', '2015-04-01');
    check(form.querySelector('input[name="legalStatus"][value="private"]'));
    setValue('registeredAddress', '12 Marina Road, Lagos Island, Lagos');
    setValue('natureOfBusiness', 'Import/export trade finance');
    setValue('tin', '12345678-0001');
    setValue('companyEmail', 'finance@acmetrading.com');
    setValue('website', 'https://acmetrading.com');
    setValue('bankAccountNumber', '0123456789');
    setValue('bankName', 'First Bank of Nigeria');

    check(form.querySelector('.document-row[data-doc-id="certificate_of_incorporation"] .doc-checkbox'));
    check(form.querySelector('.document-row[data-doc-id="cac_status_report"] .doc-checkbox'));
    check(form.consent);

    setValue('certifyingName', 'Jane Doe');
    setValue('designation', 'Managing Director');
    setValue('signatureName', 'Jane Doe');
    check(form.signatureAgree);

    form.dispatchEvent(new Event('input', { bubbles: true }));
  });

  document.body.appendChild(button);
})();
