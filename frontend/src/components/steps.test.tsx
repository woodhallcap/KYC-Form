import { useReducer } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initialAppState, reducer } from '../lib/reducer';
import type { AppState } from '../lib/reducer';
import { Step1Entity } from './Step1Entity';
import { Step2Documents } from './Step2Documents';
import { Step3Declaration } from './Step3Declaration';
import { DOCUMENT_LABELS } from '../lib/documents';

type StepComponent = typeof Step1Entity;

function Host({ Step, init }: { Step: StepComponent; init?: AppState }) {
  const [state, dispatch] = useReducer(reducer, init ?? initialAppState());
  return <Step state={state} dispatch={dispatch} onNext={() => {}} onBack={() => {}} />;
}

describe('Step1Entity', () => {
  it('shows a required error only after the field is blurred empty', async () => {
    const user = userEvent.setup();
    render(<Host Step={Step1Entity} />);
    expect(screen.queryByText('Company name is required.')).toBeNull();
    await user.click(screen.getByLabelText('Company Name'));
    await user.tab();
    expect(screen.getByText('Company name is required.')).toBeInTheDocument();
  });

  it('reveals the specify input only for legal status Other', async () => {
    const user = userEvent.setup();
    render(<Host Step={Step1Entity} />);
    expect(screen.queryByPlaceholderText('Please specify')).toBeNull();
    await user.click(screen.getByLabelText('Other'));
    expect(screen.getByPlaceholderText('Please specify')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Private Limited Company'));
    expect(screen.queryByPlaceholderText('Please specify')).toBeNull();
  });
});

describe('Step2Documents', () => {
  it('renders all 12 documents and shows the file input only once ticked', async () => {
    const user = userEvent.setup();
    render(<Host Step={Step2Documents} />);
    Object.values(DOCUMENT_LABELS).forEach((label) => expect(screen.getByLabelText(label)).toBeInTheDocument());
    expect(Object.keys(DOCUMENT_LABELS)).toHaveLength(12);
    expect(screen.queryByLabelText('File for Certificate of Incorporation')).toBeNull();
    await user.click(screen.getByLabelText('Certificate of Incorporation'));
    expect(screen.getByLabelText('File for Certificate of Incorporation')).toBeInTheDocument();
  });
});

describe('Step3Declaration', () => {
  it('disables submit and Back and shows Submitting… while sending', () => {
    const init = { ...initialAppState(), step: 3 as const, status: 'submitting' as const };
    render(<Host Step={Step3Declaration} init={init} />);
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  });

  it('shows Submit Form when idle', () => {
    render(<Host Step={Step3Declaration} />);
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeEnabled();
  });
});
