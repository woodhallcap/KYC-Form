import type { CustomerType } from '../types';

interface TypeSelectorProps {
  onSelect: (type: CustomerType) => void;
}

const CHOICES: { type: CustomerType; title: string; description: string }[] = [
  { type: 'individual', title: 'Individual customer', description: 'For a person opening an account or applying for a facility.' },
  { type: 'corporate', title: 'Corporate customer', description: 'For a company, with its directors and beneficial owners.' },
];

export function TypeSelector({ onSelect }: TypeSelectorProps) {
  return (
    <section>
      <h2>Who is this form for?</h2>
      <p>Choose the option that matches the customer, and we will show the right questions.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {CHOICES.map((choice) => (
          <button
            key={choice.type}
            type="button"
            onClick={() => onSelect(choice.type)}
            className="cursor-pointer rounded-brand border border-primary bg-white p-5 text-left transition hover:bg-bg-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="mb-1 block font-heading text-xl text-primary">{choice.title}</span>
            <span className="block text-sm">{choice.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
