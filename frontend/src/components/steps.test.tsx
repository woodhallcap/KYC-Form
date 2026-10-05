import { useReducer } from 'react';
import type { ComponentType } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initialAppState, reducer } from '../lib/reducer';
import type { Action, AppState } from '../lib/reducer';
import type { CustomerType } from '../types';
import { TypeSelector } from './TypeSelector';
import { Step1Entity } from './Step1Entity';
import { Step2Directors } from './Step2Directors';
import { Step3Documents } from './Step3Documents';
import { Step4Funds } from './Step4Funds';
import { Step5Declaration } from './Step5Declaration';
import { IndividualStep1Person } from './IndividualStep1Person';
import { IndividualStep2Documents } from './IndividualStep2Documents';
import { IndividualStep3Declaration } from './IndividualStep3Declaration';
import type { StepProps } from './stepProps';
import { CORPORATE_DOCUMENTS, INDIVIDUAL_DOCUMENTS } from '../lib/documents';

const forType = (customerType: CustomerType, step = 1, extra: Action[] = []): AppState =>
  [{ type: 'selectType', customerType } as Action, { type: 'goTo', step } as Action, ...extra].reduce(reducer, initialAppState());
const corp = (step = 1) => forType('corporate', step);
const indiv = (step = 1) => forType('individual', step);

function Host({ Step, init }: { Step: ComponentType<StepProps>; init?: AppState }) {
  const [state, dispatch] = useReducer(reducer, init ?? corp());
  const p = state.individual.person;
  return (
    <>
      <Step state={state} dispatch={dispatch} onNext={() => {}} onBack={() => {}} />
      <span data-testid="seal-name">{state.corporate.images.sealFile?.name ?? ''}</span>
      <span data-testid="pct-0">{state.corporate.directors[0]?.shareholdingPercent}</span>
      <span data-testid="pep-0">{state.corporate.directors[0]?.pep}</span>
      <span data-testid="gender">{p.gender}</span>
      <span data-testid="means">{p.meansOfId.join(',')}</span>
      <span data-testid="income">{p.sourceOfIncome}</span>
    </>
  );
}

const rowsOf = () => screen.getAllByRole('group', { name: /^Director \d+$/ });

describe('TypeSelector', () => {
  it('renders both customer types and reports the choice', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TypeSelector onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: /Individual customer/ }));
    await user.click(screen.getByRole('button', { name: /Corporate customer/ }));
    expect(onSelect.mock.calls).toEqual([['individual'], ['corporate']]);
  });
});

describe('Step1Entity', () => {
  it('shows a required error only after the field is blurred empty', async () => {
    const user = userEvent.setup();
    render(<Host Step={Step1Entity} />);
    expect(screen.queryByText('Company name is required.')).toBeNull();
    await user.click(screen.getByLabelText('Company Name'));
    await user.tab();
    expect(screen.getByText('Company name is required.')).toBeInTheDocument();
  });

  it('labels the registration number as BN / RC', () => {
    render(<Host Step={Step1Entity} />);
    expect(screen.getByLabelText('Business Registration Number (BN / RC)')).toBeInTheDocument();
    expect(screen.queryByLabelText('RC Number')).toBeNull();
  });

  it('has company email and no legal status or website', () => {
    render(<Host Step={Step1Entity} />);
    expect(screen.getByLabelText('Company Email')).toBeInTheDocument();
    expect(screen.queryByLabelText('Website (if any)')).toBeNull();
    expect(screen.queryByText('Legal Status')).toBeNull();
    expect(screen.getByLabelText('Business/Operating Address (if different)')).toBeInTheDocument();
  });
});

describe('Step2Directors', () => {
  it('adds and removes rows, keeps the last row, and scopes errors to the row', async () => {
    const user = userEvent.setup();
    render(<Host Step={Step2Directors} init={corp(2)} />);
    expect(rowsOf()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Remove director 1' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Add another person' }));
    const rows = rowsOf();
    expect(rows).toHaveLength(2);
    await user.click(within(rows[1]).getByLabelText('Name'));
    await user.tab();
    expect(within(rows[1]).getByText('Name is required.')).toBeInTheDocument();
    expect(within(rows[0]).queryByText('Name is required.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Remove director 1' }));
    expect(rowsOf()).toHaveLength(1);
    expect(screen.queryByText('Name is required.')).toBeNull();
  });

  it('captures PEP and shareholding', async () => {
    const user = userEvent.setup();
    render(<Host Step={Step2Directors} />);
    const row = rowsOf()[0];
    await user.click(within(row).getByLabelText('Yes'));
    await user.type(within(row).getByLabelText('% Shareholding'), '12.5');
    expect(screen.getByTestId('pep-0')).toHaveTextContent('yes');
    expect(screen.getByTestId('pct-0')).toHaveTextContent('12.5');
  });

  it('shows a file input for each attachment type', () => {
    render(<Host Step={Step2Directors} />);
    ['ID', 'BVN', 'NIN', 'Proof of address'].forEach((l) =>
      expect(screen.getByLabelText(`Director 1 ${l} file`)).toBeInTheDocument());
  });

  it('shows the list-level error when present', () => {
    const init = { ...corp(2), errors: { directors: 'Add at least one director, signatory or UBO.' } };
    render(<Host Step={Step2Directors} init={init} />);
    expect(screen.getByText('Add at least one director, signatory or UBO.')).toBeInTheDocument();
  });

  it('disables Add another person at 25 rows', async () => {
    const user = userEvent.setup();
    render(<Host Step={Step2Directors} />);
    for (let i = 0; i < 24; i++) await user.click(screen.getByRole('button', { name: 'Add another person' }));
    expect(rowsOf()).toHaveLength(25);
    expect(screen.getByRole('button', { name: 'Add another person' })).toBeDisabled();
  });
});

describe('Step3Documents (corporate)', () => {
  it('renders a file input and a Required or Optional badge for every document, and shows an uploaded file', async () => {
    const user = userEvent.setup();
    render(<Host Step={Step3Documents} />);
    CORPORATE_DOCUMENTS.forEach((d) => expect(screen.getByLabelText(d.label)).toBeInTheDocument());
    expect(screen.getAllByText('Required')).toHaveLength(CORPORATE_DOCUMENTS.filter((d) => d.required).length);
    await user.upload(screen.getByLabelText(CORPORATE_DOCUMENTS[0].label), new File(['x'], 'a.pdf'));
    expect(screen.getByText('a.pdf')).toBeInTheDocument();
  });

  it('shows the consent error from state', () => {
    const init = { ...corp(3), errors: { consent: 'Consent to processing is required.' } };
    render(<Host Step={Step3Documents} init={init} />);
    expect(screen.getByText('Consent to processing is required.')).toBeInTheDocument();
  });
});

describe('Step4Funds', () => {
  it('captures both fields and shows required errors after blur', async () => {
    const user = userEvent.setup();
    render(<Host Step={Step4Funds} init={corp(4)} />);
    await user.click(screen.getByLabelText('Source of Funds'));
    await user.tab();
    expect(screen.getByText('Source of funds is required.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Source of Funds'), 'Sales');
    expect(screen.queryByText('Source of funds is required.')).toBeNull();
    await user.click(screen.getByLabelText('Facility Amount Requested (₦)'));
    await user.tab();
    expect(screen.getByText('Facility amount requested is required.')).toBeInTheDocument();
  });
});

describe('Step5Declaration (corporate)', () => {
  it('has both signatories with name and date fields and the signature and seal image tiles', () => {
    render(<Host Step={Step5Declaration} />);
    ['Authorized Signatory 1 — Name', 'Authorized Signatory 1 — Date', 'Authorized Signatory 2 — Name', 'Authorized Signatory 2 — Date']
      .forEach((l) => expect(screen.getByLabelText(l)).toBeInTheDocument());
    ['Authorized Signatory 1 — Handwritten Signature', 'Authorized Signatory 2 — Handwritten Signature', 'Company Seal or Stamp']
      .forEach((l) => expect(screen.getByLabelText(l)).toBeInTheDocument());
    expect(screen.getByLabelText(/^We confirm the attached images/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^I agree that the typed names/)).toBeNull();
  });

  it('stores the chosen seal file and shows a seal error from state', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const init = { ...corp(5), errors: { sealFile: 'Company seal or stamp is required.' } };
    render(<Host Step={Step5Declaration} init={init} />);
    expect(screen.getByText('Company seal or stamp is required.')).toBeInTheDocument();
    await user.upload(screen.getByLabelText('Company Seal or Stamp'), new File(['x'], 'seal.png'));
    expect(screen.getByTestId('seal-name')).toHaveTextContent('seal.png');
  });

  it('shows the image-type error when a PDF is chosen as the seal', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<Host Step={Step5Declaration} />);
    await user.upload(screen.getByLabelText('Company Seal or Stamp'), new File(['x'], 'sig.pdf'));
    expect(screen.getByText('Upload a JPG or PNG image.')).toBeInTheDocument();
  });

  it('disables submit and Back and shows Submitting… while sending', () => {
    const init = { ...corp(5), status: 'submitting' as const };
    render(<Host Step={Step5Declaration} init={init} />);
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  });

  it('shows Submit Form when idle', () => {
    render(<Host Step={Step5Declaration} />);
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeEnabled();
  });
});

describe('IndividualStep1Person', () => {
  const groupOf = (name: string) => screen.getByRole('group', { name });
  const radiosOf = (name: string) => screen.getByRole('radiogroup', { name });

  it('shows a required error only after a field is blurred empty, and checks the email', async () => {
    const user = userEvent.setup();
    render(<Host Step={IndividualStep1Person} init={indiv()} />);
    expect(screen.queryByText('Full name is required.')).toBeNull();
    await user.click(screen.getByLabelText('Full Name'));
    await user.tab();
    expect(screen.getByText('Full name is required.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'nope');
    await user.tab();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
  });

  it('has every field, with duplicate labels reachable within their groups', () => {
    render(<Host Step={IndividualStep1Person} init={indiv()} />);
    ['Full Name', 'Date of Birth', 'Place of Birth', 'Nationality', 'Country of Residence', 'Residential Address', 'LGA', 'State', 'Phone No', 'Email',
      'ID No (optional)', 'Expiry Date (optional)', 'Occupation', 'Employer/Business Name', 'Office Address', 'Source of Wealth',
      'Official Email'].forEach((l) => expect(screen.getByLabelText(l), l).toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: 'BVN' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'NIN' })).toBeInTheDocument();
    expect(within(groupOf('Means of ID')).getAllByRole('checkbox')).toHaveLength(4);
    expect(within(groupOf('Means of ID')).queryByLabelText('BVN')).toBeNull();
    expect(within(radiosOf('Gender')).getAllByRole('radio')).toHaveLength(2);
    expect(within(radiosOf('Source of Income')).getAllByRole('radio')).toHaveLength(5);
    expect(within(radiosOf('Purpose of Relationship with Woodhall Finance')).getAllByRole('radio')).toHaveLength(4);
    expect(screen.queryByLabelText(/Expected Monthly Turnover/)).toBeNull();
    expect(screen.queryByText(/Expected Transaction Type/)).toBeNull();
    const office = screen.getByLabelText('Office Address');
    const official = screen.getByLabelText('Official Email');
    expect(office.compareDocumentPosition(official) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sets gender and toggles multiple means of ID', async () => {
    const user = userEvent.setup();
    render(<Host Step={IndividualStep1Person} init={indiv()} />);
    await user.click(within(radiosOf('Gender')).getByLabelText('Female'));
    expect(screen.getByTestId('gender')).toHaveTextContent('F');
    const means = within(groupOf('Means of ID'));
    await user.click(means.getByLabelText('NIN'));
    await user.click(means.getByLabelText("Driver's License"));
    expect(screen.getByTestId('means')).toHaveTextContent('nin,drivers_license');
    await user.click(means.getByLabelText('NIN'));
    expect(screen.getByTestId('means')).toHaveTextContent(/^drivers_license$/);
  });

  it('reveals the specify input only for Source of Income = Other, independently of Purpose', async () => {
    const user = userEvent.setup();
    render(<Host Step={IndividualStep1Person} init={indiv()} />);
    expect(screen.queryByLabelText('Specify source of income')).toBeNull();
    expect(screen.queryByLabelText('Specify purpose')).toBeNull();
    await user.click(within(radiosOf('Source of Income')).getByLabelText('Other'));
    expect(screen.getByLabelText('Specify source of income')).toBeInTheDocument();
    expect(screen.queryByLabelText('Specify purpose')).toBeNull();
    await user.click(within(radiosOf('Purpose of Relationship with Woodhall Finance')).getByLabelText('Other'));
    expect(screen.getByLabelText('Specify purpose')).toBeInTheDocument();
    await user.click(within(radiosOf('Source of Income')).getByLabelText('Salary'));
    expect(screen.queryByLabelText('Specify source of income')).toBeNull();
    expect(screen.getByLabelText('Specify purpose')).toBeInTheDocument();
  });

  it('shows the specify error after blur, and group errors inside their group', async () => {
    const user = userEvent.setup();
    const init = { ...indiv(), errors: { meansOfId: 'Select at least one means of ID.' } };
    render(<Host Step={IndividualStep1Person} init={init} />);
    expect(screen.getByText('Select at least one means of ID.')).toBeInTheDocument();
    await user.click(within(radiosOf('Source of Income')).getByLabelText('Other'));
    await user.click(screen.getByLabelText('Specify source of income'));
    await user.tab();
    expect(screen.getByText('Please specify the source of income.')).toBeInTheDocument();
  });
});

describe('IndividualStep2Documents', () => {
  it('renders a file input and a Required or Optional badge for every document, and shows an uploaded file', async () => {
    const user = userEvent.setup();
    render(<Host Step={IndividualStep2Documents} init={indiv(2)} />);
    INDIVIDUAL_DOCUMENTS.forEach((d) => expect(screen.getByLabelText(d.label)).toBeInTheDocument());
    expect(screen.getAllByText('Required')).toHaveLength(INDIVIDUAL_DOCUMENTS.filter((d) => d.required).length);
    expect(screen.getAllByText('Optional')).toHaveLength(INDIVIDUAL_DOCUMENTS.filter((d) => !d.required).length);
    await user.upload(screen.getByLabelText('Valid Means of ID'), new File(['x'], 'a.pdf'));
    expect(screen.getByText('a.pdf')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Section B: Verification Documents' })).toBeInTheDocument();
  });

  it('shows the consent error and a next button for the declaration', () => {
    const init = { ...indiv(2), errors: { consent: 'Consent to processing is required.' } };
    render(<Host Step={IndividualStep2Documents} init={init} />);
    expect(screen.getByText('Consent to processing is required.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next: Declaration' })).toBeInTheDocument();
  });
});

describe('IndividualStep3Declaration', () => {
  it('has name, date, signature image and agreement, and validates after blur', async () => {
    const user = userEvent.setup();
    render(<Host Step={IndividualStep3Declaration} init={indiv(3)} />);
    expect(screen.getByRole('heading', { name: 'Section C: Declaration' })).toBeInTheDocument();
    ['Full Name', 'Date', 'Handwritten Signature'].forEach((l) => expect(screen.getByLabelText(l)).toBeInTheDocument());
    expect(screen.getByLabelText(/^I confirm the attached image/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Typed Signature (type your full name)')).toBeNull();
    await user.click(screen.getByLabelText('Full Name'));
    await user.tab();
    expect(screen.getByText('Name is required.')).toBeInTheDocument();
  });

  it('shows the image-type error when a PDF is chosen as the signature', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<Host Step={IndividualStep3Declaration} init={indiv(3)} />);
    await user.upload(screen.getByLabelText('Handwritten Signature'), new File(['x'], 'sig.pdf'));
    expect(screen.getByText('Upload a JPG or PNG image.')).toBeInTheDocument();
  });

  it('disables submit and Back while sending, and shows Submit Form when idle', () => {
    const { unmount } = render(<Host Step={IndividualStep3Declaration} init={{ ...indiv(3), status: 'submitting' as const }} />);
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    unmount();
    render(<Host Step={IndividualStep3Declaration} init={indiv(3)} />);
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeEnabled();
  });
});

describe('declaration wording', () => {
  it('names Woodhall Finance Company Ltd in both declarations', () => {
    const { unmount } = render(<Host Step={Step5Declaration} init={corp(5)} />);
    expect(screen.getByText(/Woodhall Finance Company Ltd is obligated to report suspicious transactions to NFIU/)).toBeInTheDocument();
    expect(screen.queryByText(/Woodhall Capital/)).toBeNull();
    unmount();
    render(<Host Step={IndividualStep3Declaration} init={indiv(3)} />);
    expect(screen.getByText(/authorize Woodhall Finance Company Ltd to verify my details/)).toBeInTheDocument();
    expect(screen.queryByText(/Woodhall Capital/)).toBeNull();
  });
});
