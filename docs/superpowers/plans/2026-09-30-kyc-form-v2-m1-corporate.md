# KYC Form v2 — Milestone 1 (Flow plumbing + updated Corporate flow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old corporate form with the updated 5-step Corporate flow (Entity, Directors/UBOs, Documents, Source of Funds, Declaration) on both the React frontend and the PHP backend, built on data-driven flow config so M2 can add the Individual flow.

**Architecture:** A `Flow` is a list of steps, each with `owns(key)`, `touchKeys(form)` and `validate(form)`. The reducer, progress bar and App read the active flow (only `corporate` in M1). Backend `handle_submission` dispatches on `customerType` (only `corporate` accepted in M1; anything else → 422). Form data shape changes from `step1/step3` to `fields` + `directors` on the PHP side and `entity/directors/funds/declaration` on the React side.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest + RTL (frontend); PHP 8, TCPDF, PHPMailer, custom test harness (backend).

**Spec:** `docs/superpowers/specs/2026-09-30-kyc-form-v2-design.md`
**Branch:** `kyc-form-v2` (cut from local `main`, which contains the React migration).

## Global Constraints

- No `Co-Authored-By` trailers and no "Generated with Claude Code" lines in commits or PR text (user preference).
- **Never POST a real submission against `config.php`'s real `RECIPIENT_EMAIL`.** Verify the backend through PHP tests with injected fake senders; no manual `curl` submissions. Browser checks are page loads/screenshots only.
- Uploads: extensions `pdf, jpg, jpeg, png, docx`; 5MB per file; 20MB total across **all** uploads (documents, directors' files, seal). Limits unchanged in `config.php`.
- Draft localStorage key `woodhall-kyc-draft-v2`; v1 drafts are ignored, never migrated. Files are never persisted.
- Server and client use identical field keys and messages (see Task 1 and Task 4 tables). Error keys: entity/funds/declaration fields by name; director fields `directors.<i>.<field>`; list-level `directors`; uploads `directorFile.<i>.<fileId>`, `sealFile`, document ids, `_total` (upload/total keys are alert-only — they never map to a step).
- Only submitted (ticked) documents are validated and attached; the client omits files of unticked documents and the server ignores them.
- TCPDF core fonts cannot render `₦`; the PDF uses "(NGN)" wording. The web UI may use `₦`.
- Branding stays "Woodhall Capital" everywhere (owner decision pending — see spec Open items). Consent checkbox stays. Both authorized signatories required.
- `assets/logos/` paths are read by PHP and must not move.
- Company seal: optional upload. Max 25 director rows; at least 1 row required.
- Backend accepts only `customerType=corporate` in M1; `individual` is added in M2.

## Review Focus

- Removing a director row while other rows have errors/touched fields: errors must not shift onto the wrong row; the last remaining row cannot be removed.
- Shareholding boundaries — `0`, `100`, `12.5` pass; `""`, `abc`, `-1`, `101`, `1e2` fail — identically on client and server.
- A ticked document with a bad file blocks; an **unticked** document with a bad/oversize file neither blocks nor is attached. The 20MB total spans documents + directors' files + seal.
- The same filename uploaded in several slots (e.g. `id.pdf` for two directors) must produce distinct attachment names.
- Hostile/odd POSTs must not fatal under `strict_types`: `directors` as a string, rows as non-arrays, `documents` as a string, missing `customerType`, `customerType=individual`, 26 director rows.
- v1 or corrupt localStorage drafts do not crash the app and are not restored; a draft with one empty director row does not count as content.

## File Structure

```
lib/validator.php               constants, sanitising, validate_entity/directors/documents/funds/declaration/uploads
lib/pdf-builder.php             corporate_pdf_sections() + build_corporate_pdf(); build_submission_pdf() dispatcher
lib/mailer.php                  submission_summary(); emails read $data['fields']
lib/submission-handler.php      dispatch, upload parsing, attachments, corporate handling
preview.php                     dev preview updated to new data shape
tests/php/*                     rewritten for new shape
frontend/src/types.ts           new form types + DIRECTOR_FIELDS
frontend/src/lib/validation.ts  validators (client mirror of validator.php)
frontend/src/lib/documents.ts   6 corporate document labels
frontend/src/flows/types.ts     Flow, FlowStep
frontend/src/flows/corporate.ts corporateFlow, FLOWS
frontend/src/lib/initial-state.ts, autosave.ts, submit.ts, reducer.ts   updated
frontend/src/components/        ProgressBar (n steps), TextField (groups), Step1Entity, Step2Directors(+DirectorRow), Step3Documents, Step4Funds, Step5Declaration
frontend/src/App.tsx, src/dev/prefill.ts
```

---

### Task 1: PHP validator (TDD)

**Files:** Modify `lib/validator.php`; Rewrite `tests/php/test_validator.php`.

**Interfaces — Produces:**

```php
const CORPORATE_DOCUMENT_IDS; const DIRECTOR_FILE_IDS; const MAX_DIRECTORS = 25;
function is_blank($value): bool;                       // non-scalar → true
function sanitize_submission_input(array $post): array; // also sanitises + re-indexes $post['directors'] rows
function validate_entity(array $data): array;           // ['valid'=>bool,'errors'=>[...]]
function validate_directors($rows): array;
function validate_uploads(array $entries): array;       // entries: [['key'=>string,'file'=>['name','size']], ...] → ['valid','errors'] incl '_total'
function validate_documents_consent(bool $consent): array;   // errors['consent']
function validate_funds(array $data): array;
function validate_declaration(array $data): array;
```

Messages (identical to client): entity — `Company name is required.`, `RC number is required.`, `Date of incorporation is required.`, `Registered address is required.`, `Nature of business is required.`, `Tax identification number is required.`, `Company email is required.` / `Enter a valid email address.`, `Corporate bank account number is required.`, `Bank name is required.`. Directors — `Add at least one director, signatory or UBO.` (key `directors`), `Too many directors listed (maximum 25).` (key `directors`), per row `Name is required.`, `Designation is required.`, `BVN is required.`, `NIN is required.`, `Nationality is required.`, `Residential address is required.`, `% shareholding is required.`, `Enter a percentage between 0 and 100.`, `Select Yes or No.`. Uploads — `File type not allowed: <name>`, `File exceeds 5MB limit: <name>`, `Total attachments exceed the 20MB limit.` (`_total`). Consent — `Consent to processing is required.`. Funds — `Source of funds is required.`, `Facility amount requested is required.`. Declaration — `Authorized signatory 1 name is required.`, `Authorized signatory 1 date is required.`, same for 2, `You must confirm this constitutes your signature.`. Percentage regex (both sides): `/^\d+(\.\d+)?$/` and value ≤ 100.

- [ ] **Step 1: Rewrite `tests/php/test_validator.php`** keeping the existing sanitize/filename/email/file-meta tests verbatim (lines for `sanitize_text`, `sanitize_multiline_text`, `sanitize_filename`, `validate_file_meta`) and replacing the step1/2/3 tests with:

```php
function valid_entity(): array {
    return ['companyName'=>'Acme Ltd','rcNumber'=>'RC1','dateOfIncorporation'=>'2020-01-01','registeredAddress'=>'1 Main St',
        'natureOfBusiness'=>'Trading','tin'=>'T1','companyEmail'=>'info@acme.com','bankAccountNumber'=>'01','bankName'=>'First Bank'];
}
function valid_director(array $o = []): array {
    return array_replace(['name'=>'Jane','designation'=>'MD','bvn'=>'1','nin'=>'2','shareholdingPercent'=>'50',
        'nationality'=>'Nigerian','pep'=>'no','residentialAddress'=>'1 Rd'], $o);
}

test_case('validate_entity flags all required fields when empty', function () {
    $r = validate_entity([]);
    assert_equal(false, $r['valid']);
    foreach (['companyName','rcNumber','dateOfIncorporation','registeredAddress','natureOfBusiness','tin','companyEmail','bankAccountNumber','bankName'] as $k) assert_true(isset($r['errors'][$k]), $k);
    assert_true(!isset($r['errors']['businessAddress']));
});
test_case('validate_entity passes with all required fields and rejects a bad email', function () {
    assert_equal(true, validate_entity(valid_entity())['valid']);
    assert_equal('Enter a valid email address.', validate_entity(array_replace(valid_entity(), ['companyEmail'=>'nope']))['errors']['companyEmail']);
});
test_case('validate_directors requires at least one row and caps the list', function () {
    assert_equal('Add at least one director, signatory or UBO.', validate_directors([])['errors']['directors']);
    assert_equal('Add at least one director, signatory or UBO.', validate_directors('foo')['errors']['directors']);
    assert_equal('Too many directors listed (maximum 25).', validate_directors(array_fill(0, 26, valid_director()))['errors']['directors']);
});
test_case('validate_directors keys errors by row index', function () {
    $r = validate_directors([valid_director(), valid_director(['name'=>'', 'pep'=>''])]);
    assert_equal(false, $r['valid']);
    assert_equal('Name is required.', $r['errors']['directors.1.name']);
    assert_equal('Select Yes or No.', $r['errors']['directors.1.pep']);
    assert_true(!isset($r['errors']['directors.0.name']));
});
test_case('validate_directors percentage boundaries', function () {
    foreach (['0','100','12.5'] as $ok) assert_equal(true, validate_directors([valid_director(['shareholdingPercent'=>$ok])])['valid'], $ok);
    foreach (['abc','-1','101','1e2'] as $bad) assert_equal('Enter a percentage between 0 and 100.', validate_directors([valid_director(['shareholdingPercent'=>$bad])])['errors']['directors.0.shareholdingPercent'], $bad);
    assert_equal('% shareholding is required.', validate_directors([valid_director(['shareholdingPercent'=>''])])['errors']['directors.0.shareholdingPercent']);
});
test_case('validate_directors survives non-array rows and array values', function () {
    $r = validate_directors(['oops', valid_director(['name'=>['x']])]);
    assert_equal(false, $r['valid']);
    assert_true(isset($r['errors']['directors.0.name']));
    assert_true(isset($r['errors']['directors.1.name']));
});
test_case('validate_uploads rejects bad types/sizes and flags the 20MB total', function () {
    $r = validate_uploads([['key'=>'a','file'=>['name'=>'x.exe','size'=>1]], ['key'=>'b','file'=>['name'=>'y.pdf','size'=>6*1024*1024]]]);
    assert_equal('File type not allowed: x.exe', $r['errors']['a']);
    assert_equal('File exceeds 5MB limit: y.pdf', $r['errors']['b']);
    $many = array_map(fn($i) => ['key'=>"k$i",'file'=>['name'=>"f$i.pdf",'size'=>int_size(4.5)]], range(1,5));
    assert_true(isset(validate_uploads($many)['errors']['_total']));
    assert_equal(true, validate_uploads([])['valid']);
});
function int_size(float $mb): int { return (int) ($mb * 1024 * 1024); }
test_case('validate_documents_consent requires consent', function () {
    assert_equal('Consent to processing is required.', validate_documents_consent(false)['errors']['consent']);
    assert_equal(true, validate_documents_consent(true)['valid']);
});
test_case('validate_funds requires both fields', function () {
    assert_equal(['sourceOfFunds','facilityAmount'], array_keys(validate_funds([])['errors']));
    assert_equal(true, validate_funds(['sourceOfFunds'=>'Sales','facilityAmount'=>'5,000,000'])['valid']);
});
test_case('validate_declaration requires both signatories, dates and agreement', function () {
    $r = validate_declaration([]);
    foreach (['signatory1Name','signatory1Date','signatory2Name','signatory2Date','signatureAgree'] as $k) assert_true(isset($r['errors'][$k]), $k);
    assert_equal(true, validate_declaration(['signatory1Name'=>'A','signatory1Date'=>'2026-01-01','signatory2Name'=>'B','signatory2Date'=>'2026-01-01','signatureAgree'=>'on'])['valid']);
});
test_case('sanitize_submission_input cleans director rows, re-indexes, and drops non-array rows', function () {
    $r = sanitize_submission_input(['companyName'=>"Acme\r\nLtd", 'directors'=>[5=>['name'=>"Jane\r\nBcc: x", 'residentialAddress'=>"1 Rd\r\nLagos"], 9=>'junk']]);
    assert_equal('AcmeLtd', $r['companyName']);
    assert_equal([0], array_keys($r['directors']));
    assert_equal('JaneBcc: x', $r['directors'][0]['name']);
    assert_equal("1 Rd\nLagos", $r['directors'][0]['residentialAddress']);
});
test_case('sanitize_submission_input leaves a non-array directors value alone', function () {
    assert_equal('foo', sanitize_submission_input(['directors'=>'foo'])['directors']);
});
test_case('is_blank treats arrays as blank', function () { assert_equal(true, is_blank(['x'])); });
test_summary();
```

- [ ] **Step 2:** `php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_validator.php` → Expected: FAIL (undefined functions).

- [ ] **Step 3: Implement.** In `lib/validator.php`: keep `ALLOWED_FILE_EXTENSIONS`, `MAX_FILE_SIZE`, `MAX_TOTAL_SIZE`, `sanitize_text`, `sanitize_multiline_text`, `sanitize_filename`, `is_valid_email`, `validate_file_meta` unchanged. Replace the rest:

```php
const CORPORATE_DOCUMENT_IDS = [
    'certificate_of_incorporation', 'cac_forms', 'memorandum_articles',
    'board_resolution', 'company_bank_statement', 'corporate_id_signatories',
];
const DIRECTOR_FILE_IDS = ['id', 'bvn', 'nin', 'proof_of_address'];
const MAX_DIRECTORS = 25;

const SINGLE_LINE_TEXT_FIELDS = [
    'customerType', 'companyName', 'rcNumber', 'dateOfIncorporation', 'natureOfBusiness', 'tin', 'companyEmail',
    'bankAccountNumber', 'bankName', 'sourceOfFunds', 'facilityAmount',
    'signatory1Name', 'signatory1Date', 'signatory2Name', 'signatory2Date',
];
const MULTILINE_TEXT_FIELDS = ['registeredAddress', 'businessAddress'];
const DIRECTOR_SINGLE_LINE_FIELDS = ['name', 'designation', 'bvn', 'nin', 'shareholdingPercent', 'nationality', 'pep'];
const DIRECTOR_MULTILINE_FIELDS = ['residentialAddress'];

function is_blank($value): bool
{
    if ($value !== null && !is_scalar($value)) {
        return true;
    }
    return $value === null || trim((string) $value) === '';
}

function sanitize_submission_input(array $post): array
{
    foreach (SINGLE_LINE_TEXT_FIELDS as $field) {
        if (isset($post[$field]) && is_string($post[$field])) {
            $post[$field] = sanitize_text($post[$field]);
        }
    }
    foreach (MULTILINE_TEXT_FIELDS as $field) {
        if (isset($post[$field]) && is_string($post[$field])) {
            $post[$field] = sanitize_multiline_text($post[$field]);
        }
    }
    if (isset($post['directors']) && is_array($post['directors'])) {
        $rows = [];
        foreach ($post['directors'] as $row) {
            if (!is_array($row)) {
                continue;
            }
            foreach (DIRECTOR_SINGLE_LINE_FIELDS as $field) {
                if (isset($row[$field]) && is_string($row[$field])) {
                    $row[$field] = sanitize_text($row[$field]);
                }
            }
            foreach (DIRECTOR_MULTILINE_FIELDS as $field) {
                if (isset($row[$field]) && is_string($row[$field])) {
                    $row[$field] = sanitize_multiline_text($row[$field]);
                }
            }
            $rows[] = $row;
        }
        $post['directors'] = $rows;
    }
    return $post;
}

function validation_result(array $errors): array
{
    return ['valid' => count($errors) === 0, 'errors' => $errors];
}

function validate_entity(array $data): array
{
    $errors = [];
    $required = [
        'companyName' => 'Company name is required.',
        'rcNumber' => 'RC number is required.',
        'dateOfIncorporation' => 'Date of incorporation is required.',
        'registeredAddress' => 'Registered address is required.',
        'natureOfBusiness' => 'Nature of business is required.',
        'tin' => 'Tax identification number is required.',
    ];
    foreach ($required as $field => $message) {
        if (is_blank($data[$field] ?? null)) $errors[$field] = $message;
    }
    $email = $data['companyEmail'] ?? null;
    if (is_blank($email)) {
        $errors['companyEmail'] = 'Company email is required.';
    } elseif (!is_valid_email((string) $email)) {
        $errors['companyEmail'] = 'Enter a valid email address.';
    }
    if (is_blank($data['bankAccountNumber'] ?? null)) $errors['bankAccountNumber'] = 'Corporate bank account number is required.';
    if (is_blank($data['bankName'] ?? null)) $errors['bankName'] = 'Bank name is required.';
    return validation_result($errors);
}

function validate_directors($rows): array
{
    if (!is_array($rows) || count($rows) === 0) {
        return validation_result(['directors' => 'Add at least one director, signatory or UBO.']);
    }
    if (count($rows) > MAX_DIRECTORS) {
        return validation_result(['directors' => 'Too many directors listed (maximum ' . MAX_DIRECTORS . ').']);
    }
    $required = [
        'name' => 'Name is required.',
        'designation' => 'Designation is required.',
        'bvn' => 'BVN is required.',
        'nin' => 'NIN is required.',
        'nationality' => 'Nationality is required.',
        'residentialAddress' => 'Residential address is required.',
    ];
    $errors = [];
    foreach (array_values($rows) as $i => $row) {
        $row = is_array($row) ? $row : [];
        foreach ($required as $field => $message) {
            if (is_blank($row[$field] ?? null)) $errors["directors.$i.$field"] = $message;
        }
        $pct = $row['shareholdingPercent'] ?? null;
        if (is_blank($pct)) {
            $errors["directors.$i.shareholdingPercent"] = '% shareholding is required.';
        } elseif (!preg_match('/^\d+(\.\d+)?$/', (string) $pct) || (float) $pct > 100) {
            $errors["directors.$i.shareholdingPercent"] = 'Enter a percentage between 0 and 100.';
        }
        if (!in_array($row['pep'] ?? '', ['yes', 'no'], true)) {
            $errors["directors.$i.pep"] = 'Select Yes or No.';
        }
    }
    return validation_result($errors);
}

function validate_uploads(array $entries): array
{
    $errors = [];
    $totalSize = 0;
    foreach ($entries as $entry) {
        $result = validate_file_meta($entry['file']);
        if (!$result['valid']) {
            $errors[$entry['key']] = $result['error'];
        } else {
            $totalSize += (int) ($entry['file']['size'] ?? 0);
        }
    }
    if ($totalSize > MAX_TOTAL_SIZE) {
        $errors['_total'] = 'Total attachments exceed the 20MB limit.';
    }
    return validation_result($errors);
}

function validate_documents_consent(bool $consent): array
{
    return validation_result($consent ? [] : ['consent' => 'Consent to processing is required.']);
}

function validate_funds(array $data): array
{
    $errors = [];
    if (is_blank($data['sourceOfFunds'] ?? null)) $errors['sourceOfFunds'] = 'Source of funds is required.';
    if (is_blank($data['facilityAmount'] ?? null)) $errors['facilityAmount'] = 'Facility amount requested is required.';
    return validation_result($errors);
}

function validate_declaration(array $data): array
{
    $errors = [];
    foreach ([1, 2] as $n) {
        if (is_blank($data["signatory{$n}Name"] ?? null)) $errors["signatory{$n}Name"] = "Authorized signatory {$n} name is required.";
        if (is_blank($data["signatory{$n}Date"] ?? null)) $errors["signatory{$n}Date"] = "Authorized signatory {$n} date is required.";
    }
    if (empty($data['signatureAgree'])) $errors['signatureAgree'] = 'You must confirm this constitutes your signature.';
    return validation_result($errors);
}
```

Note `validate_file_meta` and the old `validate_step1/2/3` functions: delete the old `validate_step1`, `validate_step2`, `validate_step3` and old `DOCUMENT_IDS`.

- [ ] **Step 4:** Run the validator tests → Expected: all pass. (`test_submission_handler.php`, `test_pdf_builder.php`, `test_mailer.php` are expected to be broken until Tasks 2–3; do not run them here.)
- [ ] **Step 5: Commit** `feat(backend): rebuild validator for the updated corporate form`.

---

### Task 2: PDF builder, mailer and preview for the new data shape (TDD)

**Files:** Modify `lib/pdf-builder.php`, `lib/mailer.php`, `preview.php`; Rewrite `tests/php/test_pdf_builder.php`; Modify `tests/php/test_mailer.php`.

**Interfaces — Produces (`$data` shape used by handler in Task 3):**

```php
$data = [
  'customerType' => 'corporate', 'submittedAt' => 'Y-m-d H:i:s',
  'fields' => [/* sanitised POST: companyName … sourceOfFunds, facilityAmount, signatory1Name … */],
  'directors' => [ ['name'=>..,'designation'=>..,'bvn'=>..,'nin'=>..,'shareholdingPercent'=>..,'nationality'=>..,'pep'=>'yes|no','residentialAddress'=>..,'attachments'=>['id','nin']] ],
  'documents' => [ ['id'=>..,'label'=>..,'submitted'=>bool] ],
  'consent' => bool, 'sealAttached' => bool,
];
function corporate_pdf_sections(array $data): array;  // [['title'=>string,'groups'=>[['subtitle'=>?string,'rows'=>[[label,value],...]],...]],...]
function build_corporate_pdf(array $data): string;
function build_submission_pdf(array $data): string;   // dispatch on $data['customerType']; 'corporate' only
function submission_summary(array $data): array;      // ['kind'=>'Corporate KYC / CDD','name'=>companyName,'email'=>companyEmail]
```

- [ ] **Step 1: Failing tests.** `tests/php/test_pdf_builder.php`:

```php
<?php
declare(strict_types=1);
require __DIR__ . '/test_helper.php';
require __DIR__ . '/../../lib/pdf-builder.php';

function sample_corporate_data(): array {
    return [
        'customerType'=>'corporate','submittedAt'=>'2026-09-15 14:00:00',
        'fields'=>['companyName'=>'Acme Trading Ltd','rcNumber'=>'RC123456','dateOfIncorporation'=>'2015-04-01','registeredAddress'=>'1 Marina Road, Lagos',
            'businessAddress'=>'','natureOfBusiness'=>'Trade finance','tin'=>'TIN000111','companyEmail'=>'info@acme.com','bankAccountNumber'=>'0011223344','bankName'=>'First Bank',
            'sourceOfFunds'=>'Trade proceeds','facilityAmount'=>'5,000,000','signatory1Name'=>'Jane Doe','signatory1Date'=>'2026-09-15','signatory2Name'=>'John Roe','signatory2Date'=>'2026-09-15'],
        'directors'=>[
            ['name'=>'Jane Doe','designation'=>'MD','bvn'=>'111','nin'=>'222','shareholdingPercent'=>'60','nationality'=>'Nigerian','pep'=>'no','residentialAddress'=>'1 Rd','attachments'=>['id','nin']],
            ['name'=>'John Roe','designation'=>'Director','bvn'=>'333','nin'=>'444','shareholdingPercent'=>'40','nationality'=>'Ghanaian','pep'=>'yes','residentialAddress'=>'2 Rd','attachments'=>[]],
        ],
        'documents'=>[['id'=>'certificate_of_incorporation','label'=>'CAC Certificate of Incorporation','submitted'=>true],['id'=>'cac_forms','label'=>'CAC Forms','submitted'=>false]],
        'consent'=>true,'sealAttached'=>true,
    ];
}

test_case('build_submission_pdf returns a valid PDF binary for a corporate submission', function () {
    $pdf = build_submission_pdf(sample_corporate_data());
    assert_true(strpos($pdf, '%PDF-') === 0);
    assert_true(strlen($pdf) > 1000);
});
test_case('corporate_pdf_sections lists sections A–E in order', function () {
    $titles = array_map(fn($s) => $s['title'], corporate_pdf_sections(sample_corporate_data()));
    assert_equal(['Section A: Entity Information','Section B: Directors, Signatories & UBOs (>5%)','Section C: Required Documents','Section D: Source of Funds','Section E: Declaration'], $titles);
});
test_case('corporate_pdf_sections renders one group per director with labelled rows', function () {
    $b = corporate_pdf_sections(sample_corporate_data())[1];
    assert_equal(2, count($b['groups']));
    assert_equal('Director / Signatory / UBO 2', $b['groups'][1]['subtitle']);
    $rows = array_column($b['groups'][1]['rows'], 1, 0);
    assert_equal('John Roe', $rows['Name']); assert_equal('40%', $rows['% Shareholding']); assert_equal('Yes', $rows['PEP']);
    assert_equal('None', $rows['Attachments']);
    assert_equal('ID, NIN', array_column($b['groups'][0]['rows'], 1, 0)['Attachments']);
});
test_case('corporate_pdf_sections shows documents, funds, declaration and seal', function () {
    $s = corporate_pdf_sections(sample_corporate_data());
    $docs = array_column($s[2]['groups'][0]['rows'], 1, 0);
    assert_equal('Submitted', $docs['CAC Certificate of Incorporation']); assert_equal('Not submitted', $docs['CAC Forms']);
    assert_equal('Given', $docs['Consent to processing']);
    assert_equal('Trade proceeds', array_column($s[3]['groups'][0]['rows'], 1, 0)['Source of Funds']);
    assert_equal('5,000,000', array_column($s[3]['groups'][0]['rows'], 1, 0)['Facility Amount Requested (NGN)']);
    $decl = array_column($s[4]['groups'][0]['rows'], 1, 0);
    assert_equal('Jane Doe', $decl['Authorized Signatory 1']); assert_equal('2026-09-15', $decl['Signatory 1 Date']);
    assert_equal('Attached', $decl['Company Seal']);
});
test_case('build_submission_pdf survives missing/empty directors and unknown types', function () {
    $d = sample_corporate_data(); $d['directors'] = [];
    assert_true(strpos(build_submission_pdf($d), '%PDF-') === 0);
});
test_summary();
```

`tests/php/test_mailer.php`: replace `$sampleData` with `['customerType'=>'corporate','submittedAt'=>'2026-09-15 14:00:00','fields'=>['companyName'=>'Acme Trading Ltd','companyEmail'=>'info@acme.com']]`; add:

```php
test_case('submission_summary describes a corporate submission', function () use ($sampleData) {
    assert_equal(['kind'=>'Corporate KYC / CDD','name'=>'Acme Trading Ltd','email'=>'info@acme.com'], submission_summary($sampleData));
});
test_case('send_submission_emails skips the confirmation when there is no submitter email', function () {
    $fakes = []; $factory = function () use (&$fakes) { return $fakes[] = new FakePHPMailer(); };
    $r = send_submission_emails(['customerType'=>'corporate','submittedAt'=>'x','fields'=>['companyName'=>'A','companyEmail'=>'']], '%PDF', [], $factory);
    assert_equal(true, $r['success']); assert_equal(1, count($fakes));
});
test_case('admin email subject names the type and the company', function () use ($sampleData) {
    $fakes = []; $factory = function () use (&$fakes) { return $fakes[] = new FakePHPMailer(); };
    send_submission_emails($sampleData, '%PDF', [], $factory);
    assert_equal('New Corporate KYC / CDD Submission — Acme Trading Ltd', $fakes[0]->Subject);
});
```

- [ ] **Step 2:** Run `php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_pdf_builder.php` and `.../test_mailer.php` → FAIL (undefined functions / old keys).

- [ ] **Step 3: Implement `lib/pdf-builder.php`.** Replace `build_submission_pdf` and delete `pdf_legal_status_label`; keep `pdf_section_title`, `pdf_field_table`, `pdf_watermark` and the spacing constants:

```php
function build_submission_pdf(array $data): string
{
    return build_corporate_pdf($data);
}

function pdf_yes_no(string $value): string
{
    return $value === 'yes' ? 'Yes' : ($value === 'no' ? 'No' : '');
}

function corporate_pdf_sections(array $data): array
{
    $f = $data['fields'] ?? [];
    $v = fn(string $k): string => (string) ($f[$k] ?? '');

    $directorGroups = [];
    foreach (array_values($data['directors'] ?? []) as $i => $d) {
        $attached = array_map(fn($id) => strtoupper($id) === 'PROOF_OF_ADDRESS' ? 'Proof of address' : strtoupper($id), $d['attachments'] ?? []);
        $directorGroups[] = [
            'subtitle' => 'Director / Signatory / UBO ' . ($i + 1),
            'rows' => [
                ['Name', (string) ($d['name'] ?? '')],
                ['Designation', (string) ($d['designation'] ?? '')],
                ['BVN', (string) ($d['bvn'] ?? '')],
                ['NIN', (string) ($d['nin'] ?? '')],
                ['% Shareholding', ($d['shareholdingPercent'] ?? '') !== '' ? $d['shareholdingPercent'] . '%' : ''],
                ['Nationality', (string) ($d['nationality'] ?? '')],
                ['PEP', pdf_yes_no((string) ($d['pep'] ?? ''))],
                ['Residential Address', (string) ($d['residentialAddress'] ?? '')],
                ['Attachments', count($attached) > 0 ? implode(', ', $attached) : 'None'],
            ],
        ];
    }

    $docRows = array_map(fn(array $doc): array => [$doc['label'], !empty($doc['submitted']) ? 'Submitted' : 'Not submitted'], $data['documents'] ?? []);
    $docRows[] = ['Consent to processing', !empty($data['consent']) ? 'Given' : 'Not given'];

    return [
        ['title' => 'Section A: Entity Information', 'groups' => [['subtitle' => null, 'rows' => [
            ['Company Name', $v('companyName')], ['RC Number', $v('rcNumber')], ['Date of Incorporation', $v('dateOfIncorporation')],
            ['Registered Address', $v('registeredAddress')], ['Business Address', $v('businessAddress')],
            ['Nature of Business', $v('natureOfBusiness')], ['Tax Identification Number', $v('tin')],
            ['Company Email', $v('companyEmail')], ['Corporate Bank Account', $v('bankAccountNumber')], ['Bank', $v('bankName')],
        ]]]],
        ['title' => 'Section B: Directors, Signatories & UBOs (>5%)', 'groups' => $directorGroups],
        ['title' => 'Section C: Required Documents', 'groups' => [['subtitle' => null, 'rows' => $docRows]]],
        ['title' => 'Section D: Source of Funds', 'groups' => [['subtitle' => null, 'rows' => [
            ['Source of Funds', $v('sourceOfFunds')], ['Facility Amount Requested (NGN)', $v('facilityAmount')],
        ]]]],
        ['title' => 'Section E: Declaration', 'groups' => [['subtitle' => null, 'rows' => [
            ['Certification', 'We certify that the above information is true. We understand Woodhall Capital is obligated to report suspicious transactions to NFIU.'],
            ['Authorized Signatory 1', $v('signatory1Name')], ['Signatory 1 Date', $v('signatory1Date')],
            ['Authorized Signatory 2', $v('signatory2Name')], ['Signatory 2 Date', $v('signatory2Date')],
            ['Company Seal', !empty($data['sealAttached']) ? 'Attached' : 'Not provided'],
            ['Typed signatures agreed', 'Yes'],
        ]]]],
    ];
}

function build_corporate_pdf(array $data): string
{
    $pdf = new TCPDF('P', 'mm', 'A4', true, 'UTF-8', false);
    $pdf->SetCreator('Woodhall Capital KYC Form');
    $pdf->SetAuthor('Woodhall Capital');
    $pdf->SetTitle('Corporate KYC / CDD Submission — ' . ($data['fields']['companyName'] ?? ''));
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(true);
    $pdf->SetMargins(18, 18, 18);
    $pdf->SetAutoPageBreak(true, 18);
    $pdf->AddPage();

    $primary = [14, 64, 51];
    $ink = [22, 22, 22];

    $logoPath = __DIR__ . '/../assets/logos/woodhall-capital-logo-full-colour-rgb-1.png';
    if (file_exists($logoPath)) {
        $pdf->Image($logoPath, 18, 10, 24, 0, 'PNG');
    }
    pdf_watermark($pdf, $logoPath);

    $pdf->SetY(30);
    $pdf->SetTextColor($primary[0], $primary[1], $primary[2]);
    $pdf->SetFont('helvetica', 'B', 16);
    $pdf->Cell(0, 10, 'Corporate KYC / CDD Submission', 0, 1, 'C');
    $pdf->SetFont('helvetica', '', 10);
    $pdf->SetTextColor($ink[0], $ink[1], $ink[2]);
    $pdf->Cell(0, 6, 'Submitted: ' . ($data['submittedAt'] ?? ''), 0, 1, 'C');
    $pdf->Ln(PDF_SPACE_LG);

    foreach (corporate_pdf_sections($data) as $index => $section) {
        if ($index > 0) {
            $pdf->Ln(PDF_SPACE_LG);
        }
        pdf_section_title($pdf, $section['title'], $primary);
        foreach ($section['groups'] as $group) {
            if ($group['subtitle'] !== null) {
                $pdf->SetFont('helvetica', 'B', 11);
                $pdf->Cell(0, 7, $group['subtitle'], 0, 1, 'L');
                $pdf->SetFont('helvetica', '', 10);
            }
            pdf_field_table($pdf, $group['rows']);
            $pdf->Ln(PDF_SPACE_SM);
        }
    }

    return $pdf->Output('', 'S');
}
```

`pdf_field_table` already shows `—` for empty values (`$value !== ''`); it calls `getStringHeight` with the value, so values must be strings (they are).

- [ ] **Step 4: Implement `lib/mailer.php` edits.**

```php
function submission_summary(array $data): array
{
    $fields = $data['fields'] ?? [];
    return [
        'kind' => 'Corporate KYC / CDD',
        'name' => (string) ($fields['companyName'] ?? ''),
        'email' => (string) ($fields['companyEmail'] ?? ''),
    ];
}
```

In `build_admin_email_html` and `build_confirmation_email_html` replace `$data['step1']['companyName']` with `submission_summary($data)['name']` (escaped as before). In `send_submission_emails` replace `$companyName = $data['step1']['companyName'] ?? 'submitter'` with `$summary = submission_summary($data); $companyName = $summary['name'] !== '' ? $summary['name'] : 'submitter';`, the admin subject with `'New ' . $summary['kind'] . ' Submission — ' . $companyName`, and `$submitterEmail = $summary['email'];`.

- [ ] **Step 5: Update `preview.php`** `preview_sample_data()` to the `$data` shape above (customerType corporate, `fields`, two `directors`, the 6 document labels from Task 3's `CORPORATE_DOCUMENT_LABELS` as `documents`, `consent`, `sealAttached`). `preview.php` only calls `build_submission_pdf`, `build_admin_email_html`, `build_confirmation_email_html`, so no other change.

- [ ] **Step 6:** Run `php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_pdf_builder.php` and `.../test_mailer.php` → all pass. Then `php -l preview.php`.
- [ ] **Step 7: Commit** `feat(backend): corporate PDF layout and mailer for the new data shape`.

---

### Task 3: Submission handler (TDD)

**Files:** Modify `lib/submission-handler.php`; Rewrite `tests/php/test_submission_handler.php`.

**Interfaces — Consumes:** Task 1 validators, Task 2 `$data` shape, `build_submission_pdf`, `send_submission_emails`. **Produces:** `handle_submission(array $post, array $files, ?callable $sendEmails = null): array` (same signature/return `['success','errors','message']`); `const CORPORATE_DOCUMENT_LABELS`; `function extract_upload(array $files, string $top, array $path): ?array`.

`$sendEmails` is called as `($data, $pdfBytes, $attachments)`; attachments are `['tmpPath','originalName']` with `originalName` = `<slot> - <sanitised filename>` where `<slot>` is the document id, `director-<n>-<fileId>`, or `company-seal`.

- [ ] **Step 1: Failing tests** (`tests/php/test_submission_handler.php`):

```php
<?php
declare(strict_types=1);
require __DIR__ . '/test_helper.php';
require __DIR__ . '/../../config.php';
require __DIR__ . '/../../lib/submission-handler.php';

function sample_post(array $o = []): array {
    return array_replace([
        'customerType'=>'corporate','companyName'=>'Acme Trading Ltd','rcNumber'=>'RC123456','dateOfIncorporation'=>'2015-04-01',
        'registeredAddress'=>'1 Marina Road, Lagos','businessAddress'=>'','natureOfBusiness'=>'Trade finance','tin'=>'TIN000111',
        'companyEmail'=>'info@acme.com','bankAccountNumber'=>'0011223344','bankName'=>'First Bank',
        'directors'=>[['name'=>'Jane Doe','designation'=>'MD','bvn'=>'1','nin'=>'2','shareholdingPercent'=>'60','nationality'=>'Nigerian','pep'=>'no','residentialAddress'=>'1 Rd']],
        'documents'=>['certificate_of_incorporation'=>['submitted'=>'on']],'consent'=>'on',
        'sourceOfFunds'=>'Trade proceeds','facilityAmount'=>'5,000,000',
        'signatory1Name'=>'Jane Doe','signatory1Date'=>'2026-09-15','signatory2Name'=>'John Roe','signatory2Date'=>'2026-09-15','signatureAgree'=>'on',
    ], $o);
}
function tmp_file(string $content = 'dummy'): string { $p = tempnam(sys_get_temp_dir(), 'kyc-test-'); file_put_contents($p, $content); return $p; }
function upload(string $name, string $tmp, int $size = 5, int $err = UPLOAD_ERR_OK): array { return compact('name', 'tmp', 'size', 'err'); }
/** Build a PHP-style nested $_FILES entry: $path is the key path under $top. */
function files_entry(string $top, array $path, array $u): array {
    $wrap = function ($v) use ($path) { for ($i = count($path) - 1; $i >= 0; $i--) { $v = [$path[$i] => $v]; } return $v; };
    return [$top => ['name'=>$wrap($u['name']),'size'=>$wrap($u['size']),'tmp_name'=>$wrap($u['tmp']),'error'=>$wrap($u['err'])]];
}
function ok_sender(?array &$captured = null, ?array &$attachments = null): callable {
    return function (array $data, string $pdf, array $att) use (&$captured, &$attachments) { $captured = $data; $attachments = $att; return ['success'=>true,'error'=>null]; };
}

test_case('rejects a missing or unsupported customerType without sending', function () {
    foreach ([[], ['customerType'=>'individual'], ['customerType'=>['x']]] as $post) {
        $called = false;
        $r = handle_submission($post, [], function () use (&$called) { $called = true; return ['success'=>true,'error'=>null]; });
        assert_equal(false, $r['success']); assert_true(isset($r['errors']['customerType'])); assert_true(!$called);
    }
});
test_case('returns field errors for an otherwise empty corporate submission', function () {
    $r = handle_submission(['customerType'=>'corporate'], []);
    assert_equal(false, $r['success']);
    foreach (['companyName','directors','consent','sourceOfFunds','signatory1Name'] as $k) assert_true(isset($r['errors'][$k]), $k);
});
test_case('does not fatal on hostile shapes (directors/documents as strings, junk rows, 26 rows)', function () {
    $r = handle_submission(sample_post(['directors'=>'foo','documents'=>'bar']), []);
    assert_equal(false, $r['success']); assert_true(isset($r['errors']['directors']));
    $r = handle_submission(sample_post(['directors'=>array_fill(0, 26, sample_post()['directors'][0])]), []);
    assert_equal('Too many directors listed (maximum 25).', $r['errors']['directors']);
});
test_case('succeeds and hands the email sender the new data shape', function () {
    $data = null; $att = null;
    $r = handle_submission(sample_post(), [], ok_sender($data, $att));
    assert_equal(true, $r['success']);
    assert_equal('corporate', $data['customerType']);
    assert_equal('Acme Trading Ltd', $data['fields']['companyName']);
    assert_equal('Jane Doe', $data['directors'][0]['name']);
    assert_equal(6, count($data['documents']));
    assert_equal(true, $data['documents'][0]['submitted']);
    assert_equal(true, $data['consent']); assert_equal(false, $data['sealAttached']);
});
test_case('strips header-injection attempts from text fields and director rows', function () {
    $data = null;
    $post = sample_post(['companyName'=>"Acme Ltd\r\nBcc: attacker@evil.com", 'registeredAddress'=>"1 Marina\r\nBcc: a@evil.com"]);
    $post['directors'][0]['name'] = "Jane\r\nBcc: a@evil.com";
    handle_submission($post, [], ok_sender($data));
    assert_equal('Acme LtdBcc: attacker@evil.com', $data['fields']['companyName']);
    assert_true(strpos($data['fields']['registeredAddress'], "\r") === false);
    assert_equal('JaneBcc: a@evil.com', $data['directors'][0]['name']);
});
test_case('attaches a ticked document with a sanitised, slot-prefixed name and deletes temp files', function () {
    $tmp = tmp_file(); $att = null;
    $files = files_entry('documents', ['certificate_of_incorporation', 'file'], upload('../../evil<>.pdf', $tmp));
    handle_submission(sample_post(), $files, ok_sender($d, $att));
    assert_equal('certificate_of_incorporation - evil__.pdf', $att[0]['originalName']);
    assert_true(!file_exists($tmp), 'temp file should be cleaned up');
});
test_case('ignores an UNTICKED document even when its file is invalid or oversized', function () {
    $tmp = tmp_file(); $att = null;
    $files = files_entry('documents', ['cac_forms', 'file'], upload('virus.exe', $tmp, 9 * 1024 * 1024));
    $r = handle_submission(sample_post(), $files, ok_sender($d, $att));
    assert_equal(true, $r['success']); assert_equal(0, count($att));
    @unlink($tmp);
});
test_case('blocks a ticked document with a disallowed file type', function () {
    $tmp = tmp_file(); $called = false;
    $files = files_entry('documents', ['certificate_of_incorporation', 'file'], upload('virus.exe', $tmp));
    $r = handle_submission(sample_post(), $files, function () use (&$called) { $called = true; return ['success'=>true,'error'=>null]; });
    assert_equal('File type not allowed: virus.exe', $r['errors']['certificate_of_incorporation']); assert_true(!$called);
    @unlink($tmp);
});
test_case('rejects a PHP-level upload failure instead of silently dropping it', function () {
    $called = false;
    $files = files_entry('documents', ['certificate_of_incorporation', 'file'], upload('big.pdf', '', 0, UPLOAD_ERR_INI_SIZE));
    $r = handle_submission(sample_post(), $files, function () use (&$called) { $called = true; return ['success'=>true,'error'=>null]; });
    assert_equal(false, $r['success']); assert_true(isset($r['errors']['certificate_of_incorporation'])); assert_true(!$called);
});
test_case('attaches director files and the seal with distinct names even for identical filenames', function () {
    $a = tmp_file(); $b = tmp_file(); $c = tmp_file(); $att = null; $d = null;
    $post = sample_post(); $post['directors'][] = $post['directors'][0];
    $files = array_merge(
        files_entry('directors', [0, 'files', 'id'], upload('id.pdf', $a)),
        [] );
    $files['directors'] = array_replace_recursive(
        files_entry('directors', [0, 'files', 'id'], upload('id.pdf', $a))['directors'],
        files_entry('directors', [1, 'files', 'id'], upload('id.pdf', $b))['directors']);
    $files = array_merge($files, files_entry('sealFile', [], upload('seal.png', $c)));
    $r = handle_submission($post, $files, ok_sender($d, $att));
    assert_equal(true, $r['success']);
    $names = array_column($att, 'originalName'); sort($names);
    assert_equal(['company-seal - seal.png', 'director-1-id - id.pdf', 'director-2-id - id.pdf'], $names);
    assert_equal(true, $d['sealAttached']); assert_equal(['id'], $d['directors'][0]['attachments']);
    foreach ([$a, $b, $c] as $p) assert_true(!file_exists($p));
});
test_case('flags a director file with a bad type under directorFile.<i>.<id>', function () {
    $tmp = tmp_file();
    $files = files_entry('directors', [0, 'files', 'nin'], upload('x.exe', $tmp));
    $r = handle_submission(sample_post(), $files, ok_sender());
    assert_equal('File type not allowed: x.exe', $r['errors']['directorFile.0.nin']);
    @unlink($tmp);
});
test_case('counts documents, directors files and the seal toward the 20MB total', function () {
    $t = [tmp_file(), tmp_file(), tmp_file(), tmp_file(), tmp_file()];
    $mb = 4 * 1024 * 1024 + 900000;
    $files = files_entry('documents', ['certificate_of_incorporation', 'file'], upload('a.pdf', $t[0], $mb));
    $files['directors'] = array_replace_recursive(
        files_entry('directors', [0, 'files', 'id'], upload('b.pdf', $t[1], $mb))['directors'],
        files_entry('directors', [0, 'files', 'nin'], upload('c.pdf', $t[2], $mb))['directors'],
        files_entry('directors', [0, 'files', 'bvn'], upload('d.pdf', $t[3], $mb))['directors']);
    $files = array_merge($files, files_entry('sealFile', [], upload('e.png', $t[4], $mb)));
    $r = handle_submission(sample_post(), $files, ok_sender());
    assert_equal('Total attachments exceed the 20MB limit.', $r['errors']['_total']);
    foreach ($t as $p) @unlink($p);
});
test_case('surfaces email failures without exposing internals', function () {
    $r = handle_submission(sample_post(), [], fn() => ['success'=>false,'error'=>'SMTP down']);
    assert_equal(false, $r['success']); assert_true(strpos($r['message'], 'SMTP') === false);
});
test_summary();
```

- [ ] **Step 2:** `php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_submission_handler.php` → FAIL.

- [ ] **Step 3: Implement** `lib/submission-handler.php` (replace the file's contents; keep `upload_error_message` as is):

```php
<?php
declare(strict_types=1);

require_once __DIR__ . '/validator.php';
require_once __DIR__ . '/pdf-builder.php';
require_once __DIR__ . '/mailer.php';

const CORPORATE_DOCUMENT_LABELS = [
    'certificate_of_incorporation' => 'CAC Certificate of Incorporation',
    'cac_forms' => 'CAC Forms CAC2.3 / CAC1.1 - Directors & Shareholders',
    'memorandum_articles' => 'Memorandum & Articles of Association',
    'board_resolution' => 'Board Resolution to open account and obtain facility',
    'company_bank_statement' => 'Company Bank Statement - Last 12 months',
    'corporate_id_signatories' => 'Corporate ID of Authorized Signatories',
];

function extract_upload(array $files, string $top, array $path): ?array
{
    if (!isset($files[$top]['name'])) {
        return null;
    }
    $meta = [];
    foreach (['name', 'size', 'tmp_name', 'error'] as $key) {
        $node = $files[$top][$key] ?? null;
        foreach ($path as $segment) {
            if (!is_array($node) || !array_key_exists($segment, $node)) {
                return null;
            }
            $node = $node[$segment];
        }
        if ($node === null || is_array($node)) {
            return null;
        }
        $meta[$key] = $node;
    }
    return $meta['name'] === '' ? null : $meta;
}

function upload_error_message(int $code): string
{
    switch ($code) {
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            return 'This file is too large to upload.';
        case UPLOAD_ERR_PARTIAL:
            return 'This file was only partially uploaded. Please try again.';
        default:
            return 'This file could not be uploaded. Please try again.';
    }
}

function parse_documents_input(array $post, array $files): array
{
    $docsPost = is_array($post['documents'] ?? null) ? $post['documents'] : [];
    $documents = [];
    foreach (CORPORATE_DOCUMENT_IDS as $id) {
        $submitted = is_array($docsPost[$id] ?? null) && !empty($docsPost[$id]['submitted']);
        $documents[] = [
            'id' => $id,
            'label' => CORPORATE_DOCUMENT_LABELS[$id],
            'submitted' => $submitted,
            'file' => $submitted ? extract_upload($files, 'documents', [$id, 'file']) : null,
        ];
    }
    return $documents;
}

/** Every upload that will be validated and attached: ['key','slot','file']. */
function collect_uploads(array $documents, array $files, int $directorCount): array
{
    $uploads = [];
    foreach ($documents as $doc) {
        if ($doc['file'] !== null) {
            $uploads[] = ['key' => $doc['id'], 'slot' => $doc['id'], 'file' => $doc['file']];
        }
    }
    for ($i = 0; $i < $directorCount; $i++) {
        foreach (DIRECTOR_FILE_IDS as $fileId) {
            $meta = extract_upload($files, 'directors', [$i, 'files', $fileId]);
            if ($meta !== null) {
                $uploads[] = ['key' => "directorFile.$i.$fileId", 'slot' => 'director-' . ($i + 1) . '-' . $fileId, 'file' => $meta];
            }
        }
    }
    $seal = extract_upload($files, 'sealFile', []);
    if ($seal !== null) {
        $uploads[] = ['key' => 'sealFile', 'slot' => 'company-seal', 'file' => $seal];
    }
    return $uploads;
}

function failure(array $errors, string $message = 'Please correct the highlighted fields.'): array
{
    return ['success' => false, 'errors' => $errors, 'message' => $message];
}

function handle_submission(array $post, array $files, ?callable $sendEmails = null): array
{
    $sendEmails = $sendEmails ?? 'send_submission_emails';
    $post = sanitize_submission_input($post);

    if (($post['customerType'] ?? null) !== 'corporate') {
        return failure(['customerType' => 'Unsupported customer type.']);
    }
    return handle_corporate_submission($post, $files, $sendEmails);
}

function handle_corporate_submission(array $post, array $files, callable $sendEmails): array
{
    $rows = is_array($post['directors'] ?? null) ? array_values($post['directors']) : [];
    $documents = parse_documents_input($post, $files);
    $consent = !empty($post['consent']);

    $errors = array_merge(
        validate_entity($post)['errors'],
        validate_directors($post['directors'] ?? null)['errors'],
        validate_documents_consent($consent)['errors'],
        validate_funds($post)['errors'],
        validate_declaration($post)['errors']
    );

    $uploads = collect_uploads($documents, $files, min(count($rows), MAX_DIRECTORS));
    $checkable = [];
    foreach ($uploads as $upload) {
        $code = $upload['file']['error'] ?? UPLOAD_ERR_NO_FILE;
        if ($code !== UPLOAD_ERR_OK) {
            $errors[$upload['key']] = upload_error_message((int) $code);
        } else {
            $checkable[] = ['key' => $upload['key'], 'file' => $upload['file']];
        }
    }
    $errors = array_merge($errors, validate_uploads($checkable)['errors']);

    if (count($errors) > 0) {
        return failure($errors);
    }

    $directorRows = [];
    foreach ($rows as $i => $row) {
        $attached = [];
        foreach ($uploads as $upload) {
            if (strpos($upload['key'], "directorFile.$i.") === 0) {
                $attached[] = substr($upload['key'], strlen("directorFile.$i."));
            }
        }
        $row['attachments'] = $attached;
        $directorRows[] = $row;
    }

    $sealAttached = false;
    $attachments = [];
    foreach ($uploads as $upload) {
        if ($upload['key'] === 'sealFile') {
            $sealAttached = true;
        }
        $attachments[] = [
            'tmpPath' => $upload['file']['tmp_name'],
            'originalName' => $upload['slot'] . ' - ' . sanitize_filename((string) $upload['file']['name']),
        ];
    }

    $data = [
        'customerType' => 'corporate',
        'submittedAt' => date('Y-m-d H:i:s'),
        'fields' => $post,
        'directors' => $directorRows,
        'documents' => array_map(fn(array $d): array => ['id' => $d['id'], 'label' => $d['label'], 'submitted' => $d['submitted']], $documents),
        'consent' => $consent,
        'sealAttached' => $sealAttached,
    ];

    $pdfBytes = build_submission_pdf($data);
    $emailResult = call_user_func($sendEmails, $data, $pdfBytes, $attachments);

    foreach ($attachments as $attachment) {
        if (file_exists($attachment['tmpPath'])) {
            @unlink($attachment['tmpPath']);
        }
    }

    if (!$emailResult['success']) {
        return failure([], 'We could not send your submission. Please try again shortly.');
    }
    return ['success' => true, 'errors' => [], 'message' => 'Submission received.'];
}
```

Note: `handle_submission` with `customerType` an array: `$post['customerType']` non-string → `!== 'corporate'` → rejected; `sanitize_text` only touches strings.

- [ ] **Step 4:** Run `tests/php/test_submission_handler.php` → all pass; then run all four PHP suites plus `php -l submit.php`.
- [ ] **Step 5: Commit** `feat(backend): corporate submission handler with director and seal uploads`.

---

### Task 4: Frontend types, validation and corporate flow config (TDD)

**Files:** Rewrite `frontend/src/types.ts`, `frontend/src/lib/validation.ts`, `frontend/src/lib/documents.ts`; Create `frontend/src/flows/types.ts`, `frontend/src/flows/corporate.ts`; Rewrite `frontend/src/lib/validation.test.ts`; Create `frontend/src/flows/corporate.test.ts`.

**Interfaces — Produces:**

```ts
// types.ts
export type Errors = Record<string, string>;
export type CustomerType = 'corporate';
export const DIRECTOR_FIELDS = ['name','designation','bvn','nin','shareholdingPercent','nationality','pep','residentialAddress'] as const;
export type DirectorField = (typeof DIRECTOR_FIELDS)[number];
export type DirectorFileId = 'id' | 'bvn' | 'nin' | 'proof_of_address';
export interface CorporateEntity { companyName; rcNumber; dateOfIncorporation; registeredAddress; businessAddress; natureOfBusiness; tin; companyEmail; bankAccountNumber; bankName: string }
export interface Director { name; designation; bvn; nin; shareholdingPercent; nationality; residentialAddress: string; pep: '' | 'yes' | 'no'; files: Record<DirectorFileId, File | null> }
export interface CorporateFunds { sourceOfFunds: string; facilityAmount: string }
export interface CorporateDeclaration { signatory1Name; signatory1Date; signatory2Name; signatory2Date: string; signatureAgree: boolean }
export interface DocState { submitted: boolean; file: File | null }
export interface FormState { entity: CorporateEntity; directors: Director[]; docs: Record<string, DocState>; consent: boolean; funds: CorporateFunds; declaration: CorporateDeclaration; seal: File | null }
// validation.ts
export const DOCUMENT_IDS, DIRECTOR_FILE_IDS, MAX_DIRECTORS, MAX_FILE_SIZE, MAX_TOTAL_SIZE;
export function isBlank(v: unknown): boolean; export function isValidEmail(v: string): boolean;
export function validateFileMeta(f: {name: string; size: number}): {valid: boolean; error: string | null};
export function collectUploads(form: FormState): { key: string; file: File }[];   // keys: doc id | directorFile.<i>.<id> | sealFile
export function validateEntity(d: Partial<CorporateEntity>): Errors;
export function validateDirectors(rows: Director[]): Errors;     // row fields + director-file meta (no total)
export function validateDocuments(form: FormState): Errors;      // consent + meta + _total across ALL uploads
export function validateFunds(d: Partial<CorporateFunds>): Errors;
export function validateDeclaration(d: Partial<CorporateDeclaration>, seal: File | null): Errors;  // fields + sealFile meta
// flows/types.ts
export interface FlowStep { id: string; title: string; owns(key: string): boolean; touchKeys(form: FormState): string[]; validate(form: FormState): Errors }
export interface Flow { id: CustomerType; steps: FlowStep[] }
// flows/corporate.ts
export const corporateFlow: Flow; export const FLOWS: Record<CustomerType, Flow>;
```

Messages: exactly the table in Task 1 (client mirror). `validateFileMeta` messages unchanged from v1.

- [ ] **Step 1: Failing tests.** `validation.test.ts` — port the v1 `validateFileMeta` cases (disallowed ext, >5MB, valid pdf) and add (use a `form()` helper building a `FormState` with `initialState()` from `./initial-state` — created in Task 5; to avoid an ordering cycle, this task's tests build the state inline with a local `makeForm(overrides)` helper returning a complete `FormState`):

```ts
it('validateEntity flags required fields, allows empty businessAddress, checks email', () => {
  const e = validateEntity({});
  ['companyName','rcNumber','dateOfIncorporation','registeredAddress','natureOfBusiness','tin','companyEmail','bankAccountNumber','bankName'].forEach((k) => expect(e[k]).toBeTruthy());
  expect(e.businessAddress).toBeUndefined();
  expect(validateEntity({ ...validEntity, companyEmail: 'nope' }).companyEmail).toBe('Enter a valid email address.');
  expect(validateEntity({ ...validEntity, companyName: '   ' }).companyName).toBe('Company name is required.');
});
it('validateDirectors: needs a row, keys errors by index, checks percentage boundaries identically to the server', () => {
  expect(validateDirectors([]).directors).toBe('Add at least one director, signatory or UBO.');
  const rows = [dir(), dir({ name: '', pep: '' })];
  const e = validateDirectors(rows);
  expect(e['directors.1.name']).toBe('Name is required.'); expect(e['directors.1.pep']).toBe('Select Yes or No.'); expect(e['directors.0.name']).toBeUndefined();
  ['0','100','12.5'].forEach((v) => expect(validateDirectors([dir({ shareholdingPercent: v })])).toEqual({}));
  ['abc','-1','101','1e2'].forEach((v) => expect(validateDirectors([dir({ shareholdingPercent: v })])['directors.0.shareholdingPercent']).toBe('Enter a percentage between 0 and 100.'));
  expect(validateDirectors([dir({ shareholdingPercent: '' })])['directors.0.shareholdingPercent']).toBe('% shareholding is required.');
  expect(validateDirectors(Array.from({ length: 26 }, () => dir())).directors).toBe('Too many directors listed (maximum 25).');
});
it('validateDirectors reports a bad director file under directorFile.<i>.<id>', () => {
  const r = dir(); r.files.nin = new File(['x'], 'a.exe');
  expect(validateDirectors([r])['directorFile.0.nin']).toBe('File type not allowed: a.exe');
});
it('validateDocuments requires consent, validates only ticked docs, and totals ALL uploads', () => {
  expect(validateDocuments(makeForm()).consent).toBe('Consent to processing is required.');
  const f = makeForm({ consent: true }); f.docs.cac_forms = { submitted: false, file: bigFile('x.exe', 9) };
  expect(validateDocuments(f)).toEqual({});
  const g = makeForm({ consent: true });
  g.docs.certificate_of_incorporation = { submitted: true, file: bigFile('a.pdf', 4.5) };
  g.directors[0].files.id = bigFile('b.pdf', 4.5); g.directors[0].files.nin = bigFile('c.pdf', 4.5); g.directors[0].files.bvn = bigFile('d.pdf', 4.5); g.seal = bigFile('e.png', 4.5);
  expect(validateDocuments(g)._total).toBe('Total attachments exceed the 20MB limit.');
  const h = makeForm({ consent: true }); h.docs.utility = { submitted: true, file: new File(['x'], 'a.exe') };
  expect(Object.keys(validateDocuments(h)).some((k) => k === 'utility')).toBe(true);
});
it('validateFunds and validateDeclaration', () => {
  expect(Object.keys(validateFunds({}))).toEqual(['sourceOfFunds','facilityAmount']);
  const e = validateDeclaration({}, null);
  ['signatory1Name','signatory1Date','signatory2Name','signatory2Date','signatureAgree'].forEach((k) => expect(e[k]).toBeTruthy());
  expect(validateDeclaration({ signatory1Name: 'A', signatory1Date: '2026-01-01', signatory2Name: 'B', signatory2Date: '2026-01-01', signatureAgree: true }, null)).toEqual({});
  expect(validateDeclaration({ signatory1Name: 'A', signatory1Date: 'd', signatory2Name: 'B', signatory2Date: 'd', signatureAgree: true }, new File(['x'], 's.exe')).sealFile).toBe('File type not allowed: s.exe');
});
```

with helpers `bigFile(name, mb)` = `new File([new Uint8Array(Math.floor(mb*1024*1024))], name)`, `dir(o)` = a valid `Director` (pep `'no'`, all `files` null), `makeForm(o)` = full `FormState` (entity strings `''`, `directors:[dir()]`, `docs` for each `DOCUMENT_IDS` id `{submitted:false,file:null}`, `consent:false`, funds/declaration empty, `seal:null`), `validEntity` = the 10 entity fields filled.

`flows/corporate.test.ts`:

```ts
it('has five steps in order', () => expect(corporateFlow.steps.map((s) => s.id)).toEqual(['entity','directors','documents','funds','declaration']));
it('ownership maps keys to the right step', () => {
  const own = (k: string) => corporateFlow.steps.findIndex((s) => s.owns(k)) + 1;
  expect([own('companyName'), own('directors'), own('directors.3.name'), own('consent'), own('sourceOfFunds'), own('signatureAgree')]).toEqual([1, 2, 2, 3, 4, 5]);
  expect(own('directorFile.0.id')).toBe(0); expect(own('sealFile')).toBe(0); expect(own('_total')).toBe(0); expect(own('certificate_of_incorporation')).toBe(0);
});
it('directors touchKeys cover every row and field', () => {
  const f = makeForm(); f.directors.push(dir());
  const keys = corporateFlow.steps[1].touchKeys(f);
  expect(keys).toContain('directors'); expect(keys).toContain('directors.1.residentialAddress'); expect(keys).toHaveLength(1 + 2 * 8);
});
it('each step validates its own slice', () => {
  const f = makeForm();
  expect(Object.keys(corporateFlow.steps[0].validate(f)).length).toBeGreaterThan(0);
  expect(corporateFlow.steps[2].validate(f).consent).toBeTruthy();
});
```

(`makeForm`/`dir` live in `frontend/src/test-utils.ts`; move them there in this task and import from both test files.)

- [ ] **Step 2:** `cd frontend && npx vitest run src/lib/validation.test.ts src/flows` → FAIL.
- [ ] **Step 3: Implement** `types.ts` (as in the Interfaces block; `DIRECTOR_FIELDS` const array), `lib/documents.ts`:

```ts
export const DOCUMENT_LABELS: Record<string, string> = {
  certificate_of_incorporation: 'CAC Certificate of Incorporation',
  cac_forms: 'CAC Forms CAC2.3 / CAC1.1 - Directors & Shareholders',
  memorandum_articles: 'Memorandum & Articles of Association',
  board_resolution: 'Board Resolution to open account and obtain facility',
  company_bank_statement: 'Company Bank Statement - Last 12 months',
  corporate_id_signatories: 'Corporate ID of Authorized Signatories',
};
```

`lib/validation.ts`:

```ts
import type { CorporateDeclaration, CorporateEntity, CorporateFunds, Director, DirectorFileId, Errors, FormState } from '../types';

export const ALLOWED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'docx'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_TOTAL_SIZE = 20 * 1024 * 1024;
export const MAX_DIRECTORS = 25;
export const DOCUMENT_IDS: readonly string[] = ['certificate_of_incorporation', 'cac_forms', 'memorandum_articles', 'board_resolution', 'company_bank_statement', 'corporate_id_signatories'];
export const DIRECTOR_FILE_IDS: readonly DirectorFileId[] = ['id', 'bvn', 'nin', 'proof_of_address'];

interface FileMeta { name: string; size: number }

export function isBlank(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateFileMeta(file: FileMeta): { valid: boolean; error: string | null } {
  const name = file.name || '';
  const ext = name.split('.').pop()!.toLowerCase();
  if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) return { valid: false, error: 'File type not allowed: ' + name };
  if (file.size > MAX_FILE_SIZE) return { valid: false, error: 'File exceeds 5MB limit: ' + name };
  return { valid: true, error: null };
}

function directorFileErrors(rows: Director[]): Errors {
  const errors: Errors = {};
  rows.forEach((row, i) => {
    DIRECTOR_FILE_IDS.forEach((id) => {
      const file = row.files[id];
      if (!file) return;
      const meta = validateFileMeta(file);
      if (!meta.valid) errors[`directorFile.${i}.${id}`] = meta.error as string;
    });
  });
  return errors;
}

export function collectUploads(form: FormState): { key: string; file: File }[] {
  const uploads: { key: string; file: File }[] = [];
  DOCUMENT_IDS.forEach((id) => {
    const doc = form.docs[id];
    if (doc && doc.submitted && doc.file) uploads.push({ key: id, file: doc.file });
  });
  form.directors.forEach((row, i) => {
    DIRECTOR_FILE_IDS.forEach((fid) => {
      const file = row.files[fid];
      if (file) uploads.push({ key: `directorFile.${i}.${fid}`, file });
    });
  });
  if (form.seal) uploads.push({ key: 'sealFile', file: form.seal });
  return uploads;
}

export function validateEntity(d: Partial<CorporateEntity>): Errors {
  const errors: Errors = {};
  const required: [keyof CorporateEntity, string][] = [
    ['companyName', 'Company name is required.'], ['rcNumber', 'RC number is required.'],
    ['dateOfIncorporation', 'Date of incorporation is required.'], ['registeredAddress', 'Registered address is required.'],
    ['natureOfBusiness', 'Nature of business is required.'], ['tin', 'Tax identification number is required.'],
  ];
  required.forEach(([key, message]) => { if (isBlank(d[key])) errors[key] = message; });
  if (isBlank(d.companyEmail)) errors.companyEmail = 'Company email is required.';
  else if (!isValidEmail(d.companyEmail as string)) errors.companyEmail = 'Enter a valid email address.';
  if (isBlank(d.bankAccountNumber)) errors.bankAccountNumber = 'Corporate bank account number is required.';
  if (isBlank(d.bankName)) errors.bankName = 'Bank name is required.';
  return errors;
}

export function validateDirectors(rows: Director[]): Errors {
  if (rows.length === 0) return { directors: 'Add at least one director, signatory or UBO.' };
  if (rows.length > MAX_DIRECTORS) return { directors: `Too many directors listed (maximum ${MAX_DIRECTORS}).` };
  const errors: Errors = {};
  const required: [keyof Director, string][] = [
    ['name', 'Name is required.'], ['designation', 'Designation is required.'], ['bvn', 'BVN is required.'],
    ['nin', 'NIN is required.'], ['nationality', 'Nationality is required.'], ['residentialAddress', 'Residential address is required.'],
  ];
  rows.forEach((row, i) => {
    required.forEach(([key, message]) => { if (isBlank(row[key])) errors[`directors.${i}.${key}`] = message; });
    const pct = row.shareholdingPercent;
    if (isBlank(pct)) errors[`directors.${i}.shareholdingPercent`] = '% shareholding is required.';
    else if (!/^\d+(\.\d+)?$/.test(pct.trim()) || Number(pct) > 100) errors[`directors.${i}.shareholdingPercent`] = 'Enter a percentage between 0 and 100.';
    if (row.pep !== 'yes' && row.pep !== 'no') errors[`directors.${i}.pep`] = 'Select Yes or No.';
  });
  return { ...errors, ...directorFileErrors(rows) };
}

export function validateDocuments(form: FormState): Errors {
  const errors: Errors = {};
  let total = 0;
  collectUploads(form).forEach(({ key, file }) => {
    const meta = validateFileMeta(file);
    if (!meta.valid) errors[key] = meta.error as string;
    else total += file.size;
  });
  if (total > MAX_TOTAL_SIZE) errors._total = 'Total attachments exceed the 20MB limit.';
  if (!form.consent) errors.consent = 'Consent to processing is required.';
  return errors;
}

export function validateFunds(d: Partial<CorporateFunds>): Errors {
  const errors: Errors = {};
  if (isBlank(d.sourceOfFunds)) errors.sourceOfFunds = 'Source of funds is required.';
  if (isBlank(d.facilityAmount)) errors.facilityAmount = 'Facility amount requested is required.';
  return errors;
}

export function validateDeclaration(d: Partial<CorporateDeclaration>, seal: File | null): Errors {
  const errors: Errors = {};
  ([1, 2] as const).forEach((n) => {
    if (isBlank(d[`signatory${n}Name`])) errors[`signatory${n}Name`] = `Authorized signatory ${n} name is required.`;
    if (isBlank(d[`signatory${n}Date`])) errors[`signatory${n}Date`] = `Authorized signatory ${n} date is required.`;
  });
  if (!d.signatureAgree) errors.signatureAgree = 'You must confirm this constitutes your signature.';
  if (seal) {
    const meta = validateFileMeta(seal);
    if (!meta.valid) errors.sealFile = meta.error as string;
  }
  return errors;
}
```

`flows/types.ts` (as in Interfaces) and `flows/corporate.ts`:

```ts
import { DIRECTOR_FIELDS } from '../types';
import type { CustomerType, FormState, Errors } from '../types';
import { validateDeclaration, validateDirectors, validateDocuments, validateEntity, validateFunds } from '../lib/validation';
import type { Flow, FlowStep } from './types';

export const ENTITY_FIELDS = ['companyName','rcNumber','dateOfIncorporation','registeredAddress','businessAddress','natureOfBusiness','tin','companyEmail','bankAccountNumber','bankName'];
const FUNDS_FIELDS = ['sourceOfFunds', 'facilityAmount'];
const DECLARATION_FIELDS = ['signatory1Name','signatory1Date','signatory2Name','signatory2Date','signatureAgree'];

function step(id: string, title: string, fields: string[], validate: (f: FormState) => Errors, opts: { prefix?: string; extraTouch?: (f: FormState) => string[] } = {}): FlowStep {
  return {
    id, title, validate,
    owns: (key) => fields.includes(key) || (!!opts.prefix && key.startsWith(opts.prefix)),
    touchKeys: (form) => [...fields, ...(opts.extraTouch ? opts.extraTouch(form) : [])],
  };
}

export const corporateFlow: Flow = {
  id: 'corporate',
  steps: [
    step('entity', 'Entity Information', ENTITY_FIELDS, (f) => validateEntity(f.entity)),
    step('directors', 'Directors & UBOs', ['directors'], (f) => validateDirectors(f.directors), {
      prefix: 'directors.',
      extraTouch: (f) => f.directors.flatMap((_, i) => DIRECTOR_FIELDS.map((n) => `directors.${i}.${n}`)),
    }),
    step('documents', 'Documents', ['consent'], validateDocuments),
    step('funds', 'Source of Funds', FUNDS_FIELDS, (f) => validateFunds(f.funds)),
    step('declaration', 'Declaration', DECLARATION_FIELDS, (f) => validateDeclaration(f.declaration, f.seal)),
  ],
};

export const FLOWS: Record<CustomerType, Flow> = { corporate: corporateFlow };
```

Note `FormState` type change breaks other frontend files until Tasks 5–8; the type-check (`tsc -b`) is only required to pass at the end of Task 8; per-task verification here is the targeted vitest run. `validation.test.ts` old cases for v1 `validateStep1/2/3` are deleted with the rewrite.

- [ ] **Step 4:** Run the two test files → pass.
- [ ] **Step 5: Commit** `feat(frontend): corporate types, validation and flow config`.

---

### Task 5: Initial state, autosave v2, and FormData builder (TDD)

**Files:** Rewrite `frontend/src/lib/initial-state.ts`, `autosave.ts`, `submit.ts` and their tests (`autosave.test.ts`, `submit.test.ts`); `test-utils.ts` re-exports `initialState as emptyState`.

**Interfaces — Consumes:** Task 4 types/validation. **Produces:**

```ts
export function emptyDirector(): Director;
export function initialState(): FormState;                 // one empty director row
// autosave.ts
export const STORAGE_KEY = 'woodhall-kyc-draft-v2';
export interface Draft { v: 2; customerType: CustomerType; entity: Record<string,string>; funds: Record<string,string>; declaration: Record<string, string | boolean>; directors: Record<string,string>[]; documents: Record<string, boolean>; consent: boolean }
export function serialize(state: FormState): Draft; loadDraft(): Draft | null; saveDraft(state): void; clearDraft(): void;
export function hasAnyContent(d: Draft | null): boolean; export function applyDraft(state: FormState, d: Draft): FormState;
// submit.ts
export function buildFormData(state: FormState): FormData; export function postSubmission(state, fetchImpl?): Promise<SubmitResult>;
```

FormData contract: `customerType=corporate`; entity, funds fields by name (always appended, even empty); declaration name/date fields by name and `signatureAgree=on` when true; `consent=on`; `directors[i][<field>]` for all 8 fields (always appended) and `directors[i][files][<id>]` only when a file is set; for each doc: `documents[id][submitted]=on` when ticked **and** `documents[id][file]` only when ticked and a file exists; `sealFile` when set.

- [ ] **Step 1: Failing tests.**

```ts
// autosave.test.ts
it('round-trips values incl. directors, docs and consent, and never stores files', () => {
  const s = emptyState(); s.entity.companyName = 'Acme'; s.funds.sourceOfFunds = 'Sales';
  s.directors[0].name = 'Jane'; s.directors[0].pep = 'yes'; s.directors[0].files.id = new File(['x'], 'secret.pdf');
  s.directors.push({ ...emptyDirector(), name: 'John' }); s.docs.cac_forms.submitted = true; s.consent = true; s.declaration.signatureAgree = true; s.seal = new File(['x'], 'seal.png');
  saveDraft(s);
  expect(localStorage.getItem(STORAGE_KEY)).not.toContain('secret.pdf'); expect(localStorage.getItem(STORAGE_KEY)).not.toContain('seal.png');
  const r = applyDraft(emptyState(), loadDraft()!);
  expect(r.entity.companyName).toBe('Acme'); expect(r.directors.map((d) => d.name)).toEqual(['Jane', 'John']); expect(r.directors[0].pep).toBe('yes');
  expect(r.docs.cac_forms.submitted).toBe(true); expect(r.consent).toBe(true); expect(r.declaration.signatureAgree).toBe(true); expect(r.directors[0].files.id).toBeNull(); expect(r.seal).toBeNull();
});
it('ignores v1, corrupt and non-object drafts', () => {
  localStorage.setItem('woodhall-kyc-draft-v1', JSON.stringify({ fields: { companyName: 'Old' } })); expect(loadDraft()).toBeNull();
  localStorage.setItem(STORAGE_KEY, '{oops'); expect(loadDraft()).toBeNull();
  localStorage.setItem(STORAGE_KEY, '"str"'); expect(loadDraft()).toBeNull();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, entity: {} })); expect(loadDraft()).toBeNull();
});
it('applyDraft tolerates malformed pieces and caps rows at 25', () => {
  const bad = { v: 2, customerType: 'corporate', entity: { companyName: 5 }, directors: [null, 'x', { name: 'A', pep: 'maybe' }, ...Array(40).fill({ name: 'Z' })], documents: 'no', funds: null, declaration: [], consent: 'yes' } as unknown as Draft;
  const r = applyDraft(emptyState(), bad);
  expect(r.entity.companyName).toBe(''); expect(r.directors.length).toBeLessThanOrEqual(25); expect(r.directors.find((d) => d.name === 'A')!.pep).toBe('');
});
it('swallows storage errors; empty draft and a single empty director row are not content', () => {
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
  expect(() => saveDraft(emptyState())).not.toThrow(); spy.mockRestore();
  expect(hasAnyContent(serialize(emptyState()))).toBe(false);
  const s = emptyState(); s.directors[0].nationality = 'Nigerian'; expect(hasAnyContent(serialize(s))).toBe(true);
});
// submit.test.ts
it('builds the corporate FormData contract', () => {
  const s = emptyState(); s.entity.companyName = 'Acme'; s.directors[0].name = 'Jane'; s.directors[0].files.nin = new File(['x'], 'n.pdf');
  s.docs.cac_forms = { submitted: true, file: new File(['x'], 'c.pdf') }; s.docs.board_resolution = { submitted: false, file: new File(['x'], 'b.pdf') };
  s.consent = true; s.declaration.signatureAgree = true; s.declaration.signatory1Name = 'Jane'; s.seal = new File(['x'], 'seal.png');
  const fd = buildFormData(s);
  expect(fd.get('customerType')).toBe('corporate'); expect(fd.get('companyName')).toBe('Acme'); expect(fd.get('sourceOfFunds')).toBe('');
  expect(fd.get('directors[0][name]')).toBe('Jane'); expect(fd.get('directors[0][pep]')).toBe('');
  expect((fd.get('directors[0][files][nin]') as File).name).toBe('n.pdf'); expect(fd.has('directors[0][files][id]')).toBe(false);
  expect(fd.get('documents[cac_forms][submitted]')).toBe('on'); expect((fd.get('documents[cac_forms][file]') as File).name).toBe('c.pdf');
  expect(fd.has('documents[board_resolution][submitted]')).toBe(false); expect(fd.has('documents[board_resolution][file]')).toBe(false);
  expect(fd.get('consent')).toBe('on'); expect(fd.get('signatureAgree')).toBe('on'); expect(fd.get('signatory1Name')).toBe('Jane'); expect((fd.get('sealFile') as File).name).toBe('seal.png');
});
it('omits checkbox fields and files when nothing is ticked or attached', () => {
  const fd = buildFormData(emptyState());
  ['consent', 'signatureAgree', 'sealFile'].forEach((k) => expect(fd.has(k)).toBe(false));
});
it('numbers every director row', () => {
  const s = emptyState(); s.directors.push({ ...emptyDirector(), name: 'John' });
  expect(buildFormData(s).get('directors[1][name]')).toBe('John');
});
// keep the two postSubmission tests from v1 unchanged (non-JSON rejects; error bodies resolve; posts to 'submit.php').
```

- [ ] **Step 2:** `npx vitest run src/lib/autosave.test.ts src/lib/submit.test.ts` → FAIL.
- [ ] **Step 3: Implement.**

`initial-state.ts`:

```ts
import type { DocState, Director, FormState } from '../types';
import { DOCUMENT_IDS } from './validation';

export function emptyDirector(): Director {
  return {
    name: '', designation: '', bvn: '', nin: '', shareholdingPercent: '', nationality: '', pep: '', residentialAddress: '',
    files: { id: null, bvn: null, nin: null, proof_of_address: null },
  };
}

export function initialState(): FormState {
  const docs: Record<string, DocState> = {};
  DOCUMENT_IDS.forEach((id) => { docs[id] = { submitted: false, file: null }; });
  return {
    entity: { companyName: '', rcNumber: '', dateOfIncorporation: '', registeredAddress: '', businessAddress: '', natureOfBusiness: '', tin: '', companyEmail: '', bankAccountNumber: '', bankName: '' },
    directors: [emptyDirector()],
    docs, consent: false,
    funds: { sourceOfFunds: '', facilityAmount: '' },
    declaration: { signatory1Name: '', signatory1Date: '', signatory2Name: '', signatory2Date: '', signatureAgree: false },
    seal: null,
  };
}
```

`autosave.ts`:

```ts
import { DIRECTOR_FIELDS } from '../types';
import type { CustomerType, Director, FormState } from '../types';
import { emptyDirector } from './initial-state';
import { MAX_DIRECTORS } from './validation';

export const STORAGE_KEY = 'woodhall-kyc-draft-v2';

export interface Draft {
  v: 2; customerType: CustomerType;
  entity: Record<string, string>; funds: Record<string, string>; declaration: Record<string, string | boolean>;
  directors: Record<string, string>[]; documents: Record<string, boolean>; consent: boolean;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function pickStrings<T extends object>(base: T, src: unknown): T {
  const out = { ...base } as Record<string, unknown>;
  if (isObj(src)) Object.keys(base).forEach((k) => { if (typeof base[k as keyof T] === 'string' && typeof src[k] === 'string') out[k] = src[k]; });
  return out as T;
}

export function serialize(state: FormState): Draft {
  const documents: Record<string, boolean> = {};
  Object.keys(state.docs).forEach((id) => { documents[id] = state.docs[id].submitted; });
  return {
    v: 2, customerType: 'corporate',
    entity: { ...state.entity }, funds: { ...state.funds }, declaration: { ...state.declaration },
    directors: state.directors.map((d) => { const { files: _files, ...values } = d; return values; }),
    documents, consent: state.consent,
  };
}

export function loadDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isObj(parsed) && parsed.v === 2 ? (parsed as unknown as Draft) : null;
  } catch { return null; }
}

export function saveDraft(state: FormState): void {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(state))); } catch { /* best-effort */ }
}
export function clearDraft(): void {
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* nothing to clean */ }
}

export function hasAnyContent(d: Draft | null): boolean {
  if (!d) return false;
  const anyText = (o: unknown) => isObj(o) && Object.values(o).some((v) => (typeof v === 'string' && v.trim() !== '') || v === true);
  const directorHasContent = (row: unknown) => isObj(row) && DIRECTOR_FIELDS.some((f) => typeof row[f] === 'string' && (row[f] as string).trim() !== '');
  return anyText(d.entity) || anyText(d.funds) || anyText(d.declaration) ||
    (Array.isArray(d.directors) && d.directors.some(directorHasContent)) ||
    (isObj(d.documents) && Object.values(d.documents).some((v) => v === true)) || d.consent === true;
}

export function applyDraft(state: FormState, d: Draft): FormState {
  const directors: Director[] = Array.isArray(d.directors)
    ? d.directors.filter(isObj).slice(0, MAX_DIRECTORS).map((row) => {
        const base = pickStrings(emptyDirector(), row);
        return { ...base, pep: row.pep === 'yes' || row.pep === 'no' ? row.pep : '' };
      })
    : [];
  const docs = { ...state.docs };
  if (isObj(d.documents)) Object.keys(d.documents).forEach((id) => { if (docs[id] && d.documents[id] === true) docs[id] = { ...docs[id], submitted: true }; });
  const declaration = pickStrings(state.declaration, d.declaration);
  declaration.signatureAgree = isObj(d.declaration) && d.declaration.signatureAgree === true;
  return {
    ...state,
    entity: pickStrings(state.entity, d.entity),
    funds: pickStrings(state.funds, d.funds),
    declaration, docs,
    directors: directors.length > 0 ? directors : state.directors,
    consent: d.consent === true,
  };
}
```

`submit.ts`:

```ts
import { DIRECTOR_FIELDS } from '../types';
import type { FormState } from '../types';
import { DIRECTOR_FILE_IDS, DOCUMENT_IDS } from './validation';

export interface SubmitResult { success: boolean; message?: string; errors?: Record<string, string> }

export function buildFormData(state: FormState): FormData {
  const fd = new FormData();
  fd.append('customerType', 'corporate');
  Object.entries(state.entity).forEach(([k, v]) => fd.append(k, v));
  Object.entries(state.funds).forEach(([k, v]) => fd.append(k, v));
  const { signatureAgree, ...signatories } = state.declaration;
  Object.entries(signatories).forEach(([k, v]) => fd.append(k, v));
  if (signatureAgree) fd.append('signatureAgree', 'on');
  if (state.consent) fd.append('consent', 'on');
  state.directors.forEach((row, i) => {
    DIRECTOR_FIELDS.forEach((f) => fd.append(`directors[${i}][${f}]`, row[f]));
    DIRECTOR_FILE_IDS.forEach((id) => { const file = row.files[id]; if (file) fd.append(`directors[${i}][files][${id}]`, file); });
  });
  DOCUMENT_IDS.forEach((id) => {
    const doc = state.docs[id];
    if (!doc.submitted) return;
    fd.append(`documents[${id}][submitted]`, 'on');
    if (doc.file) fd.append(`documents[${id}][file]`, doc.file);
  });
  if (state.seal) fd.append('sealFile', state.seal);
  return fd;
}

export async function postSubmission(state: FormState, fetchImpl: typeof fetch = fetch): Promise<SubmitResult> {
  const response = await fetchImpl('submit.php', { method: 'POST', body: buildFormData(state) });
  return response.json();
}
```

- [ ] **Step 4:** Run the two test files (+ Task 4 tests) → pass.
- [ ] **Step 5: Commit** `feat(frontend): v2 draft autosave and corporate FormData contract`.

---

### Task 6: Reducer (TDD)

**Files:** Rewrite `frontend/src/lib/reducer.ts` and `reducer.test.ts`.

**Interfaces — Consumes:** Tasks 4–5. **Produces:**

```ts
export type FieldGroup = 'entity' | 'funds' | 'declaration';
export interface AppState { customerType: CustomerType; form: FormState; step: number; touched: Record<string, boolean>; errors: Errors; status: 'idle'|'submitting'|'done'; draftRestored: boolean }
export type Action =
  | { type: 'setField'; group: FieldGroup; name: string; value: string | boolean }
  | { type: 'setConsent'; value: boolean }
  | { type: 'setDocSubmitted'; id: string; value: boolean }
  | { type: 'setDocFile'; id: string; file: File | null }
  | { type: 'addDirector' } | { type: 'removeDirector'; index: number }
  | { type: 'setDirectorField'; index: number; name: DirectorField; value: string }
  | { type: 'setDirectorFile'; index: number; fileId: DirectorFileId; file: File | null }
  | { type: 'setSeal'; file: File | null }
  | { type: 'touch'; name: string } | { type: 'next' } | { type: 'back' } | { type: 'goTo'; step: number }
  | { type: 'serverErrors'; errors: Errors } | { type: 'restoreDraft'; draft: Draft } | { type: 'reset' }
  | { type: 'submitting'; value: boolean } | { type: 'done' };
export function initialAppState(): AppState;
export function flowOf(s: { customerType: CustomerType }): Flow;
export function stepErrors(form: FormState, flow: Flow, step: number): Errors;
export function fieldStep(flow: Flow, key: string): number | null;   // 1-based; null = unmatched → alert
```

Semantics: `errors` = current-step validation filtered to touched keys after any form/touch/step change; `next` touches `touchKeys` of the current step and either advances (errors `{}`) or sets the FULL step errors; `removeDirector` is a no-op with one row, otherwise removes the row and clears every touched key starting `directors` (so errors cannot land on the wrong row); `addDirector` no-ops at 25; `serverErrors` jumps to the earliest owning step among keys with an owner and stores the full map; `setDocSubmitted(false)` keeps the file in state.

- [ ] **Step 1: Failing tests** (`reducer.test.ts`; `run(s, ...actions)` helper as in v1). Cases:
  - `next` on empty step 1 stays at 1 and sets `errors.companyName === 'Company name is required.'`.
  - a `fillEntity` helper (setField for the 9 required entity fields) then `next` → step 2, `errors` `{}`.
  - field error only after `touch`, cleared when fixed (v1 test, on `entity.companyName`).
  - step 2: `next` with an empty row sets `errors['directors.0.name']`; after `setDirectorField` for all 8 fields (`pep: 'no'`) then `next` → step 3.
  - `addDirector` then `next` touches row 1 keys (`errors['directors.1.name']` present) while row 0 valid.
  - `removeDirector` with one row is a no-op; with two rows removes the chosen one and clears touched: build 2 rows, `next` (touches both, errors on both), `removeDirector 0` → `errors` has no `directors.*` keys and `touched` has none starting `directors`, and the remaining row is the former row 1.
  - `addDirector` at 25 rows no-ops.
  - step 3 (documents): tick a doc, `setDocFile` with `a.exe`, `setConsent true`, `next` → stays at 3 with `errors.certificate_of_incorporation === 'File type not allowed: a.exe'`; unticking it (`setDocSubmitted false`) then `next` → advances to 4.
  - `setSeal` with bad file: on step 5 `next` → `errors.sealFile`.
  - `back` never goes below 1; `next` never exceeds 5.
  - `restoreDraft` applies values and sets `draftRestored`; `reset` returns `initialAppState()`.
  - `serverErrors({ 'directors.0.name': 'x' })` from step 5 → step 2; `{ consent: 'x', tin: 'y' }` → step 1; `{ _total: 'x', 'directorFile.0.id': 'y', sealFile: 'z', customerType: 'w' }` → step unchanged.
  - `fieldStep(corporateFlow, ...)`: `signatureAgree`→5, `consent`→3, `directors.7.pep`→2, `directorFile.0.id`→null, `_total`→null.
  - `stepErrors(form, flow, 5).signatory1Name` is set on an empty form.
- [ ] **Step 2:** `npx vitest run src/lib/reducer.test.ts` → FAIL.
- [ ] **Step 3: Implement** `reducer.ts`:

```ts
import type { CustomerType, DirectorField, DirectorFileId, Errors, FormState } from '../types';
import { FLOWS } from '../flows/corporate';
import type { Flow } from '../flows/types';
import { applyDraft } from './autosave';
import type { Draft } from './autosave';
import { emptyDirector, initialState } from './initial-state';
import { MAX_DIRECTORS } from './validation';

export type FieldGroup = 'entity' | 'funds' | 'declaration';

export interface AppState { /* as in Interfaces */ }
export type Action = /* as in Interfaces */;

export function flowOf(s: { customerType: CustomerType }): Flow { return FLOWS[s.customerType]; }

export function stepErrors(form: FormState, flow: Flow, step: number): Errors {
  return flow.steps[step - 1].validate(form);
}

export function fieldStep(flow: Flow, key: string): number | null {
  const index = flow.steps.findIndex((s) => s.owns(key));
  return index === -1 ? null : index + 1;
}

export function initialAppState(): AppState {
  return { customerType: 'corporate', form: initialState(), step: 1, touched: {}, errors: {}, status: 'idle', draftRestored: false };
}

function visibleErrors(form: FormState, flow: Flow, step: number, touched: Record<string, boolean>): Errors {
  const all = stepErrors(form, flow, step);
  const shown: Errors = {};
  Object.keys(all).forEach((key) => { if (touched[key]) shown[key] = all[key]; });
  return shown;
}

function withForm(s: AppState, form: FormState, touched = s.touched): AppState {
  return { ...s, form, touched, errors: visibleErrors(form, flowOf(s), s.step, touched) };
}

function updateDirector(s: AppState, index: number, patch: (d: FormState['directors'][number]) => FormState['directors'][number]): AppState {
  if (index < 0 || index >= s.form.directors.length) return s;
  const directors = s.form.directors.map((d, i) => (i === index ? patch(d) : d));
  return withForm(s, { ...s.form, directors });
}

export function reducer(s: AppState, a: Action): AppState {
  const flow = flowOf(s);
  switch (a.type) {
    case 'setField':
      return withForm(s, { ...s.form, [a.group]: { ...s.form[a.group], [a.name]: a.value } } as FormState);
    case 'setConsent':
      return withForm(s, { ...s.form, consent: a.value });
    case 'setDocSubmitted':
      return withForm(s, { ...s.form, docs: { ...s.form.docs, [a.id]: { ...s.form.docs[a.id], submitted: a.value } } });
    case 'setDocFile':
      return withForm(s, { ...s.form, docs: { ...s.form.docs, [a.id]: { ...s.form.docs[a.id], file: a.file } } });
    case 'addDirector':
      return s.form.directors.length >= MAX_DIRECTORS ? s : withForm(s, { ...s.form, directors: [...s.form.directors, emptyDirector()] });
    case 'removeDirector': {
      if (s.form.directors.length <= 1 || a.index < 0 || a.index >= s.form.directors.length) return s;
      const touched = Object.fromEntries(Object.entries(s.touched).filter(([k]) => !k.startsWith('directors')));
      return withForm(s, { ...s.form, directors: s.form.directors.filter((_, i) => i !== a.index) }, touched);
    }
    case 'setDirectorField':
      return updateDirector(s, a.index, (d) => ({ ...d, [a.name]: a.value }));
    case 'setDirectorFile':
      return updateDirector(s, a.index, (d) => ({ ...d, files: { ...d.files, [a.fileId]: a.file } }));
    case 'setSeal':
      return withForm(s, { ...s.form, seal: a.file });
    case 'touch': {
      const touched = { ...s.touched, [a.name]: true };
      return { ...s, touched, errors: visibleErrors(s.form, flow, s.step, touched) };
    }
    case 'next': {
      const current = flow.steps[s.step - 1];
      const touched = { ...s.touched };
      current.touchKeys(s.form).forEach((k) => { touched[k] = true; });
      const errors = current.validate(s.form);
      if (Object.keys(errors).length > 0) return { ...s, touched, errors };
      return { ...s, touched, step: Math.min(flow.steps.length, s.step + 1), errors: {} };
    }
    case 'back': {
      const step = Math.max(1, s.step - 1);
      return { ...s, step, errors: visibleErrors(s.form, flow, step, s.touched) };
    }
    case 'goTo': {
      const step = Math.min(flow.steps.length, Math.max(1, a.step));
      return { ...s, step, errors: visibleErrors(s.form, flow, step, s.touched) };
    }
    case 'serverErrors': {
      const steps = Object.keys(a.errors).map((k) => fieldStep(flow, k)).filter((n): n is number => n !== null);
      return { ...s, step: steps.length > 0 ? Math.min(...steps) : s.step, errors: a.errors };
    }
    case 'restoreDraft':
      return { ...s, form: applyDraft(s.form, a.draft), draftRestored: true };
    case 'reset':
      return initialAppState();
    case 'submitting':
      return { ...s, status: a.value ? 'submitting' : 'idle' };
    case 'done':
      return { ...s, status: 'done' };
  }
}
```

- [ ] **Step 4:** Run reducer tests → pass (and Tasks 4–5 suites still pass).
- [ ] **Step 5: Commit** `feat(frontend): generic flow-driven reducer with director rows`.

---

### Task 7: Components (TDD)

**Files:** Modify `components/ProgressBar.tsx`, `TextField.tsx`, `Step1Entity.tsx`; `git mv` `Step2Documents.tsx` → `Step3Documents.tsx` and `Step3Declaration.tsx` → `Step5Declaration.tsx` (and edit); Create `Step2Directors.tsx`, `DirectorRow.tsx`, `Step4Funds.tsx`; Modify `components/stepProps.ts` (unchanged shape); Rewrite `components/steps.test.tsx`.

**Interfaces — Consumes:** Task 6 `AppState`/`Action`; `DOCUMENT_LABELS`, `DIRECTOR_FIELDS`, `DIRECTOR_FILE_IDS`. **Produces:**

```ts
ProgressBar({ titles: string[]; step: number })   // desktop pills "n. Title" (data-testid progress-step-n), mobile "Step n of N: Title"
TextField props: { state; dispatch; group: 'entity' | 'funds' | 'declaration'; name; label; placeholder?; type?: 'text'|'email'|'date'; multiline? }
Step1Entity, Step2Directors, Step3Documents, Step4Funds, Step5Declaration: (props: StepProps) => JSX   // StepProps = { state, dispatch, onNext, onBack } unchanged
```

**Class contract:** reuse the existing Tailwind classes (`Field`, `inputClass`, `Button`, card, spacing) unchanged. ProgressBar pill text is `{n}. {title}`; with 5 pills use `text-xs sm:text-[13px]` and `px-1` so long titles wrap instead of overflowing.

**Behavior contract:**
- `Step1Entity`: fields in order — Company Name, RC Number, Date of Incorporation (date), Registered Address (multiline), Business Address (multiline; label `Business/Operating Address (if different)`), Nature of Business, Tax Identification Number (TIN), Company Email (email; placeholder `e.g. finance@acmetrading.com`), Corporate Bank Account Number, Bank. Same placeholders as v1 where the field existed. Legal status and website are removed. Heading `Section A: Entity Information`; only a `Next: Directors & UBOs` button.
- `Step2Directors` (`Section B: Directors, Signatories & UBOs (>5%)`, paragraph `Attach ID, BVN, NIN and proof of address for each person where available.`): renders a `DirectorRow` per row and an `Add another person` button (disabled at 25), list-level error `state.errors.directors` in a `role="alert"` paragraph; buttons `Back` / `Next: Documents`.
- `DirectorRow` (`role="group"` `aria-label="Director {n}"`): header `Person {n}` + `Remove` button (`aria-label="Remove director {n}"`, disabled when only one row); text inputs with ids `directors-{i}-{field}` and labels `Name`, `Designation`, `BVN`, `NIN`, `% Shareholding` (`inputMode="decimal"`), `Nationality`, multiline `Residential Address`; PEP radio group (`name="pep-{i}"`, labels `Yes`/`No`, legend `PEP`); four file inputs under `Attachments (optional)` with `aria-label="Director {n} {ID|BVN|NIN|Proof of address} file"`, `accept=".pdf,.jpg,.jpeg,.png,.docx"`. Each field's `onBlur` dispatches `touch` `directors.{i}.{field}`; `onChange` dispatches `setDirectorField`; radios also dispatch `touch`; errors read from `state.errors['directors.{i}.{field}']` and shown in `Field` (`role="alert"`). Use `<div className="mb-4 rounded-lg border border-[#E4DAD2] p-4">` for the row card.
- `Step3Documents` (`Section C: Required Documents`, paragraph `Tick each document submitted and attach a copy where available.`): identical to v1 documents step but iterating the 6 ids; consent checkbox text unchanged; buttons `Back` / `Next: Source of Funds`.
- `Step4Funds` (`Section D: Source of Funds`): TextField `sourceOfFunds` (label `Source of Funds`, multiline), `facilityAmount` (label `Facility Amount Requested (₦)`, placeholder `e.g. 5,000,000`); buttons `Back` / `Next: Declaration`.
- `Step5Declaration` (`Section E: Declaration`): certification paragraph `We certify that the above information is true. We understand Woodhall Capital is obligated to report suspicious transactions to NFIU.`; TextFields (group `declaration`) `signatory1Name` (`Authorized Signatory 1 — Name`), `signatory1Date` (`Authorized Signatory 1 — Date`, type date), same for 2; a file input `aria-label="Company seal (optional)"` dispatching `setSeal`, with `Field` error from `state.errors.sealFile`; the `signatureAgree` checkbox (`I agree that the typed names above constitute our signatures.`; dispatches `setField` group `declaration` + `touch`); `Back` and the submit button exactly as v1 (`Submitting…` / `Submit Form`, spinner, both disabled while `status === 'submitting'`).

- [ ] **Step 1: Failing tests** (`steps.test.tsx`; same `Host` pattern as v1 with the new reducer):

```tsx
it('Step1Entity shows a required error only after blur, has company email, and no legal status/website', async () => { /* as v1 + expect getByLabelText('Company Email'), queryByLabelText('Website (if any)') null, queryByText('Legal Status') null */ });
it('Step2Directors adds and removes rows, keeps the last row, and scopes errors to the row', async () => {
  const user = userEvent.setup(); render(<Host Step={Step2Directors} />);
  expect(screen.getAllByRole('group', { name: /^Director \d+$/ })).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Remove director 1' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Add another person' }));
  const rows = screen.getAllByRole('group', { name: /^Director \d+$/ }); expect(rows).toHaveLength(2);
  await user.click(within(rows[1]).getByLabelText('Name')); await user.tab();
  expect(within(rows[1]).getByText('Name is required.')).toBeInTheDocument();
  expect(within(rows[0]).queryByText('Name is required.')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Remove director 1' }));
  expect(screen.getAllByRole('group', { name: /^Director \d+$/ })).toHaveLength(1);
  expect(screen.queryByText('Name is required.')).toBeNull();
});
it('Step2Directors captures PEP and shareholding', async () => { /* click within row 1: 'Yes'; type '12.5' into '% Shareholding'; assert values */ });
it('Step2Directors shows file inputs for each attachment type', () => { ['ID','BVN','NIN','Proof of address'].forEach((l) => expect(screen.getByLabelText(`Director 1 ${l} file`)).toBeInTheDocument()); });
it('Step3Documents renders the 6 labels and shows the file input only once ticked', async () => { /* as v1 with new labels; expect Object.keys(DOCUMENT_LABELS).length 6 */ });
it('Step4Funds captures both fields and shows required errors after blur', async () => { /* … */ });
it('Step5Declaration: both signatories, seal input, submit states', async () => { /* labels exist; Submitting… disabled with Back disabled; idle 'Submit Form' enabled; uploading a seal dispatches (assert via host state readout or by re-render) */ });
it('ProgressBar marks active/complete pills for five steps', () => { render(<ProgressBar titles={['A','B','C','D','E']} step={3} />); expect(screen.getByTestId('progress-step-3').className).toContain('bg-primary'); expect(screen.getByTestId('progress-step-2').className).toContain('bg-accent'); expect(screen.getByText('Step 3 of 5: C')).toBeInTheDocument(); });
```

(Write each `/* … */` case out in full when implementing — they follow the v1 patterns line for line; no case may be left as a comment.)

- [ ] **Step 2:** `npx vitest run src/components` → FAIL.
- [ ] **Step 3: Implement** the components per the contracts. `TextField.tsx` change: `group: 'entity' | 'funds' | 'declaration'` and `value` read via `(state.form[group] as unknown as Record<string, string>)[name]`. `git mv` the two step files first, then edit.
- [ ] **Step 4:** Run component tests → pass.
- [ ] **Step 5: Commit** `feat(frontend): corporate step components incl. directors table`.

---

### Task 8: App wiring, prefill, and end-to-end UI tests (TDD)

**Files:** Modify `frontend/src/App.tsx`, `frontend/src/dev/prefill.ts`; Rewrite `frontend/src/App.test.tsx`.

**Interfaces — Consumes:** Tasks 4–7. **Produces:** default export `App`.

Behavior changes vs current `App.tsx`: derive `const flow = flowOf(state)`; `const lastStep = flow.steps.length`; `ProgressBar titles={flow.steps.map(s => s.title)}`; `STEP_COMPONENTS = [Step1Entity, Step2Directors, Step3Documents, Step4Funds, Step5Declaration]` rendered by `state.step - 1`; `alertUnmatched(flow, errors)` uses `fieldStep(flow, key) === null`; `onNext` = `alertUnmatched(flow, stepErrors(form, flow, step)); dispatch({type:'next'})`; `onSubmit` validates `stepErrors(form, flow, lastStep)` and dispatches `next` (which touches the last step) when non-empty; confirmation email = `form.entity.companyEmail`; everything else (lazy draft init, debounced autosave skipping first mount, sending ref, server-error handling, alerts, dev button, direction animation) unchanged. `prefillActions()` becomes: entity fields (10, incl. `companyEmail: 'finance@acmetrading.com'`), one director row (`setDirectorField` × 8 with `pep: 'no'`), tick `certificate_of_incorporation` and `cac_forms`, `setConsent`, funds (2), declaration (`signatory1Name/Date`, `signatory2Name/Date`, `signatureAgree`).

- [ ] **Step 1: Failing tests.** Rewrite `App.test.tsx` keeping the v1 structure; helpers:

```ts
const ENTITY = { 'Company Name': 'Acme Ltd', 'RC Number': 'RC1', 'Date of Incorporation': '2020-01-01', 'Registered Address': '1 Main St', 'Nature of Business': 'Trading', 'Tax Identification Number (TIN)': 'T1', 'Company Email': 'info@acme.com', 'Corporate Bank Account Number': '0123', Bank: 'First Bank' };
async function fillEntity() { Object.entries(ENTITY).forEach(([l, v]) => setVal(l, v)); }
async function fillDirector(user, n = 1) { const row = screen.getByRole('group', { name: `Director ${n}` }); const set = (l: string, v: string) => fireEvent.change(within(row).getByLabelText(l), { target: { value: v } }); set('Name','Jane'); set('Designation','MD'); set('BVN','1'); set('NIN','2'); set('% Shareholding','60'); set('Nationality','Nigerian'); set('Residential Address','1 Rd'); await user.click(within(row).getByLabelText('No')); }
// goToStep(user, n) walks: entity → Next: Directors & UBOs → fillDirector → Next: Documents → tick consent → Next: Source of Funds → funds → Next: Declaration.
```

Cases: (1) cannot advance from step 1 empty; error text. (2) advances to Directors after filling entity (`Section B: …`). (3) cannot advance from Directors with an empty row; row error visible; after `fillDirector` advances. (4) Documents step: ticking a doc and uploading `a.exe` (`applyAccept:false`) then Next → alert containing `File type not allowed: a.exe`, stays on step 3; unticking it lets the user proceed. (5) Funds step blocks empty. (6) Happy path through all 5 steps: submit → `fetch` called once with `submit.php`, FormData has `customerType=corporate` and `directors[0][name]=Jane`, confirmation shows `info@acme.com`, draft removed. (7) server `{success:false, errors:{tin:'bad'}, message:'m'}` → jumps to step 1, shows `bad`, `alert('m')`, then after re-walking to step 5 Submit is enabled. (8) server error on `directors.0.nin` → jumps to Directors step and shows the message inside Director 1. (9) `{errors:{}, message:'Mail failed'}` → alert, stays on step 5, submit enabled. (10) fetch rejects → `Network error. Please try again.`; non-JSON body → same; buttons re-enabled. (11) double submit → fetch once. (12) v2 draft restore shows banner with values (entity + a director + `documents`), "Clear and start over" empties and removes the key; a **v1** draft under the old key is ignored (no banner). (13) existing draft not overwritten with an empty state on mount; typed values autosave after debounce; a draft with only an empty director row shows no banner. (14) `_total`/upload server errors show only as an alert and do not change the step.

- [ ] **Step 2:** `npx vitest run src/App.test.tsx` → FAIL.
- [ ] **Step 3: Implement** the App and prefill changes above.
- [ ] **Step 4:** Run the entire frontend suite: `cd frontend && npm test` → all pass; `npx tsc -b` → clean; `npm run build` → succeeds; `grep -c "Fill test data" dist/assets/*.js` → `0`.
- [ ] **Step 5: Commit** `feat(frontend): wire the 5-step corporate wizard`.

---

### Task 9: Docs, packaging check, visual verification

**Files:** Modify `README.md`; verify `scripts/package.sh`.

- [ ] **Step 1: README** — update the intro/"Tech stack" wording for the corporate v2 form; replace the frontend structure list (`flows/`, `Step1Entity … Step5Declaration`, `DirectorRow`), add a "Request contract" section (the FormData contract from Task 5 and the error-key rules from Global Constraints), note the M1 backend accepts only `customerType=corporate`, and update the tests section (PHP suite list unchanged, frontend counts not hard-coded).
- [ ] **Step 2: Full verification** — `cd frontend && npm test && npx tsc -b && npm run build`; run all four PHP suites; `php -l submit.php lib/*.php preview.php`; `scripts/package.sh` and confirm the zip has `assets/logos/`, `submit.php`, `lib/`, and no `preview.php`/`tests/`.
- [ ] **Step 3: Visual check (page loads only, never POST)** — serve `build/woodhall-kyc` with `php -S localhost:8000`; screenshot `/` at 1024px, and at 375px via a same-origin iframe probe page (headless Chrome ignores window widths below ~500px); view the images and confirm the progress pills, Section A card and heading spacing look right. The Directors/Documents/Funds/Declaration layouts are covered by the RTL tests; the owner can eyeball them through the dev "Fill test data" button under `npm run dev`. Kill the server afterwards.
- [ ] **Step 4: Commit** `docs: describe the corporate v2 form and request contract`.

---

## Self-Review

- **Spec coverage:** corporate steps A–E (T4/T7), removed fields (T1/T4/T7), directors table with add/remove/min 1/max 25 and per-row attachments (T4–T7), 6-document list + consent (T4/T7), source of funds + facility amount (T1/T4/T7), two signatories + dates + seal + agreement (T4/T7), flows config + reducer (T4/T6), v2 draft key (T5), customerType contract and dispatch (T3/T5), backend validator/PDF/mailer/handler (T1–T3), 20MB total across all uploads (T1/T3/T4), branding unchanged and consent kept (Global Constraints), README (T9). Individual flow and selector are M2 (separate plan).
- **Deliberate deviations from v1 behavior (rulings):** unticked documents' files are neither validated nor attached (client omits them; server ignores) — prevents un-ticked files being emailed unvalidated.
- **Type consistency:** `FormState` (`entity/directors/docs/consent/funds/declaration/seal`), `Flow/FlowStep`, `AppState.customerType/step`, `fieldStep(flow,key)`, `stepErrors(form,flow,step)`, `DIRECTOR_FIELDS`, `DIRECTOR_FILE_IDS`, `MAX_DIRECTORS` are used with identical names across tasks; PHP `$data['fields'|'directors'|'documents'|'consent'|'sealAttached']` matches between T2 and T3.
- **Placeholders:** Task 7/8 test bullets that say "follow the v1 patterns" are specified case-by-case with concrete assertions above; the executor writes them out in full (each case is enumerated).
