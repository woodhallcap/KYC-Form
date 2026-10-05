import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEY, applyDraft, hasAnyContent, loadDraft, saveDraft, serialize } from './autosave';
import { emptyDirector } from './initial-state';
import { emptyIndividual, emptyState } from '../test-utils';
import type { CorporateDraft, IndividualDraft } from './autosave';
import { applyIndividualDraft } from './autosave';

beforeEach(() => localStorage.clear());

describe('autosave v2', () => {
  it('round-trips values incl. directors, docs and consent, and never stores files', () => {
    const s = emptyState();
    s.entity.companyName = 'Acme';
    s.funds.sourceOfFunds = 'Sales';
    s.directors[0].name = 'Jane';
    s.directors[0].pep = 'yes';
    s.directors[0].files.id = new File(['x'], 'secret.pdf');
    s.directors.push({ ...emptyDirector(), name: 'John' });
    s.docs.cac_forms = new File(['x'], 'c.pdf');
    s.consent = true;
    s.declaration.signatureAgree = true;
    s.seal = new File(['x'], 'seal.png');
    saveDraft(s);
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('secret.pdf');
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('seal.png');
    const r = applyDraft(emptyState(), loadDraft()! as CorporateDraft);
    expect(r.entity.companyName).toBe('Acme');
    expect(r.funds.sourceOfFunds).toBe('Sales');
    expect(r.directors.map((d) => d.name)).toEqual(['Jane', 'John']);
    expect(r.directors[0].pep).toBe('yes');
    expect(Object.values(r.docs).every((f) => f === null)).toBe(true);
    expect(r.consent).toBe(true);
    expect(r.declaration.signatureAgree).toBe(true);
    expect(r.directors[0].files.id).toBeNull();
    expect(r.seal).toBeNull();
  });

  it('ignores v1, corrupt and non-object drafts', () => {
    localStorage.setItem('woodhall-kyc-draft-v1', JSON.stringify({ fields: { companyName: 'Old' } }));
    expect(loadDraft()).toBeNull();
    localStorage.setItem(STORAGE_KEY, '{oops');
    expect(loadDraft()).toBeNull();
    localStorage.setItem(STORAGE_KEY, '"str"');
    expect(loadDraft()).toBeNull();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, entity: {} }));
    expect(loadDraft()).toBeNull();
  });

  it('restores an older draft that still carries a documents key, ignoring it', () => {
    const old = { v: 2, customerType: 'corporate', entity: { companyName: 'Acme' }, documents: { cac_forms: true }, consent: true } as unknown as CorporateDraft;
    const r = applyDraft(emptyState(), old);
    expect(r.entity.companyName).toBe('Acme');
    expect(Object.values(r.docs).every((f) => f === null)).toBe(true);
  });

  it('applyDraft tolerates malformed pieces and caps rows at 25', () => {
    const bad = {
      v: 2, customerType: 'corporate', entity: { companyName: 5 },
      directors: [null, 'x', { name: 'A', pep: 'maybe' }, ...Array(40).fill({ name: 'Z' })],
      documents: 'no', funds: null, declaration: [], consent: 'yes',
    } as unknown as CorporateDraft;
    const r = applyDraft(emptyState(), bad);
    expect(r.entity.companyName).toBe('');
    expect(r.directors.length).toBeLessThanOrEqual(25);
    expect(r.directors.find((d) => d.name === 'A')!.pep).toBe('');
    expect(r.consent).toBe(false);
  });

  it('swallows storage errors', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(() => saveDraft(emptyState())).not.toThrow();
    spy.mockRestore();
  });

  it('treats an empty draft and a single empty director row as no content', () => {
    expect(hasAnyContent(serialize(emptyState()))).toBe(false);
    const s = emptyState();
    s.directors[0].nationality = 'Nigerian';
    expect(hasAnyContent(serialize(s))).toBe(true);
  });
});

describe('autosave: individual drafts', () => {
  it('round-trips person text, arrays, choices, docs, consent and agreement, and never stores files', () => {
    const f = emptyIndividual();
    f.person.fullName = 'Jane Doe';
    f.person.meansOfId = ['nin', 'voters_card'];
    f.person.expectedTransactionTypes = ['cash'];
    f.person.gender = 'F';
    f.person.sourceOfIncome = 'other';
    f.person.sourceOfIncomeOther = 'Gift';
    f.person.purposeOfRelationship = 'lease';
    f.docs.valid_means_of_id = new File(['x'], 'secret.pdf');
    f.consent = true;
    f.declaration.signatureAgree = true;
    f.declaration.declarationName = 'Jane Doe';
    saveDraft(f);
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('secret.pdf');
    const d = loadDraft()!;
    expect(d.customerType).toBe('individual');
    const r = applyIndividualDraft(emptyIndividual(), d as IndividualDraft);
    expect(r.person.fullName).toBe('Jane Doe');
    expect(r.person.meansOfId).toEqual(['nin', 'voters_card']);
    expect(r.person.expectedTransactionTypes).toEqual(['cash']);
    expect(r.person.gender).toBe('F');
    expect(r.person.sourceOfIncome).toBe('other');
    expect(r.person.sourceOfIncomeOther).toBe('Gift');
    expect(r.person.purposeOfRelationship).toBe('lease');
    expect(r.docs.valid_means_of_id).toBeNull();
    expect(r.consent).toBe(true);
    expect(r.declaration.signatureAgree).toBe(true);
    expect(r.declaration.declarationName).toBe('Jane Doe');
  });

  it('serialize dispatches on the form discriminator', () => {
    expect(serialize(emptyState()).customerType).toBe('corporate');
    expect(serialize(emptyIndividual()).customerType).toBe('individual');
  });

  it('loadDraft accepts individual drafts and corporate drafts without a customerType, and rejects unknown types', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, customerType: 'individual', person: {}, declaration: {}, documents: {}, consent: false }));
    expect(loadDraft()?.customerType).toBe('individual');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, entity: {}, directors: [] }));
    expect(loadDraft()?.customerType).toBe('corporate');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, customerType: 'partnership', person: {} }));
    expect(loadDraft()).toBeNull();
  });

  it('applyIndividualDraft tolerates malformed input and drops unknown option values', () => {
    const bad = {
      v: 2, customerType: 'individual',
      person: { fullName: 5, meansOfId: 'nin', expectedTransactionTypes: ['cash', 'bogus', 7], gender: 'X', sourceOfIncome: 'lottery', purposeOfRelationship: 'gift', email: 'a@b.co' },
      declaration: [], documents: 'no', consent: 'yes',
    } as unknown as IndividualDraft;
    const r = applyIndividualDraft(emptyIndividual(), bad);
    expect(r.person.fullName).toBe('');
    expect(r.person.meansOfId).toEqual([]);
    expect(r.person.expectedTransactionTypes).toEqual(['cash']);
    expect(r.person.gender).toBe('');
    expect(r.person.sourceOfIncome).toBe('');
    expect(r.person.purposeOfRelationship).toBe('');
    expect(r.person.email).toBe('a@b.co');
    expect(r.consent).toBe(false);
  });

  it('hasAnyContent is false for an empty individual draft and true for any text, array or checkbox', () => {
    expect(hasAnyContent(serialize(emptyIndividual()))).toBe(false);
    const a = emptyIndividual(); a.person.fullName = 'J';
    const b = emptyIndividual(); b.person.meansOfId = ['nin'];
    const c = emptyIndividual(); c.consent = true;
    const d = emptyIndividual(); d.person.gender = 'M';
    [a, b, c, d].forEach((f) => expect(hasAnyContent(serialize(f))).toBe(true));
  });
});
