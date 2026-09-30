import { DIRECTOR_FIELDS } from '../types';
import type { FormState } from '../types';
import { DIRECTOR_FILE_IDS, DOCUMENT_IDS } from './validation';

export interface SubmitResult {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
}

export function buildFormData(state: FormState): FormData {
  const fd = new FormData();
  fd.append('customerType', 'corporate');
  Object.entries(state.entity).forEach(([k, v]) => fd.append(k, v));
  Object.entries(state.funds).forEach(([k, v]) => fd.append(k, v));
  const { signatureAgree, ...signatories } = state.declaration;
  Object.entries(signatories).forEach(([k, v]) => fd.append(k, v));
  if (signatureAgree) fd.append('signatureAgree', 'on');
  if (state.consent) fd.append('consent', 'on');
  state.directors.forEach((row, i) => {
    DIRECTOR_FIELDS.forEach((f) => fd.append(`directors[${i}][${f}]`, row[f]));
    DIRECTOR_FILE_IDS.forEach((id) => {
      const file = row.files[id];
      if (file) fd.append(`directors[${i}][files][${id}]`, file);
    });
  });
  DOCUMENT_IDS.forEach((id) => {
    const doc = state.docs[id];
    if (!doc.submitted) return;
    fd.append(`documents[${id}][submitted]`, 'on');
    if (doc.file) fd.append(`documents[${id}][file]`, doc.file);
  });
  if (state.seal) fd.append('sealFile', state.seal);
  return fd;
}

export async function postSubmission(state: FormState, fetchImpl: typeof fetch = fetch): Promise<SubmitResult> {
  const response = await fetchImpl('submit.php', { method: 'POST', body: buildFormData(state) });
  return response.json();
}
