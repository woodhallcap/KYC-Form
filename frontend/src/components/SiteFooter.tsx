import { CONTACT } from '../lib/copy';

const YEAR = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="mt-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-primary/10 pt-6 text-sm text-ink/70">
      <p className="m-0">© {YEAR} Woodhall Finance. All rights reserved.</p>
      <p className="m-0 flex flex-wrap gap-x-6 gap-y-1">
        <a href={`mailto:${CONTACT.email}`} className="text-primary underline-offset-2 hover:underline">
          {CONTACT.email}
        </a>
        <a href={CONTACT.websiteHref} className="text-primary underline-offset-2 hover:underline">
          {CONTACT.website}
        </a>
      </p>
    </footer>
  );
}
