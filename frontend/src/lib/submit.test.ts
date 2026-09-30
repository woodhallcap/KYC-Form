import { describe, it, expect, vi } from 'vitest';
import { buildFormData, postSubmission } from './submit';
import { emptyDirector } from './initial-state';
import { emptyState } from '../test-utils';

describe('buildFormData', () => {
  it('builds the corporate FormData contract', () => {
    const s = emptyState();
    s.entity.companyName = 'Acme';
    s.directors[0].name = 'Jane';
    s.directors[0].files.nin = new File(['x'], 'n.pdf');
    s.docs.cac_forms = { submitted: true, file: new File(['x'], 'c.pdf') };
    s.docs.board_resolution = { submitted: false, file: new File(['x'], 'b.pdf') };
    s.consent = true;
    s.declaration.signatureAgree = true;
    s.declaration.signatory1Name = 'Jane';
    s.seal = new File(['x'], 'seal.png');
    const fd = buildFormData(s);
    expect(fd.get('customerType')).toBe('corporate');
    expect(fd.get('companyName')).toBe('Acme');
    expect(fd.get('sourceOfFunds')).toBe('');
    expect(fd.get('directors[0][name]')).toBe('Jane');
    expect(fd.get('directors[0][pep]')).toBe('');
    expect((fd.get('directors[0][files][nin]') as File).name).toBe('n.pdf');
    expect(fd.has('directors[0][files][id]')).toBe(false);
    expect(fd.get('documents[cac_forms][submitted]')).toBe('on');
    expect((fd.get('documents[cac_forms][file]') as File).name).toBe('c.pdf');
    expect(fd.has('documents[board_resolution][submitted]')).toBe(false);
    expect(fd.has('documents[board_resolution][file]')).toBe(false);
    expect(fd.get('consent')).toBe('on');
    expect(fd.get('signatureAgree')).toBe('on');
    expect(fd.get('signatory1Name')).toBe('Jane');
    expect((fd.get('sealFile') as File).name).toBe('seal.png');
  });

  it('omits checkbox fields and files when nothing is ticked or attached', () => {
    const fd = buildFormData(emptyState());
    ['consent', 'signatureAgree', 'sealFile'].forEach((k) => expect(fd.has(k)).toBe(false));
  });

  it('numbers every director row', () => {
    const s = emptyState();
    s.directors.push({ ...emptyDirector(), name: 'John' });
    expect(buildFormData(s).get('directors[1][name]')).toBe('John');
  });
});

describe('postSubmission', () => {
  it('rejects when the response is not JSON', async () => {
    const f = vi.fn().mockResolvedValue({ json: () => Promise.reject(new SyntaxError('x')) });
    await expect(postSubmission(emptyState(), f as unknown as typeof fetch)).rejects.toBeTruthy();
  });

  it('resolves with the parsed payload, including error bodies', async () => {
    const f = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ success: false, errors: { tin: 'bad' } }) });
    const r = await postSubmission(emptyState(), f as unknown as typeof fetch);
    expect(r.errors).toEqual({ tin: 'bad' });
    expect(f).toHaveBeenCalledWith('submit.php', expect.objectContaining({ method: 'POST' }));
  });
});
