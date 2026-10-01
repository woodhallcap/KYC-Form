import { CONTACT } from '../lib/copy';
import { ArrowUpRightIcon, CheckIcon } from './icons';

export function Confirmation({ email }: { email: string }) {
  return (
    <div className="mx-auto max-w-lg py-6 text-center sm:py-10">
      <span className="mx-auto mb-6 grid size-16 place-items-center rounded-full bg-primary text-white">
        <CheckIcon className="size-8" />
      </span>
      <h2>Thank you</h2>
      <p>
        We have received your KYC / CDD submission. A copy is on its way to <strong className="font-semibold">{email}</strong>.
      </p>

      <ol aria-label="What happens next" className="mx-auto mt-8 mb-8 max-w-sm list-decimal space-y-2 pl-5 text-left text-sm">
        <li>Our compliance team reviews your details and documents.</li>
        <li>We contact you if anything is missing or unclear.</li>
        <li>Keep the emailed copy for your records.</li>
      </ol>

      <a href={CONTACT.websiteHref} className="group inline-flex items-center gap-1.5 text-[15px] font-semibold text-white">
        <span className="rounded-full bg-primary px-7 py-3 transition group-hover:bg-primary-dark">Back to {CONTACT.website}</span>
        <span className="grid size-[46px] place-items-center rounded-full bg-primary transition group-hover:bg-primary-dark">
          <ArrowUpRightIcon className="size-[18px]" />
        </span>
      </a>
    </div>
  );
}
