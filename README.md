# Woodhall Finance — KYC / CDD Form

A public web form that digitizes Woodhall Finance's KYC / CDD process (the customer-facing
parts of the updated KYC document). The first screen asks whether the customer is an
**Individual** or a **Corporate** customer, then shows the matching wizard:

- **Individual (3 steps):** **A** Customer Information, **B** Verification Documents,
  **C** Declaration (typed name, typed signature, date).
- **Corporate (5 steps):** **A** Entity Information, **B** Directors, Signatories & UBOs (>5%) —
  a list you can add to and remove from, with optional per-person attachments — **C** Required
  Documents, **D** Source of Funds and **E** Declaration (two typed-name signatories plus an
  optional company seal).

Official-use sections (risk rating, sign-offs, EDD, CBN notes) are not on the web form. On
submission it:

1. Generates a branded, print-ready PDF of the full submission.
2. Emails that PDF (plus any uploaded supporting documents) to compliance.
3. Emails a confirmation copy of the PDF to the submitter.

## Tech stack

React + TypeScript front end (built with Vite into static files) backed by a PHP endpoint.
No Composer dependency at deploy time — PHPMailer and TCPDF are vendored directly
into `vendor/` since Bluehost shared hosting doesn't guarantee Composer is available.
Node is only needed to build the front end; nothing Node-based runs in production.

- **Front end:** React 19, TypeScript, Tailwind CSS v4, Vite
- **Backend:** PHP 8+
- **Email:** [PHPMailer](https://github.com/PHPMailer/PHPMailer) (vendored, no Composer)
- **PDF generation:** [TCPDF](https://github.com/tecnickcom/TCPDF) (vendored, pruned to the 14 core fonts only)
- **Tests:** Vitest + React Testing Library for the front end, a small custom assertion harness for PHP (no PHPUnit dependency)

## Project structure

```
frontend/                  React app (Vite + TypeScript + Tailwind)
  src/App.tsx              wizard layout, step orchestration, submission
  src/flows/               a flow = ordered steps (owns/touchKeys/validate): corporate.ts, individual.ts
  src/lib/validation.ts    client-side validation (mirrors lib/validator.php)
  src/lib/reducer.ts       flow-driven form state, touched/error logic, director rows
  src/lib/autosave.ts      localStorage draft autosave/restore (key woodhall-kyc-draft-v2)
  src/lib/submit.ts        builds the FormData and POSTs to submit.php
  src/components/          BrandPanel (side panel), TypeSelector, ProgressBar (stepper), FileTile (uploads),
                           corporate Step1Entity … Step5Declaration, DirectorRow,
                           IndividualStep1Person … IndividualStep3Declaration, DocumentsStep, fields
  src/dev/prefill.ts       dev-only "Fill test data" data
assets/logos/              brand logos — bundled into the front end AND read by the
                           PHP PDF/email code (lib/pdf-builder.php, lib/mailer.php)
scripts/package.sh         builds the front end and assembles the Bluehost deploy zip
config.php                 recipient email, SMTP settings, upload limits
submit.php                 HTTP entry point — validates and orchestrates a submission
lib/validator.php          server-side validation + input sanitization (authoritative)
lib/pdf-builder.php        renders the print-ready submission PDF (TCPDF)
lib/mailer.php             builds and sends the admin + confirmation emails (PHPMailer)
lib/submission-handler.php dispatches by customerType (corporate | individual) → validate → PDF → email → cleanup
preview.php                dev-only preview of the emails/PDF using sample data
vendor/                    vendored PHPMailer + TCPDF (no Composer)
tests/php/                 PHP unit tests (custom harness)
```

## Request contract

`POST submit.php` (multipart). `customerType` is required and is `corporate` or `individual`;
anything else is rejected with `errors.customerType`.

**Corporate**

- Text fields by name: `companyName, rcNumber, dateOfIncorporation, registeredAddress,
  businessAddress, natureOfBusiness, tin, companyEmail, bankAccountNumber, bankName,
  sourceOfFunds, facilityAmount, signatory1Name, signatory1Date, signatory2Name, signatory2Date`;
  checkboxes `consent`, `signatureAgree` = `on`.
- Directors: `directors[i][name|designation|bvn|nin|shareholdingPercent|nationality|pep|residentialAddress]`
  (`pep` = `yes`/`no`, `shareholdingPercent` 0–100) and optional files
  `directors[i][files][id|bvn|nin|proof_of_address]`.
- Documents: ids `certificate_of_incorporation, cac_forms, memorandum_articles, board_resolution,
  company_bank_statement, corporate_id_signatories`. Optional `sealFile`.

**Individual**

- Text fields by name: `fullName, dateOfBirth, placeOfBirth, nationality, countryOfResidence,
  residentialAddress, lga, state, phone, email, idNumber, idExpiry, bvn, nin, occupation,
  employerName, officeAddress, sourceOfIncomeOther, sourceOfWealth, purposeOther,
  expectedMonthlyTurnover, declarationName, signatureName, signatureDate`; checkboxes `consent`,
  `signatureAgree` = `on`.
- Choices: `gender` (`M`/`F`), `sourceOfIncome` (`salary|business|investment|inheritance|other`),
  `purposeOfRelationship` (`loan|lease|investment|other`); `sourceOfIncomeOther` / `purposeOther`
  are required when the choice is `other`.
- Multi-choice arrays: `meansOfId[]` (`nin|bvn|passport|drivers_license|voters_card`, at least one)
  and `expectedTransactionTypes[]` (`cash|transfer|cheque`, at least one).
- Documents (all five are required, each with a file): ids `valid_means_of_id, utility_bill, bank_statement, passport_photograph, signature_mandate_card`. Items 1 to 8 on the form are all required, except the ID expiry date.

**Both:** `documents[<id>][submitted]=on` plus `documents[<id>][file]`; only ticked documents are
validated and attached. Uploads: pdf/jpg/jpeg/png/docx, 5MB each, 20MB total across all uploads.
Response: `{success, errors, message}`. Field errors are keyed by field name (`directors.<i>.<field>`
for director rows); upload problems are keyed by document id, `directorFile.<i>.<id>`, `sealFile`
or `_total` and shown to the user as an alert. The confirmation copy is emailed to `companyEmail`
(corporate) or `email` (individual).

## Local development

Requires PHP 8+ and Node.js 20+. Run both servers:

```bash
php -S localhost:8000          # backend (repo root)
cd frontend && npm install     # first time only
npm run dev                    # front end on http://localhost:5173
```

Vite proxies `/submit.php` to the PHP server on :8000. In `npm run dev` only, a
**"Fill test data (dev only)"** button appears bottom-right; it is compiled out of
production builds. **Careful:** a real submission emails `RECIPIENT_EMAIL` from
`config.php` — point it at a test inbox or configure a sandbox SMTP before testing.

## Configuration

Before deploying, edit `config.php`:

| Constant | Purpose |
|---|---|
| `RECIPIENT_EMAIL` / `RECIPIENT_NAME` | **Placeholder — must be replaced** with the real compliance inbox before go-live. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` / `SMTP_SECURE` | Leave `SMTP_HOST` empty to fall back to PHP's built-in `mail()`; set these for real SMTP delivery. |
| `MAIL_FROM_ADDRESS` / `MAIL_FROM_NAME` | From-address used on both outgoing emails. |
| `MAX_FILE_SIZE_BYTES` / `MAX_TOTAL_SIZE_BYTES` | Per-file (5MB) and total (20MB) upload caps. |

`.user.ini` raises PHP's own `upload_max_filesize`/`post_max_size` ini limits to
comfortably exceed the app's caps above — without it, some hosts' lower defaults
would silently reject uploads before the app's own validation ever runs.

## Link preview (Open Graph)

When the form's link is pasted into WhatsApp, Slack, LinkedIn or iMessage, the preview card uses the
tags in `frontend/index.html` and the 1200×630 image `frontend/public/og-image.png` (the Woodhall
Finance logo). Crawlers need absolute addresses, so the page's public address comes from
`VITE_SITE_URL` in `frontend/.env` (default `https://kyc.woodhallfinanceltd.com`, no trailing
slash). To preview from another host, set `VITE_SITE_URL` at build time, for example as an
environment variable in the Vercel project settings. Social apps cache previews, so a changed
image can take a while to show up, or use the platform's link debugger to refresh it.

## Previewing emails and the PDF

`preview.php` renders the admin email, confirmation email, and generated PDF using
sample data — no real submission or send involved. It's restricted to local
requests (`127.0.0.1`/`::1`) and is **not linked from the public form**.

```
http://localhost:8000/preview.php
```

**Delete `preview.php` before deploying to production** — it has no authentication
beyond the IP check.

## Running tests

```bash
# Front end (Vitest)
cd frontend && npm test

# PHP tests (suppress harmless PHP 8.4+ deprecation notices from TCPDF's
# legacy XML parser calls)
php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_validator.php
php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_pdf_builder.php
php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_mailer.php
php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_submission_handler.php
```

## Deploying to Bluehost

1. Set the real values in `config.php` (recipient email, SMTP credentials).
2. Run `scripts/package.sh`. It builds the front end and writes
   `build/woodhall-kyc-deploy.zip` (also unpacked in `build/woodhall-kyc/`). The package
   contains the built site, `submit.php`, `config.php`, `lib/`, `vendor/`, `assets/logos/`,
   `.htaccess` and `.user.ini`. `preview.php` and `tests/` are excluded.
3. Upload the package contents to the target directory via FTP/File Manager. The site
   uses relative URLs, so it works from a subdirectory as well as the domain root.
4. Confirm PHP 8+ is selected in the hosting control panel.
5. Submit a real test form end-to-end and confirm both emails arrive with the
   PDF and any attachments intact.

## Security notes

- Server-side validation (`lib/validator.php`) is authoritative — client-side
  validation is a UX convenience only.
- All text input is sanitized (control characters stripped, CR/LF stripped from
  single-line fields) before use, to prevent email header injection.
- Uploaded filenames are sanitized before being used as email attachment names.
- No database is used anywhere in this app, so SQL injection is not an applicable
  attack surface here.
