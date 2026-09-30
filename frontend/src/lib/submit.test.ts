import { describe, it, expect, vi } from 'vitest';
import { buildFormData, postSubmission } from './submit';
import { emptyState } from '../test-utils';

describe('buildFormData', () => {
  it('uses the old field names', () => {
    const s = emptyState();
    s.step1.companyName = 'Acme';
    s.docs.utility_bill = { submitted: true, file: new File(['x'], 'a.pdf') };
    s.consent = true;
    s.step3.signatureAgree = true;
    const fd = buildFormData(s);
    expect(fd.get('companyName')).toBe('Acme');
    expect(fd.get('documents[utility_bill][submitted]')).toBe('on');
    expect((fd.get('documents[utility_bill][file]') as File).name).toBe('a.pdf');
    expect(fd.get('consent')).toBe('on');
    expect(fd.get('signatureAgree')).toBe('on');
    expect(fd.has('documents[bvn_nin][submitted]')).toBe(false);
  });

  it('omits legalStatus when none chosen but always sends legalStatusOther', () => {
    const fd = buildFormData(emptyState());
    expect(fd.has('legalStatus')).toBe(false);
    expect(fd.get('legalStatusOther')).toBe('');
  });

  it('sends a file even when its checkbox is unticked (old behaviour)', () => {
    const s = emptyState();
    s.docs.utility_bill.file = new File(['x'], 'a.pdf');
    expect(buildFormData(s).has('documents[utility_bill][file]')).toBe(true);
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
