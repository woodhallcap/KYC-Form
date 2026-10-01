# KYC Form v2 — Individual + Corporate flows (updated document)

Date: 2026-09-30
Source: `KYC Form.pdf` (updated Woodhall document: 1. Individual KYC, 2. Corporate KYC, 3. EDD, 4. CBN notes)
Builds on: the React migration (PR #1). Branch `kyc-form-v2` is cut from local `main`, which includes it.

## Goal

The public web form captures the customer-facing parts of the updated document for two
customer types, **Individual** and **Corporate**, and delivers a branded PDF plus uploaded
documents to compliance, with a confirmation copy to the submitter.

## Decisions (agreed with owner)

- The customer picks Individual or Corporate on the first screen.
- Only customer-facing parts are on the web form. **Excluded (official use):** risk rating,
  PEP/sanctions screening result, officer / AMLCO / compliance sign-offs, the EDD form, the
  CBN compliance notes, the BVN-validation-slip and NIN-verification checklist lines.
- Approach: **data-driven flows** — each customer type is a config of steps, fields and
  validators rendered by one generic wizard.
- The Corporate form keeps a required **company email** (the new document dropped it; the
  owner asked to keep it so the confirmation copy still has a recipient).
- The "frontend only" limit from the React migration no longer applies: PHP validator, PDF
  and emails change too.
- Two milestones, each shippable: **M1** plumbing + updated Corporate flow (incl. PDF/email);
  **M2** Individual flow + type selector.

## Non-goals

Internal/staff sections, an EDD workflow, staff mode, any visual redesign, database.

## Open items (defaults chosen; owner may override)

- **Branding.** The document is titled "Woodhall Finance Company Ltd"; the app, PDF and emails
  say "Woodhall Capital". Default: unchanged. Text/logo change is a small follow-up.
- **Consent checkbox.** The old form had a "we consent to processing…" checkbox; the new
  document has none. Default: **keep it** on the Corporate documents step (removing a legal
  consent silently is riskier than keeping it). Individual gets the same consent.
- **Both authorized signatories required** on Corporate (the document lists two). Default: yes.

## Architecture

### Flows (frontend)

`frontend/src/flows/{corporate,individual}.ts` each export:
`{ id, label, steps: [{ id, title, fields: string[], validate(form) → Errors }] }`.
The reducer's `next`, `touch`, `fieldStep` and error logic read the active flow instead of
hard-coded steps. `customerType: 'individual' | 'corporate' | null` is part of the state;
`null` shows the selector. `FormState` becomes a discriminated union on `customerType`.

Draft key becomes `woodhall-kyc-draft-v2` (stores `customerType` and all values, never files).
v1 drafts are ignored, not migrated.

### Corporate flow (M1)

| Step | Content | Required |
|---|---|---|
| A Entity | companyName, rcNumber, dateOfIncorporation, registeredAddress, businessAddress, natureOfBusiness, tin, companyEmail, bankAccountNumber, bankName | all except businessAddress; companyEmail must be a valid email |
| B Directors, Signatories & UBOs >5% | list of rows (add/remove, min 1): name, designation, bvn, nin, shareholdingPercent, nationality, pep (yes/no), residentialAddress; per-row optional attachments: id, bvn, nin, proof_of_address | all eight row fields; shareholdingPercent numeric 0–100 |
| C Required Documents | tick + attach: certificate_of_incorporation, cac_forms (CAC2.3 / CAC1.1 – Directors & Shareholders), memorandum_articles, board_resolution (to open account and obtain facility), company_bank_statement (last 12 months), corporate_id_signatories; consent checkbox | consent; attachments optional as today |
| D Funds | sourceOfFunds, facilityAmount (₦) | both non-blank |
| E Declaration | certification text; signatory1Name + signatory1Date, signatory2Name + signatory2Date; optional company-seal upload; signatureAgree checkbox | names, dates, agree |

Removed vs today: legalStatus, legalStatusOther, website; the old 12-document list.

### Individual flow (M2)

| Step | Content | Required |
|---|---|---|
| A Customer information | fullName, dateOfBirth, placeOfBirth, gender (M/F), nationality, countryOfResidence, residentialAddress, lga, state, phone, email, meansOfId (checkboxes: NIN, BVN, Int'l Passport, Driver's License, Voter's Card), idNumber, idExpiry, bvn, nin, occupation, employerName, officeAddress, sourceOfIncome (Salary/Business/Investment/Inheritance/Other + text), sourceOfWealth, purposeOfRelationship (Loan/Lease/Investment/Other + text), expectedMonthlyTurnover (₦), expectedTransactionTypes (Cash/Transfer/Cheque, multi) | all except idExpiry, employerName, officeAddress; ≥1 meansOfId; "Other" requires its text; email valid |
| B Documents | tick + attach: valid_means_of_id, proof_of_address (<3 months: utility bill / bank statement), passport_photograph, signature_mandate_card; consent checkbox | consent |
| C Declaration | declarationName ("I, ___ hereby declare…"), signatureName, signatureDate, signatureAgree | all |

### Shared rules

Blank = trim-empty. Files: pdf/jpg/jpeg/png/docx, 5MB each, 20MB total across **all** uploads
(directors' and documents'). Limits unchanged in `config.php`. Field-level errors map to the
step that owns the field (earliest step wins on server errors); errors on uploads / `_total`
show as an alert, as today. Typed-name signatures, no drawn signatures.

## Client–server contract

`POST submit.php` multipart, same style as today:
`customerType=corporate|individual`, flat fields by name, `documents[<id>][submitted]` /
`documents[<id>][file]`, corporate `directors[<i>][<field>]` and
`directors[<i>][files][<id|bvn|nin|proof_of_address>]`, `companyEmail` / `email`, checkbox
values `on`. `sealFile` for the corporate seal. Response JSON unchanged:
`{success, errors, message}`.

## Backend (PHP)

- `lib/validator.php`: `validate_corporate($post,$files)` and `validate_individual(...)`, with
  the same sanitising (control chars, CR/LF stripped from single-line fields). Unknown or
  missing `customerType` → 422 with `errors.customerType`. Director rows parsed defensively
  (non-array, huge counts capped at 25 rows).
- `lib/pdf-builder.php`: `build_corporate_pdf` and `build_individual_pdf`, same branding and
  watermark, sections mirroring the document; directors rendered as a table.
- `lib/mailer.php`: admin email subject includes type and name; the confirmation copy goes to
  `companyEmail` / `email` (both required, so always present).
- `lib/submission-handler.php`: dispatches by `customerType`; attachments include directors'
  files and the seal; temp files always cleaned up.
- `submit.php` unchanged. Backend paths to `assets/logos/` unchanged.

## Testing

- Vitest: each flow's validators (incl. directors rows, percent bounds, "Other" text, means of
  ID ≥1); reducer with both flows and the selector; autosave v2 round-trip and v1 ignored;
  FormData shape for directors/seal/individual; App flows for both types (happy path, server
  error step jump, network error, draft restore).
- PHP: validator, PDF (renders, contains key fields), mailer (subject, recipients), handler
  (both types, upload error cases, cleanup).
- Manual: headless-Chrome screenshots at 1024 and 375px for both flows; submit only against a
  test recipient (never the real `RECIPIENT_EMAIL` — see the earlier stray-email incident).

## Cleanup / docs

README: form description, structure, request contract. Delete the v1 corporate-only code paths
and unused legal-status / website handling. Remove the old 12-item document list.

## Risks

- Per-director attachments can hit the 20MB total quickly; the error is an alert with the
  existing message. Limits deliberately unchanged.
- Discriminated-union state is a bigger refactor than field edits; M1 is scoped to land the
  plumbing with Corporate alone before Individual is added.
- Branding remains an owner decision (see Open items).
