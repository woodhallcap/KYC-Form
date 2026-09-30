import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { STORAGE_KEY } from './lib/autosave';

const STEP1: Record<string, string> = {
  'Company Name': 'Acme Ltd',
  'RC Number': 'RC1',
  'Date of Incorporation': '2020-01-01',
  'Registered Address': '1 Main St',
  'Nature of Business': 'Trading',
  'Tax Identification Number (TIN)': 'T1',
  'Company Email': 'info@acme.com',
  'Corporate Bank Account Number': '0123',
  Bank: 'First Bank',
};

const setVal = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function fillStep1(user: ReturnType<typeof userEvent.setup>) {
  Object.entries(STEP1).forEach(([label, v]) => setVal(label, v));
  await user.click(screen.getByLabelText('Private Limited Company'));
}

async function goToStep3(user: ReturnType<typeof userEvent.setup>) {
  await fillStep1(user);
  await user.click(screen.getByRole('button', { name: 'Next: KYC Documents' }));
  await user.click(screen.getByLabelText(/^We consent/));
  await user.click(screen.getByRole('button', { name: 'Next: Declaration' }));
}

async function fillStep3AndSubmit(user: ReturnType<typeof userEvent.setup>) {
  setVal('Name', 'Jane');
  setVal('Designation', 'CEO');
  setVal('Typed Signature (type your full name)', 'Jane Doe');
  await user.click(screen.getByLabelText(/^I agree/));
  await user.click(screen.getByRole('button', { name: 'Submit Form' }));
}

const json = (payload: unknown) => vi.fn().mockResolvedValue({ json: () => Promise.resolve(payload) });

let alertSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  localStorage.clear();
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

describe('App wizard', () => {
  it('cannot advance from step 1 with empty fields', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Next: KYC Documents' }));
    expect(screen.getByText('Company name is required.')).toBeInTheDocument();
    expect(screen.queryByText('Section B: KYC / CDD Documentation')).toBeNull();
  });

  it('advances to step 2 after filling step 1', async () => {
    const user = userEvent.setup();
    render(<App />);
    await fillStep1(user);
    await user.click(screen.getByRole('button', { name: 'Next: KYC Documents' }));
    expect(screen.getByText('Section B: KYC / CDD Documentation')).toBeInTheDocument();
  });

  it('alerts on step 2 file errors, which have no field of their own', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<App />);
    await fillStep1(user);
    await user.click(screen.getByRole('button', { name: 'Next: KYC Documents' }));
    await user.click(screen.getByLabelText('Certificate of Incorporation'));
    await user.upload(screen.getByLabelText('File for Certificate of Incorporation'), new File(['x'], 'a.exe'));
    await user.click(screen.getByLabelText(/^We consent/));
    await user.click(screen.getByRole('button', { name: 'Next: Declaration' }));
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('File type not allowed: a.exe'));
    expect(screen.getByText('Section B: KYC / CDD Documentation')).toBeInTheDocument();
  });

  it('submits, shows confirmation with the company email and clears the draft', async () => {
    const user = userEvent.setup();
    const fetchMock = json({ success: true });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await goToStep3(user);
    await fillStep3AndSubmit(user);
    expect(await screen.findByText('Thank you')).toBeInTheDocument();
    expect(screen.getByText('info@acme.com')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('submit.php');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('jumps to the earliest step with a server error and re-enables submit', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', json({ success: false, errors: { tin: 'bad' }, message: 'm' }));
    render(<App />);
    await goToStep3(user);
    await fillStep3AndSubmit(user);
    expect(await screen.findByText('bad')).toBeInTheDocument();
    expect(screen.getByText('Section A: Entity Information')).toBeInTheDocument();
    expect(alertSpy).toHaveBeenCalledWith('m');
    await user.click(screen.getByRole('button', { name: 'Next: KYC Documents' }));
    await user.click(screen.getByRole('button', { name: 'Next: Declaration' }));
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeEnabled();
  });

  it('shows the server message and stays on step 3 when there are no field errors', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', json({ success: false, errors: {}, message: 'Mail failed' }));
    render(<App />);
    await goToStep3(user);
    await fillStep3AndSubmit(user);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Mail failed'));
    expect(screen.getByText('Section C: Declaration')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeEnabled();
  });

  it('reports a network error when fetch rejects', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    render(<App />);
    await goToStep3(user);
    await fillStep3AndSubmit(user);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Network error. Please try again.'));
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeEnabled();
  });

  it('reports a network error when the response is not JSON', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.reject(new SyntaxError('<html>')) }));
    render(<App />);
    await goToStep3(user);
    await fillStep3AndSubmit(user);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Network error. Please try again.'));
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeEnabled();
  });

  it('sends only one request when submit is clicked twice', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await goToStep3(user);
    await fillStep3AndSubmit(user);
    const btn = screen.getByRole('button', { name: 'Submitting…' });
    fireEvent.click(btn);
    fireEvent.submit(btn.closest('form')!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('App draft', () => {
  const seed = () =>
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        fields: { companyName: 'Draft Co', legalStatusOther: 'Trust' },
        legalStatus: 'other',
        documents: {},
        consent: false,
        signatureAgree: false,
      }),
    );

  it('restores a draft including legal status other, and clears it on request', async () => {
    seed();
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText('We restored your unsaved draft.')).toBeInTheDocument();
    expect(screen.getByLabelText('Company Name')).toHaveValue('Draft Co');
    expect(screen.getByPlaceholderText('Please specify')).toHaveValue('Trust');
    await user.click(screen.getByRole('button', { name: 'Clear and start over' }));
    expect(screen.getByLabelText('Company Name')).toHaveValue('');
    expect(screen.queryByPlaceholderText('Please specify')).toBeNull();
    expect(screen.queryByText('We restored your unsaved draft.')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does not overwrite an existing draft with an empty state on mount', async () => {
    seed();
    render(<App />);
    await new Promise((r) => setTimeout(r, 1000));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).fields.companyName).toBe('Draft Co');
  });

  it('autosaves typed values after the debounce', async () => {
    render(<App />);
    setVal('Company Name', 'Typed Co');
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).fields.companyName).toBe('Typed Co'), {
      timeout: 2000,
    });
  });
});
