import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { STORAGE_KEY } from './lib/autosave';

type User = ReturnType<typeof userEvent.setup>;

const ENTITY: Record<string, string> = {
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
const next = (user: User, name: string) => user.click(screen.getByRole('button', { name }));

function fillEntity() {
  Object.entries(ENTITY).forEach(([label, value]) => setVal(label, value));
}

async function fillDirector(user: User, n = 1) {
  const row = screen.getByRole('group', { name: `Director ${n}` });
  const set = (label: string, value: string) => fireEvent.change(within(row).getByLabelText(label), { target: { value } });
  set('Name', 'Jane');
  set('Designation', 'MD');
  set('BVN', '1');
  set('NIN', '2');
  set('% Shareholding', '60');
  set('Nationality', 'Nigerian');
  set('Residential Address', '1 Rd');
  await user.click(within(row).getByLabelText('No'));
}

async function toDirectors(user: User) {
  fillEntity();
  await next(user, 'Next: Directors & UBOs');
}
async function toDocuments(user: User) {
  await toDirectors(user);
  await fillDirector(user);
  await next(user, 'Next: Documents');
}
async function toFunds(user: User) {
  await toDocuments(user);
  await user.click(screen.getByLabelText(/^We consent/));
  await next(user, 'Next: Source of Funds');
}
async function toDeclaration(user: User) {
  await toFunds(user);
  setVal('Source of Funds', 'Sales');
  setVal('Facility Amount Requested (₦)', '5,000,000');
  await next(user, 'Next: Declaration');
}
async function submitDeclaration(user: User) {
  setVal('Authorized Signatory 1 — Name', 'Jane Doe');
  setVal('Authorized Signatory 1 — Date', '2026-09-15');
  setVal('Authorized Signatory 2 — Name', 'John Roe');
  setVal('Authorized Signatory 2 — Date', '2026-09-15');
  await user.click(screen.getByLabelText(/^I agree that the typed names/));
  await user.click(screen.getByRole('button', { name: 'Submit Form' }));
}

const json = (payload: unknown) => vi.fn().mockResolvedValue({ json: () => Promise.resolve(payload) });

let alertSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  localStorage.clear();
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

describe('navigation and validation', () => {
  it('cannot advance from step 1 with empty fields', async () => {
    const user = userEvent.setup();
    render(<App />);
    await next(user, 'Next: Directors & UBOs');
    expect(screen.getByText('Company name is required.')).toBeInTheDocument();
    expect(screen.queryByText(/^Section B/)).toBeNull();
  });

  it('advances to Directors after filling the entity', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toDirectors(user);
    expect(screen.getByText(/^Section B: Directors/)).toBeInTheDocument();
  });

  it('cannot advance from Directors with an empty row, then can once filled', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toDirectors(user);
    await next(user, 'Next: Documents');
    expect(within(screen.getByRole('group', { name: 'Director 1' })).getByText('Name is required.')).toBeInTheDocument();
    await fillDirector(user);
    await next(user, 'Next: Documents');
    expect(screen.getByText('Section C: Required Documents')).toBeInTheDocument();
  });

  it('alerts on a bad file for a ticked document, and lets the user through once it is unticked', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<App />);
    await toDocuments(user);
    const label = 'CAC Forms CAC2.3 / CAC1.1 - Directors & Shareholders';
    await user.click(screen.getByLabelText(label));
    await user.upload(screen.getByLabelText(`File for ${label}`), new File(['x'], 'a.exe'));
    await user.click(screen.getByLabelText(/^We consent/));
    await next(user, 'Next: Source of Funds');
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('File type not allowed: a.exe'));
    expect(screen.getByText('Section C: Required Documents')).toBeInTheDocument();
    await user.click(screen.getByLabelText(label));
    await next(user, 'Next: Source of Funds');
    expect(screen.getByText('Section D: Source of Funds')).toBeInTheDocument();
  });

  it('blocks the Funds step until both fields are filled', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toFunds(user);
    await next(user, 'Next: Declaration');
    expect(screen.getByText('Source of funds is required.')).toBeInTheDocument();
    expect(screen.getByText('Facility amount requested is required.')).toBeInTheDocument();
  });
});

describe('submission', () => {
  it('submits the corporate contract, shows confirmation with the company email and clears the draft', async () => {
    const user = userEvent.setup();
    const fetchMock = json({ success: true });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await toDeclaration(user);
    await submitDeclaration(user);
    expect(await screen.findByText('Thank you')).toBeInTheDocument();
    expect(screen.getByText('info@acme.com')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('submit.php');
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('customerType')).toBe('corporate');
    expect(body.get('directors[0][name]')).toBe('Jane');
    expect(body.get('companyEmail')).toBe('info@acme.com');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('jumps to the earliest step with a server error and keeps submit usable afterwards', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', json({ success: false, errors: { tin: 'bad' }, message: 'm' }));
    render(<App />);
    await toDeclaration(user);
    await submitDeclaration(user);
    expect(await screen.findByText('bad')).toBeInTheDocument();
    expect(screen.getByText('Section A: Entity Information')).toBeInTheDocument();
    expect(alertSpy).toHaveBeenCalledWith('m');
    await next(user, 'Next: Directors & UBOs');
    await next(user, 'Next: Documents');
    await next(user, 'Next: Source of Funds');
    await next(user, 'Next: Declaration');
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeEnabled();
  });

  it('shows a server error on a director field inside that director', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', json({ success: false, errors: { 'directors.0.nin': 'NIN already on file' }, message: 'm' }));
    render(<App />);
    await toDeclaration(user);
    await submitDeclaration(user);
    await waitFor(() => expect(screen.getByText(/^Section B: Directors/)).toBeInTheDocument());
    expect(within(screen.getByRole('group', { name: 'Director 1' })).getByText('NIN already on file')).toBeInTheDocument();
  });

  it('shows upload/total server errors only as an alert and stays on the declaration step', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', json({ success: false, errors: { _total: 'Total attachments exceed the 20MB limit.' }, message: 'm2' }));
    render(<App />);
    await toDeclaration(user);
    await submitDeclaration(user);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('m2'));
    expect(alertSpy).toHaveBeenCalledWith('Total attachments exceed the 20MB limit.');
    expect(screen.getByText('Section E: Declaration')).toBeInTheDocument();
  });

  it('shows the server message and stays on the declaration step when there are no field errors', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', json({ success: false, errors: {}, message: 'Mail failed' }));
    render(<App />);
    await toDeclaration(user);
    await submitDeclaration(user);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Mail failed'));
    expect(screen.getByText('Section E: Declaration')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeEnabled();
  });

  it('reports a network error when fetch rejects', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    render(<App />);
    await toDeclaration(user);
    await submitDeclaration(user);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Network error. Please try again.'));
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeEnabled();
  });

  it('reports a network error when the response is not JSON', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.reject(new SyntaxError('<html>')) }));
    render(<App />);
    await toDeclaration(user);
    await submitDeclaration(user);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Network error. Please try again.'));
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeEnabled();
  });

  it('sends only one request when submit is triggered twice', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await toDeclaration(user);
    await submitDeclaration(user);
    const btn = screen.getByRole('button', { name: 'Submitting…' });
    fireEvent.click(btn);
    fireEvent.submit(btn.closest('form')!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('draft', () => {
  const draft = (over: Record<string, unknown> = {}) => ({
    v: 2, customerType: 'corporate', entity: {}, funds: {}, declaration: {},
    directors: [{ name: '' }], documents: {}, consent: false, ...over,
  });

  it('restores a v2 draft and clears it on request', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft({ entity: { companyName: 'Draft Co' }, documents: { cac_forms: true } })));
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText('We restored your unsaved draft.')).toBeInTheDocument();
    expect(screen.getByLabelText('Company Name')).toHaveValue('Draft Co');
    await user.click(screen.getByRole('button', { name: 'Clear and start over' }));
    expect(screen.getByLabelText('Company Name')).toHaveValue('');
    expect(screen.queryByText('We restored your unsaved draft.')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('ignores a v1 draft', () => {
    localStorage.setItem('woodhall-kyc-draft-v1', JSON.stringify({ fields: { companyName: 'Old' }, legalStatus: 'private' }));
    render(<App />);
    expect(screen.queryByText('We restored your unsaved draft.')).toBeNull();
    expect(screen.getByLabelText('Company Name')).toHaveValue('');
  });

  it('does not treat a draft with only an empty director row as content', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft()));
    render(<App />);
    expect(screen.queryByText('We restored your unsaved draft.')).toBeNull();
  });

  it('does not overwrite an existing draft with an empty state on mount', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft({ entity: { companyName: 'Draft Co' } })));
    render(<App />);
    await new Promise((r) => setTimeout(r, 1000));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).entity.companyName).toBe('Draft Co');
  });

  it('autosaves typed values after the debounce', async () => {
    render(<App />);
    setVal('Company Name', 'Typed Co');
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).entity.companyName).toBe('Typed Co'), { timeout: 2000 });
  });
});
