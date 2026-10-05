# KYC form — corrections from the 2 Oct 2026 review

Date: 2026-10-05
Source: review meeting notes (2026-10-02, Gemini) + owner's `tdl.md`
Branch: `review-corrections`, cut from `og-meta` (carries the owner's uncommitted copy edits)

## Goal

Every application arrives complete: required fields filled, required documents attached and a
handwritten signature on file. The form, PDF and emails all say **Woodhall Finance**. Nobody
can reach the next step with something missing.

## Decisions (agreed with owner)

- **Documents step:** drop the "tick if submitted" checkboxes. Each document is an upload
  tile marked *Required* or *Optional*. **Next** stays blocked until every required file is
  attached. The PDF lists each document as *Attached* or *Not provided*.
- **Proof of address (individual):** two required uploads. One is a utility bill and the
  other a bank statement, both less than 3 months old. Separately, a required
  **12-month bank statement** upload.
- **Signature:** every signer uploads a photo or scan of a **handwritten signature**
  (JPG/PNG). It is required and is embedded in the PDF. The typed name stays. The checkbox
  becomes "I confirm the attached image is my own handwritten signature."
- **Notification recipients:** `credit@woodhallfinanceltd.com` only. The config takes a
  list, so more can be added later.
- **Brand:** "Woodhall Capital" becomes "Woodhall Finance" in all user-facing text: form,
  PDF, emails, page title, README.
- **Out of scope here:**
  - The visitor system has its own brief at `../visitor-system-brief.md`.
  - Microsoft 365 / DNS setup is a research doc at `docs/email-setup-microsoft-365.md`. Its
    outcome may change `config.php` (SMTP or Graph), but not this form.
  - Bank-statement authenticity checks (MBS / bank email forwarding) were discussed, but no
    action was assigned.

## Individual flow

### Step A — Customer Information

| Change | Detail |
|---|---|
| Required | Every field **except `idNumber` and `idExpiry`**. Newly required: `employerName`, `officeAddress`, and the new `officialEmail`. |
| New field | `officialEmail` ("Official Email"), placed right after Office Address. It must be a valid email. |
| Means of ID | BVN is removed from the options. The remaining options are NIN, Int'l Passport, Driver's License and Voter's Card. The BVN *number* field stays required. |
| Removed | `expectedMonthlyTurnover` and `expectedTransactionTypes`, removed from the form, types, draft, request, validator and PDF. |
| Relabel | "Purpose of Relationship" becomes "Purpose of Relationship with Woodhall Finance". |

### Step B — Verification Documents (upload tiles)

| id | Label | |
|---|---|---|
| `valid_means_of_id` | Valid Means of ID | Required |
| `proof_of_address_utility` | Proof of Address: Utility Bill (less than 3 months old) | Required |
| `proof_of_address_statement` | Proof of Address: Bank Statement (less than 3 months old) | Required |
| `bank_statement_12_months` | Bank Statement — Last 12 months | Required |
| `passport_photograph` | Recent Passport Photograph | Required |
| `work_id` | Work ID | Optional |
| `employment_letter` | Employment Letter | Optional |
| `signature_mandate_card` | Signature Mandate Card | Optional |

Every tile accepts the same formats as today: PDF, JPG, PNG and DOCX, up to 5MB each.
The consent checkbox stays.

### Step C — Declaration

The Name and Date fields stay. The typed-signature text field is replaced by a required
**signature image** upload (`signatureFile`). The checkbox wording changes as described
under Decisions.

## Corporate flow

### Step A — Entity Information

"RC Number" becomes **"Business Registration Number (BN / RC)"**. The placeholder is
`e.g. RC1234567 or BN1234567`, and the error message changes to match. The field name stays
`rcNumber`, so the request contract keeps that key.

### Step B — Directors

No change. Per-person attachments stay optional.

### Step C — Required Documents (upload tiles)

| id | Label | |
|---|---|---|
| `certificate_of_incorporation` | CAC Certificate of Incorporation | Required |
| `cac_status_report` | CAC Status Report | Required (new) |
| `cac_forms` | CAC Forms CAC2.3 / CAC1.1 - Directors & Shareholders | Required |
| `memorandum_articles` | Memorandum & Articles of Association | Required |
| `board_resolution` | Board Resolution to open account and obtain facility | Required |
| `company_bank_statement` | Company Bank Statement - Last 12 months | Required |
| `government_id_signatories` | Valid Government-issued ID of Authorized Signatories | Required (new) |
| `passport_photograph_signatories` | Recent Passport Photograph of Authorized Signatories | Required (new) |
| `corporate_id_signatories` | Corporate ID of Authorized Signatories | Optional |

### Step E — Declaration

- Signatory 1 and Signatory 2 each keep a typed name and a date. Each also gets a required
  **signature image** (`signatory1SignatureFile`, `signatory2SignatureFile`).
- The **company seal or stamp** becomes required (`sealFile`, image) and is embedded in the
  PDF.
- The checkbox reads: "We confirm the attached images are our handwritten signatures."

## Cross-cutting

- **Wizard gating.** Each documents step owns its document ids, so missing or invalid files
  show inline under the tile and block **Next**. They no longer fall through to `alert()`.
  The declaration steps own their signature and seal keys in the same way. The server
  rejects a missing required file with the same key.
- **Image-only uploads.** Signature and seal tiles accept only `.jpg`, `.jpeg` and `.png`
  (`accept="image/*"`, so phones offer the camera). The error message is "Upload a JPG or
  PNG image."
- **Draft autosave.** Files are never stored. The per-document `submitted` flags are dropped
  from the draft. The storage key stays `woodhall-kyc-draft-v2`. Old drafts still load, and
  removed fields and BVN-as-ID are ignored.
- **Request contract.**
  - Documents are sent as `documents[<id>]` (file only; the `[submitted]` flag is gone).
  - Signatures and seal: `signatureFile`, or `signatory1SignatureFile`,
    `signatory2SignatureFile` and `sealFile`.
  - Individual: `officialEmail` added; `expectedMonthlyTurnover` and
    `expectedTransactionTypes[]` removed.
- **PDF.**
  - Document rows read Attached or Not provided.
  - Signature images and the seal are drawn in the Declaration section, about 50mm wide.
    The image is drawn before the temp files are deleted. If TCPDF can't render an image,
    the row falls back to the text "Attached (see email)", so the submission never fails
    over the PDF.
  - The PDF labels follow the new form labels.
- **Emails.**
  - `config.php` defines `RECIPIENT_EMAILS = ['credit@woodhallfinanceltd.com']`, and every
    address is added to the notification.
  - New copy for the notification: who submitted, which customer type, a list of the
    documents attached, and the PDF.
  - New copy for the confirmation: what happens next, a contact address and the Woodhall
    Finance sign-off.
  - `MAIL_FROM_*` and `RECIPIENT_NAME` change to the Woodhall Finance name.
- **Copy.**
  - "Customer Due Diligence" in title case wherever it is a heading.
  - The side-panel "What you'll need" lists match the new document sets.
  - The owner's contact edits (info@ address, Ikoyi address) are kept.
- **Formatting.** The owner's editor reformatted five files to double quotes. They are set
  back to the repo's single-quote style, keeping the content edits.

## Risks / open items (defaults chosen)

- **Total upload size.** The 20MB total cap stays. The corporate form can now carry 9
  documents, a seal and 2 signatures, plus director files, and a 12-month statement can be
  large. Default: raise the total to **30MB** on both client and server. It is worth
  checking Bluehost's `post_max_size` and `upload_max_filesize` on deploy.
- **Signature mandate card (individual) and Corporate ID (corporate)** were not discussed.
  Default: keep both, as optional.
- **Employer fields for self-employed or unemployed applicants.** The meeting rule ("all
  mandatory") makes employer name, office address and official email required for
  everyone. If that blocks real applicants, they can become optional later.

## Testing

- **Vitest:** validation (required docs, image-only checks, the new and removed fields),
  flow ownership of the doc and signature keys, Next blocked without the required files,
  FormData shape, and draft restore ignoring removed fields.
- **PHP harness:** validator mirrors, the handler rejects missing required files,
  multi-recipient mail, and the PDF with and without embeddable images.
- **Manual:** `preview.php` for the emails and PDF, plus one end-to-end run of each flow in
  the dev server.
