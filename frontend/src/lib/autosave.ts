import type { FormState, Step1Data, Step3Data } from '../types';

export const STORAGE_KEY = 'woodhall-kyc-draft-v1';

export interface Draft {
  fields: Record<string, string>;
  legalStatus: string;
  documents: Record<string, boolean>;
  consent: boolean;
  signatureAgree: boolean;
}

const STEP1_TEXT_FIELDS: (keyof Step1Data)[] = [
  'companyName', 'rcNumber', 'dateOfIncorporation', 'legalStatusOther', 'registeredAddress',
  'businessAddress', 'natureOfBusiness', 'tin', 'companyEmail', 'website', 'bankAccountNumber', 'bankName',
];
const STEP3_TEXT_FIELDS: (keyof Step3Data & string)[] = ['certifyingName', 'designation', 'signatureName'];

export function serialize(state: FormState): Draft {
  const fields: Record<string, string> = {};
  STEP1_TEXT_FIELDS.forEach((name) => (fields[name] = state.step1[name]));
  STEP3_TEXT_FIELDS.forEach((name) => (fields[name] = state.step3[name] as string));
  const documents: Record<string, boolean> = {};
  Object.keys(state.docs).forEach((id) => (documents[id] = state.docs[id].submitted));
  return {
    fields,
    legalStatus: state.step1.legalStatus,
    documents,
    consent: state.consent,
    signatureAgree: state.step3.signatureAgree,
  };
}

export function loadDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.fields || typeof parsed.fields !== 'object') return null;
    return parsed as Draft;
  } catch {
    return null;
  }
}

export function saveDraft(state: FormState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(state)));
  } catch {
    // Storage full or unavailable — autosave is best-effort.
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

export function hasAnyContent(draft: Draft | null): boolean {
  if (!draft) return false;
  const hasText = Object.values(draft.fields).some((v) => typeof v === 'string' && v.trim() !== '');
  const hasDocs = Object.values(draft.documents || {}).some(Boolean);
  return hasText || !!draft.legalStatus || hasDocs || !!draft.consent || !!draft.signatureAgree;
}

export function applyDraft(state: FormState, draft: Draft): FormState {
  const step1 = { ...state.step1 };
  const step3 = { ...state.step3 };
  STEP1_TEXT_FIELDS.forEach((name) => {
    if (typeof draft.fields[name] === 'string') step1[name] = draft.fields[name];
  });
  STEP3_TEXT_FIELDS.forEach((name) => {
    if (typeof draft.fields[name] === 'string') (step3[name] as string) = draft.fields[name];
  });
  if (typeof draft.legalStatus === 'string') step1.legalStatus = draft.legalStatus;
  step3.signatureAgree = !!draft.signatureAgree;
  const docs = { ...state.docs };
  Object.keys(draft.documents || {}).forEach((id) => {
    if (docs[id] && draft.documents[id]) docs[id] = { ...docs[id], submitted: true };
  });
  return { ...state, step1, step3, docs, consent: !!draft.consent };
}
