(function () {
  'use strict';

  var STORAGE_KEY = 'woodhall-kyc-draft-v1';
  var DEBOUNCE_MS = 800;

  var TEXT_FIELD_NAMES = [
    'companyName', 'rcNumber', 'dateOfIncorporation', 'legalStatusOther',
    'registeredAddress', 'businessAddress', 'natureOfBusiness', 'tin',
    'companyEmail', 'website', 'bankAccountNumber', 'bankName',
    'certifyingName', 'designation', 'signatureName'
  ];

  function isStorageAvailable() {
    try {
      var testKey = '__woodhall_storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  function serializeForm(form) {
    var data = { fields: {}, legalStatus: '', documents: {}, consent: false, signatureAgree: false };

    TEXT_FIELD_NAMES.forEach(function (name) {
      if (form[name]) data.fields[name] = form[name].value;
    });

    var checkedStatus = form.querySelector('input[name="legalStatus"]:checked');
    data.legalStatus = checkedStatus ? checkedStatus.value : '';

    form.querySelectorAll('.document-row').forEach(function (row) {
      var id = row.dataset.docId;
      var checkbox = row.querySelector('.doc-checkbox');
      data.documents[id] = !!(checkbox && checkbox.checked);
    });

    if (form.consent) data.consent = form.consent.checked;
    if (form.signatureAgree) data.signatureAgree = form.signatureAgree.checked;

    return data;
  }

  function applyToForm(form, data) {
    if (!data) return;

    TEXT_FIELD_NAMES.forEach(function (name) {
      if (form[name] && typeof data.fields[name] === 'string') {
        form[name].value = data.fields[name];
      }
    });

    if (data.legalStatus) {
      var radio = form.querySelector('input[name="legalStatus"][value="' + data.legalStatus + '"]');
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change'));
      }
    }

    Object.keys(data.documents || {}).forEach(function (id) {
      var row = form.querySelector('.document-row[data-doc-id="' + id + '"]');
      if (!row) return;
      var checkbox = row.querySelector('.doc-checkbox');
      if (checkbox && data.documents[id]) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));
      }
    });

    if (form.consent) form.consent.checked = !!data.consent;
    if (form.signatureAgree) form.signatureAgree.checked = !!data.signatureAgree;
  }

  function hasAnyContent(data) {
    if (!data) return false;
    var hasText = TEXT_FIELD_NAMES.some(function (name) {
      return data.fields[name] && data.fields[name].trim() !== '';
    });
    var hasDocs = Object.keys(data.documents || {}).some(function (id) {
      return data.documents[id];
    });
    return hasText || data.legalStatus || hasDocs || data.consent || data.signatureAgree;
  }

  function init(form) {
    if (!isStorageAvailable()) return null;

    var saveTimer = null;

    function save() {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeForm(form)));
      } catch (e) {
        // Storage full or unavailable mid-session — autosave is best-effort.
      }
    }

    function scheduleSave() {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(save, DEBOUNCE_MS);
    }

    form.addEventListener('input', scheduleSave);
    form.addEventListener('change', scheduleSave);

    function clearDraft() {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        // Nothing to clean up if storage is unavailable.
      }
    }

    function loadDraft() {
      try {
        var raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    return { loadDraft: loadDraft, applyToForm: applyToForm, hasAnyContent: hasAnyContent, clearDraft: clearDraft };
  }

  window.WoodhallAutosave = { init: init };
})();
