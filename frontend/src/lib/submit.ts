import { DIRECTOR_FIELDS } from '../types';
import type { CorporateForm, FormState, IndividualForm } from '../types';
import { DIRECTOR_FILE_IDS, DOCUMENT_IDS, INDIVIDUAL_DOCUMENT_IDS } from './validation';

export interface SubmitResult {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
}

function buildCorporateFormData(state: CorporateForm): FormData {
  const fd = new FormData();
  fd.append('customerType', 'corporate');
  Object.entries(state.entity).forEach(([k, v]) => fd.append(k, v));
  Object.entries(state.funds).forEach(([k, v]) => fd.append(k, v));
  const { signatureAgree, ...signatories } = state.declaration;
  Object.entries(signatories).forEach(([k, v]) => fd.append(k, v));
  if (signatureAgree) fd.append('signatureAgree', 'on');
  if (state.consent) fd.append('consent', 'on');
  // Required documents and images go before director files so they survive if the host caps the upload count.
  appendDocuments(fd, state.docs, DOCUMENT_IDS);
  appendImages(fd, state.images);
  state.directors.forEach((row, i) => {
    DIRECTOR_FIELDS.forEach((f) => fd.append(`directors[${i}][${f}]`, row[f]));
    DIRECTOR_FILE_IDS.forEach((id) => {
      const file = row.files[id];
      if (file) fd.append(`directors[${i}][files][${id}]`, file);
    });
  });
  return fd;
}

function appendImages(fd: FormData, images: Record<string, File | null>): void {
  Object.entries(images).forEach(([k, f]) => {
    if (f) fd.append(k, f);
  });
}

function appendDocuments(fd: FormData, docs: Record<string, File | null>, ids: readonly string[]): void {
  ids.forEach((id) => {
    const file = docs[id];
    if (file) fd.append(`documents[${id}]`, file);
  });
}

function buildIndividualFormData(form: IndividualForm): FormData {
  const fd = new FormData();
  fd.append('customerType', 'individual');
  const { meansOfId, gender, ...scalars } = form.person;
  Object.entries(scalars).forEach(([k, v]) => fd.append(k, v));
  if (gender) fd.append('gender', gender);
  meansOfId.forEach((v) => fd.append('meansOfId[]', v));
  const { signatureAgree, ...declaration } = form.declaration;
  Object.entries(declaration).forEach(([k, v]) => fd.append(k, v));
  if (signatureAgree) fd.append('signatureAgree', 'on');
  if (form.consent) fd.append('consent', 'on');
  appendDocuments(fd, form.docs, INDIVIDUAL_DOCUMENT_IDS);
  appendImages(fd, form.images);
  return fd;
}

export function buildFormData(state: FormState): FormData {
  return state.customerType === 'individual' ? buildIndividualFormData(state) : buildCorporateFormData(state);
}

export async function postSubmission(state: FormState, fetchImpl: typeof fetch = fetch): Promise<SubmitResult> {
  const response = await fetchImpl('submit.php', { method: 'POST', body: buildFormData(state) });
  return response.json();
}
