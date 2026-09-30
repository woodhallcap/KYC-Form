# React Frontend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vanilla HTML/CSS/JS KYC wizard with a React + TypeScript + Tailwind app with identical behavior, keeping the PHP backend untouched.

**Architecture:** Vite app in `frontend/` builds to static files. State lives in one `useReducer` in `App`; validation is a typed port of `assets/js/validation.js`; autosave and submit are small pure modules under `src/lib/`. `scripts/package.sh` assembles `dist/` + PHP into a deploy folder/zip for Bluehost.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind v4 (`@tailwindcss/vite`), Vitest, React Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-09-30-react-migration-design.md`

## Global Constraints

- Backend (`submit.php`, `lib/`, `vendor/`, `config.php`) is not modified.
- Same validation messages and limits: 5MB per file, 20MB total; extensions `pdf, jpg, jpeg, png, docx`.
- localStorage key `woodhall-kyc-draft-v1`, debounce 800ms, same JSON shape (`fields`, `legalStatus`, `documents`, `consent`, `signatureAgree`).
- FormData field names identical to the old form: text fields by name, `legalStatus`, `legalStatusOther`, `documents[<id>][submitted]`, `documents[<id>][file]`, `consent`, `signatureAgree`.
- POST target is `submit.php` (relative), same origin.
- Theme tokens: primary `#0E4033`, primary-dark `#0B473A`, accent `#8FD299`, bg `#F9F3F0`, bg-alt `#F4E7E1`, ink `#161616`, error `#B3261E`; radius 10px; card shadow `0 10px 30px rgba(14,64,51,0.08)`; heading font Vanitas, body font Jost.
- Dev prefill button only when `import.meta.env.DEV`.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Draft saved with `legalStatus: "other"` restores AND shows the "Please specify" input.
- Corrupt or non-object JSON in localStorage, or storage that throws, must not crash the app.
- Server returns non-JSON (PHP fatal / HTML 500): user sees the network-error alert and can retry (buttons re-enabled).
- Whitespace-only values count as blank; a second click on Submit while sending does nothing.
- Server errors keyed by a field on step 1 or 3 jump to the earliest errored step; unmatched keys (document ids, `_total`) show only as an alert (old behavior).

## File Structure

```
frontend/
  package.json, tsconfig*.json, vite.config.ts, index.html
  public/logos/*, public/fonts/*           (moved from assets/)
  src/main.tsx, src/index.css              entry + Tailwind theme/fonts
  src/App.tsx                              layout, step orchestration, submit
  src/types.ts                             FormData shape, Errors
  src/lib/validation.ts                    port of validation.js
  src/lib/autosave.ts                      load/save/clear draft
  src/lib/submit.ts                        buildFormData + postSubmission
  src/lib/reducer.ts                       form state reducer
  src/components/{Header,ProgressBar,DraftBanner,Field,Button,DocumentRow,Confirmation}.tsx
  src/components/{Step1Entity,Step2Documents,Step3Declaration}.tsx
  src/dev/prefill.ts                       sample data
  src/**/*.test.ts(x)
scripts/package.sh
```

---

### Task 1: Scaffold Vite + React + TS + Tailwind + Vitest

**Files:** Create `frontend/` (package.json, tsconfig, vite.config.ts, index.html, src/main.tsx, src/index.css, src/App.tsx stub, src/test-setup.ts); move `assets/logos` → `frontend/public/logos`, `assets/fonts` → `frontend/public/fonts`.

**Interfaces:** Produces the `npm run dev|build|test` scripts and the Tailwind tokens `bg-primary`, `text-primary`, `bg-accent`, `bg-bg`, `bg-bg-alt`, `text-ink`, `text-error`, `border-error`, `font-heading`, `font-body`, `rounded-brand`, `shadow-card`.

- [ ] **Step 1: Scaffold**

```bash
cd /Users/mac/Developer/woodhall/kyc
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npm install tailwindcss @tailwindcss/vite
npm install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
git mv ../assets/logos public/logos && git mv "../assets/fonts" public/fonts
rm -f src/App.css src/assets/react.svg public/vite.svg
```

- [ ] **Step 2: Configure** `vite.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/submit.php': 'http://localhost:8000' } },
  test: { environment: 'jsdom', globals: true, setupFiles: './src/test-setup.ts' },
});
```

`src/test-setup.ts`: `import '@testing-library/jest-dom/vitest';`
Add to `package.json` scripts: `"test": "vitest run"`. Set `"types": ["vitest/globals"]` in `tsconfig.app.json` compilerOptions.

- [ ] **Step 3: Theme** `src/index.css`

```css
@import 'tailwindcss';

@font-face { font-family: 'Vanitas'; src: url('/fonts/Vanitas Font Family/fonts/fonnts.com-Vanitas-Regular.otf') format('opentype'); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: 'Vanitas'; src: url('/fonts/Vanitas Font Family/fonts/fonnts.com-Vanitas-Bold.otf') format('opentype'); font-weight: 700; font-style: normal; font-display: swap; }
@font-face { font-family: 'Vanitas'; src: url('/fonts/Vanitas Font Family/fonts/fonnts.com-Vanitas-Italic.otf') format('opentype'); font-weight: 400; font-style: italic; font-display: swap; }
@font-face { font-family: 'Vanitas'; src: url('/fonts/Vanitas Font Family/fonts/fonnts.com-Vanitas-BoldItalic.otf') format('opentype'); font-weight: 700; font-style: italic; font-display: swap; }

@theme {
  --color-primary: #0E4033;
  --color-primary-dark: #0B473A;
  --color-accent: #8FD299;
  --color-bg: #F9F3F0;
  --color-bg-alt: #F4E7E1;
  --color-ink: #161616;
  --color-error: #B3261E;
  --font-heading: 'Vanitas', Georgia, 'Times New Roman', serif;
  --font-body: 'Jost', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --radius-brand: 10px;
  --shadow-card: 0 10px 30px rgba(14, 64, 51, 0.08);
}

body { @apply bg-bg font-body text-ink min-h-screen; }
h1, h2, h3 { @apply font-heading text-primary mt-0; }
[hidden] { display: none !important; }
```

`index.html`: title `Corporate KYC / CDD Form — Woodhall Capital`, viewport meta, Google Fonts `<link>` for `Jost:wght@400;600` (preconnect + stylesheet), `<div id="root">`, module script.
`src/main.tsx`: render `<App />` in `StrictMode`, import `./index.css`. `src/App.tsx` stub: `export default function App() { return <h1>KYC</h1>; }`.

- [ ] **Step 4: Verify**

Run: `cd frontend && npm run build && npm test -- --passWithNoTests`
Expected: build succeeds; vitest exits 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(frontend): scaffold Vite React TS Tailwind app

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Types and validation port (TDD)

**Files:** Create `frontend/src/types.ts`, `frontend/src/lib/validation.ts`; Test `frontend/src/lib/validation.test.ts`.

**Interfaces — Produces:**

```ts
// types.ts
export type Errors = Record<string, string>;
export interface Step1Data { companyName: string; rcNumber: string; dateOfIncorporation: string; legalStatus: string; legalStatusOther: string; registeredAddress: string; businessAddress: string; natureOfBusiness: string; tin: string; companyEmail: string; website: string; bankAccountNumber: string; bankName: string; }
export interface Step3Data { certifyingName: string; designation: string; signatureName: string; signatureAgree: boolean; }
export interface DocState { submitted: boolean; file: File | null; }
export interface FormState { step1: Step1Data; docs: Record<string, DocState>; consent: boolean; step3: Step3Data; }
// validation.ts
export const DOCUMENT_IDS: readonly string[]; export const MAX_FILE_SIZE: number; export const MAX_TOTAL_SIZE: number;
export function isBlank(v: unknown): boolean;
export function validateStep1(d: Partial<Step1Data>): { valid: boolean; errors: Errors };
export function validateFileMeta(f: { name: string; size: number }): { valid: boolean; error: string | null };
export function validateStep2(docs: { id: string; submitted: boolean; file: { name: string; size: number } | null }[], consent: boolean): { valid: boolean; errors: Errors };
export function validateStep3(d: Partial<Step3Data>): { valid: boolean; errors: Errors };
```

- [ ] **Step 1: Write failing tests.** Port all 11 cases from `tests/js/validation.test.js` to Vitest (`import { describe, it, expect } from 'vitest'`, `expect(...).toBe(...)`), importing from `./validation`. Add:

```ts
it('treats whitespace-only values as blank', () => {
  expect(validateStep1({ companyName: '   ' }).errors.companyName).toBe('Company name is required.');
});
it('does not count an unsubmitted document toward the total', () => {
  const docs = DOCUMENT_IDS.map((id) => ({ id, submitted: false, file: { name: id + '.pdf', size: 6 * 1024 * 1024 } }));
  expect(validateStep2(docs, true).valid).toBe(true);
});
it('attaches file-type errors to the document id', () => {
  const r = validateStep2([{ id: 'utility_bill', submitted: true, file: { name: 'a.exe', size: 1 } }], true);
  expect(r.errors.utility_bill).toBe('File type not allowed: a.exe');
});
```

- [ ] **Step 2:** Run `cd frontend && npx vitest run src/lib/validation.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** `types.ts` (as above) and `validation.ts` as a line-for-line typed port of `assets/js/validation.js` (constants, `DOCUMENT_IDS` list of the 12 ids in the same order, identical messages: `'Company name is required.'`, `'RC number is required.'`, `'Date of incorporation is required.'`, `'Legal status is required.'`, `'Please specify the legal status.'`, `'Registered address is required.'`, `'Nature of business is required.'`, `'Tax identification number is required.'`, `'Company email is required.'`, `'Enter a valid email address.'`, `'Corporate bank account number is required.'`, `'Bank name is required.'`, `'File type not allowed: <name>'`, `'File exceeds 5MB limit: <name>'`, `'Total attachments exceed the 20MB limit.'` under key `_total`, `'Consent to processing is required.'`, `'Certifying name is required.'`, `'Designation is required.'`, `'Typed signature is required.'`, `'You must confirm this constitutes your signature.'`). Email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. In `validateStep2`, only docs with `submitted && file` are checked; a file that fails meta gets `errors[doc.id]`, otherwise its size adds to total.

- [ ] **Step 4:** Run the same command → PASS.
- [ ] **Step 5: Commit** `feat(frontend): port validation to TypeScript`.

---

### Task 3: Autosave and submit modules (TDD)

**Files:** Create `frontend/src/lib/autosave.ts`, `frontend/src/lib/submit.ts`; Test `autosave.test.ts`, `submit.test.ts`.

**Interfaces — Consumes:** `FormState`, `DOCUMENT_IDS`. **Produces:**

```ts
// autosave.ts
export const STORAGE_KEY = 'woodhall-kyc-draft-v1';
export interface Draft { fields: Record<string,string>; legalStatus: string; documents: Record<string,boolean>; consent: boolean; signatureAgree: boolean; }
export function serialize(state: FormState): Draft;
export function loadDraft(): Draft | null;      // never throws; null on missing/corrupt/non-object
export function saveDraft(state: FormState): void; // never throws
export function clearDraft(): void;              // never throws
export function hasAnyContent(d: Draft | null): boolean;
export function applyDraft(state: FormState, d: Draft): FormState;
// submit.ts
export function buildFormData(state: FormState): FormData;
export interface SubmitResult { success: boolean; message?: string; errors?: Record<string,string>; }
export function postSubmission(state: FormState, fetchImpl?: typeof fetch): Promise<SubmitResult>; // rejects on network or non-JSON
```

Text field names in `fields`: `companyName, rcNumber, dateOfIncorporation, legalStatusOther, registeredAddress, businessAddress, natureOfBusiness, tin, companyEmail, website, bankAccountNumber, bankName, certifyingName, designation, signatureName`.

- [ ] **Step 1: Failing tests.**

```ts
// autosave.test.ts
beforeEach(() => localStorage.clear());
it('round-trips a draft including legalStatus other', () => {
  const s = emptyState(); s.step1.legalStatus = 'other'; s.step1.legalStatusOther = 'Trust'; s.docs.utility_bill.submitted = true; s.consent = true;
  saveDraft(s);
  const restored = applyDraft(emptyState(), loadDraft()!);
  expect(restored.step1.legalStatus).toBe('other');
  expect(restored.step1.legalStatusOther).toBe('Trust');
  expect(restored.docs.utility_bill.submitted).toBe(true);
  expect(restored.consent).toBe(true);
});
it('returns null for corrupt or non-object JSON', () => {
  localStorage.setItem(STORAGE_KEY, '{oops'); expect(loadDraft()).toBeNull();
  localStorage.setItem(STORAGE_KEY, '"str"'); expect(loadDraft()).toBeNull();
});
it('swallows storage errors', () => {
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
  expect(() => saveDraft(emptyState())).not.toThrow(); spy.mockRestore();
});
it('hasAnyContent is false for an empty draft', () => {
  expect(hasAnyContent(serialize(emptyState()))).toBe(false);
});
it('never stores files', () => {
  const s = emptyState(); s.docs.utility_bill.file = new File(['x'], 'a.pdf');
  expect(JSON.stringify(serialize(s))).not.toContain('a.pdf');
});
// submit.test.ts
it('builds FormData with the old field names', () => {
  const s = emptyState(); s.step1.companyName = 'Acme'; s.docs.utility_bill = { submitted: true, file: new File(['x'], 'a.pdf') }; s.consent = true; s.step3.signatureAgree = true;
  const fd = buildFormData(s);
  expect(fd.get('companyName')).toBe('Acme');
  expect(fd.get('documents[utility_bill][submitted]')).toBe('on');
  expect((fd.get('documents[utility_bill][file]') as File).name).toBe('a.pdf');
  expect(fd.get('consent')).toBe('on'); expect(fd.get('signatureAgree')).toBe('on');
  expect(fd.has('documents[bvn_nin][submitted]')).toBe(false);
});
it('omits legalStatus when none chosen but always sends legalStatusOther', () => {
  const fd = buildFormData(emptyState());
  expect(fd.has('legalStatus')).toBe(false); expect(fd.get('legalStatusOther')).toBe('');
});
it('sends a file even when its checkbox is unticked (old behaviour)', () => {
  const s = emptyState(); s.docs.utility_bill.file = new File(['x'], 'a.pdf');
  expect(buildFormData(s).has('documents[utility_bill][file]')).toBe(true);
});
it('rejects when the response is not JSON', async () => {
  const f = vi.fn().mockResolvedValue({ json: () => Promise.reject(new SyntaxError('x')) });
  await expect(postSubmission(emptyState(), f as any)).rejects.toBeTruthy();
});
it('resolves with the parsed payload, including error bodies', async () => {
  const f = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ success: false, errors: { tin: 'bad' } }) });
  expect((await postSubmission(emptyState(), f as any)).errors).toEqual({ tin: 'bad' });
});
```

Create test helper `frontend/src/test-utils.ts` exporting `emptyState(): FormState` (all strings `''`, `legalStatus: ''`, docs for every id `{ submitted:false, file:null }`, booleans false). Task 4 will re-export it from the reducer as `initialState()`; here `emptyState` is defined in `src/lib/reducer.ts` — **to avoid ordering issues, define `initialState()` in `src/lib/initial-state.ts` now and have `test-utils.ts` do `export const emptyState = initialState;`.**

- [ ] **Step 2:** Run `npx vitest run src/lib` → FAIL.

- [ ] **Step 3: Implement.** `buildFormData`: append each text field always (empty string included) for the 15 text fields plus `website`/`businessAddress`; append `legalStatus` only when non-empty; for each doc id: `documents[id][submitted]='on'` if submitted; `documents[id][file]` = file if present; `consent`/`signatureAgree` = `'on'` when true. `postSubmission`: `fetchImpl('submit.php', { method: 'POST', body })` then `res.json()`. `loadDraft`: try/catch, `JSON.parse`, return null unless result is a non-null object with `fields` object. `applyDraft`: copy string fields only when `typeof === 'string'`; set `legalStatus`; set doc `submitted` true only where draft says true; set `consent`, `signatureAgree` via `!!`.

- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(frontend): add autosave and submit modules`.

---

### Task 4: Reducer (TDD)

**Files:** Create `frontend/src/lib/reducer.ts`; Test `reducer.test.ts`.

**Interfaces — Consumes:** `initialState`, validators, `applyDraft`. **Produces:**

```ts
export interface AppState {
  form: FormState; step: 1 | 2 | 3; touched: Record<string, boolean>;
  errors: Errors; status: 'idle' | 'submitting' | 'done'; draftRestored: boolean;
}
export type Action =
  | { type: 'setField'; group: 'step1' | 'step3'; name: string; value: string | boolean }
  | { type: 'setConsent'; value: boolean }
  | { type: 'setDocSubmitted'; id: string; value: boolean }
  | { type: 'setDocFile'; id: string; file: File | null }
  | { type: 'touch'; name: string }
  | { type: 'next' } | { type: 'back' }
  | { type: 'goTo'; step: 1 | 2 | 3 }
  | { type: 'serverErrors'; errors: Errors }
  | { type: 'restoreDraft'; draft: Draft }
  | { type: 'reset' }
  | { type: 'submitting'; value: boolean } | { type: 'done' };
export function initialAppState(): AppState;
export function reducer(s: AppState, a: Action): AppState;
export function stepErrors(form: FormState, step: 1 | 2 | 3): Errors;   // maps to validateStepN
export function fieldStep(name: string): 1 | 2 | 3 | null;               // step owning a data-field key
```

Field-to-step map: step 1 = the 13 step1 keys (incl. `legalStatus`, `legalStatusOther`, `businessAddress`, `website`); step 2 = `consent`; step 3 = `certifyingName, designation, signatureName, signatureAgree`. Document ids and `_total` map to `null`.

Semantics: `errors` always equals `stepErrors` filtered to touched keys for the current step (recomputed after every action that changes form, touch, or step). `next` touches every key of the current step; if `stepErrors` is empty, advances and clears `errors`, otherwise sets `errors` to the full step errors (including untouched-key/doc/`_total` ones, so the UI can alert on unmatched keys). `back` moves down (min 1).

- [ ] **Step 1: Failing tests** (exercise each): 
  - `next` on empty step 1 stays at 1 and sets errors for `companyName` etc.
  - `next` on valid step 1 → step 2, `errors` `{}`.
  - typing into an untouched field does not show an error; after `touch` it does; fixing it clears it.
  - `setDocFile` then `next` at step 2 with `.exe` and submitted → errors keyed by doc id.
  - `restoreDraft` sets `draftRestored: true` and applies fields; `reset` returns `initialAppState()` with `draftRestored: false`.
  - `serverErrors` `{tin:'x'}` → `step` becomes 1 and `errors.tin === 'x'`; `{consent:'x', tin:'y'}` → step 1 (earliest); `{utility_bill:'x'}` only → step unchanged.
  - `fieldStep('_total') === null`, `fieldStep('signatureAgree') === 3`.

- [ ] **Step 2:** `npx vitest run src/lib/reducer.test.ts` → FAIL.
- [ ] **Step 3: Implement** per semantics above. `serverErrors`: compute earliest step among keys with non-null `fieldStep`; if any, `step = earliest`; set `errors` to the full server map (UI reads it, alerts unmatched).
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(frontend): add form state reducer`.

---

### Task 5: UI primitives, chrome, and steps

**Files:** Create `components/{Header,ProgressBar,DraftBanner,Field,Button,DocumentRow,Confirmation,Step1Entity,Step2Documents,Step3Declaration}.tsx`, `src/dev/prefill.ts`; Test `components/steps.test.tsx`.

**Interfaces — Consumes:** `AppState`, `Action`, `Errors`, `DOCUMENT_IDS`. **Produces:**

```ts
export const STEP_NAMES: Record<1|2|3, string>;   // in ProgressBar.tsx: 'Entity Information','KYC / CDD Documents','Declaration'
<Field name label error? children />              // wrapper: label + slot + <p role="alert" class="text-error text-[13px] mt-1">{error}</p>
export const inputClass: string                   // shared input class string
<Button variant="primary"|"secondary" ... />
type StepProps = { state: AppState; dispatch: React.Dispatch<Action> }
```

**Class contract (Tailwind mapping of old CSS):**
- `inputClass` = `w-full rounded-md border border-[#D8CFC8] px-3 py-2.5 font-body text-[15px]`; add `border-error` when the field has an error.
- Button base: `inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 text-[15px] font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-70`; primary `bg-primary text-white hover:bg-primary-dark`; secondary `border border-primary text-primary bg-transparent`.
- Card: `relative overflow-hidden rounded-brand bg-white shadow-card p-5 sm:p-8`, with the four faint corner emblems as an inline `style` `backgroundImage`/`backgroundSize`/`backgroundPosition` copied from `assets/css/style.css:34-58` (sizes 60px mobile / 90px `sm:`; use a `data-emblem` element with `sm:` arbitrary bg-size classes or a `useMediaQuery`-free CSS var in `index.css`).
- Progress (desktop, `hidden sm:flex`): pill `flex-1 text-center rounded-full px-1.5 py-2.5 text-[13px] font-semibold tracking-[0.03em]`; active `bg-primary text-white`, complete `bg-accent text-primary`, else `bg-bg-alt text-primary`. Mobile (`sm:hidden`): label `text-[13px] font-semibold text-primary mb-2`, track `h-1.5 rounded-full bg-bg-alt overflow-hidden`, fill `h-full bg-primary rounded-full transition-[width] duration-200` with `style={{ width: step/3*100 + '%' }}`.
- Header: `flex justify-center px-4 py-6`, logo `h-16 sm:h-[84px]`, src `/logos/woodhall-capital-logo-full-colour-rgb-1.svg`.
- Wizard container: `mx-auto mb-16 max-w-[720px] px-4`.
- Draft banner: `flex items-center justify-between gap-3 rounded-lg border border-accent bg-bg-alt px-3.5 py-2.5 mb-5 text-sm text-primary`, its button `rounded-full border border-primary px-3.5 py-1.5 text-[13px] whitespace-nowrap`.
- Document row: `rounded-lg border border-[#E4DAD2] p-4 mb-3`; file input wrapper `mt-2.5` rendered only when `submitted`; row shows checkbox label from the 12 labels (copy exact text from `index.html:117-172`).
- Step slide: section wrapper `motion-safe:transition motion-safe:duration-[180ms]`, toggled between `opacity-100 translate-x-0` and `opacity-0 ±translate-x-6`.

**Behavior contract per step:** Each input `id`/`name` equals the old one; `onBlur` dispatches `{type:'touch', name}`; `onChange` dispatches `setField`; checkboxes/radios also dispatch `touch`. Step 1: legal-status radios (`private|public|other`); the "Please specify" input renders only when `legalStatus === 'other'`. Labels, placeholders, headings, and paragraph text are copied verbatim from `index.html` lines 33-113 (step 1), 115-179 (step 2), 181-222 (step 3). Field error text shown from `state.errors[name]` only for keys present. Step 3 Submit button is `type="submit"`, shows spinner `size-3.5 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin` and label `Submitting…`/`Submit Form` from `state.status`; Back buttons disabled while submitting. `Confirmation` shows `Thank you` and `Your KYC/CDD submission has been received. A copy has been emailed to {email}.`

- [ ] **Step 1: Failing tests** (`steps.test.tsx`, RTL + userEvent, rendering `Step1Entity` with a stateful test host using the real reducer):
  - shows "Company name is required." after blurring an empty Company Name; not before.
  - choosing "Other" reveals "Please specify"; choosing "Private Limited Company" hides it.
  - Step 2: file input for a document appears only after ticking its checkbox; all 12 labels render.
  - Step 3: Submit button disabled and labelled "Submitting…" when `status === 'submitting'`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement components per the contracts. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(frontend): add form components with Tailwind styling`.

`src/dev/prefill.ts` exports `prefillActions(): Action[]` dispatching the same sample values as `assets/js/dev-tools.js:24-46` (setField for each text field, `legalStatus` `private`, `setDocSubmitted` for `certificate_of_incorporation` and `cac_status_report`, `setConsent`, step 3 fields, `signatureAgree`).

---

### Task 6: App wiring, autosave, submit flow (TDD)

**Files:** Modify `frontend/src/App.tsx`, `main.tsx`; Test `frontend/src/App.test.tsx`.

**Interfaces — Consumes:** everything above. **Produces:** default export `App`.

Behavior:
- On mount: `loadDraft()`; if `hasAnyContent`, dispatch `restoreDraft`. Debounced 800ms `saveDraft(state.form)` on form change (skip when `status === 'done'`; skip the initial mount so an empty state doesn't overwrite an existing draft before restore).
- DraftBanner shows when `draftRestored`; "Clear and start over" dispatches `reset` and calls `clearDraft()`.
- Progress bars hidden and form replaced by `Confirmation` when `status === 'done'`.
- `<form noValidate onSubmit>`: on submit, ignore if `status === 'submitting'`; dispatch `next`-style validation of step 3 (`stepErrors(form,3)` non-empty → dispatch `touch` for all step-3 keys + set errors, return); else `submitting(true)` → `postSubmission`; success → `clearDraft()`, `done`; failure with errors → `serverErrors`, `submitting(false)`, `alert(message || 'Submission failed. Please check the form and try again.')`; rejection → `submitting(false)`, `alert('Network error. Please try again.')`.
- After any action leaving `errors` with keys where `fieldStep(key) === null`, `alert` those messages joined by newline (matches old `showErrors`).
- Dev prefill button (`fixed bottom-4 right-4 z-[100] rounded-md border border-dashed border-[#7A5B00] bg-[#FFF3CD] px-3.5 py-2 text-[13px] text-[#7A5B00]`, text `Fill test data (dev only)`) rendered only if `import.meta.env.DEV`.
- Respect reduced motion: use `window.matchMedia('(prefers-reduced-motion: reduce)')`; when reduced, switch steps immediately; else apply the 180ms out/in class sequence.

- [ ] **Step 1: Failing tests** with `vi.stubGlobal('fetch', ...)`, `vi.spyOn(window,'alert')`, fake timers where needed:
  - cannot advance from step 1 with empty fields; error text appears.
  - filling step 1 then Next shows step 2 heading "Section B: KYC / CDD Documentation".
  - full happy path → fetch called once with `submit.php`, confirmation shows the typed company email, `localStorage` draft removed.
  - server `{success:false, errors:{tin:'bad'}, message:'m'}` from step 3 → step 1 visible, "bad" shown, `alert('m')`, Submit re-enabled.
  - `{success:false, errors:{}, message:'Mail failed'}` → alert('Mail failed'), stays on step 3.
  - fetch rejects, and separately `.json()` rejects → `alert('Network error. Please try again.')`, buttons re-enabled.
  - double-click Submit → fetch called once.
  - pre-seeded draft (with `legalStatus:'other'`) → banner visible and "Please specify" input visible and populated; "Clear and start over" empties fields and removes the draft key.
  - existing draft is not overwritten by an empty state on mount.
- [ ] **Step 2:** `npx vitest run src/App.test.tsx` → FAIL. **Step 3:** Implement. **Step 4:** PASS (whole suite: `npm test`).
- [ ] **Step 5: Commit** `feat(frontend): wire wizard, autosave and submission`.

---

### Task 7: Packaging, cleanup, docs, end-to-end check

**Files:** Create `scripts/package.sh`; Delete `index.html`, `assets/js/`, `assets/css/`, `tests/js/`, `assets/fonts/Vanitas Font Family/shortcut.html` only if unused (keep it in `public/fonts` untouched); Modify `README.md`, `.gitignore`.

- [ ] **Step 1: `scripts/package.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
(cd frontend && npm ci && npm run build)
OUT=build/woodhall-kyc
rm -rf build && mkdir -p "$OUT/docs"
cp -R frontend/dist/. "$OUT/"
cp submit.php config.php .htaccess .user.ini "$OUT/"
cp -R lib vendor "$OUT/"
cp docs/.htaccess "$OUT/docs/.htaccess"
(cd build && zip -qr woodhall-kyc-deploy.zip woodhall-kyc)
echo "Built build/woodhall-kyc-deploy.zip"
```

`chmod +x scripts/package.sh`; add `build/`, `frontend/node_modules/`, `frontend/dist/` to `.gitignore`. Note `lib/.htaccess` and `vendor/.htaccess` are included via `cp -R`.

- [ ] **Step 2: Run** `scripts/package.sh`. Expected: `build/woodhall-kyc-deploy.zip` exists; `unzip -l` shows `index.html`, `assets/*.js`, `submit.php`, `lib/`, `vendor/`, and no `preview.php`, `tests/`, or `frontend/`.

- [ ] **Step 3: End-to-end check.** `cd build/woodhall-kyc && php -S localhost:8000`; open `http://localhost:8000`, fill the form with real values (SMTP unset falls back to `mail()`; a send failure is an acceptable outcome here — confirm the request reaches `submit.php` and the UI handles the JSON response). Also run `cd frontend && npm run dev` with `php -S localhost:8000` at the repo root and confirm the proxy. Verify at 375px and 1024px widths against the old page (git stash or old checkout) for layout parity.

- [ ] **Step 4: Cleanup** `git rm -r index.html assets/js assets/css tests/js`. Run PHP tests (README commands) and `cd frontend && npm test && npm run build` — all must pass.

- [ ] **Step 5: README.** Update Tech stack, Project structure, Local development (`cd frontend && npm run dev` + `php -S localhost:8000`), Running tests (Vitest replaces `node --test`), and Deploying (`scripts/package.sh`, upload zip contents, no manual `preview.php` deletion needed since it is excluded).

- [ ] **Step 6: Commit** `feat: switch to React frontend, add packaging script, remove legacy JS/CSS`.

---

## Self-Review

- Spec coverage: layout/build (T1, T7), components/state (T4–T6), parity — inline validation (T4), autosave (T3, T6), submit/error flow (T3, T6), other-status (T5), slide/reduced motion (T5, T6), dev button (T6); styling tokens/Jost (T1, T5); testing (T2–T6); cleanup/README (T7).
- Type names are consistent across tasks: `FormState`, `AppState`, `Action`, `Draft`, `stepErrors`, `fieldStep`, `initialState`/`initialAppState`.
- No open placeholders: verbatim copy from `index.html` is by exact line range.
