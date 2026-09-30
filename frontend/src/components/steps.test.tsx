import { useReducer } from 'react';
import type { ComponentType } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initialAppState, reducer } from '../lib/reducer';
import type { AppState } from '../lib/reducer';
import { ProgressBar } from './ProgressBar';
import { Step1Entity } from './Step1Entity';
import { Step2Directors } from './Step2Directors';
import { Step3Documents } from './Step3Documents';
import { Step4Funds } from './Step4Funds';
import { Step5Declaration } from './Step5Declaration';
import type { StepProps } from './stepProps';
import { DOCUMENT_LABELS } from '../lib/documents';

function Host({ Step, init }: { Step: ComponentType<StepProps>; init?: AppState }) {
  const [state, dispatch] = useReducer(reducer, init ?? initialAppState());
  return (
    <>
      <Step state={state} dispatch={dispatch} onNext={() => {}} onBack={() => {}} />
      <span data-testid="seal-name">{state.form.seal?.name ?? ''}</span>
      <span data-testid="pct-0">{state.form.directors[0]?.shareholdingPercent}</span>
      <span data-testid="pep-0">{state.form.directors[0]?.pep}</span>
    </>
  );
}

const at = (step: number): AppState => ({ ...initialAppState(), step });
const rowsOf = () => screen.getAllByRole('group', { name: /^Director \d+$/ });

describe('Step1Entity', () => {
  it('shows a required error only after the field is blurred empty', async () => {
    const user = userEvent.setup();
    render(<Host Step={Step1Entity} />);
    expect(screen.queryByText('Company name is required.')).toBeNull();
    await user.click(screen.getByLabelText('Company Name'));
    await user.tab();
    expect(screen.getByText('Company name is required.')).toBeInTheDocument();
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
    render(<Host Step={Step2Directors} init={at(2)} />);
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
    const init = { ...initialAppState(), errors: { directors: 'Add at least one director, signatory or UBO.' } };
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

describe('Step3Documents', () => {
  it('renders the 6 documents and shows the file input only once ticked', async () => {
    const user = userEvent.setup();
    render(<Host Step={Step3Documents} />);
    expect(Object.keys(DOCUMENT_LABELS)).toHaveLength(6);
    Object.values(DOCUMENT_LABELS).forEach((label) => expect(screen.getByLabelText(label)).toBeInTheDocument());
    const label = DOCUMENT_LABELS.certificate_of_incorporation;
    expect(screen.queryByLabelText(`File for ${label}`)).toBeNull();
    await user.click(screen.getByLabelText(label));
    expect(screen.getByLabelText(`File for ${label}`)).toBeInTheDocument();
  });

  it('shows the consent error from state', () => {
    const init = { ...initialAppState(), step: 3, errors: { consent: 'Consent to processing is required.' } };
    render(<Host Step={Step3Documents} init={init} />);
    expect(screen.getByText('Consent to processing is required.')).toBeInTheDocument();
  });
});

describe('Step4Funds', () => {
  it('captures both fields and shows required errors after blur', async () => {
    const user = userEvent.setup();
    render(<Host Step={Step4Funds} init={at(4)} />);
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

describe('Step5Declaration', () => {
  it('has both signatories with name and date fields and an optional seal input', () => {
    render(<Host Step={Step5Declaration} />);
    ['Authorized Signatory 1 — Name', 'Authorized Signatory 1 — Date', 'Authorized Signatory 2 — Name', 'Authorized Signatory 2 — Date']
      .forEach((l) => expect(screen.getByLabelText(l)).toBeInTheDocument());
    expect(screen.getByLabelText('Company seal (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText(/^I agree that the typed names/)).toBeInTheDocument();
  });

  it('stores the chosen seal file and shows a seal error from state', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const init = { ...initialAppState(), step: 5, errors: { sealFile: 'File type not allowed: s.exe' } };
    render(<Host Step={Step5Declaration} init={init} />);
    expect(screen.getByText('File type not allowed: s.exe')).toBeInTheDocument();
    await user.upload(screen.getByLabelText('Company seal (optional)'), new File(['x'], 'seal.png'));
    expect(screen.getByTestId('seal-name')).toHaveTextContent('seal.png');
  });

  it('disables submit and Back and shows Submitting… while sending', () => {
    const init = { ...initialAppState(), step: 5, status: 'submitting' as const };
    render(<Host Step={Step5Declaration} init={init} />);
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  });

  it('shows Submit Form when idle', () => {
    render(<Host Step={Step5Declaration} />);
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeEnabled();
  });
});

describe('ProgressBar', () => {
  it('marks active and complete pills for five steps', () => {
    render(<ProgressBar titles={['A', 'B', 'C', 'D', 'E']} step={3} />);
    expect(screen.getByTestId('progress-step-3').className).toContain('bg-primary');
    expect(screen.getByTestId('progress-step-2').className).toContain('bg-accent');
    expect(screen.getByTestId('progress-step-4').className).toContain('bg-bg-alt');
    expect(screen.getByText('Step 3 of 5: C')).toBeInTheDocument();
  });
});
