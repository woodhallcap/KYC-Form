import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrandPanel } from './BrandPanel';
import { Button } from './Button';
import { Confirmation } from './Confirmation';
import { FileTile } from './FileTile';
import { ProgressBar } from './ProgressBar';
import { SectionHeading } from './SectionHeading';
import { SiteFooter } from './SiteFooter';
import { TypeSelector } from './TypeSelector';
import { formatFileSize } from '../lib/format';

function TileHost({ error }: { error?: string }) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <>
      <FileTile label="File for ID" caption="ID" file={file} onChange={setFile} error={error} />
      <span data-testid="name">{file?.name ?? ''}</span>
    </>
  );
}

describe('formatFileSize', () => {
  it('formats bytes, kilobytes and megabytes', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
  });
});

describe('FileTile', () => {
  it('has a labelled file input and an add prompt with the accepted types', () => {
    render(<TileHost />);
    expect(screen.getByLabelText('File for ID')).toHaveAttribute('type', 'file');
    expect(screen.getByText(/PDF, JPG, PNG or DOCX/)).toBeInTheDocument();
  });

  it('shows the chosen file name and size, and removes it again', async () => {
    const user = userEvent.setup();
    render(<TileHost />);
    await user.upload(screen.getByLabelText('File for ID'), new File([new Uint8Array(2048)], 'id.pdf'));
    expect(screen.getByTestId('name')).toHaveTextContent('id.pdf');
    expect(screen.getByText('id.pdf', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove File for ID' }));
    expect(screen.getByTestId('name')).toHaveTextContent('');
    expect(screen.queryByText('id.pdf', { selector: 'p' })).toBeNull();
    // the same file can be chosen again after removal
    await user.upload(screen.getByLabelText('File for ID'), new File([new Uint8Array(2048)], 'id.pdf'));
    expect(screen.getByTestId('name')).toHaveTextContent('id.pdf');
  });

  it('flags a disallowed type and an oversized file right under the tile', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { unmount } = render(<TileHost />);
    await user.upload(screen.getByLabelText('File for ID'), new File(['x'], 'a.exe'));
    expect(screen.getByRole('alert')).toHaveTextContent('File type not allowed: a.exe');
    unmount();
    render(<TileHost />);
    await user.upload(screen.getByLabelText('File for ID'), new File([new Uint8Array(6 * 1024 * 1024)], 'big.pdf'));
    expect(screen.getByRole('alert')).toHaveTextContent('File exceeds 5MB limit: big.pdf');
  });

  it('shows a supplied error (for example from the server) when there is no file problem', () => {
    render(<TileHost error="Could not upload this file." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not upload this file.');
  });
});

describe('Button', () => {
  it('adds an arrow circle only when asked, without changing the accessible name', () => {
    const { rerender } = render(<Button>Next: Documents</Button>);
    expect(screen.getByRole('button', { name: 'Next: Documents' }).querySelector('svg')).toBeNull();
    rerender(<Button arrow>Next: Documents</Button>);
    const button = screen.getByRole('button', { name: 'Next: Documents' });
    expect(button.querySelector('svg')).not.toBeNull();
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is disabled and stays a plain button by default', () => {
    render(<Button disabled>Back</Button>);
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toHaveAttribute('type', 'button');
  });
});

describe('SectionHeading', () => {
  it('keeps the section marker and the title in one heading', () => {
    render(<SectionHeading text="Section A: Entity Information" />);
    expect(screen.getByRole('heading', { name: 'Section A: Entity Information' })).toBeInTheDocument();
    expect(screen.getByText('Section A:')).toBeInTheDocument();
  });

  it('renders a plain heading when there is no marker', () => {
    render(<SectionHeading text="Who is this form for?" />);
    expect(screen.getByRole('heading', { name: 'Who is this form for?' })).toBeInTheDocument();
  });
});

describe('ProgressBar (stepper)', () => {
  it('marks the active, complete and upcoming steps and ticks finished ones', () => {
    render(<ProgressBar titles={['A', 'B', 'C', 'D', 'E']} step={3} />);
    expect(screen.getByTestId('progress-step-1')).toHaveAttribute('data-state', 'complete');
    expect(screen.getByTestId('progress-step-2')).toHaveAttribute('data-state', 'complete');
    expect(screen.getByTestId('progress-step-3')).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('progress-step-3')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByTestId('progress-step-4')).toHaveAttribute('data-state', 'upcoming');
    expect(screen.getByTestId('progress-step-2').querySelector('svg')).not.toBeNull();
    expect(screen.getByTestId('progress-step-4').querySelector('svg')).toBeNull();
    expect(screen.getByText('Step 3 of 5: C')).toBeInTheDocument();
  });

  it('shows each step title, works for three steps, and says progress is saved', () => {
    render(<ProgressBar titles={['Customer Information', 'Documents', 'Declaration']} step={1} />);
    expect(within(screen.getByTestId('progress-step-2')).getByText('Documents')).toBeInTheDocument();
    expect(screen.queryByTestId('progress-step-4')).toBeNull();
    expect(screen.getByText(/progress is saved automatically/i)).toBeInTheDocument();
  });
});

describe('BrandPanel', () => {
  it('shows the logo, an intro and the help contacts before a type is chosen, with no checklist', () => {
    render(<BrandPanel customerType={null} />);
    expect(screen.getByRole('img', { name: 'Woodhall Finance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Customer due diligence' })).toBeInTheDocument();
    expect(screen.queryByText("What you'll need")).toBeNull();
    expect(screen.getByRole('link', { name: 'office@woodhallfinanceltd.com' })).toHaveAttribute('href', 'mailto:office@woodhallfinanceltd.com');
    expect(screen.getByRole('link', { name: '+234 14549820' })).toHaveAttribute('href', 'tel:+23414549820');
    expect(screen.getByText(/Wuse 2, Abuja/)).toBeInTheDocument();
  });

  it('lists what an individual needs', () => {
    render(<BrandPanel customerType="individual" />);
    expect(screen.getByRole('heading', { name: 'Individual customer' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: "What you'll need" });
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    expect(within(list).getByText(/passport photograph/i)).toBeInTheDocument();
  });

  it('lists what a company needs', () => {
    render(<BrandPanel customerType="corporate" />);
    expect(screen.getByRole('heading', { name: 'Corporate customer' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: "What you'll need" });
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
    expect(within(list).getByText(/CAC certificate of incorporation/i)).toBeInTheDocument();
  });
});

describe('SiteFooter', () => {
  it('shows the copyright, the website link and a contact route', () => {
    render(<SiteFooter />);
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} Woodhall Finance`))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'woodhallfinanceltd.com' })).toHaveAttribute('href', 'https://woodhallfinanceltd.com');
    expect(screen.getByRole('link', { name: 'office@woodhallfinanceltd.com' })).toHaveAttribute('href', 'mailto:office@woodhallfinanceltd.com');
  });
});

describe('TypeSelector', () => {
  it('shows both customer types with what each needs, and reports the choice', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TypeSelector onSelect={onSelect} />);
    expect(screen.getByRole('heading', { name: 'Who is this form for?' })).toBeInTheDocument();
    const individual = screen.getByRole('button', { name: /Individual customer/ });
    const corporate = screen.getByRole('button', { name: /Corporate customer/ });
    expect(within(individual).getByText(/A valid ID/)).toBeInTheDocument();
    expect(within(corporate).getByText(/Directors and owners above 5%/)).toBeInTheDocument();
    await user.click(individual);
    await user.click(corporate);
    expect(onSelect.mock.calls).toEqual([['individual'], ['corporate']]);
  });
});

describe('Confirmation', () => {
  it('thanks the customer, names the email, explains what happens next and links back to the website', () => {
    render(<Confirmation email="info@acme.com" />);
    expect(screen.getByRole('heading', { name: 'Thank you' })).toBeInTheDocument();
    expect(screen.getByText('info@acme.com')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'What happens next' })).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('link', { name: /Back to woodhallfinanceltd.com/ })).toHaveAttribute('href', 'https://woodhallfinanceltd.com');
  });
});
