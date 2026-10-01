import { CUSTOMER_LABEL, NEEDS_SHORT } from '../lib/copy';
import type { CustomerType } from '../types';
import { SectionHeading } from './SectionHeading';
import { ArrowUpRightIcon, BuildingIcon, CheckIcon, UserIcon } from './icons';

interface TypeSelectorProps {
  onSelect: (type: CustomerType) => void;
}

const CHOICES: { type: CustomerType; description: string; icon: React.ReactNode }[] = [
  {
    type: 'individual',
    description: 'For a person opening an account or applying for a facility.',
    icon: <UserIcon className="size-6" />,
  },
  {
    type: 'corporate',
    description: 'For a company, with its directors and beneficial owners.',
    icon: <BuildingIcon className="size-6" />,
  },
];

export function TypeSelector({ onSelect }: TypeSelectorProps) {
  return (
    <section>
      <SectionHeading text="Who is this form for?" />
      <p>Choose the option that matches the customer, and we will show the right questions.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {CHOICES.map((choice) => (
          <button
            key={choice.type}
            type="button"
            onClick={() => onSelect(choice.type)}
            className="group flex cursor-pointer flex-col rounded-3xl border border-primary/20 bg-white p-6 text-left transition hover:border-primary hover:bg-cream"
          >
            <span className="mb-4 grid size-12 place-items-center rounded-full bg-primary text-white">{choice.icon}</span>
            <span className="mb-1 block text-xl text-primary">{CUSTOMER_LABEL[choice.type]}</span>
            <span className="mb-4 block text-sm text-ink/80">{choice.description}</span>
            <span className="mb-5 block space-y-1.5">
              {NEEDS_SHORT[choice.type].map((item) => (
                <span key={item} className="flex items-center gap-2 text-sm">
                  <CheckIcon className="size-4 shrink-0 text-copper-dark" />
                  <span>{item}</span>
                </span>
              ))}
            </span>
            <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              Start
              <span className="grid size-8 place-items-center rounded-full bg-primary text-white transition group-hover:translate-x-0.5">
                <ArrowUpRightIcon className="size-4" />
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
