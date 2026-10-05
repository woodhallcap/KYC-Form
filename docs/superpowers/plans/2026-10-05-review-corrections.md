# Review Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the 2 Oct 2026 review corrections. After this, every KYC submission arrives with its required fields filled, its required documents attached and handwritten signature images included, under the Woodhall Finance brand.

**Architecture:** Both sides change: the React wizard (`frontend/src`) and its PHP mirror (`lib/*.php`). Documents become a spec list (`{id, label, required}`) that drives the upload tiles, validation, FormData, the server checks and the PDF. Signature and seal files live in one `images` map per form. That map has its own reducer action and its own image-only validation. Each flow step "owns" its file keys, so missing files block **Next** and show inline.

**Tech Stack:** React 19 + TypeScript + Vitest/RTL (frontend). PHP 8 with vendored TCPDF + PHPMailer, tested with the custom harness in `tests/php`.

**Spec:** `docs/superpowers/specs/2026-10-05-review-corrections-design.md`

## Global Constraints

- Brand name in all user-facing text: **Woodhall Finance**. "Woodhall Capital" must not appear outside `docs/` and `vendor/`.
- Code style: single quotes, existing line widths. Do not run Prettier with default settings; it rewrites to double quotes.
- Document uploads: `.pdf .jpg .jpeg .png .docx`, ≤ 5MB each. Signature and seal: `.jpg .jpeg .png` only, ≤ 5MB, error text `Upload a JPG or PNG image.`
- Total attachments ≤ **20MB** (unchanged), error key `_total`.
- Notification recipients: `['credit@woodhallfinanceltd.com']`.
- Required-document error text: `` `${label} is required.` `` It must be identical in TypeScript and PHP.
- Draft storage key stays `woodhall-kyc-draft-v2`. Files are never stored.
- The request field `rcNumber` keeps its name.
- Frontend tests: `cd frontend && npx vitest run`. PHP tests: `php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/<file>.php`.
- Commits: no `Co-Authored-By` trailer (owner preference).

## Review Focus

1. **A file removed after Next was pressed.** The tile must show "… is required." again, and Next must block. (Task 2)
2. **A signature photographed as HEIC, or a PDF uploaded to the signature tile.** The user gets `Upload a JPG or PNG image.` on the client, and the server rejects it too. (Tasks 3, 7)
3. **A corrupt or renamed "PNG" signature.** The PDF still builds and shows "Attached (see email)". The request must never die mid-response. (Task 8)
4. **A draft saved before this change.** It contains `expectedTransactionTypes`, `meansOfId: ['bvn']`, `signatureName` and `documents` ticks. It must restore without crashing, and the removed values are ignored. (Task 2 / Task 4)
5. **All uploads at the limit.** Nine 5MB corporate documents push the 20MB total over. The `_total` alert appears on the final step and nothing is sent. (Task 3)

---

### Task 1: Restore repo formatting, keep the owner's copy edits, get back to green

The owner's editor reformatted five files to double quotes. Ten tests fail because the copy was edited but its tests were not.

**Files:**
- Modify: `frontend/src/App.tsx`, `frontend/src/components/BrandPanel.tsx`, `frontend/src/components/IndividualStep1Person.tsx`, `frontend/src/components/ui.test.tsx`, `frontend/src/lib/copy.ts`

- [ ] **Step 1: Save the owner's diff, then restore the HEAD versions**

```bash
cd /Users/mac/Developer/woodhall/kyc
git diff > /tmp/owner-edits.diff   # backup only
git checkout -- frontend/src/App.tsx frontend/src/components/BrandPanel.tsx frontend/src/components/IndividualStep1Person.tsx frontend/src/components/ui.test.tsx frontend/src/lib/copy.ts
```

- [ ] **Step 2: Re-apply the content edits in the original style**
  - `BrandPanel.tsx`: `title: 'Customer due diligence'` becomes `title: 'Customer Due Diligence'`.
  - `copy.ts`: make these replacements.
    - `'A passport photograph'` becomes `'A recent passport photograph'`.
    - `email: 'office@woodhallfinanceltd.com'` becomes `email: 'info@woodhallfinanceltd.com'`.
    - `address: 'No 1 Bitou Street, Wuse 2, Abuja FCT'` becomes `address: '8A Modupe Alakija Cres, Ikoyi, Lagos 106104, Lagos'`.
  - `ui.test.tsx`: make these replacements.
    - The heading name `'Customer due diligence'` becomes `'Customer Due Diligence'`.
    - Both `office@woodhallfinanceltd.com` occurrences become `info@woodhallfinanceltd.com`.
    - The address matcher `/Wuse 2, Abuja/` becomes `/Modupe Alakija/`.
  - `IndividualStep1Person.tsx` and `App.tsx`: no content edits to re-apply. Task 4 handles the Purpose and Turnover labels.

- [ ] **Step 3: Run the suite**

Run: `cd frontend && npx vitest run`
Expected: all 160 tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "chore: keep the contact and casing edits, restore single-quote formatting"
```

---

### Task 2: Documents become required/optional upload tiles (frontend, both flows)

**Files:**
- Modify: `frontend/src/types.ts`, `frontend/src/lib/documents.ts`, `frontend/src/lib/validation.ts`, `frontend/src/lib/initial-state.ts`, `frontend/src/lib/reducer.ts`, `frontend/src/lib/submit.ts`, `frontend/src/lib/autosave.ts`, `frontend/src/flows/corporate.ts`, `frontend/src/flows/individual.ts`, `frontend/src/components/DocumentRow.tsx`, `frontend/src/components/DocumentsStep.tsx`, `frontend/src/components/Step3Documents.tsx`, `frontend/src/components/IndividualStep2Documents.tsx`, `frontend/src/dev/prefill.ts`, `frontend/src/test-utils.ts`
- Test: `frontend/src/lib/validation.test.ts`, `frontend/src/lib/submit.test.ts`, `frontend/src/lib/autosave.test.ts`, `frontend/src/lib/reducer.test.ts`, `frontend/src/flows/*.test.ts`, `frontend/src/components/steps.test.tsx`, `frontend/src/App.test.tsx`

**Interfaces:**
- Produces:
  - `DocumentSpec { id: string; label: string; required: boolean }`.
  - `CORPORATE_DOCUMENTS` and `INDIVIDUAL_DOCUMENTS: readonly DocumentSpec[]` (in `lib/documents.ts`).
  - `DOCUMENT_IDS` and `INDIVIDUAL_DOCUMENT_IDS` (derived, still exported from `lib/validation.ts`).
  - `form.docs: Record<string, File | null>`.
  - Action `{ type: 'setDocFile'; id; file }`. The `setDocSubmitted` action is deleted.
  - `documentErrors(docs, specs): Errors`.
  - FormData key `documents[<id>]` (a file, with no `[submitted]` flag).

- [ ] **Step 1: Write the failing tests** (in `validation.test.ts`, replacing the tick-based `validateDocuments` and `validateIndividualDocuments` blocks)

```ts
import { CORPORATE_DOCUMENTS, INDIVIDUAL_DOCUMENTS } from './documents';

const pdf = (name = 'a.pdf') => new File(['x'], name);
const allDocs = (specs: readonly { id: string }[]) => Object.fromEntries(specs.map((d) => [d.id, pdf()]));

describe('validateDocuments (corporate)', () => {
  it('requires every required document and consent, keyed by document id', () => {
    const errors = validateDocuments(makeForm());
    CORPORATE_DOCUMENTS.filter((d) => d.required).forEach((d) => expect(errors[d.id]).toBe(`${d.label} is required.`));
    expect(errors.corporate_id_signatories).toBeUndefined();
    expect(errors.consent).toBeTruthy();
  });
  it('passes with every required file and consent, and checks the type of an optional file', () => {
    const docs = allDocs(CORPORATE_DOCUMENTS.filter((d) => d.required));
    expect(validateDocuments(makeForm({ docs, consent: true }))).toEqual({});
    const bad = validateDocuments(makeForm({ docs: { ...docs, corporate_id_signatories: pdf('x.exe') }, consent: true }));
    expect(bad.corporate_id_signatories).toBe('File type not allowed: x.exe');
  });
});

describe('validateIndividualDocuments', () => {
  it('requires the five required documents but not work ID, employment letter or mandate card', () => {
    const errors = validateIndividualDocuments(makeIndividual());
    expect(Object.keys(errors).filter((k) => k !== 'consent').sort()).toEqual(
      ['bank_statement_12_months', 'passport_photograph', 'proof_of_address_statement', 'proof_of_address_utility', 'valid_means_of_id'],
    );
  });
});
```

Also add these tests:
- **flows tests:** `own('cac_status_report') === 3` (corporate), and `own('proof_of_address_utility') === 2` (individual).
- **`reducer.test.ts`:** `setDocFile` stores the file, and dispatching `setDocFile` with `null` after a `next` shows `"… is required."` again (Review Focus 1).
- **`autosave.test.ts`:** a draft containing a `documents: { cac_forms: true }` key restores without error, and the restored `docs` are all `null`.
- **`submit.test.ts`:** `fd.get('documents[cac_forms]')` is the File, and no `documents[cac_forms][submitted]` key exists.

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd frontend && npx vitest run src/lib src/flows`
Expected: FAIL (`CORPORATE_DOCUMENTS` is not exported, and the shape of `docs` differs).

- [ ] **Step 3: Implement**

`lib/documents.ts` (replaces both label maps):

```ts
export interface DocumentSpec {
  id: string;
  label: string;
  required: boolean;
}

export const CORPORATE_DOCUMENTS: readonly DocumentSpec[] = [
  { id: 'certificate_of_incorporation', label: 'CAC Certificate of Incorporation', required: true },
  { id: 'cac_status_report', label: 'CAC Status Report', required: true },
  { id: 'cac_forms', label: 'CAC Forms CAC2.3 / CAC1.1 - Directors & Shareholders', required: true },
  { id: 'memorandum_articles', label: 'Memorandum & Articles of Association', required: true },
  { id: 'board_resolution', label: 'Board Resolution to open account and obtain facility', required: true },
  { id: 'company_bank_statement', label: 'Company Bank Statement - Last 12 months', required: true },
  { id: 'government_id_signatories', label: 'Valid Government-issued ID of Authorized Signatories', required: true },
  { id: 'passport_photograph_signatories', label: 'Recent Passport Photograph of Authorized Signatories', required: true },
  { id: 'corporate_id_signatories', label: 'Corporate ID of Authorized Signatories', required: false },
];

export const INDIVIDUAL_DOCUMENTS: readonly DocumentSpec[] = [
  { id: 'valid_means_of_id', label: 'Valid Means of ID', required: true },
  { id: 'proof_of_address_utility', label: 'Proof of Address: Utility Bill (less than 3 months old)', required: true },
  { id: 'proof_of_address_statement', label: 'Proof of Address: Bank Statement (less than 3 months old)', required: true },
  { id: 'bank_statement_12_months', label: 'Bank Statement - Last 12 months', required: true },
  { id: 'passport_photograph', label: 'Recent Passport Photograph', required: true },
  { id: 'work_id', label: 'Work ID', required: false },
  { id: 'employment_letter', label: 'Employment Letter', required: false },
  { id: 'signature_mandate_card', label: 'Signature Mandate Card', required: false },
];
```

`lib/validation.ts`:

```ts
import { CORPORATE_DOCUMENTS, INDIVIDUAL_DOCUMENTS } from './documents';
import type { DocumentSpec } from './documents';

export const DOCUMENT_IDS: readonly string[] = CORPORATE_DOCUMENTS.map((d) => d.id);
export const INDIVIDUAL_DOCUMENT_IDS: readonly string[] = INDIVIDUAL_DOCUMENTS.map((d) => d.id);

/** Missing required files and bad files, keyed by document id. */
export function documentErrors(docs: Record<string, File | null>, specs: readonly DocumentSpec[]): Errors {
  const errors: Errors = {};
  specs.forEach(({ id, label, required }) => {
    const file = docs[id];
    if (!file) {
      if (required) errors[id] = `${label} is required.`;
      return;
    }
    const meta = validateFileMeta(file);
    if (!meta.valid) errors[id] = meta.error as string;
  });
  return errors;
}

export function validateDocuments(form: CorporateForm): Errors {
  return { ...documentErrors(form.docs, CORPORATE_DOCUMENTS), ...consentError(form.consent) };
}

export function validateIndividualDocuments(form: IndividualForm): Errors {
  return { ...documentErrors(form.docs, INDIVIDUAL_DOCUMENTS), ...consentError(form.consent) };
}
```

`collectUploads(form)` now loops `DOCUMENT_IDS` with `form.docs[id]` (it no longer checks `submitted`). Add `collectIndividualUploads(form)` with the same loop over `INDIVIDUAL_DOCUMENT_IDS`. Task 3 adds a `_total` check that uses both functions. Remove `uploadErrors` from `validateDocuments`, because per-file checks now live in `documentErrors`.

`types.ts`: delete `DocState`. On both forms, set `docs: Record<string, File | null>`.

`initial-state.ts`: `docs: Object.fromEntries(DOCUMENT_IDS.map((id) => [id, null]))` (and the same for individual).

`reducer.ts`: delete `setDocSubmitted`. Change `setDocFile` to:

```ts
case 'setDocFile':
  return form ? withForm(s, { ...form, docs: { ...form.docs, [a.id]: a.file } }) : s;
```

`submit.ts`, replacing `appendDocuments`:

```ts
function appendDocuments(fd: FormData, docs: Record<string, File | null>, ids: readonly string[]): void {
  ids.forEach((id) => {
    const file = docs[id];
    if (file) fd.append(`documents[${id}]`, file);
  });
}
```

`autosave.ts`:
- Remove `documents` from both draft interfaces and from `serialize*`.
- Delete `documentsOf` and `applyDocuments`.
- In `apply*Draft`, keep `docs: form.docs`.
- `hasAnyContent`'s `common` becomes `d.consent === true`.

Flows: in the documents step fields, `['consent', ...DOCUMENT_IDS]` (corporate) and `['consent', ...INDIVIDUAL_DOCUMENT_IDS]` (individual). Import the ids from `../lib/validation`.

`DocumentRow.tsx` (no checkbox; one tile per document):

```tsx
import { FileTile } from './FileTile';

interface DocumentRowProps {
  id: string;
  label: string;
  required: boolean;
  file: File | null;
  error?: string;
  onFile: (file: File | null) => void;
}

export function DocumentRow({ id, label, required, file, error, onFile }: DocumentRowProps) {
  return (
    <div className={`mb-3 rounded-2xl border p-4 transition ${file ? 'border-primary/40 bg-cream' : 'border-[#e4dad2] bg-white'}`} data-doc-id={id}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="font-medium">{label}</span>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${required ? 'bg-primary/10 text-primary' : 'bg-ink/5 text-ink/60'}`}>
          {required ? 'Required' : 'Optional'}
        </span>
      </div>
      <FileTile label={label} file={file} onChange={onFile} error={error} />
    </div>
  );
}
```

`DocumentsStep.tsx`:
- Replace the `ids` and `labels` props with `documents: readonly DocumentSpec[]`.
- Render `DocumentRow` with `file={form.docs[d.id]}`.
- `onFile` dispatches both `setDocFile` and `{ type: 'touch', name: d.id }`, so removing a file shows the error.

`Step3Documents` intro: `"Attach a copy of each required document. Files can be PDF, JPG, PNG or DOCX, up to 5MB each."`. Pass `documents={CORPORATE_DOCUMENTS}`.

`IndividualStep2Documents` intro: the same text plus `" Proof of address must be less than 3 months old."`. Pass `documents={INDIVIDUAL_DOCUMENTS}`.

`dev/prefill.ts`: replace the `setDocSubmitted` actions with one `setDocFile` per required document. Use dummy files: `new File(['test'], `${id}.pdf`, { type: 'application/pdf' })`.

`test-utils.ts`: `makeForm` and `makeIndividual` build `docs` from `DOCUMENT_IDS` and `INDIVIDUAL_DOCUMENT_IDS` with `null` values. Delete the local `DOC_IDS` and `INDIVIDUAL_DOC_IDS` arrays.

`steps.test.tsx`: rewrite the two "renders the N documents" tests.
- Every spec label has a file input: `getByLabelText(label)`.
- The number of `Required` badges equals the number of required specs.
- Uploading with `await user.upload(screen.getByLabelText(label), new File(['x'], 'a.pdf'))` shows `a.pdf`.

`App.test.tsx`: add an `attachAll` helper, and call it in `toFunds` (before the consent click) and in the individual flow's step-2 helper:

```ts
async function attachAll(user: User, specs: readonly DocumentSpec[]) {
  for (const d of specs.filter((s) => s.required)) await user.upload(screen.getByLabelText(d.label), new File(['x'], `${d.id}.pdf`));
}
```

Update "sends a ticked document and omits an unticked one". It becomes "sends attached documents and omits optional ones left empty": assert `documents[valid_means_of_id]` is a File and `documents[work_id]` is null. Add "blocks Next on the documents step until required files are attached": with consent ticked and no files, clicking Next keeps the heading and shows `Valid Means of ID is required.`

- [ ] **Step 4: Run the whole suite**

Run: `cd frontend && npx vitest run && npx tsc -b`
Expected: all tests pass, with no type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): required and optional document upload tiles that block Next"
```

---

### Task 3: Handwritten signature and seal images (frontend)

**Files:**
- Modify: `frontend/src/types.ts`, `lib/validation.ts`, `lib/initial-state.ts`, `lib/reducer.ts`, `lib/submit.ts`, `flows/corporate.ts`, `flows/individual.ts`, `components/FileTile.tsx`, `components/Step5Declaration.tsx`, `components/IndividualStep3Declaration.tsx`, `dev/prefill.ts`, `test-utils.ts`
- Test: `lib/validation.test.ts`, `lib/submit.test.ts`, `lib/reducer.test.ts`, `components/steps.test.tsx`, `App.test.tsx`

**Interfaces:**
- Consumes (from Task 2): `collectUploads(form)`, `collectIndividualUploads(form)`, `uploadErrors`.
- Produces:
  - `ImageName = 'signatureFile' | 'signatory1SignatureFile' | 'signatory2SignatureFile' | 'sealFile'`.
  - `CorporateForm.images: Record<'signatory1SignatureFile' | 'signatory2SignatureFile' | 'sealFile', File | null>`. This replaces `seal`.
  - `IndividualForm.images: Record<'signatureFile', File | null>`.
  - `IndividualDeclaration` loses `signatureName`.
  - Action `{ type: 'setImage'; name: ImageName; file: File | null }`. The `setSeal` action is deleted.
  - `validateImageMeta(file)`.
  - `validateDeclaration(form: CorporateForm)` and `validateIndividualDeclaration(form: IndividualForm)` now take the whole form.
  - FormData keys equal the image names.
  - `IMAGE_SPECS` for each flow: `{ name: ImageName; label: string; missing: string }[]`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('validateImageMeta', () => {
  it('accepts jpg/jpeg/png only and keeps the 5MB cap', () => {
    expect(validateImageMeta(new File(['x'], 'sig.PNG')).valid).toBe(true);
    expect(validateImageMeta(new File(['x'], 'sig.heic')).error).toBe('Upload a JPG or PNG image.');
    expect(validateImageMeta(new File(['x'], 'sig.pdf')).error).toBe('Upload a JPG or PNG image.');
    expect(validateImageMeta(bigFile('sig.jpg', 5.1)).error).toBe('File exceeds 5MB limit: sig.jpg');
  });
});

describe('validateDeclaration (corporate)', () => {
  it('requires both signature images and the seal', () => {
    const e = validateDeclaration(makeForm());
    expect(e.signatory1SignatureFile).toBe('Authorized signatory 1 signature is required.');
    expect(e.signatory2SignatureFile).toBe('Authorized signatory 2 signature is required.');
    expect(e.sealFile).toBe('Company seal or stamp is required.');
  });
  it('reports _total when all uploads exceed 20MB', () => {
    const docs = Object.fromEntries(DOCUMENT_IDS.map((id) => [id, bigFile(`${id}.pdf`, 4.9)]));
    expect(validateDeclaration(makeForm({ docs }))._total).toBe('Total attachments exceed the 20MB limit.');
  });
});

describe('validateIndividualDeclaration', () => {
  it('requires name, date, agreement and the signature image; there is no typed signature', () => {
    const e = validateIndividualDeclaration(makeIndividual());
    expect(Object.keys(e).sort()).toEqual(['declarationName', 'signatureAgree', 'signatureDate', 'signatureFile']);
    expect(e.signatureFile).toBe('Handwritten signature is required.');
  });
});
```

Also:
- **`submit.test.ts`:** `fd.get('sealFile')`, `fd.get('signatory1SignatureFile')` and `fd.get('signatureFile')` are the Files, and `signatureName` is absent.
- **flows tests:** `own('sealFile') === 5` for corporate, and `own('signatureFile') === 3` for individual. `_total` stays unowned.

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd frontend && npx vitest run src/lib src/flows`
Expected: FAIL (`validateImageMeta` is not defined).

- [ ] **Step 3: Implement**

`lib/validation.ts`:

```ts
export const IMAGE_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png'];

export function validateImageMeta(file: FileMeta): { valid: boolean; error: string | null } {
  const ext = (file.name || '').split('.').pop()!.toLowerCase();
  if (!IMAGE_FILE_EXTENSIONS.includes(ext)) return { valid: false, error: 'Upload a JPG or PNG image.' };
  if (file.size > MAX_FILE_SIZE) return { valid: false, error: 'File exceeds 5MB limit: ' + file.name };
  return { valid: true, error: null };
}

export interface ImageSpec { name: ImageName; label: string; missing: string }

export const CORPORATE_IMAGES: readonly ImageSpec[] = [
  { name: 'signatory1SignatureFile', label: 'Authorized Signatory 1 — Handwritten Signature', missing: 'Authorized signatory 1 signature is required.' },
  { name: 'signatory2SignatureFile', label: 'Authorized Signatory 2 — Handwritten Signature', missing: 'Authorized signatory 2 signature is required.' },
  { name: 'sealFile', label: 'Company Seal or Stamp', missing: 'Company seal or stamp is required.' },
];
export const INDIVIDUAL_IMAGES: readonly ImageSpec[] = [
  { name: 'signatureFile', label: 'Handwritten Signature', missing: 'Handwritten signature is required.' },
];

function imageErrors(images: Partial<Record<ImageName, File | null>>, specs: readonly ImageSpec[]): Errors {
  const errors: Errors = {};
  specs.forEach(({ name, missing }) => {
    const file = images[name];
    if (!file) errors[name] = missing;
    else {
      const meta = validateImageMeta(file);
      if (!meta.valid) errors[name] = meta.error as string;
    }
  });
  return errors;
}

/** Only the size matters for the total; per-file problems are reported by their own step. */
function totalError(files: File[]): Errors {
  const total = files.reduce((sum, f) => sum + f.size, 0);
  return total > MAX_TOTAL_SIZE ? { _total: 'Total attachments exceed the 20MB limit.' } : {};
}
```

`collectUploads` now also pushes every non-null `form.images` entry, keyed by its image name; delete the old `seal` push. `collectIndividualUploads` pushes `images.signatureFile` in the same way.

```ts
export function validateDeclaration(form: CorporateForm): Errors {
  const d = form.declaration;
  const errors: Errors = {};
  ([1, 2] as const).forEach((n) => {
    if (isBlank(d[`signatory${n}Name`])) errors[`signatory${n}Name`] = `Authorized signatory ${n} name is required.`;
    if (isBlank(d[`signatory${n}Date`])) errors[`signatory${n}Date`] = `Authorized signatory ${n} date is required.`;
  });
  if (!d.signatureAgree) errors.signatureAgree = 'You must confirm the attached images are your signatures.';
  return { ...errors, ...imageErrors(form.images, CORPORATE_IMAGES), ...totalError(collectUploads(form).map((u) => u.file)) };
}

export function validateIndividualDeclaration(form: IndividualForm): Errors {
  const d = form.declaration;
  const errors: Errors = {};
  if (isBlank(d.declarationName)) errors.declarationName = 'Name is required.';
  if (isBlank(d.signatureDate)) errors.signatureDate = 'Signature date is required.';
  if (!d.signatureAgree) errors.signatureAgree = 'You must confirm the attached image is your signature.';
  return { ...errors, ...imageErrors(form.images, INDIVIDUAL_IMAGES), ...totalError(collectIndividualUploads(form).map((u) => u.file)) };
}
```

Delete `uploadErrors` if nothing else uses it.

`reducer.ts`: replace `setSeal` with:

```ts
case 'setImage':
  return form ? withForm(s, { ...form, images: { ...form.images, [a.name]: a.file } } as FormState) : s;
```

Flows:
- Corporate `DECLARATION_FIELDS` gains `'signatory1SignatureFile', 'signatory2SignatureFile', 'sealFile'`. Its validator becomes `(f) => validateDeclaration(asCorporate(f))`.
- Individual `DECLARATION_FIELDS` is `['declarationName', 'signatureDate', 'signatureAgree', 'signatureFile']`.

`FileTile.tsx`: add an `imageOnly?: boolean` prop.
- When it is set, `accept` is `'.jpg,.jpeg,.png,image/jpeg,image/png'` and `validateImageMeta` is used.
- The hint changes to `'JPG or PNG photo or scan, up to 5MB'`.

`submit.ts`: in both builders, add `Object.entries(form.images).forEach(([k, f]) => { if (f) fd.append(k, f); })`. Remove `signatureName` and the `sealFile` line.

`Step5Declaration.tsx`:
- Paragraph text: `We certify that the above information is true. We understand Woodhall Finance is obligated to report suspicious transactions to NFIU.`
- For each signatory, keep the Name and Date `TextField`s. Then add `<FileTile imageOnly label={spec.label} caption={spec.label} file={form.images[spec.name]} error={state.errors[spec.name]} onChange={(file) => { dispatch({ type: 'setImage', name: spec.name, file }); dispatch({ type: 'touch', name: spec.name }); }} />`.
- Add the seal tile in the same way, using the `sealFile` spec.
- Above the tiles, add the helper line `<p className="text-sm text-ink/70">Sign on plain white paper, then upload a clear photo or scan.</p>`.
- Checkbox text: `We confirm the attached images are our own handwritten signatures.`

`IndividualStep3Declaration.tsx`:
- Paragraph: `…I authorize Woodhall Finance to verify my details…`.
- Fields: `declarationName` (label `Full Name`), `signatureDate` (`Date`), the signature tile, the same helper line, and the checkbox `I confirm the attached image is my own handwritten signature.`

`test-utils.ts`: `makeForm` gets `images: { signatory1SignatureFile: null, signatory2SignatureFile: null, sealFile: null }` and drops `seal`. `makeIndividual` gets `images: { signatureFile: null }`, and its declaration has no `signatureName`.

`dev/prefill.ts`: add `setImage` actions with `new File(['test'], 'signature.png', { type: 'image/png' })`, and remove `signatureName`.

`steps.test.tsx`: in `Host`, replace `seal-name` with `state.corporate.images.sealFile?.name`. Update the declaration tests to cover these:
- the tiles exist (`getByLabelText('Company Seal or Stamp')`);
- an uploaded `sig.pdf` shows `Upload a JPG or PNG image.`;
- the old typed-signature label is gone.

`App.test.tsx`: update `submitCorporate` and the individual submit helper so they `user.upload` PNG files to each signature or seal label before ticking the new checkbox labels (`/^We confirm the attached images/`, `/^I confirm the attached image/`). Add the test "blocks submit and shows an inline error when the seal is missing".

- [ ] **Step 4: Run the suite and type check**

Run: `cd frontend && npx vitest run && npx tsc -b`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): require handwritten signature and seal images"
```

---

### Task 4: Individual Customer Information fields

**Files:**
- Modify: `frontend/src/types.ts`, `lib/validation.ts`, `lib/initial-state.ts`, `lib/reducer.ts` (`ChoiceName`), `lib/submit.ts`, `lib/autosave.ts`, `flows/individual.ts`, `components/IndividualStep1Person.tsx`, `dev/prefill.ts`, `test-utils.ts`
- Test: `lib/validation.test.ts`, `lib/autosave.test.ts`, `lib/submit.test.ts`, `flows/individual.test.ts`, `components/steps.test.tsx`, `App.test.tsx`

**Interfaces:**
- Produces:
  - `IndividualPerson` gains `officialEmail: string` and loses `expectedMonthlyTurnover` and `expectedTransactionTypes`.
  - `MeansOfId = 'nin' | 'passport' | 'drivers_license' | 'voters_card'`.
  - `ChoiceName = 'meansOfId'`.
  - `TransactionType` and `TRANSACTION_TYPE_OPTIONS` are deleted.

- [ ] **Step 1: Write the failing tests**

```ts
describe('validateIndividualPerson', () => {
  it('requires everything except ID number and expiry', () => {
    const e = validateIndividualPerson(makeIndividual().person);
    ['fullName', 'dateOfBirth', 'gender', 'employerName', 'officeAddress', 'officialEmail', 'bvn', 'nin', 'meansOfId'].forEach((k) => expect(e[k], k).toBeTruthy());
    expect(e.idNumber).toBeUndefined();
    expect(e.idExpiry).toBeUndefined();
    expect(e.expectedMonthlyTurnover).toBeUndefined();
    expect(e.expectedTransactionTypes).toBeUndefined();
  });
  it('checks the official email format', () => {
    expect(validateIndividualPerson({ ...validPerson, officialEmail: 'nope' }).officialEmail).toBe('Enter a valid email address.');
    expect(validateIndividualPerson(validPerson)).toEqual({});
  });
  it('no longer offers BVN as a means of ID', () => {
    expect(MEANS_OF_ID_OPTIONS.map((o) => o.value)).toEqual(['nin', 'passport', 'drivers_license', 'voters_card']);
  });
});
```

`autosave.test.ts` (Review Focus 4): a legacy draft `{ v: 2, customerType: 'individual', person: { fullName: 'A', meansOfId: ['bvn', 'nin'], expectedTransactionTypes: ['cash'], expectedMonthlyTurnover: '5' }, declaration: { signatureName: 'A' }, documents: { proof_of_address: true }, consent: true }` restores as follows:
- `meansOfId` is `['nin']`;
- `fullName` is `'A'`;
- the person object has neither removed key;
- `declaration` has no `signatureName`.

`steps.test.tsx`:
- `Official Email` follows `Office Address` in DOM order (use `compareDocumentPosition`).
- There is no `Expected Monthly Turnover` or `Expected Transaction Type` label.
- The radiogroup is named `Purpose of Relationship with Woodhall Finance`.
- The means-of-ID group has no `BVN` checkbox: `within(group).queryByLabelText('BVN')` is null.

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd frontend && npx vitest run src/lib/validation.test.ts src/components/steps.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`validateIndividualPerson`:
- The required list gains `['employerName', 'Employer/business name is required.']` and `['officeAddress', 'Office address is required.']`.
- It loses `idNumber` and `expectedMonthlyTurnover`.
- Add the `officialEmail` checks, with the same pattern as `email`: `'Official email is required.'` / `'Enter a valid email address.'`.
- Delete the transaction-types block.

`MEANS_OF_ID_OPTIONS`: remove the `bvn` entry.

`flows/individual.ts` `PERSON_FIELDS`: remove `expectedMonthlyTurnover` and `expectedTransactionTypes`, and add `officialEmail` after `officeAddress`. Make the same change to `PERSON_KEYS` in `flows/individual.test.ts`.

`submit.ts`: delete the `expectedTransactionTypes` destructure and its loop.

`autosave.ts`:
- Delete the `expectedTransactionTypes` copy and pick.
- `pickStrings` already ignores unknown keys, and `pickOptions` drops `'bvn'`.

`IndividualStep1Person.tsx`:
- Delete the turnover `TextField` and the `CheckboxGroup` for transaction types, and drop the `TRANSACTION_TYPE_OPTIONS` import.
- After the `officeAddress` field, add `<TextField {...common} name="officialEmail" label="Official Email" type="email" placeholder="e.g. jane.doe@employer.com" />`.
- Purpose label: `Purpose of Relationship with Woodhall Finance`.
- ID labels: `ID No (optional)` and `Expiry Date (optional)`.

`test-utils.ts` `validPerson`:
- Add `employerName: 'Acme Engineering'`, `officeAddress: '4 Adeola Odeku St'` and `officialEmail: 'jane@acme-eng.com'`.
- Remove the two dropped keys.
- Make the same change to `makeIndividual`.

`dev/prefill.ts`: add `officialEmail: 'jane.doe@acme-engineering.com'`, and remove `expectedMonthlyTurnover` and the transaction-type toggle.

`App.test.tsx` `PERSON` map: remove the turnover entry, add `'Official Email': 'jane@acme-eng.com'`, and remove the transaction-type click.

- [ ] **Step 4: Run the suite and type check**

Run: `cd frontend && npx vitest run && npx tsc -b`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): individual form field changes from the review"
```

---

### Task 5: Corporate registration label, brand and side-panel copy (frontend)

**Files:**
- Modify: `frontend/src/components/Step1Entity.tsx`, `lib/validation.ts`, `lib/copy.ts`, `frontend/index.html`
- Test: `components/steps.test.tsx`, `lib/validation.test.ts`, `components/ui.test.tsx`, `App.test.tsx` (`ENTITY` map), `src/social-preview.test.ts`

- [ ] **Step 1: Write the failing tests**
  - `steps.test.tsx` → `Step1Entity`: `getByLabelText('Business Registration Number (BN / RC)')` exists and `queryByLabelText('RC Number')` is null.
  - `validation.test.ts`: `validateEntity({}).rcNumber === 'Business registration number is required.'`
  - `social-preview.test.ts`: `document.title === 'KYC / CDD Form — Woodhall Finance'`. Follow that file's existing pattern for reading `index.html`.
  - `ui.test.tsx` → BrandPanel: after choosing individual, the checklist contains `/12 months of bank statements/`; for corporate, it contains `/CAC status report/` and `/company seal/`.
  - Add a repo-wide guard to `ui.test.tsx`:

```ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
it('never says Woodhall Capital in the front end', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  const files = [...walk(join(__dirname, '..')), join(__dirname, '../../index.html')].filter((p) => !p.endsWith('.test.tsx'));
  files.forEach((p) => expect(readFileSync(p, 'utf8'), p).not.toMatch(/Woodhall Capital/));
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd frontend && npx vitest run src/components src/social-preview.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**
  - `Step1Entity`: label `Business Registration Number (BN / RC)`, placeholder `e.g. RC1234567 or BN1234567`.
  - `validateEntity`: message `'Business registration number is required.'`.
  - `index.html` `<title>`: `KYC / CDD Form — Woodhall Finance`.
  - `copy.ts` `NEEDS`:

```ts
individual: [
  "A valid means of ID (NIN slip, international passport, driver's license or voter's card)",
  'Your BVN and NIN',
  'Proof of address from the last 3 months: a utility bill and a bank statement',
  'The last 12 months of bank statements',
  'A recent passport photograph',
  'A photo or scan of your handwritten signature',
  'Optional: work ID, employment letter, signature mandate card',
],
corporate: [
  'CAC certificate of incorporation and CAC status report',
  'CAC forms CAC2.3 and CAC1.1 for directors and shareholders',
  'Memorandum and articles of association',
  'A board resolution to open the account and obtain the facility',
  'The last 12 months of company bank statements',
  'Government-issued ID and a recent passport photograph of each authorized signatory',
  "Photos or scans of both signatories' handwritten signatures and the company seal or stamp",
],
```

`App.test.tsx` `ENTITY`: rename the key `'RC Number'` to `'Business Registration Number (BN / RC)'`.

- [ ] **Step 4: Run the suite, type check, lint and build**

Run: `cd frontend && npx vitest run && npm run lint && npm run build`
Expected: all tests pass; the lint is clean and the build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat(frontend): BN/RC label, Woodhall Finance brand and updated checklists"
```

---

### Task 6: PHP validator mirrors the new rules

**Files:**
- Modify: `lib/validator.php`
- Test: `tests/php/test_validator.php`

**Interfaces:**
- Produces:
  - `CORPORATE_DOCUMENTS` and `INDIVIDUAL_DOCUMENTS`: `id => ['label' => string, 'required' => bool]`. They replace `CORPORATE_DOCUMENT_IDS`, `INDIVIDUAL_DOCUMENT_IDS` and the handler's label constants. The ids and labels must equal `frontend/src/lib/documents.ts` exactly.
  - `CORPORATE_IMAGES` and `INDIVIDUAL_IMAGES`: `name => ['slot' => string, 'missing' => string]`.
  - `validate_image_meta(array $file): array`.
  - `validate_uploads` honours `$entry['image'] === true`.

- [ ] **Step 1: Write the failing tests**

```php
test_case('validate_image_meta accepts jpg/jpeg/png only', function () {
    assert_equal(true, validate_image_meta(['name' => 'sig.PNG', 'size' => 10])['valid']);
    assert_equal('Upload a JPG or PNG image.', validate_image_meta(['name' => 'sig.heic', 'size' => 10])['error']);
    assert_equal('Upload a JPG or PNG image.', validate_image_meta(['name' => 'sig.pdf', 'size' => 10])['error']);
});

test_case('validate_individual_person: all required except idNumber/idExpiry; officialEmail checked; BVN is not an ID option', function () {
    $e = validate_individual_person([])['errors'];
    foreach (['employerName', 'officeAddress', 'officialEmail', 'meansOfId'] as $k) assert_true(isset($e[$k]), $k);
    foreach (['idNumber', 'idExpiry', 'expectedMonthlyTurnover', 'expectedTransactionTypes'] as $k) assert_true(!isset($e[$k]), $k);
    $p = valid_person(['officialEmail' => 'nope']);
    assert_equal('Enter a valid email address.', validate_individual_person($p)['errors']['officialEmail']);
    assert_equal('Select at least one means of ID.', validate_individual_person(valid_person(['meansOfId' => ['bvn']]))['errors']['meansOfId']);
});

test_case('validate_individual_declaration no longer needs a typed signature', function () {
    $r = validate_individual_declaration(['declarationName' => 'A', 'signatureDate' => '2026-10-05', 'signatureAgree' => 'on']);
    assert_equal(true, $r['valid']);
});

test_case('rcNumber message names the business registration number', function () {
    assert_equal('Business registration number is required.', validate_entity([])['errors']['rcNumber']);
});

test_case('document specs match the front end ids and labels', function () {
    $ts = file_get_contents(__DIR__ . '/../../frontend/src/lib/documents.ts');
    foreach ([CORPORATE_DOCUMENTS, INDIVIDUAL_DOCUMENTS] as $docs) {
        foreach ($docs as $id => $spec) {
            assert_true(strpos($ts, "id: '{$id}', label: '{$spec['label']}', required: " . ($spec['required'] ? 'true' : 'false')) !== false, $id);
        }
    }
});
```

Update or add `valid_person()` in the test file with the same values as the frontend `validPerson` (Task 4). Remove any existing tests for the typed signature or transaction types.

- [ ] **Step 2: Run them and confirm they fail**

Run: `php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_validator.php`
Expected: FAIL (`validate_image_meta` is undefined).

- [ ] **Step 3: Implement** in `lib/validator.php`:

```php
const IMAGE_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png'];

const CORPORATE_DOCUMENTS = [
    'certificate_of_incorporation' => ['label' => 'CAC Certificate of Incorporation', 'required' => true],
    'cac_status_report' => ['label' => 'CAC Status Report', 'required' => true],
    'cac_forms' => ['label' => 'CAC Forms CAC2.3 / CAC1.1 - Directors & Shareholders', 'required' => true],
    'memorandum_articles' => ['label' => 'Memorandum & Articles of Association', 'required' => true],
    'board_resolution' => ['label' => 'Board Resolution to open account and obtain facility', 'required' => true],
    'company_bank_statement' => ['label' => 'Company Bank Statement - Last 12 months', 'required' => true],
    'government_id_signatories' => ['label' => 'Valid Government-issued ID of Authorized Signatories', 'required' => true],
    'passport_photograph_signatories' => ['label' => 'Recent Passport Photograph of Authorized Signatories', 'required' => true],
    'corporate_id_signatories' => ['label' => 'Corporate ID of Authorized Signatories', 'required' => false],
];

const INDIVIDUAL_DOCUMENTS = [
    'valid_means_of_id' => ['label' => 'Valid Means of ID', 'required' => true],
    'proof_of_address_utility' => ['label' => 'Proof of Address: Utility Bill (less than 3 months old)', 'required' => true],
    'proof_of_address_statement' => ['label' => 'Proof of Address: Bank Statement (less than 3 months old)', 'required' => true],
    'bank_statement_12_months' => ['label' => 'Bank Statement - Last 12 months', 'required' => true],
    'passport_photograph' => ['label' => 'Recent Passport Photograph', 'required' => true],
    'work_id' => ['label' => 'Work ID', 'required' => false],
    'employment_letter' => ['label' => 'Employment Letter', 'required' => false],
    'signature_mandate_card' => ['label' => 'Signature Mandate Card', 'required' => false],
];

const CORPORATE_IMAGES = [
    'signatory1SignatureFile' => ['slot' => 'signatory-1-signature', 'missing' => 'Authorized signatory 1 signature is required.'],
    'signatory2SignatureFile' => ['slot' => 'signatory-2-signature', 'missing' => 'Authorized signatory 2 signature is required.'],
    'sealFile' => ['slot' => 'company-seal', 'missing' => 'Company seal or stamp is required.'],
];
const INDIVIDUAL_IMAGES = [
    'signatureFile' => ['slot' => 'signature', 'missing' => 'Handwritten signature is required.'],
];

function validate_image_meta(array $file): array
{
    $name = $file['name'] ?? '';
    if (!in_array(strtolower(pathinfo($name, PATHINFO_EXTENSION)), IMAGE_FILE_EXTENSIONS, true)) {
        return ['valid' => false, 'error' => 'Upload a JPG or PNG image.'];
    }
    if (($file['size'] ?? 0) > MAX_FILE_SIZE) {
        return ['valid' => false, 'error' => "File exceeds 5MB limit: {$name}"];
    }
    return ['valid' => true, 'error' => null];
}
```

In `validate_uploads`, change the per-entry check to `$result = !empty($entry['image']) ? validate_image_meta($entry['file']) : validate_file_meta($entry['file']);`.

Other changes in `validator.php`:
- `MEANS_OF_ID`: drop `'bvn'`. Delete `TRANSACTION_TYPES`. Set `ARRAY_TEXT_FIELDS = ['meansOfId']`.
- `SINGLE_LINE_TEXT_FIELDS`: remove `expectedMonthlyTurnover` and `signatureName`; add `officialEmail`.
- `validate_individual_person`: the same rule changes as Task 4. The new messages are `'Employer/business name is required.'`, `'Office address is required.'` and `'Official email is required.'`.
- `validate_individual_declaration`: drop the `signatureName` check, and set the agree message to `'You must confirm the attached image is your signature.'`.
- `validate_declaration` agree message: `'You must confirm the attached images are your signatures.'`.
- `validate_entity` rcNumber message: as tested above.

- [ ] **Step 4: Run all PHP tests**

Run: `for f in tests/php/test_validator.php tests/php/test_submission_handler.php tests/php/test_pdf_builder.php tests/php/test_mailer.php; do php -d error_reporting="E_ALL & ~E_DEPRECATED" $f | tail -1; done`
Expected: `test_validator` passes in full. The handler and PDF tests may fail where they reference removed constants or labels; Tasks 7–8 fix those. Note the failures, but do not fix them here.

- [ ] **Step 5: Commit**

```bash
git add lib/validator.php tests/php/test_validator.php
git commit -m "feat(backend): validator mirrors required documents, images and individual field changes"
```

---

### Task 7: PHP submission handler — required files, images, new request contract

**Files:**
- Modify: `lib/submission-handler.php`
- Test: `tests/php/test_submission_handler.php`

**Interfaces:**
- Consumes (from Task 6): `CORPORATE_DOCUMENTS`, `INDIVIDUAL_DOCUMENTS`, `CORPORATE_IMAGES`, `INDIVIDUAL_IMAGES`, `validate_uploads` with the `image` flag.
- Produces:
  - `$data['documents']` is a list of `['id', 'label', 'attached' => bool]`.
  - `$data['images']` maps an image name to its tmp path, only for attached images.
  - `$data['sealAttached']` is removed.

- [ ] **Step 1: Write the failing tests.** First rewrite the fixtures:
  - `sample_post()` drops `documents` and adds nothing else.
  - Add a helper `all_files(array $docIds, array $imageNames): array`. For each document it merges `files_entry('documents', [$id], upload("$id.pdf", tmp_file()))`. For each image it merges `files_entry($name, [], upload("$name.png", tmp_file()))`.
  - Update every existing success-path test to pass `all_files(array_keys(CORPORATE_DOCUMENTS), array_keys(CORPORATE_IMAGES))`.

```php
test_case('rejects a corporate submission missing a required document or image, keyed by id', function () {
    $files = all_files(['certificate_of_incorporation'], ['signatory1SignatureFile']);
    $r = handle_submission(sample_post(), $files, ok_sender());
    assert_equal(false, $r['success']);
    assert_equal('CAC Status Report is required.', $r['errors']['cac_status_report']);
    assert_equal('Company seal or stamp is required.', $r['errors']['sealFile']);
    assert_true(!isset($r['errors']['corporate_id_signatories']), 'optional doc');
    assert_true(!isset($r['errors']['certificate_of_incorporation']));
});

test_case('rejects a non-image signature', function () {
    $files = array_replace_recursive(all_files(array_keys(CORPORATE_DOCUMENTS), array_keys(CORPORATE_IMAGES)),
        files_entry('signatory2SignatureFile', [], upload('sig.pdf', tmp_file())));
    $r = handle_submission(sample_post(), $files, ok_sender());
    assert_equal('Upload a JPG or PNG image.', $r['errors']['signatory2SignatureFile']);
});

test_case('passes attached flags and image paths to the sender, and slot-names image attachments', function () {
    $files = all_files(array_keys(CORPORATE_DOCUMENTS), array_keys(CORPORATE_IMAGES));
    $r = handle_submission(sample_post(), $files, ok_sender($data, $att));
    assert_equal(true, $r['success']);
    $byId = array_column($data['documents'], 'attached', 'id');
    assert_equal(true, $byId['cac_status_report']);
    assert_true(isset($data['images']['sealFile']));
    $names = array_column($att, 'originalName');
    assert_true(count(array_filter($names, fn($n) => strpos($n, 'signatory-1-signature - ') === 0)) === 1);
});

test_case('an individual submission needs the five required documents and the signature image', function () {
    $r = handle_submission(['customerType' => 'individual'], [], ok_sender());
    foreach (['valid_means_of_id', 'proof_of_address_utility', 'proof_of_address_statement', 'bank_statement_12_months', 'passport_photograph', 'signatureFile'] as $k) {
        assert_true(isset($r['errors'][$k]), $k);
    }
    foreach (['work_id', 'employment_letter', 'signature_mandate_card'] as $k) assert_true(!isset($r['errors'][$k]), $k);
});
```

Delete the old tests "ignores an UNTICKED document…" and "attaches a ticked document…". Replace the second with an equivalent: an attached document gets a slot-prefixed, sanitised name, and its temp file is deleted.

- [ ] **Step 2: Run them and confirm they fail**

Run: `php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_submission_handler.php`
Expected: FAIL.

- [ ] **Step 3: Implement**

```php
function parse_documents_input(array $files, array $specs): array
{
    $documents = [];
    foreach ($specs as $id => $spec) {
        $documents[] = ['id' => $id, 'label' => $spec['label'], 'required' => $spec['required'],
            'file' => extract_upload($files, 'documents', [$id])];
    }
    return $documents;
}

function missing_document_errors(array $documents): array
{
    $errors = [];
    foreach ($documents as $doc) {
        if ($doc['required'] && $doc['file'] === null) $errors[$doc['id']] = $doc['label'] . ' is required.';
    }
    return $errors;
}

/** Signature/seal uploads: [uploads, errors for missing ones]. */
function collect_images(array $files, array $specs): array
{
    $uploads = [];
    $errors = [];
    foreach ($specs as $name => $spec) {
        $meta = extract_upload($files, $name, []);
        if ($meta === null) $errors[$name] = $spec['missing'];
        else $uploads[] = ['key' => $name, 'slot' => $spec['slot'], 'file' => $meta, 'image' => true];
    }
    return [$uploads, $errors];
}

function image_paths(array $uploads): array
{
    $paths = [];
    foreach ($uploads as $u) {
        if (!empty($u['image'])) $paths[$u['key']] = (string) $u['file']['tmp_name'];
    }
    return $paths;
}
```

Other changes in the handler:
- `collect_uploads($documents, $files, $directorCount)`: drop the `$withSeal` parameter and branch.
- `collect_upload_errors`: pass `'image' => !empty($upload['image'])` into each `$checkable` entry.
- `summarise_documents` returns `['id', 'label', 'attached' => $d['file'] !== null]`.
- Delete `CORPORATE_DOCUMENT_LABELS` and `INDIVIDUAL_DOCUMENT_LABELS`.

The corporate handler:

```php
$documents = parse_documents_input($files, CORPORATE_DOCUMENTS);
[$images, $imageErrors] = collect_images($files, CORPORATE_IMAGES);
$uploads = array_merge(collect_uploads($documents, $files, min(count($rows), MAX_DIRECTORS)), $images);
$errors = array_merge(/* existing validators */, missing_document_errors($documents), $imageErrors, collect_upload_errors($uploads));
// …
$data['images'] = image_paths($images); // replaces 'sealAttached'
```

The individual handler is the same, using `INDIVIDUAL_DOCUMENTS` and `INDIVIDUAL_IMAGES`.

- [ ] **Step 4: Run the handler and validator tests**

Run: `php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_submission_handler.php && php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_validator.php`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/submission-handler.php tests/php/test_submission_handler.php
git commit -m "feat(backend): require documents, signature and seal images in submissions"
```

---

### Task 8: PDF — new labels, Attached/Not provided, embedded signature and seal images

**Files:**
- Modify: `lib/pdf-builder.php`, `vendor/tcpdf/config/tcpdf_config.php:226`
- Test: `tests/php/test_pdf_builder.php`

**Interfaces:**
- Consumes (from Task 7): `$data['documents'][*]['attached']`, `$data['images'][name] => path`.
- Produces: `pdf_image_field(string $label, ?string $path): array` (a row), and `pdf_image_row(TCPDF $pdf, string $label, string $path): bool`.

- [ ] **Step 1: Write the failing tests**

```php
function png_fixture(): string
{
    $p = tempnam(sys_get_temp_dir(), 'sig-') . '.png';
    $im = imagecreatetruecolor(120, 40);
    imagefill($im, 0, 0, imagecolorallocate($im, 255, 255, 255));
    imageline($im, 5, 30, 115, 10, imagecolorallocate($im, 0, 0, 0));
    imagepng($im, $p);
    return $p;
}

test_case('corporate declaration rows carry signature and seal images and document rows say Attached/Not provided', function () {
    $data = sample_corporate_data(); // existing fixture, updated to the new shape
    $data['documents'] = [['id' => 'cac_status_report', 'label' => 'CAC Status Report', 'attached' => true],
        ['id' => 'corporate_id_signatories', 'label' => 'Corporate ID of Authorized Signatories', 'attached' => false]];
    $data['images'] = ['signatory1SignatureFile' => png_fixture(), 'sealFile' => png_fixture()];
    $sections = corporate_pdf_sections($data);
    $rows = $sections[2]['groups'][0]['rows'];
    assert_equal(['CAC Status Report', 'Attached'], [$rows[0][0], $rows[0][1]]);
    assert_equal('Not provided', $rows[1][1]);
    $decl = $sections[4]['groups'][0]['rows'];
    $byLabel = [];
    foreach ($decl as $r) $byLabel[$r[0]] = $r;
    assert_true(isset($byLabel['Signatory 1 Signature']['image']));
    assert_equal('Not provided', $byLabel['Signatory 2 Signature'][1]);
    assert_true(isset($byLabel['Company Seal or Stamp']['image']));
    assert_equal('%PDF', substr(build_submission_pdf($data), 0, 4));
});

test_case('a corrupt "png" does not break the PDF and falls back to text', function () {
    $bad = tempnam(sys_get_temp_dir(), 'bad-') . '.png';
    file_put_contents($bad, 'not an image');
    $data = sample_individual_data();
    $data['images'] = ['signatureFile' => $bad];
    assert_equal('%PDF', substr(build_submission_pdf($data), 0, 4));
});

test_case('individual sections: official email, no turnover/transaction rows, Woodhall Finance wording', function () {
    $rows = individual_pdf_sections(sample_individual_data())[0]['groups'][0]['rows'];
    $labels = array_column($rows, 0);
    assert_true(in_array('Official Email', $labels, true));
    assert_true(in_array('Purpose of Relationship with Woodhall Finance', $labels, true));
    assert_true(!in_array('Expected Monthly Turnover (NGN)', $labels, true));
    assert_true(!in_array('Expected Transaction Type', $labels, true));
    $all = json_encode([individual_pdf_sections(sample_individual_data()), corporate_pdf_sections(sample_corporate_data())]);
    assert_true(strpos($all, 'Woodhall Capital') === false);
});
```

Update the fixtures in the test file:
- documents use `attached`;
- remove `sealAttached`;
- remove `expectedMonthlyTurnover`, `expectedTransactionTypes` and `signatureName`;
- add `officialEmail`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_pdf_builder.php`
Expected: FAIL.

- [ ] **Step 3: Implement**

`vendor/tcpdf/config/tcpdf_config.php` line 226: change it to `define('K_TCPDF_THROW_EXCEPTION_ERROR', true);`. Add the comment `// Woodhall: throw instead of die() so a bad image can't kill the JSON response.`

`lib/pdf-builder.php`:

```php
const PDF_LABEL_WIDTH = 55;

function pdf_image_field(string $label, ?string $path): array
{
    return $path === null ? [$label, 'Not provided'] : [$label, 'Attached (see email)', 'image' => $path];
}

/** Draws an embedded JPG/PNG beside its label. False (nothing drawn) when the file isn't a usable image. */
function pdf_image_row(TCPDF $pdf, string $label, string $path): bool
{
    $size = @getimagesize($path);
    if ($size === false || !in_array($size[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true) || $size[0] === 0) {
        return false;
    }
    $width = 50;
    $height = $width * $size[1] / $size[0];
    if ($height > 30) {
        $height = 30;
        $width = $height * $size[0] / $size[1];
    }
    $margins = $pdf->getMargins();
    if ($pdf->GetY() + $height + PDF_SPACE_SM > $pdf->getPageHeight() - $margins['bottom']) {
        $pdf->AddPage();
    }
    $y = $pdf->GetY();
    try {
        $pdf->Image($path, $margins['left'] + PDF_LABEL_WIDTH, $y, $width, $height);
    } catch (Throwable $e) {
        return false;
    }
    $pdf->SetFont('helvetica', 'B', 10);
    $pdf->MultiCell(PDF_LABEL_WIDTH, 6, $label, 0, 'L', false, 0, $margins['left'], $y);
    $pdf->SetFont('helvetica', '', 10);
    $pdf->SetY($y + $height + PDF_SPACE_SM);
    return true;
}
```

In `pdf_field_table`:
- change the loop to `foreach ($rows as $row) { [$label, $value] = $row;`;
- add `if (isset($row['image']) && pdf_image_row($pdf, $label, (string) $row['image'])) continue;` at its top;
- use `PDF_LABEL_WIDTH` instead of `$labelWidth = 55`.

Sections:
- Document rows: `[$doc['label'], !empty($doc['attached']) ? 'Attached' : 'Not provided']`.
- Add `$img = fn(string $k): ?string => is_string($data['images'][$k] ?? null) ? $data['images'][$k] : null;` in both section builders.
- Corporate A: `['Business Registration No. (BN / RC)', $v('rcNumber')]`.
- Corporate E:
  - certification text with "Woodhall Finance";
  - signatory 1 name, date and `pdf_image_field('Signatory 1 Signature', $img('signatory1SignatureFile'))`;
  - the same three rows for signatory 2;
  - `pdf_image_field('Company Seal or Stamp', $img('sealFile'))`;
  - `['Handwritten signatures confirmed', 'Yes']`.
- Individual A:
  - remove the turnover and transaction rows;
  - add `['Official Email', $v('officialEmail')]` after Office Address;
  - relabel to `Purpose of Relationship with Woodhall Finance`;
  - remove `'bvn'` from `MEANS_OF_ID_LABELS`; delete `TRANSACTION_TYPE_LABELS`.
- Individual C: declaration text with "Woodhall Finance", `Name`, `Date`, `pdf_image_field('Signature', $img('signatureFile'))`, and `['Handwritten signature confirmed', 'Yes']`.
- `SetCreator('Woodhall Finance KYC Form')` and `SetAuthor('Woodhall Finance')`.

- [ ] **Step 4: Run all PHP tests**

Run: `for f in tests/php/test_*.php; do [ $f = tests/php/test_helper.php ] || php -d error_reporting="E_ALL & ~E_DEPRECATED" $f | tail -1; done`
Expected: validator, handler and PDF pass in full. Mailer fixtures are updated in Task 9.

- [ ] **Step 5: Commit**

```bash
git add lib/pdf-builder.php vendor/tcpdf/config/tcpdf_config.php tests/php/test_pdf_builder.php
git commit -m "feat(backend): PDF shows attached documents and embeds signature and seal images"
```

---

### Task 9: Emails, config, preview, README — then full verification

**Files:**
- Modify: `config.php`, `lib/mailer.php`, `preview.php`, `README.md`
- Test: `tests/php/test_mailer.php`

**Interfaces:**
- Consumes: `$data['documents'][*]['attached']`, `$data['customerType']`.
- Produces: `RECIPIENT_EMAILS` (a list of strings) in `config.php`; the `RECIPIENT_EMAIL` constant is deleted.

- [ ] **Step 1: Write the failing tests**

```php
test_case('admin email goes to every configured recipient and lists attached documents', function () {
    $data = $sampleData; // updated fixture with documents[*]['attached']
    $sent = [];
    $factory = fake_mailer_factory($sent); // existing helper in this file; extend it to record addAddress calls
    send_submission_emails($data, '%PDF', [], $factory);
    assert_equal(RECIPIENT_EMAILS, $sent[0]['to']);
    $html = build_admin_email_html($data);
    assert_true(strpos($html, 'CAC Status Report') !== false);
});

test_case('emails say Woodhall Finance, never Woodhall Capital', function () use ($sampleData) {
    $all = build_admin_email_html($sampleData) . build_confirmation_email_html($sampleData);
    assert_true(strpos($all, 'Woodhall Capital') === false);
    assert_true(strpos($all, 'Woodhall Finance') !== false);
});

test_case('confirmation explains what happens next and gives a contact address', function () use ($sampleData) {
    $html = build_confirmation_email_html($sampleData);
    assert_true(strpos($html, 'What happens next') !== false);
    assert_true(strpos($html, 'info@woodhallfinanceltd.com') !== false);
});
```

If the file's fake mailer doesn't record recipients, extend it so `addAddress($email, $name)` appends to `$sent[n]['to']`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_mailer.php`
Expected: FAIL.

- [ ] **Step 3: Implement**

`config.php`:

```php
// Every address here receives the new-submission notification with the PDF and documents.
define('RECIPIENT_EMAILS', ['credit@woodhallfinanceltd.com']);
define('RECIPIENT_NAME', 'Woodhall Finance');
// Sending setup is pending: see docs/email-setup-microsoft-365.md.
define('MAIL_FROM_ADDRESS', 'no-reply@woodhallfinanceltd.com');
define('MAIL_FROM_NAME', 'Woodhall Finance');
define('CONTACT_EMAIL', 'info@woodhallfinanceltd.com');
```

`MAX_*` and `SMTP_*` stay as they are.

`lib/mailer.php`:
- `foreach (RECIPIENT_EMAILS as $to) { $admin->addAddress($to, RECIPIENT_NAME); }`
- The footer reads `Woodhall Finance`.
- The confirmation subject is `'We received your Woodhall Finance KYC submission'`.
- Admin body (each item a paragraph):
  - customer type and name;
  - submitted time;
  - `Documents attached:` followed by a `<ul>` of the labels where `attached` is true (each `htmlspecialchars`'d);
  - "Signature images and the company seal (if any) are attached and also shown in the PDF.";
  - "Please review the submission and contact the customer if anything is missing."
- Confirmation body:
  - `Thank you, <name>. We have received your <kind> submission and the documents you attached.`
  - `<strong>What happens next</strong><br>Our team will review your documents and verify your details. We will contact you if we need anything else.`
  - `A copy of your submission is attached for your records.`
  - `Questions? Email <a href="mailto:CONTACT_EMAIL">CONTACT_EMAIL</a>.`
  - `— Woodhall Finance`

`preview.php`: update both sample data sets to the new shapes:
- documents with `attached`;
- `images` pointing at `assets/logos/woodhall-finance.png`, as a stand-in signature;
- `officialEmail`;
- remove the dropped fields.

`README.md`:
- The title becomes `# Woodhall Finance — KYC / CDD Form`; replace the other "Woodhall Capital" mentions.
- Rewrite the **Request contract** section:
  - files are sent as `documents[<id>]`, with the id lists for each type and their Required/Optional status;
  - list the image fields;
  - list the individual fields, with `officialEmail` added and the turnover and transaction fields removed;
  - `rcNumber` is labelled "Business Registration Number (BN / RC)".
- Update the step descriptions: the individual declaration is a handwritten signature image, and the corporate declaration has signature images plus a required seal.

- [ ] **Step 4: Full verification**

```bash
cd /Users/mac/Developer/woodhall/kyc
for f in tests/php/test_*.php; do [ $f = tests/php/test_helper.php ] || php -d error_reporting="E_ALL & ~E_DEPRECATED" $f | tail -1; done
grep -rn "Woodhall Capital" --exclude-dir=node_modules --exclude-dir=vendor --exclude-dir=docs --exclude-dir=build --exclude=*.zip . || echo "brand clean"
cd frontend && npx vitest run && npm run lint && npm run build
```

Expected: every PHP file ends `N tests, N passed, 0 failed`; `brand clean` prints; the vitest run passes in full; the lint is clean; the build succeeds.

Then check it manually:
1. Run `php -S localhost:8000` from the repo root. Open `/preview.php` and check that both emails and both PDFs show "Woodhall Finance", the Attached/Not provided rows and an embedded signature image.
2. Run `cd frontend && npm run dev`. Walk through the individual flow:
   - Next is blocked on the documents step until the 5 required files are attached;
   - the signature tile rejects a `.pdf`.
3. Walk through the corporate flow in the same way.

- [ ] **Step 5: Commit**

```bash
git add config.php lib/mailer.php preview.php README.md tests/php/test_mailer.php
git commit -m "feat: Woodhall Finance emails to the credit team; document the new request contract"
```
