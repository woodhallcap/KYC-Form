import type {
  CorporateForm, CustomerType, DirectorField, DirectorFileId, Errors, FormState, ImageName, IndividualForm, MeansOfId,
} from '../types';
import { FLOWS } from '../flows/corporate';
import type { Flow } from '../flows/types';
import { applyDraft, applyIndividualDraft } from './autosave';
import type { Draft } from './autosave';
import { emptyDirector, initialCorporateForm, initialIndividualForm } from './initial-state';
import { MAX_DIRECTORS } from './validation';

export type FieldGroup = 'entity' | 'funds' | 'declaration' | 'person';
export type ChoiceName = 'meansOfId';

export interface AppState {
  customerType: CustomerType | null;
  corporate: CorporateForm;
  individual: IndividualForm;
  step: number;
  touched: Record<string, boolean>;
  errors: Errors;
  status: 'idle' | 'submitting' | 'done';
  draftRestored: boolean;
}

export type Action =
  | { type: 'selectType'; customerType: CustomerType }
  | { type: 'clearType' }
  | { type: 'setField'; group: FieldGroup; name: string; value: string | boolean }
  | { type: 'toggleChoice'; name: ChoiceName; value: string }
  | { type: 'setConsent'; value: boolean }
  | { type: 'setDocFile'; id: string; file: File | null }
  | { type: 'addDirector' }
  | { type: 'removeDirector'; index: number }
  | { type: 'setDirectorField'; index: number; name: DirectorField; value: string }
  | { type: 'setDirectorFile'; index: number; fileId: DirectorFileId; file: File | null }
  | { type: 'setImage'; name: ImageName; file: File | null }
  | { type: 'touch'; name: string }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'goTo'; step: number }
  | { type: 'serverErrors'; errors: Errors }
  | { type: 'restoreDraft'; draft: Draft }
  | { type: 'reset' }
  | { type: 'submitting'; value: boolean }
  | { type: 'done' };

/** Actions that make sense before a customer type has been chosen. */
const TYPE_FREE_ACTIONS = new Set(['selectType', 'clearType', 'reset', 'restoreDraft', 'submitting', 'done']);

export function activeForm(s: AppState): FormState | null {
  if (s.customerType === 'corporate') return s.corporate;
  if (s.customerType === 'individual') return s.individual;
  return null;
}

/** Callers must check `customerType` first; null falls back to corporate so the result is never undefined. */
export function flowOf(s: { customerType: CustomerType | null }): Flow {
  return FLOWS[s.customerType ?? 'corporate'];
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
  return {
    customerType: null,
    corporate: initialCorporateForm(),
    individual: initialIndividualForm(),
    step: 1,
    touched: {},
    errors: {},
    status: 'idle',
    draftRestored: false,
  };
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
  const next = form.customerType === 'corporate' ? { ...s, corporate: form } : { ...s, individual: form };
  return { ...next, touched, errors: visibleErrors(form, flowOf(s), s.step, touched) };
}

function updateDirector(
  s: AppState,
  index: number,
  patch: (d: CorporateForm['directors'][number]) => CorporateForm['directors'][number],
): AppState {
  if (index < 0 || index >= s.corporate.directors.length) return s;
  const directors = s.corporate.directors.map((d, i) => (i === index ? patch(d) : d));
  return withForm(s, { ...s.corporate, directors });
}

const resetNavigation = { step: 1, touched: {}, errors: {} };

export function reducer(s: AppState, a: Action): AppState {
  if (s.customerType === null && !TYPE_FREE_ACTIONS.has(a.type)) return s;
  const flow = flowOf(s);
  const form = activeForm(s);

  switch (a.type) {
    case 'selectType':
      return { ...s, ...resetNavigation, customerType: a.customerType };
    case 'clearType':
      return { ...s, ...resetNavigation, customerType: null };
    case 'setField': {
      if (!form || !(a.group in form)) return s;
      const group = (form as unknown as Record<string, object>)[a.group];
      return withForm(s, { ...form, [a.group]: { ...group, [a.name]: a.value } } as FormState);
    }
    case 'toggleChoice': {
      if (s.customerType !== 'individual') return s;
      const current: string[] = s.individual.person.meansOfId;
      const next = (current.includes(a.value) ? current.filter((v) => v !== a.value) : [...current, a.value]) as MeansOfId[];
      return withForm(s, { ...s.individual, person: { ...s.individual.person, meansOfId: next } });
    }
    case 'setConsent':
      return form ? withForm(s, { ...form, consent: a.value }) : s;
    case 'setDocFile':
      return form ? withForm(s, { ...form, docs: { ...form.docs, [a.id]: a.file } }) : s;
    case 'addDirector':
      if (s.customerType !== 'corporate' || s.corporate.directors.length >= MAX_DIRECTORS) return s;
      return withForm(s, { ...s.corporate, directors: [...s.corporate.directors, emptyDirector()] });
    case 'removeDirector': {
      if (s.customerType !== 'corporate') return s;
      const rows = s.corporate.directors;
      if (rows.length <= 1 || a.index < 0 || a.index >= rows.length) return s;
      // Touched keys are index-based, so drop them all rather than let errors slide onto a different row.
      const touched = Object.fromEntries(Object.entries(s.touched).filter(([k]) => !k.startsWith('directors')));
      return withForm(s, { ...s.corporate, directors: rows.filter((_, i) => i !== a.index) }, touched);
    }
    case 'setDirectorField':
      return s.customerType === 'corporate' ? updateDirector(s, a.index, (d) => ({ ...d, [a.name]: a.value })) : s;
    case 'setDirectorFile':
      return s.customerType === 'corporate'
        ? updateDirector(s, a.index, (d) => ({ ...d, files: { ...d.files, [a.fileId]: a.file } }))
        : s;
    case 'setImage':
      return form ? withForm(s, { ...form, images: { ...form.images, [a.name]: a.file } } as FormState) : s;
    case 'touch': {
      if (!form) return s;
      const touched = { ...s.touched, [a.name]: true };
      return { ...s, touched, errors: visibleErrors(form, flow, s.step, touched) };
    }
    case 'next': {
      if (!form) return s;
      const current = flow.steps[s.step - 1];
      const touched = { ...s.touched };
      current.touchKeys(form).forEach((k) => {
        touched[k] = true;
      });
      const errors = current.validate(form);
      if (Object.keys(errors).length > 0) return { ...s, touched, errors };
      return { ...s, touched, step: Math.min(flow.steps.length, s.step + 1), errors: {} };
    }
    case 'back': {
      if (!form) return s;
      const step = Math.max(1, s.step - 1);
      return { ...s, step, errors: visibleErrors(form, flow, step, s.touched) };
    }
    case 'goTo': {
      if (!form) return s;
      const step = Math.min(flow.steps.length, Math.max(1, a.step));
      return { ...s, step, errors: visibleErrors(form, flow, step, s.touched) };
    }
    case 'serverErrors': {
      const steps = Object.keys(a.errors)
        .map((k) => fieldStep(flow, k))
        .filter((n): n is number => n !== null);
      return { ...s, step: steps.length > 0 ? Math.min(...steps) : s.step, errors: a.errors };
    }
    case 'restoreDraft':
      return a.draft.customerType === 'individual'
        ? { ...s, customerType: 'individual', individual: applyIndividualDraft(s.individual, a.draft), draftRestored: true }
        : { ...s, customerType: 'corporate', corporate: applyDraft(s.corporate, a.draft), draftRestored: true };
    case 'reset':
      return initialAppState();
    case 'submitting':
      return { ...s, status: a.value ? 'submitting' : 'idle' };
    case 'done':
      return { ...s, status: 'done' };
  }
}
