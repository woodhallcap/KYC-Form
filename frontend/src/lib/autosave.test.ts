import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEY, applyDraft, hasAnyContent, loadDraft, saveDraft, serialize } from './autosave';
import type { Draft } from './autosave';
import { emptyDirector } from './initial-state';
import { emptyState } from '../test-utils';

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
    s.docs.cac_forms.submitted = true;
    s.consent = true;
    s.declaration.signatureAgree = true;
    s.seal = new File(['x'], 'seal.png');
    saveDraft(s);
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('secret.pdf');
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('seal.png');
    const r = applyDraft(emptyState(), loadDraft()!);
    expect(r.entity.companyName).toBe('Acme');
    expect(r.funds.sourceOfFunds).toBe('Sales');
    expect(r.directors.map((d) => d.name)).toEqual(['Jane', 'John']);
    expect(r.directors[0].pep).toBe('yes');
    expect(r.docs.cac_forms.submitted).toBe(true);
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

  it('applyDraft tolerates malformed pieces and caps rows at 25', () => {
    const bad = {
      v: 2, customerType: 'corporate', entity: { companyName: 5 },
      directors: [null, 'x', { name: 'A', pep: 'maybe' }, ...Array(40).fill({ name: 'Z' })],
      documents: 'no', funds: null, declaration: [], consent: 'yes',
    } as unknown as Draft;
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
