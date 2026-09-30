import type { Errors, FormState } from '../types';
import { applyDraft } from './autosave';
import type { Draft } from './autosave';
import { initialState } from './initial-state';
import { DOCUMENT_IDS, validateStep1, validateStep2, validateStep3 } from './validation';

type Step = 1 | 2 | 3;

export interface AppState {
  form: FormState;
  step: Step;
  touched: Record<string, boolean>;
  errors: Errors;
  status: 'idle' | 'submitting' | 'done';
  draftRestored: boolean;
}

export type Action =
  | { type: 'setField'; group: 'step1' | 'step3'; name: string; value: string | boolean }
  | { type: 'setConsent'; value: boolean }
  | { type: 'setDocSubmitted'; id: string; value: boolean }
  | { type: 'setDocFile'; id: string; file: File | null }
  | { type: 'touch'; name: string }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'goTo'; step: Step }
  | { type: 'serverErrors'; errors: Errors }
  | { type: 'restoreDraft'; draft: Draft }
  | { type: 'reset' }
  | { type: 'submitting'; value: boolean }
  | { type: 'done' };

export const STEP_FIELDS: Record<Step, string[]> = {
  1: [
    'companyName', 'rcNumber', 'dateOfIncorporation', 'legalStatus', 'legalStatusOther', 'registeredAddress',
    'businessAddress', 'natureOfBusiness', 'tin', 'companyEmail', 'website', 'bankAccountNumber', 'bankName',
  ],
  2: ['consent'],
  3: ['certifyingName', 'designation', 'signatureName', 'signatureAgree'],
};

export function fieldStep(name: string): Step | null {
  for (const step of [1, 2, 3] as Step[]) {
    if (STEP_FIELDS[step].includes(name)) return step;
  }
  return null;
}

export function stepErrors(form: FormState, step: Step): Errors {
  if (step === 1) return validateStep1(form.step1).errors;
  if (step === 2) {
    const docs = DOCUMENT_IDS.map((id) => ({ id, ...form.docs[id] }));
    return validateStep2(docs, form.consent).errors;
  }
  return validateStep3(form.step3).errors;
}

export function initialAppState(): AppState {
  return { form: initialState(), step: 1, touched: {}, errors: {}, status: 'idle', draftRestored: false };
}

function visibleErrors(form: FormState, step: Step, touched: Record<string, boolean>): Errors {
  const all = stepErrors(form, step);
  const shown: Errors = {};
  Object.keys(all).forEach((key) => {
    if (touched[key]) shown[key] = all[key];
  });
  return shown;
}

function withForm(s: AppState, form: FormState): AppState {
  return { ...s, form, errors: visibleErrors(form, s.step, s.touched) };
}

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'setField': {
      const form = { ...s.form, [a.group]: { ...s.form[a.group], [a.name]: a.value } } as FormState;
      return withForm(s, form);
    }
    case 'setConsent':
      return withForm(s, { ...s.form, consent: a.value });
    case 'setDocSubmitted':
      return withForm(s, { ...s.form, docs: { ...s.form.docs, [a.id]: { ...s.form.docs[a.id], submitted: a.value } } });
    case 'setDocFile':
      return withForm(s, { ...s.form, docs: { ...s.form.docs, [a.id]: { ...s.form.docs[a.id], file: a.file } } });
    case 'touch': {
      const touched = { ...s.touched, [a.name]: true };
      return { ...s, touched, errors: visibleErrors(s.form, s.step, touched) };
    }
    case 'next': {
      const touched = { ...s.touched };
      STEP_FIELDS[s.step].forEach((key) => (touched[key] = true));
      const errors = stepErrors(s.form, s.step);
      if (Object.keys(errors).length > 0) return { ...s, touched, errors };
      const step = Math.min(3, s.step + 1) as Step;
      return { ...s, touched, step, errors: {} };
    }
    case 'back': {
      const step = Math.max(1, s.step - 1) as Step;
      return { ...s, step, errors: visibleErrors(s.form, step, s.touched) };
    }
    case 'goTo':
      return { ...s, step: a.step, errors: visibleErrors(s.form, a.step, s.touched) };
    case 'serverErrors': {
      const steps = Object.keys(a.errors).map(fieldStep).filter((n): n is Step => n !== null);
      const step = steps.length > 0 ? (Math.min(...steps) as Step) : s.step;
      return { ...s, step, errors: a.errors };
    }
    case 'restoreDraft':
      return { ...s, form: applyDraft(s.form, a.draft), draftRestored: true };
    case 'reset':
      return initialAppState();
    case 'submitting':
      return { ...s, status: a.value ? 'submitting' : 'idle' };
    case 'done':
      return { ...s, status: 'done' };
  }
}
