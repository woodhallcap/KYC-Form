import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEY, applyDraft, hasAnyContent, loadDraft, saveDraft, serialize } from './autosave';
import { emptyState } from '../test-utils';

beforeEach(() => localStorage.clear());

describe('autosave', () => {
  it('round-trips a draft including legalStatus other', () => {
    const s = emptyState();
    s.step1.legalStatus = 'other';
    s.step1.legalStatusOther = 'Trust';
    s.docs.utility_bill.submitted = true;
    s.consent = true;
    saveDraft(s);
    const restored = applyDraft(emptyState(), loadDraft()!);
    expect(restored.step1.legalStatus).toBe('other');
    expect(restored.step1.legalStatusOther).toBe('Trust');
    expect(restored.docs.utility_bill.submitted).toBe(true);
    expect(restored.consent).toBe(true);
  });

  it('returns null for corrupt or non-object JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{oops');
    expect(loadDraft()).toBeNull();
    localStorage.setItem(STORAGE_KEY, '"str"');
    expect(loadDraft()).toBeNull();
  });

  it('swallows storage errors', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(() => saveDraft(emptyState())).not.toThrow();
    spy.mockRestore();
  });

  it('hasAnyContent is false for an empty draft', () => {
    expect(hasAnyContent(serialize(emptyState()))).toBe(false);
  });

  it('never stores files', () => {
    const s = emptyState();
    s.docs.utility_bill.file = new File(['x'], 'a.pdf');
    expect(JSON.stringify(serialize(s))).not.toContain('a.pdf');
  });
});
