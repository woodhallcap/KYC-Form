import { DIRECTOR_FIELDS } from '../types';
import type { CustomerType, Director, FormState } from '../types';
import { emptyDirector } from './initial-state';
import { MAX_DIRECTORS } from './validation';

export const STORAGE_KEY = 'woodhall-kyc-draft-v2';

export interface Draft {
  v: 2;
  customerType: CustomerType;
  entity: Record<string, string>;
  funds: Record<string, string>;
  declaration: Record<string, string | boolean>;
  directors: Record<string, string>[];
  documents: Record<string, boolean>;
  consent: boolean;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Copy only the string-valued keys `base` already has, ignoring anything malformed in `src`. */
function pickStrings<T extends object>(base: T, src: unknown): T {
  const out = { ...base } as Record<string, unknown>;
  if (isObj(src)) {
    Object.keys(base).forEach((k) => {
      if (typeof (base as Record<string, unknown>)[k] === 'string' && typeof src[k] === 'string') out[k] = src[k];
    });
  }
  return out as T;
}

export function serialize(state: FormState): Draft {
  const documents: Record<string, boolean> = {};
  Object.keys(state.docs).forEach((id) => {
    documents[id] = state.docs[id].submitted;
  });
  return {
    v: 2,
    customerType: 'corporate',
    entity: { ...state.entity },
    funds: { ...state.funds },
    declaration: { ...state.declaration },
    directors: state.directors.map((d) => {
      const { files: _files, ...values } = d;
      return values;
    }),
    documents,
    consent: state.consent,
  };
}

export function loadDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isObj(parsed) && parsed.v === 2 ? (parsed as unknown as Draft) : null;
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

export function hasAnyContent(d: Draft | null): boolean {
  if (!d) return false;
  const anyText = (o: unknown) =>
    isObj(o) && Object.values(o).some((v) => (typeof v === 'string' && v.trim() !== '') || v === true);
  const directorHasContent = (row: unknown) =>
    isObj(row) && DIRECTOR_FIELDS.some((f) => typeof row[f] === 'string' && (row[f] as string).trim() !== '');
  return (
    anyText(d.entity) ||
    anyText(d.funds) ||
    anyText(d.declaration) ||
    (Array.isArray(d.directors) && d.directors.some(directorHasContent)) ||
    (isObj(d.documents) && Object.values(d.documents).some((v) => v === true)) ||
    d.consent === true
  );
}

export function applyDraft(state: FormState, d: Draft): FormState {
  const directors: Director[] = Array.isArray(d.directors)
    ? d.directors
        .filter(isObj)
        .slice(0, MAX_DIRECTORS)
        .map((row) => ({
          ...pickStrings(emptyDirector(), row),
          pep: row.pep === 'yes' || row.pep === 'no' ? row.pep : '',
        }))
    : [];
  const docs = { ...state.docs };
  if (isObj(d.documents)) {
    Object.keys(d.documents).forEach((id) => {
      if (docs[id] && d.documents[id] === true) docs[id] = { ...docs[id], submitted: true };
    });
  }
  const declaration = pickStrings(state.declaration, d.declaration);
  declaration.signatureAgree = isObj(d.declaration) && d.declaration.signatureAgree === true;
  return {
    ...state,
    entity: pickStrings(state.entity, d.entity),
    funds: pickStrings(state.funds, d.funds),
    declaration,
    docs,
    directors: directors.length > 0 ? directors : state.directors,
    consent: d.consent === true,
  };
}
