import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { STORAGE_KEY } from './lib/autosave';
import { CORPORATE_DOCUMENTS, INDIVIDUAL_DOCUMENTS } from './lib/documents';
import type { DocumentSpec } from './lib/documents';
import { bigFile } from './test-utils';

type User = ReturnType<typeof userEvent.setup>;

const setVal = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const next = (user: User, name: string) => user.click(screen.getByRole('button', { name }));
const chooseCorporate = (user: User) => user.click(screen.getByRole('button', { name: /Corporate customer/ }));
const chooseIndividual = (user: User) => user.click(screen.getByRole('button', { name: /Individual customer/ }));

/* ------------------------------- corporate -------------------------------- */

const ENTITY: Record<string, string> = {
  'Company Name': 'Acme Ltd',
  'Business Registration Number (BN / RC)': 'RC1',
  'Date of Incorporation': '2020-01-01',
  'Registered Address': '1 Main St',
  'Nature of Business': 'Trading',
  'Tax Identification Number (TIN)': 'T1',
  'Company Email': 'info@acme.com',
  'Corporate Bank Account Number': '0123',
  Bank: 'First Bank',
};

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
  await chooseCorporate(user);
  fillEntity();
  await next(user, 'Next: Directors & UBOs');
}
async function toDocuments(user: User) {
  await toDirectors(user);
  await fillDirector(user);
  await next(user, 'Next: Documents');
}
async function attachAll(user: User, specs: readonly DocumentSpec[]) {
  for (const d of specs.filter((s) => s.required)) await user.upload(screen.getByLabelText(d.label), new File(['x'], `${d.id}.pdf`));
}
async function toFunds(user: User) {
  await toDocuments(user);
  await attachAll(user, CORPORATE_DOCUMENTS);
  await user.click(screen.getByLabelText(/^We consent/));
  await next(user, 'Next: Source of Funds');
}
async function toDeclaration(user: User) {
  await toFunds(user);
  setVal('Source of Funds', 'Sales');
  setVal('Facility Amount Requested (₦)', '5,000,000');
  await next(user, 'Next: Declaration');
}
const png = (name: string) => new File(['x'], name, { type: 'image/png' });
async function uploadCorporateImages(user: User) {
  await user.upload(screen.getByLabelText('Authorized Signatory 1 — Handwritten Signature'), png('sig1.png'));
  await user.upload(screen.getByLabelText('Authorized Signatory 2 — Handwritten Signature'), png('sig2.png'));
  await user.upload(screen.getByLabelText('Company Seal or Stamp'), png('seal.png'));
}
async function submitCorporate(user: User) {
  setVal('Authorized Signatory 1 — Name', 'Jane Doe');
  setVal('Authorized Signatory 1 — Date', '2026-09-15');
  setVal('Authorized Signatory 2 — Name', 'John Roe');
  setVal('Authorized Signatory 2 — Date', '2026-09-15');
  await uploadCorporateImages(user);
  await user.click(screen.getByLabelText(/^We confirm the attached images/));
  await user.click(screen.getByRole('button', { name: 'Submit Form' }));
}

/* ------------------------------- individual ------------------------------- */

const PERSON: Record<string, string> = {
  'Full Name': 'Jane Doe',
  'Date of Birth': '1990-01-01',
  'Place of Birth': 'Lagos',
  Nationality: 'Nigerian',
  'Country of Residence': 'Nigeria',
  'Residential Address': '1 Rd',
  LGA: 'Ikeja',
  State: 'Lagos',
  'Phone No': '08000000000',
  Email: 'jane@example.com',
  'ID No (optional)': 'A123',
  Occupation: 'Engineer',
  'Source of Wealth': 'Savings',
  'Office Address': '4 Adeola Odeku St',
  'Employer/Business Name': 'Acme Engineering',
  'Official Email': 'jane@acme-eng.com',
};

async function fillPerson(user: User) {
  Object.entries(PERSON).forEach(([label, value]) => setVal(label, value));
  fireEvent.change(screen.getByRole('textbox', { name: 'BVN' }), { target: { value: '222' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'NIN' }), { target: { value: '333' } });
  await user.click(within(screen.getByRole('radiogroup', { name: 'Gender' })).getByLabelText('Female'));
  await user.click(within(screen.getByRole('group', { name: 'Means of ID' })).getByLabelText('NIN'));
  await user.click(within(screen.getByRole('group', { name: 'Means of ID' })).getByLabelText("Int'l Passport"));
  await user.click(within(screen.getByRole('radiogroup', { name: 'Source of Income' })).getByLabelText('Salary'));
  await user.click(within(screen.getByRole('radiogroup', { name: 'Purpose of Relationship with Woodhall Finance' })).getByLabelText('Loan'));
}

async function toIndividualDocuments(user: User) {
  await chooseIndividual(user);
  await fillPerson(user);
  await next(user, 'Next: Documents');
}
async function toIndividualDeclaration(user: User) {
  await toIndividualDocuments(user);
  await attachAll(user, INDIVIDUAL_DOCUMENTS);
  await user.click(screen.getByLabelText(/^I consent/));
  await next(user, 'Next: Declaration');
}
async function submitIndividual(user: User) {
  setVal('Full Name', 'Jane Doe');
  setVal('Date', '2026-09-15');
  await user.upload(screen.getByLabelText('Handwritten Signature'), png('sig.png'));
  await user.click(screen.getByLabelText(/^I confirm the attached image/));
  await user.click(screen.getByRole('button', { name: 'Submit Form' }));
}

const json = (payload: unknown) => vi.fn().mockResolvedValue({ json: () => Promise.resolve(payload) });

let alertSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  localStorage.clear();
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

/* --------------------------------- tests ---------------------------------- */

describe('customer type selector', () => {
  it('shows the selector first, with no progress bar', () => {
    render(<App />);
    expect(screen.getByText('Who is this form for?')).toBeInTheDocument();
    expect(screen.queryByTestId('progress-step-1')).toBeNull();
  });

  it('shows a 3-step flow for Individual and a 5-step flow for Corporate', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await chooseIndividual(user);
    expect(screen.getByRole('heading', { name: 'Section A: Customer Information' })).toBeInTheDocument();
    expect(screen.getByTestId('progress-step-3')).toBeInTheDocument();
    expect(screen.queryByTestId('progress-step-4')).toBeNull();
    unmount();
    render(<App />);
    await chooseCorporate(user);
    expect(screen.getByRole('heading', { name: 'Section A: Entity Information' })).toBeInTheDocument();
    expect(screen.getByTestId('progress-step-5')).toBeInTheDocument();
  });

  it('lets the user change the type on step 1 and keeps what they typed', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chooseCorporate(user);
    setVal('Company Name', 'Acme Ltd');
    await user.click(screen.getByRole('button', { name: /Change customer type/ }));
    expect(screen.getByText('Who is this form for?')).toBeInTheDocument();
    await chooseIndividual(user);
    expect(screen.queryByRole('button', { name: /Change customer type/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Change customer type/ }));
    await chooseCorporate(user);
    expect(screen.getByLabelText('Company Name')).toHaveValue('Acme Ltd');
  });
});

describe('corporate navigation and validation', () => {
  it('cannot advance from step 1 with empty fields', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chooseCorporate(user);
    await next(user, 'Next: Directors & UBOs');
    expect(screen.getByText('Company name is required.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^Section B/ })).toBeNull();
  });

  it('advances to Directors after filling the entity', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toDirectors(user);
    expect(screen.getByRole('heading', { name: /^Section B: Directors/ })).toBeInTheDocument();
  });

  it('cannot advance from Directors with an empty row, then can once filled', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toDirectors(user);
    await next(user, 'Next: Documents');
    expect(within(screen.getByRole('group', { name: 'Director 1' })).getByText('Name is required.')).toBeInTheDocument();
    await fillDirector(user);
    await next(user, 'Next: Documents');
    expect(screen.getByRole('heading', { name: 'Section C: Required Documents' })).toBeInTheDocument();
  });

  it('blocks Next on a bad document file, and lets the user through once it is replaced', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<App />);
    await toDocuments(user);
    await attachAll(user, CORPORATE_DOCUMENTS);
    const label = 'CAC Forms CAC2.3 / CAC1.1 - Directors & Shareholders';
    await user.upload(screen.getByLabelText(label), new File(['x'], 'a.exe'));
    await user.click(screen.getByLabelText(/^We consent/));
    await next(user, 'Next: Source of Funds');
    expect(screen.getAllByText('File type not allowed: a.exe').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Section C: Required Documents' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `Remove ${label}` }));
    await user.upload(screen.getByLabelText(label), new File(['x'], 'ok.pdf'));
    await next(user, 'Next: Source of Funds');
    expect(screen.getByRole('heading', { name: 'Section D: Source of Funds' })).toBeInTheDocument();
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

describe('corporate submission', () => {
  it('submits the corporate contract, shows confirmation with the company email and clears the draft', async () => {
    const user = userEvent.setup();
    const fetchMock = json({ success: true });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await toDeclaration(user);
    await submitCorporate(user);
    expect(await screen.findByText('Thank you')).toBeInTheDocument();
    expect(screen.getByText('info@acme.com')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('submit.php');
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('customerType')).toBe('corporate');
    expect(body.get('directors[0][name]')).toBe('Jane');
    expect(body.get('companyEmail')).toBe('info@acme.com');
    expect((body.get('sealFile') as File).name).toBe('seal.png');
    expect((body.get('signatory2SignatureFile') as File).name).toBe('sig2.png');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('blocks submit and shows an inline error when the seal is missing', async () => {
    const user = userEvent.setup();
    const fetchMock = json({ success: true });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await toDeclaration(user);
    setVal('Authorized Signatory 1 — Name', 'Jane Doe');
    setVal('Authorized Signatory 1 — Date', '2026-09-15');
    setVal('Authorized Signatory 2 — Name', 'John Roe');
    setVal('Authorized Signatory 2 — Date', '2026-09-15');
    await user.upload(screen.getByLabelText('Authorized Signatory 1 — Handwritten Signature'), png('sig1.png'));
    await user.upload(screen.getByLabelText('Authorized Signatory 2 — Handwritten Signature'), png('sig2.png'));
    await user.click(screen.getByLabelText(/^We confirm the attached images/));
    await user.click(screen.getByRole('button', { name: 'Submit Form' }));
    expect(await screen.findByText('Company seal or stamp is required.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('jumps to the earliest step with a server error and keeps submit usable afterwards', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', json({ success: false, errors: { tin: 'bad' }, message: 'm' }));
    render(<App />);
    await toDeclaration(user);
    await submitCorporate(user);
    expect(await screen.findByText('bad')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Section A: Entity Information' })).toBeInTheDocument();
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
    await submitCorporate(user);
    await waitFor(() => expect(screen.getByRole('heading', { name: /^Section B: Directors/ })).toBeInTheDocument());
    expect(within(screen.getByRole('group', { name: 'Director 1' })).getByText('NIN already on file')).toBeInTheDocument();
  });

  it('shows upload/total server errors only as an alert and stays on the declaration step', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', json({ success: false, errors: { _total: 'Total attachments exceed the 20MB limit.' }, message: 'm2' }));
    render(<App />);
    await toDeclaration(user);
    await submitCorporate(user);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('m2'));
    expect(alertSpy).toHaveBeenCalledWith('Total attachments exceed the 20MB limit.');
    expect(screen.getByRole('heading', { name: 'Section E: Declaration' })).toBeInTheDocument();
  });

  it('shows the server message and stays on the declaration step when there are no field errors', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', json({ success: false, errors: {}, message: 'Mail failed' }));
    render(<App />);
    await toDeclaration(user);
    await submitCorporate(user);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Mail failed'));
    expect(screen.getByRole('heading', { name: 'Section E: Declaration' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeEnabled();
  });

  it('reports a network error when fetch rejects, and when the response is not JSON', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const { unmount } = render(<App />);
    await toDeclaration(user);
    await submitCorporate(user);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Network error. Please try again.'));
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeEnabled();
    unmount();
    localStorage.clear();
    alertSpy.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.reject(new SyntaxError('<html>')) }));
    render(<App />);
    await toDeclaration(user);
    await submitCorporate(user);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Network error. Please try again.'));
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeEnabled();
  });

  it('sends only one request when submit is triggered twice', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await toDeclaration(user);
    await submitCorporate(user);
    const btn = screen.getByRole('button', { name: 'Submitting…' });
    fireEvent.click(btn);
    fireEvent.submit(btn.closest('form')!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('individual flow', () => {
  it('blocks step 1 when empty, then advances once filled', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chooseIndividual(user);
    await next(user, 'Next: Documents');
    expect(screen.getByText('Full name is required.')).toBeInTheDocument();
    expect(screen.getByText('Select at least one means of ID.')).toBeInTheDocument();
    await fillPerson(user);
    await next(user, 'Next: Documents');
    expect(screen.getByRole('heading', { name: 'Section B: Verification Documents' })).toBeInTheDocument();
  });

  it('requires consent on the documents step', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toIndividualDocuments(user);
    await next(user, 'Next: Declaration');
    expect(screen.getByText('Consent to processing is required.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Section B: Verification Documents' })).toBeInTheDocument();
  });

  it('submits the individual contract, shows confirmation with the email and clears the draft', async () => {
    const user = userEvent.setup();
    const fetchMock = json({ success: true });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await toIndividualDeclaration(user);
    await submitIndividual(user);
    expect(await screen.findByText('Thank you')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('customerType')).toBe('individual');
    expect(body.get('email')).toBe('jane@example.com');
    expect(body.getAll('meansOfId[]')).toEqual(['nin', 'passport']);
    expect(body.get('officialEmail')).toBe('jane@acme-eng.com');
    expect(body.get('declarationName')).toBe('Jane Doe');
    expect(body.get('consent')).toBe('on');
    expect(body.has('companyName')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('blocks Next on the documents step until required files are attached', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toIndividualDocuments(user);
    await user.click(screen.getByLabelText(/^I consent/));
    await next(user, 'Next: Declaration');
    expect(screen.getByRole('heading', { name: 'Section B: Verification Documents' })).toBeInTheDocument();
    expect(screen.getByText('Valid Means of ID is required.')).toBeInTheDocument();
  });

  it('sends every attached document', async () => {
    const user = userEvent.setup();
    const fetchMock = json({ success: true });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await toIndividualDeclaration(user);
    await submitIndividual(user);
    await screen.findByText('Thank you');
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect((body.get('documents[valid_means_of_id]') as File).name).toBe('valid_means_of_id.pdf');
    expect((body.get('documents[work_id]') as File).name).toBe('work_id.pdf');
  });

  it('jumps to step 1 for an email error, and stays put with an alert for a total-size error', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', json({ success: false, errors: { email: 'Email already registered' }, message: 'm' }));
    const { unmount } = render(<App />);
    await toIndividualDeclaration(user);
    await submitIndividual(user);
    expect(await screen.findByText('Email already registered')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Section A: Customer Information' })).toBeInTheDocument();
    unmount();
    localStorage.clear();
    alertSpy.mockClear();
    vi.stubGlobal('fetch', json({ success: false, errors: { _total: 'Total attachments exceed the 20MB limit.' }, message: 'm2' }));
    render(<App />);
    await toIndividualDeclaration(user);
    await submitIndividual(user);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('m2'));
    expect(alertSpy).toHaveBeenCalledWith('Total attachments exceed the 20MB limit.');
    expect(screen.getByRole('heading', { name: 'Section C: Declaration' })).toBeInTheDocument();
  });

  it('shows a declaration-step server error on that step, and reports network errors', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', json({ success: false, errors: { signatureDate: 'Date is in the future' }, message: 'm' }));
    const { unmount } = render(<App />);
    await toIndividualDeclaration(user);
    await submitIndividual(user);
    expect(await screen.findByText('Date is in the future')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Section C: Declaration' })).toBeInTheDocument();
    unmount();
    localStorage.clear();
    alertSpy.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    render(<App />);
    await toIndividualDeclaration(user);
    await submitIndividual(user);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Network error. Please try again.'));
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeEnabled();
  });

  it('blocks Submit and shows the total-size error when attachments exceed 20MB', async () => {
    const user = userEvent.setup();
    const fetchMock = json({ success: true });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await toIndividualDocuments(user);
    for (const d of INDIVIDUAL_DOCUMENTS.filter((s) => s.required)) {
      await user.upload(screen.getByLabelText(d.label), bigFile(`${d.id}.pdf`, 4.5));
    }
    await user.click(screen.getByLabelText(/^I consent/));
    await next(user, 'Next: Declaration');
    await submitIndividual(user);
    const message = 'Total attachments exceed the 20MB limit.';
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(alertSpy).toHaveBeenCalledWith(message);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Section C: Declaration' })).toBeInTheDocument();
  });

  it('sends only one request when submit is triggered twice', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await toIndividualDeclaration(user);
    await submitIndividual(user);
    const btn = screen.getByRole('button', { name: 'Submitting…' });
    fireEvent.click(btn);
    fireEvent.submit(btn.closest('form')!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('drafts', () => {
  const corporateDraft = (over: Record<string, unknown> = {}) => ({
    v: 2, customerType: 'corporate', entity: {}, funds: {}, declaration: {},
    directors: [{ name: '' }], documents: {}, consent: false, ...over,
  });
  const individualDraft = (over: Record<string, unknown> = {}) => ({
    v: 2, customerType: 'individual', person: {}, declaration: {}, documents: {}, consent: false, ...over,
  });

  it('restores a corporate draft into the corporate flow and clears it on request', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(corporateDraft({ entity: { companyName: 'Draft Co' }, documents: { cac_forms: true } })));
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText('We restored your unsaved draft.')).toBeInTheDocument();
    expect(screen.getByLabelText('Company Name')).toHaveValue('Draft Co');
    await user.click(screen.getByRole('button', { name: 'Clear and start over' }));
    expect(screen.getByText('Who is this form for?')).toBeInTheDocument();
    expect(screen.queryByText('We restored your unsaved draft.')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('restores an individual draft into the individual flow', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(individualDraft({ person: { fullName: 'Jane Doe', sourceOfIncome: 'other', sourceOfIncomeOther: 'Gift', meansOfId: ['nin'] } })));
    render(<App />);
    expect(screen.getByText('We restored your unsaved draft.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Section A: Customer Information' })).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toHaveValue('Jane Doe');
    expect(screen.getByLabelText('Specify source of income')).toHaveValue('Gift');
    expect(within(screen.getByRole('group', { name: 'Means of ID' })).getByLabelText('NIN')).toBeChecked();
  });

  it('ignores v1 drafts, unknown customer types and empty drafts (selector shown)', () => {
    localStorage.setItem('woodhall-kyc-draft-v1', JSON.stringify({ fields: { companyName: 'Old' }, legalStatus: 'private' }));
    const { unmount } = render(<App />);
    expect(screen.getByText('Who is this form for?')).toBeInTheDocument();
    unmount();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, customerType: 'partnership', person: { fullName: 'x' } }));
    const again = render(<App />);
    expect(screen.getByText('Who is this form for?')).toBeInTheDocument();
    again.unmount();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(corporateDraft()));
    render(<App />);
    expect(screen.getByText('Who is this form for?')).toBeInTheDocument();
  });

  it('does not overwrite an existing draft, and writes nothing while the selector is showing', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(corporateDraft({ entity: { companyName: 'Draft Co' } })));
    const { unmount } = render(<App />);
    await new Promise((r) => setTimeout(r, 1000));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).entity.companyName).toBe('Draft Co');
    unmount();
    localStorage.clear();
    render(<App />);
    await new Promise((r) => setTimeout(r, 1000));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('autosaves typed values for either type after the debounce', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await chooseCorporate(user);
    setVal('Company Name', 'Typed Co');
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).entity.companyName).toBe('Typed Co'), { timeout: 2000 });
    unmount();
    localStorage.clear();
    render(<App />);
    await chooseIndividual(user);
    setVal('Full Name', 'Typed Person');
    await waitFor(() => {
      const d = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(d.customerType).toBe('individual');
      expect(d.person.fullName).toBe('Typed Person');
    }, { timeout: 2000 });
  });
});

describe('scrolling to the form card', () => {
  const scrollIntoView = vi.fn();
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    scrollIntoView.mockClear();
  });
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  const lastTarget = () => scrollIntoView.mock.contexts[scrollIntoView.mock.contexts.length - 1] as HTMLElement;

  it('does not scroll on first render', () => {
    render(<App />);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('scrolls to the top of the form card when the customer type is chosen and when it is changed', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chooseCorporate(user);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(lastTarget().tagName).toBe('MAIN');
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'start', behavior: 'smooth' });
    await user.click(screen.getByRole('button', { name: /Change customer type/ }));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('scrolls once per step change, forwards and back', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toDirectors(user);
    scrollIntoView.mockClear();
    await fillDirector(user);
    await next(user, 'Next: Documents');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(lastTarget().tagName).toBe('MAIN');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('does not scroll when Next is blocked by validation or while typing', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chooseCorporate(user);
    scrollIntoView.mockClear();
    await next(user, 'Next: Directors & UBOs');
    expect(screen.getByText('Company name is required.')).toBeInTheDocument();
    setVal('Company Name', 'Acme');
    await user.tab();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('scrolls when a server error jumps back to an earlier step, and when the confirmation appears', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', json({ success: false, errors: { tin: 'bad' }, message: 'm' }));
    const { unmount } = render(<App />);
    await toDeclaration(user);
    scrollIntoView.mockClear();
    await submitCorporate(user);
    await screen.findByText('bad');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    unmount();
    localStorage.clear();
    vi.stubGlobal('fetch', json({ success: true }));
    render(<App />);
    await toDeclaration(user);
    scrollIntoView.mockClear();
    await submitCorporate(user);
    await screen.findByText('Thank you');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('jumps instantly instead of smoothly when the visitor prefers reduced motion', async () => {
    window.matchMedia = ((query: string) => ({ matches: query.includes('prefers-reduced-motion'), media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    const user = userEvent.setup();
    render(<App />);
    await chooseIndividual(user);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'start', behavior: 'auto' });
  });
});
