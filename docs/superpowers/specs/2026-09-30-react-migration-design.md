# React Frontend Migration — Design

Date: 2026-09-30

## Goal

Replace the vanilla HTML/CSS/JS wizard with a React + TypeScript + Tailwind app, with
**no change in behavior** for the 3-step KYC/CDD form. The PHP backend (`submit.php`,
`lib/`, `vendor/`, `config.php`) is untouched and Bluehost shared hosting remains the
deployment target.

## Decisions (agreed with owner)

- Scope: **frontend only**. No backend, PDF, email, or field changes.
- Stack: Vite + React + TypeScript. No form library; `useReducer` + ported validators.
- Styling: **Tailwind v4** (`@tailwindcss/vite`, CSS-first `@theme`). `style.css` is deleted.
- Deploy: a build script replaces the manual `woodhall-kyc-deploy.zip`.

## Non-goals

Backend changes, visual redesign, new fields, new validation rules.

## Layout and build

- React app in `frontend/`. PHP files stay at the repo root.
- `npm run build` (in `frontend/`) emits `frontend/dist/`.
- `scripts/package.sh` assembles a deploy folder/zip: `dist/*` at the web root plus
  `submit.php`, `config.php`, `lib/`, `vendor/`, `.htaccess`, `.user.ini`, `docs/.htaccess`.
  `preview.php` and `tests/` are excluded.
- Dev: Vite on :5173 proxies `/submit.php` to `php -S localhost:8000`.
- Public assets (logos, Vanitas fonts) move to `frontend/public/` or `frontend/src/assets/`.

## Components and state

- `App` owns a reducer: `step`, `data` (all text fields, `legalStatus`, per-document
  `{submitted, file}`, `consent`, `signatureAgree`), `touched`, `errors`, `status`
  (`idle | submitting | done`).
- Components: `Header`, `ProgressBar` (desktop steps + mobile bar), `DraftBanner`,
  `Step1Entity`, `Step2Documents`, `Step3Declaration`, `Confirmation`.
  Shared: `Field` (label, input/textarea, error), `RadioGroup`, `DocumentRow`, `Button`.
- `lib/validation.ts` is a direct port of `assets/js/validation.js`: `validateStep1/2/3`,
  same messages, same limits (5MB file, 20MB total; pdf/jpg/jpeg/png/docx), same
  `DOCUMENT_IDS`.

## Behavior parity

- Inline validation: an error appears once a field is touched (blur/change) and
  re-validates on input; Next validates and touches the whole step.
- Autosave: localStorage key `woodhall-kyc-draft-v1`, 800ms debounce, same JSON shape
  (`fields`, `legalStatus`, `documents`, `consent`, `signatureAgree`), so drafts from the
  old form restore. Files are never persisted. Storage failures are swallowed.
  "Clear and start over" resets the form and the draft.
- Submit: `FormData` with the same field names the PHP reads; `POST submit.php`.
  Success → clear draft, show confirmation with the company email. Failure with
  `errors` → jump to the earliest step containing an errored field and show them, plus an
  alert with the message; network failure → alert. Submit and Back disabled while sending.
- Legal status "other" reveals the extra text input.
- Step transition slides (180ms) unless `prefers-reduced-motion`.
- Dev "Fill test data" button only under `import.meta.env.DEV` (absent from prod builds).

## Styling

- Tailwind theme tokens from the current `:root`: `primary #0E4033`, `primary-dark #0B473A`,
  `accent #8FD299`, `bg #F9F3F0`, `bg-alt #F4E7E1`, `ink #161616`, `error #B3261E`;
  `font-heading` Vanitas (4 `@font-face` weights kept in `index.css`); `font-body` Jost;
  10px radius; card shadow `0 10px 30px rgba(14,64,51,.08)`.
- Jost was referenced but never loaded; load it (Google Fonts) so it stops silently
  falling back.
- Utility classes in components; repeated patterns live in components, not `@apply`.
- Mobile layout matches the old 600px breakpoint as closely as Tailwind's `sm` allows.
- Motion via `motion-safe`/`motion-reduce` and a small `@keyframes` for the spinner.

## Testing

- Vitest: ported validation cases from `tests/js/validation.test.js`.
- React Testing Library: step navigation gated by validation, "other" legal status,
  draft restore/clear, submit success, server-error step jump, network error.
- PHP tests unchanged and must still pass.
- Manual: run against `php -S`, submit a real test form, confirm both emails and PDF.

## Cleanup

After parity is verified: delete `index.html`, `assets/js/`, `assets/css/`, the old JS
test, and move remaining assets. Update `README.md` (stack, structure, dev, build, deploy).

## Risks

- Tailwind `sm` (640px) vs the old 600px breakpoint: minor drift, noted if seen.
- Deploy layout change: `index.html` now comes from `dist/`; `submit.php` must resolve at
  the same origin path (`/submit.php`), which the package script guarantees.
