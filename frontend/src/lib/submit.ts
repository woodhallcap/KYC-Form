import type { FormState } from '../types';

export interface SubmitResult {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
}

export function buildFormData(state: FormState): FormData {
  const fd = new FormData();
  const { step1, step3 } = state;
  (Object.keys(step1) as (keyof typeof step1)[]).forEach((name) => {
    if (name === 'legalStatus') {
      if (step1.legalStatus) fd.append('legalStatus', step1.legalStatus);
    } else {
      fd.append(name, step1[name]);
    }
  });
  Object.keys(state.docs).forEach((id) => {
    const doc = state.docs[id];
    if (doc.submitted) fd.append(`documents[${id}][submitted]`, 'on');
    if (doc.file) fd.append(`documents[${id}][file]`, doc.file);
  });
  if (state.consent) fd.append('consent', 'on');
  fd.append('certifyingName', step3.certifyingName);
  fd.append('designation', step3.designation);
  fd.append('signatureName', step3.signatureName);
  if (step3.signatureAgree) fd.append('signatureAgree', 'on');
  return fd;
}

export async function postSubmission(state: FormState, fetchImpl: typeof fetch = fetch): Promise<SubmitResult> {
  const response = await fetchImpl('submit.php', { method: 'POST', body: buildFormData(state) });
  return response.json();
}
