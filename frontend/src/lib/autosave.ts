import { DIRECTOR_FIELDS } from '../types';
import type { CorporateForm, CustomerType, Director, FormState, IndividualForm, IndividualPerson } from '../types';
import { emptyDirector } from './initial-state';
import { INCOME_OPTIONS, MAX_DIRECTORS, MEANS_OF_ID_OPTIONS, PURPOSE_OPTIONS, TRANSACTION_TYPE_OPTIONS } from './validation';

export const STORAGE_KEY = 'woodhall-kyc-draft-v2';

export interface CorporateDraft {
  v: 2;
  customerType: 'corporate';
  entity: Record<string, string>;
  funds: Record<string, string>;
  declaration: Record<string, string | boolean>;
  directors: Record<string, string>[];
  documents: Record<string, boolean>;
  consent: boolean;
}

export interface IndividualDraft {
  v: 2;
  customerType: 'individual';
  person: Record<string, string | string[]>;
  declaration: Record<string, string | boolean>;
  documents: Record<string, boolean>;
  consent: boolean;
}

export type Draft = CorporateDraft | IndividualDraft;

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

/** Keep only members of `value` that are valid option values. */
function pickOptions<T extends string>(value: unknown, options: { value: T }[]): T[] {
  if (!Array.isArray(value)) return [];
  const allowed = options.map((o) => o.value as string);
  return value.filter((v): v is T => typeof v === 'string' && allowed.includes(v));
}

function pickOption<T extends string>(value: unknown, options: { value: T }[]): T | '' {
  return typeof value === 'string' && options.some((o) => o.value === value) ? (value as T) : '';
}

function serializeCorporate(form: CorporateForm): CorporateDraft {
  return {
    v: 2,
    customerType: 'corporate',
    entity: { ...form.entity },
    funds: { ...form.funds },
    declaration: { ...form.declaration },
    directors: form.directors.map((d) => {
      const { files: _files, ...values } = d;
      return values;
    }),
    documents: {}, // files cannot be saved, so a document is never restored as already provided
    consent: form.consent,
  };
}

function serializeIndividual(form: IndividualForm): IndividualDraft {
  return {
    v: 2,
    customerType: 'individual',
    person: { ...form.person, meansOfId: [...form.person.meansOfId], expectedTransactionTypes: [...form.person.expectedTransactionTypes] },
    declaration: { ...form.declaration },
    documents: {}, // files cannot be saved, so a document is never restored as already provided
    consent: form.consent,
  };
}

export function serialize(form: FormState): Draft {
  return form.customerType === 'individual' ? serializeIndividual(form) : serializeCorporate(form);
}

export function loadDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isObj(parsed) || parsed.v !== 2) return null;
    const type = parsed.customerType as CustomerType | undefined;
    if (type === undefined) return { ...parsed, customerType: 'corporate' } as unknown as Draft;
    return type === 'corporate' || type === 'individual' ? (parsed as unknown as Draft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(form: FormState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(form)));
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

const hasText = (v: unknown) => (typeof v === 'string' && v.trim() !== '') || v === true || (Array.isArray(v) && v.length > 0);
const anyText = (o: unknown) => isObj(o) && Object.values(o).some(hasText);

export function hasAnyContent(d: Draft | null): boolean {
  if (!d) return false;
  if (d.customerType === 'individual') {
    return d.consent === true || anyText(d.person) || anyText(d.declaration);
  }
  const directorHasContent = (row: unknown) =>
    isObj(row) && DIRECTOR_FIELDS.some((f) => typeof row[f] === 'string' && (row[f] as string).trim() !== '');
  return (
    d.consent === true ||
    anyText(d.entity) ||
    anyText(d.funds) ||
    anyText(d.declaration) ||
    (Array.isArray(d.directors) && d.directors.some(directorHasContent))
  );
}

export function applyDraft(form: CorporateForm, d: CorporateDraft): CorporateForm {
  const directors: Director[] = Array.isArray(d.directors)
    ? d.directors
        .filter(isObj)
        .slice(0, MAX_DIRECTORS)
        .map((row) => ({
          ...pickStrings(emptyDirector(), row),
          pep: row.pep === 'yes' || row.pep === 'no' ? row.pep : '',
        }))
    : [];
  const declaration = pickStrings(form.declaration, d.declaration);
  declaration.signatureAgree = isObj(d.declaration) && d.declaration.signatureAgree === true;
  return {
    ...form,
    entity: pickStrings(form.entity, d.entity),
    funds: pickStrings(form.funds, d.funds),
    declaration,
    directors: directors.length > 0 ? directors : form.directors,
    consent: d.consent === true,
  };
}

export function applyIndividualDraft(form: IndividualForm, d: IndividualDraft): IndividualForm {
  const person: IndividualPerson = pickStrings(form.person, d.person);
  const src = isObj(d.person) ? d.person : {};
  person.gender = src.gender === 'M' || src.gender === 'F' ? src.gender : '';
  person.sourceOfIncome = pickOption(src.sourceOfIncome, INCOME_OPTIONS);
  person.purposeOfRelationship = pickOption(src.purposeOfRelationship, PURPOSE_OPTIONS);
  person.meansOfId = pickOptions(src.meansOfId, MEANS_OF_ID_OPTIONS);
  person.expectedTransactionTypes = pickOptions(src.expectedTransactionTypes, TRANSACTION_TYPE_OPTIONS);
  const declaration = pickStrings(form.declaration, d.declaration);
  declaration.signatureAgree = isObj(d.declaration) && d.declaration.signatureAgree === true;
  return { ...form, person, declaration, consent: d.consent === true };
}
