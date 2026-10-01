import logo from '../../../assets/logos/woodhall-finance-darkbg.svg';
import { CONTACT, NEEDS } from '../lib/copy';
import type { CustomerType } from '../types';
import { CheckIcon, LeafShape, MailIcon, PhoneIcon, PinIcon } from './icons';

interface BrandPanelProps {
  customerType: CustomerType | null;
}

const INTRO: Record<'none' | CustomerType, { title: string; text: string }> = {
  none: {
    title: 'Customer due diligence',
    text: "A few minutes now lets us verify and onboard you properly. Choose the customer type to see what you'll need. Your progress saves as you go.",
  },
  individual: {
    title: 'Individual customer',
    text: 'We verify your identity and address before opening an account or approving a facility.',
  },
  corporate: {
    title: 'Corporate customer',
    text: 'We verify the company, its directors and anyone who owns more than 5% before opening an account or approving a facility.',
  },
};

function ContactRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-accent">{icon}</span>
      <span className="pt-1.5 text-sm leading-snug">{children}</span>
    </li>
  );
}

/** The one bold element: a dark-green brand panel with the site's tan leaf. */
export function BrandPanel({ customerType }: BrandPanelProps) {
  const intro = INTRO[customerType ?? 'none'];
  const needs = customerType ? NEEDS[customerType] : null;
  return (
    <aside
      aria-label="About this form"
      className="relative overflow-hidden rounded-brand bg-primary p-6 text-white sm:p-8 lg:sticky lg:top-6"
    >
      <LeafShape className="pointer-events-none absolute -top-16 -right-16 size-44 -scale-x-100 text-accent opacity-90" />
      <div className="relative">
        <img src={logo} alt="Woodhall Finance" className="h-11 w-auto sm:h-12" />
        <h2 className="mt-8 mb-3 text-white">{intro.title}</h2>
        <p className="mb-0 text-white/80 lg:mb-6">{intro.text}</p>

        <div className="hidden lg:block">
          {needs && (
            <>
              <h3 className="mb-3 text-base font-semibold text-accent">What you&apos;ll need</h3>
              <ul aria-label="What you'll need" className="m-0 mb-8 list-none space-y-3 p-0">
                {needs.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-snug">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-primary">
                      <CheckIcon className="size-3" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <section aria-label="Contact us" className="rounded-2xl bg-white/10 p-4">
            <h3 className="mb-3 text-base font-semibold text-white">Need help?</h3>
            <ul className="m-0 list-none space-y-3 p-0">
              <ContactRow icon={<MailIcon className="size-4" />}>
                <a href={`mailto:${CONTACT.email}`} className="underline-offset-2 hover:underline">
                  {CONTACT.email}
                </a>
              </ContactRow>
              <ContactRow icon={<PhoneIcon className="size-4" />}>
                <a href={CONTACT.phoneHref} className="underline-offset-2 hover:underline">
                  {CONTACT.phoneDisplay}
                </a>
              </ContactRow>
              <ContactRow icon={<PinIcon className="size-4" />}>{CONTACT.address}</ContactRow>
            </ul>
          </section>
        </div>
      </div>
    </aside>
  );
}
