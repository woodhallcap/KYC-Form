import type { CustomerType, DirectorField, DirectorFileId, Errors, FormState } from '../types';
import { FLOWS } from '../flows/corporate';
import type { Flow } from '../flows/types';
import { applyDraft } from './autosave';
import type { Draft } from './autosave';
import { emptyDirector, initialState } from './initial-state';
import { MAX_DIRECTORS } from './validation';

export type FieldGroup = 'entity' | 'funds' | 'declaration';

export interface AppState {
  customerType: CustomerType;
  form: FormState;
  step: number;
  touched: Record<string, boolean>;
  errors: Errors;
  status: 'idle' | 'submitting' | 'done';
  draftRestored: boolean;
}

export type Action =
  | { type: 'setField'; group: FieldGroup; name: string; value: string | boolean }
  | { type: 'setConsent'; value: boolean }
  | { type: 'setDocSubmitted'; id: string; value: boolean }
  | { type: 'setDocFile'; id: string; file: File | null }
  | { type: 'addDirector' }
  | { type: 'removeDirector'; index: number }
  | { type: 'setDirectorField'; index: number; name: DirectorField; value: string }
  | { type: 'setDirectorFile'; index: number; fileId: DirectorFileId; file: File | null }
  | { type: 'setSeal'; file: File | null }
  | { type: 'touch'; name: string }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'goTo'; step: number }
  | { type: 'serverErrors'; errors: Errors }
  | { type: 'restoreDraft'; draft: Draft }
  | { type: 'reset' }
  | { type: 'submitting'; value: boolean }
  | { type: 'done' };

export function flowOf(s: { customerType: CustomerType }): Flow {
  return FLOWS[s.customerType];
}

export function stepErrors(form: FormState, flow: Flow, step: number): Errors {
  return flow.steps[step - 1].validate(form);
}

/** 1-based step that owns an error/touch key, or null when it has no field of its own (alert-only). */
export function fieldStep(flow: Flow, key: string): number | null {
  const index = flow.steps.findIndex((s) => s.owns(key));
  return index === -1 ? null : index + 1;
}

export function initialAppState(): AppState {
  return { customerType: 'corporate', form: initialState(), step: 1, touched: {}, errors: {}, status: 'idle', draftRestored: false };
}

function visibleErrors(form: FormState, flow: Flow, step: number, touched: Record<string, boolean>): Errors {
  const all = stepErrors(form, flow, step);
  const shown: Errors = {};
  Object.keys(all).forEach((key) => {
    if (touched[key]) shown[key] = all[key];
  });
  return shown;
}

function withForm(s: AppState, form: FormState, touched = s.touched): AppState {
  return { ...s, form, touched, errors: visibleErrors(form, flowOf(s), s.step, touched) };
}

function updateDirector(
  s: AppState,
  index: number,
  patch: (d: FormState['directors'][number]) => FormState['directors'][number],
): AppState {
  if (index < 0 || index >= s.form.directors.length) return s;
  const directors = s.form.directors.map((d, i) => (i === index ? patch(d) : d));
  return withForm(s, { ...s.form, directors });
}

export function reducer(s: AppState, a: Action): AppState {
  const flow = flowOf(s);
  switch (a.type) {
    case 'setField':
      return withForm(s, { ...s.form, [a.group]: { ...s.form[a.group], [a.name]: a.value } } as FormState);
    case 'setConsent':
      return withForm(s, { ...s.form, consent: a.value });
    case 'setDocSubmitted':
      return withForm(s, { ...s.form, docs: { ...s.form.docs, [a.id]: { ...s.form.docs[a.id], submitted: a.value } } });
    case 'setDocFile':
      return withForm(s, { ...s.form, docs: { ...s.form.docs, [a.id]: { ...s.form.docs[a.id], file: a.file } } });
    case 'addDirector':
      return s.form.directors.length >= MAX_DIRECTORS
        ? s
        : withForm(s, { ...s.form, directors: [...s.form.directors, emptyDirector()] });
    case 'removeDirector': {
      if (s.form.directors.length <= 1 || a.index < 0 || a.index >= s.form.directors.length) return s;
      // Touched keys are index-based, so drop them all rather than let errors slide onto a different row.
      const touched = Object.fromEntries(Object.entries(s.touched).filter(([k]) => !k.startsWith('directors')));
      return withForm(s, { ...s.form, directors: s.form.directors.filter((_, i) => i !== a.index) }, touched);
    }
    case 'setDirectorField':
      return updateDirector(s, a.index, (d) => ({ ...d, [a.name]: a.value }));
    case 'setDirectorFile':
      return updateDirector(s, a.index, (d) => ({ ...d, files: { ...d.files, [a.fileId]: a.file } }));
    case 'setSeal':
      return withForm(s, { ...s.form, seal: a.file });
    case 'touch': {
      const touched = { ...s.touched, [a.name]: true };
      return { ...s, touched, errors: visibleErrors(s.form, flow, s.step, touched) };
    }
    case 'next': {
      const current = flow.steps[s.step - 1];
      const touched = { ...s.touched };
      current.touchKeys(s.form).forEach((k) => {
        touched[k] = true;
      });
      const errors = current.validate(s.form);
      if (Object.keys(errors).length > 0) return { ...s, touched, errors };
      return { ...s, touched, step: Math.min(flow.steps.length, s.step + 1), errors: {} };
    }
    case 'back': {
      const step = Math.max(1, s.step - 1);
      return { ...s, step, errors: visibleErrors(s.form, flow, step, s.touched) };
    }
    case 'goTo': {
      const step = Math.min(flow.steps.length, Math.max(1, a.step));
      return { ...s, step, errors: visibleErrors(s.form, flow, step, s.touched) };
    }
    case 'serverErrors': {
      const steps = Object.keys(a.errors)
        .map((k) => fieldStep(flow, k))
        .filter((n): n is number => n !== null);
      return { ...s, step: steps.length > 0 ? Math.min(...steps) : s.step, errors: a.errors };
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
