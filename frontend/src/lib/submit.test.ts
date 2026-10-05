import { describe, it, expect, vi } from 'vitest';
import { buildFormData, postSubmission } from './submit';
import { emptyDirector } from './initial-state';
import { emptyIndividual, emptyState } from '../test-utils';

describe('buildFormData', () => {
  it('builds the corporate FormData contract', () => {
    const s = emptyState();
    s.entity.companyName = 'Acme';
    s.directors[0].name = 'Jane';
    s.directors[0].files.nin = new File(['x'], 'n.pdf');
    s.docs.cac_forms = new File(['x'], 'c.pdf');
    s.consent = true;
    s.declaration.signatureAgree = true;
    s.declaration.signatory1Name = 'Jane';
    s.images.sealFile = new File(['x'], 'seal.png');
    s.images.signatory1SignatureFile = new File(['x'], 'sig1.png');
    const fd = buildFormData(s);
    expect(fd.get('customerType')).toBe('corporate');
    expect(fd.get('companyName')).toBe('Acme');
    expect(fd.get('sourceOfFunds')).toBe('');
    expect(fd.get('directors[0][name]')).toBe('Jane');
    expect(fd.get('directors[0][pep]')).toBe('');
    expect((fd.get('directors[0][files][nin]') as File).name).toBe('n.pdf');
    expect(fd.has('directors[0][files][id]')).toBe(false);
    expect((fd.get('documents[cac_forms]') as File).name).toBe('c.pdf');
    expect(fd.has('documents[cac_forms][submitted]')).toBe(false);
    expect(fd.has('documents[board_resolution]')).toBe(false);
    expect(fd.get('consent')).toBe('on');
    expect(fd.get('signatureAgree')).toBe('on');
    expect(fd.get('signatory1Name')).toBe('Jane');
    expect((fd.get('sealFile') as File).name).toBe('seal.png');
    expect((fd.get('signatory1SignatureFile') as File).name).toBe('sig1.png');
    expect(fd.has('signatory2SignatureFile')).toBe(false);
  });

  it('omits checkbox fields and files when nothing is ticked or attached', () => {
    const fd = buildFormData(emptyState());
    ['consent', 'signatureAgree', 'sealFile', 'signatory1SignatureFile'].forEach((k) => expect(fd.has(k)).toBe(false));
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

describe('buildFormData: individual', () => {
  it('builds the individual contract with array fields', () => {
    const f = emptyIndividual();
    f.person.fullName = 'Jane Doe';
    f.person.email = 'jane@example.com';
    f.person.gender = 'F';
    f.person.meansOfId = ['nin', 'passport'];
    f.person.expectedTransactionTypes = ['cash', 'transfer'];
    f.person.sourceOfIncome = 'other';
    f.person.sourceOfIncomeOther = 'Gift';
    f.docs.valid_means_of_id = new File(['x'], 'id.pdf');
    f.consent = true;
    f.declaration = { declarationName: 'Jane Doe', signatureDate: '2026-09-15', signatureAgree: true };
    f.images.signatureFile = new File(['x'], 'sig.png');
    const fd = buildFormData(f);
    expect(fd.get('customerType')).toBe('individual');
    expect(fd.get('fullName')).toBe('Jane Doe');
    expect(fd.get('email')).toBe('jane@example.com');
    expect(fd.get('gender')).toBe('F');
    expect(fd.getAll('meansOfId[]')).toEqual(['nin', 'passport']);
    expect(fd.getAll('expectedTransactionTypes[]')).toEqual(['cash', 'transfer']);
    expect(fd.get('sourceOfIncome')).toBe('other');
    expect(fd.get('sourceOfIncomeOther')).toBe('Gift');
    expect((fd.get('documents[valid_means_of_id]') as File).name).toBe('id.pdf');
    expect(fd.has('documents[valid_means_of_id][submitted]')).toBe(false);
    expect(fd.has('documents[passport_photograph]')).toBe(false);
    expect(fd.get('consent')).toBe('on');
    expect(fd.get('declarationName')).toBe('Jane Doe');
    expect(fd.get('signatureDate')).toBe('2026-09-15');
    expect(fd.get('signatureAgree')).toBe('on');
    expect((fd.get('signatureFile') as File).name).toBe('sig.png');
    expect(fd.has('signatureName')).toBe(false);
  });

  it('appends nothing for empty arrays, unset gender, or unticked checkboxes', () => {
    const fd = buildFormData(emptyIndividual());
    ['meansOfId[]', 'expectedTransactionTypes[]', 'gender', 'consent', 'signatureAgree'].forEach((k) => expect(fd.has(k), k).toBe(false));
    expect(fd.get('fullName')).toBe('');
  });

  it('does not send any corporate fields', () => {
    const fd = buildFormData(emptyIndividual());
    ['companyName', 'sealFile', 'signatory1SignatureFile', 'directors[0][name]'].forEach((k) => expect(fd.has(k), k).toBe(false));
  });
});
