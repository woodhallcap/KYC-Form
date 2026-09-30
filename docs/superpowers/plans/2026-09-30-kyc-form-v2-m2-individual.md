# KYC Form v2 — Milestone 2 (Individual flow + customer-type selector) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Individual KYC flow and a first-screen Individual/Corporate selector, on both the PHP backend and the React frontend.

**Architecture:** Backend `handle_submission` already dispatches on `customerType`; add an `individual` branch (validator, PDF, mailer summary) and factor the shared upload/attach/send tail out of the corporate handler. Frontend state becomes `customerType: CustomerType | null` plus two independent forms (`corporate`, `individual`); `flows/individual.ts` joins `flows/corporate.ts`; the reducer picks the active form via the `customerType` discriminator on each form object; a `TypeSelector` screen shows while `customerType` is null.

**Tech Stack:** as M1 (React 19, TypeScript, Tailwind v4, Vitest + RTL; PHP 8, TCPDF, PHPMailer, custom harness).

**Spec:** `docs/superpowers/specs/2026-09-30-kyc-form-v2-design.md` (Individual flow table). **M1 plan:** `docs/superpowers/plans/2026-09-30-kyc-form-v2-m1-corporate.md`.
**Branch:** `kyc-form-v2-m2` (cut from `main` at `631f0bd`).

## Global Constraints

- No `Co-Authored-By` trailers, no "Generated with Claude Code" lines in commits/PR text (user preference).
- **Never POST a real submission against `config.php`'s real `RECIPIENT_EMAIL`.** Backend verified only through PHP tests with injected fake senders. Browser checks: Vite dev server only, `submit.php` blocked in-script, no PHP backend running.
- Upload rules unchanged: `pdf, jpg, jpeg, png, docx`; 5MB each; 20MB total; only **ticked** documents validated/attached.
- Server and client use identical field keys and messages (tables in Task 1 and Task 4). Alert-only error keys stay: document ids, `_total` (and corporate `directorFile.*`, `sealFile`).
- Branding stays "Woodhall Capital"; consent checkbox kept on Individual documents step (same default as Corporate).
- Draft key stays `woodhall-kyc-draft-v2`; a draft stores ONE form (`customerType` decides which). Existing M1 corporate drafts remain valid. Restoring a draft selects its customer type (skips the selector).
- TCPDF core fonts cannot render `₦`: PDF says "(NGN)". Vanitas (heading font) lacks `& > % ( )`: keep those out of `<h2>/<h3>` text.
- Option values (identical client/server): gender `M|F`; means of ID `nin|bvn|passport|drivers_license|voters_card`; source of income `salary|business|investment|inheritance|other`; purpose `loan|lease|investment|other`; transaction types `cash|transfer|cheque`.
- Individual documents: `valid_means_of_id`, `proof_of_address`, `passport_photograph`, `signature_mandate_card`.
- `assets/logos/` paths unchanged.

## Review Focus

- `meansOfId` / `expectedTransactionTypes` sent as a string, nested array, or containing unknown values must not fatal and must be rejected (server) — and `meansOfId[]` must round-trip from FormData.
- "Other" source/purpose: switching away from Other must not leave a stale required-text error; Other with blank text blocks on both sides.
- Switching customer type (selector → back → other type) keeps each form's typed data and never leaks one type's errors/touched into the other.
- Restoring a corporate draft vs an individual draft lands in the right flow; corrupt/unknown `customerType` in a draft is ignored.
- Email is required and validated for Individual; the confirmation copy goes to it; the admin subject shows the individual's name and type.
- A corporate POST can no longer be mistaken for individual (and vice versa): unsupported/missing `customerType` still 422.

## File Structure

```
lib/validator.php               + individual constants, array sanitising, validate_individual_person/declaration
lib/pdf-builder.php             render_pdf() shared, individual_pdf_sections(), build_individual_pdf(), dispatcher
lib/mailer.php                  submission_summary() by type; email copy uses the summary
lib/submission-handler.php      generic parse_documents_input, collect_uploads options, deliver_submission(), handle_individual_submission()
preview.php                     dev preview gains ?type=individual
frontend/src/types.ts           IndividualPerson/IndividualForm, CorporateForm (+customerType), FormState union
frontend/src/lib/validation.ts  individual validators; corporate ones typed to CorporateForm
frontend/src/lib/documents.ts   + individual labels
frontend/src/flows/             narrow.ts, individual.ts; corporate.ts uses narrow
frontend/src/lib/{initial-state,autosave,submit,reducer}.ts   type-aware
frontend/src/components/        TypeSelector, ChoiceGroup, CheckboxGroup, DocumentsStep, SubmitActions, IndividualStep1Person, IndividualStep2Documents, IndividualStep3Declaration (+ corporate steps updated to state.corporate)
frontend/src/App.tsx, src/dev/prefill.ts
```

---

### Task 1: PHP validator — Individual (TDD)

**Files:** Modify `lib/validator.php`, `tests/php/test_validator.php`.

**Interfaces — Produces:**

```php
const INDIVIDUAL_DOCUMENT_IDS, MEANS_OF_ID, TRANSACTION_TYPES, SOURCE_OF_INCOME_OPTIONS, PURPOSE_OPTIONS;
function validate_individual_person(array $data): array;       // ['valid','errors']
function validate_individual_declaration(array $data): array;
// sanitize_submission_input also cleans the new single-line/multiline fields and the two array fields
```

Messages (client mirrors exactly): `Full name is required.` (fullName), `Date of birth is required.` (dateOfBirth), `Place of birth is required.` (placeOfBirth), `Select a gender.` (gender), `Nationality is required.`, `Country of residence is required.` (countryOfResidence), `Residential address is required.`, `LGA is required.` (lga), `State is required.`, `Phone number is required.` (phone), `Email is required.` / `Enter a valid email address.` (email), `Select at least one means of ID.` (meansOfId), `ID number is required.` (idNumber), `BVN is required.`, `NIN is required.`, `Occupation is required.`, `Select a source of income.` (sourceOfIncome), `Please specify the source of income.` (sourceOfIncomeOther, only when `other`), `Source of wealth is required.`, `Select the purpose of the relationship.` (purposeOfRelationship), `Please specify the purpose.` (purposeOther, only when `other`), `Expected monthly turnover is required.`, `Select at least one transaction type.` (expectedTransactionTypes). Declaration: `Name is required.` (declarationName), `Typed signature is required.` (signatureName), `Signature date is required.` (signatureDate), `You must confirm this constitutes your signature.` (signatureAgree). Optional (no error): idExpiry, employerName, officeAddress.

- [ ] **Step 1: Failing tests** — append to `tests/php/test_validator.php` before `test_summary();`:

```php
function valid_person(array $o = []): array {
    return array_replace([
        'fullName'=>'Jane Doe','dateOfBirth'=>'1990-01-01','placeOfBirth'=>'Lagos','gender'=>'F','nationality'=>'Nigerian',
        'countryOfResidence'=>'Nigeria','residentialAddress'=>'1 Rd','lga'=>'Ikeja','state'=>'Lagos','phone'=>'08000000000','email'=>'jane@example.com',
        'meansOfId'=>['nin','passport'],'idNumber'=>'A123','bvn'=>'222','nin'=>'333','occupation'=>'Engineer',
        'sourceOfIncome'=>'salary','sourceOfWealth'=>'Savings','purposeOfRelationship'=>'loan',
        'expectedMonthlyTurnover'=>'500,000','expectedTransactionTypes'=>['transfer'],
    ], $o);
}
test_case('validate_individual_person flags every required field when empty, but not the optional ones', function () {
    $r = validate_individual_person([]);
    foreach (['fullName','dateOfBirth','placeOfBirth','gender','nationality','countryOfResidence','residentialAddress','lga','state','phone','email','meansOfId','idNumber','bvn','nin','occupation','sourceOfIncome','sourceOfWealth','purposeOfRelationship','expectedMonthlyTurnover','expectedTransactionTypes'] as $k) assert_true(isset($r['errors'][$k]), $k);
    foreach (['idExpiry','employerName','officeAddress','sourceOfIncomeOther','purposeOther'] as $k) assert_true(!isset($r['errors'][$k]), $k);
});
test_case('validate_individual_person passes a complete person and checks the email', function () {
    assert_equal(true, validate_individual_person(valid_person())['valid']);
    assert_equal('Enter a valid email address.', validate_individual_person(valid_person(['email'=>'nope']))['errors']['email']);
});
test_case('validate_individual_person: Other needs its text, other choices do not', function () {
    assert_equal('Please specify the source of income.', validate_individual_person(valid_person(['sourceOfIncome'=>'other']))['errors']['sourceOfIncomeOther']);
    assert_equal('Please specify the purpose.', validate_individual_person(valid_person(['purposeOfRelationship'=>'other']))['errors']['purposeOther']);
    assert_equal(true, validate_individual_person(valid_person(['sourceOfIncome'=>'other','sourceOfIncomeOther'=>'Gift','purposeOfRelationship'=>'other','purposeOther'=>'Trade']))['valid']);
    assert_true(!isset(validate_individual_person(valid_person(['sourceOfIncomeOther'=>'']))['errors']['sourceOfIncomeOther']));
});
test_case('validate_individual_person rejects unknown/odd choice values without fataling', function () {
    foreach (['gender'=>'X','sourceOfIncome'=>'lottery','purposeOfRelationship'=>'gift'] as $k => $v) assert_true(isset(validate_individual_person(valid_person([$k=>$v]))['errors'][$k]), $k);
    foreach ([['nin','bogus'], 'nin', [['nin']], [], [1, 2]] as $bad) assert_equal('Select at least one means of ID.', validate_individual_person(valid_person(['meansOfId'=>$bad]))['errors']['meansOfId'], json_encode($bad));
    foreach ([['cash','bogus'], 'cash', [], [['cash']]] as $bad) assert_equal('Select at least one transaction type.', validate_individual_person(valid_person(['expectedTransactionTypes'=>$bad]))['errors']['expectedTransactionTypes'], json_encode($bad));
    assert_true(isset(validate_individual_person(valid_person(['fullName'=>['x']]))['errors']['fullName']));
});
test_case('validate_individual_declaration requires name, signature, date and agreement', function () {
    $r = validate_individual_declaration([]);
    foreach (['declarationName','signatureName','signatureDate','signatureAgree'] as $k) assert_true(isset($r['errors'][$k]), $k);
    assert_equal(true, validate_individual_declaration(['declarationName'=>'A','signatureName'=>'A','signatureDate'=>'2026-01-01','signatureAgree'=>'on'])['valid']);
});
test_case('sanitize_submission_input cleans individual fields and array fields', function () {
    $r = sanitize_submission_input(['fullName'=>"Jane\r\nBcc: x", 'residentialAddress'=>"1 Rd\r\nLagos", 'officeAddress'=>"2 Rd\x00", 'meansOfId'=>["nin\r\n", ['x'], 5, 'bvn'], 'expectedTransactionTypes'=>'cash']);
    assert_equal('JaneBcc: x', $r['fullName']);
    assert_equal("1 Rd\nLagos", $r['residentialAddress']);
    assert_equal('2 Rd', $r['officeAddress']);
    assert_equal(['nin', 'bvn'], $r['meansOfId']);
    assert_equal('cash', $r['expectedTransactionTypes']);
});
```

- [ ] **Step 2:** `php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_validator.php` → FAIL (undefined functions).
- [ ] **Step 3: Implement** in `lib/validator.php`. Add constants after `MAX_DIRECTORS`:

```php
const INDIVIDUAL_DOCUMENT_IDS = ['valid_means_of_id', 'proof_of_address', 'passport_photograph', 'signature_mandate_card'];
const MEANS_OF_ID = ['nin', 'bvn', 'passport', 'drivers_license', 'voters_card'];
const TRANSACTION_TYPES = ['cash', 'transfer', 'cheque'];
const SOURCE_OF_INCOME_OPTIONS = ['salary', 'business', 'investment', 'inheritance', 'other'];
const PURPOSE_OPTIONS = ['loan', 'lease', 'investment', 'other'];
const ARRAY_TEXT_FIELDS = ['meansOfId', 'expectedTransactionTypes'];
```

Extend `SINGLE_LINE_TEXT_FIELDS` with `'fullName','dateOfBirth','placeOfBirth','gender','nationality','countryOfResidence','lga','state','phone','email','idNumber','idExpiry','bvn','nin','occupation','employerName','sourceOfIncome','sourceOfIncomeOther','sourceOfWealth','purposeOfRelationship','purposeOther','expectedMonthlyTurnover','declarationName','signatureName','signatureDate'` and `MULTILINE_TEXT_FIELDS` with `'residentialAddress','officeAddress'`. In `sanitize_submission_input`, before the directors block:

```php
    foreach (ARRAY_TEXT_FIELDS as $field) {
        if (isset($post[$field]) && is_array($post[$field])) {
            $clean = [];
            foreach ($post[$field] as $item) {
                if (is_string($item)) {
                    $clean[] = sanitize_text($item);
                }
            }
            $post[$field] = $clean;
        }
    }
```

Add the validators:

```php
function is_choice($value, array $options): bool
{
    return is_string($value) && in_array($value, $options, true);
}

function are_choices($value, array $options): bool
{
    if (!is_array($value) || count($value) === 0) {
        return false;
    }
    foreach ($value as $item) {
        if (!is_choice($item, $options)) {
            return false;
        }
    }
    return true;
}

function validate_individual_person(array $data): array
{
    $errors = [];
    $required = [
        'fullName' => 'Full name is required.', 'dateOfBirth' => 'Date of birth is required.',
        'placeOfBirth' => 'Place of birth is required.', 'nationality' => 'Nationality is required.',
        'countryOfResidence' => 'Country of residence is required.', 'residentialAddress' => 'Residential address is required.',
        'lga' => 'LGA is required.', 'state' => 'State is required.', 'phone' => 'Phone number is required.',
        'idNumber' => 'ID number is required.', 'bvn' => 'BVN is required.', 'nin' => 'NIN is required.',
        'occupation' => 'Occupation is required.', 'sourceOfWealth' => 'Source of wealth is required.',
        'expectedMonthlyTurnover' => 'Expected monthly turnover is required.',
    ];
    foreach ($required as $field => $message) {
        if (is_blank($data[$field] ?? null)) $errors[$field] = $message;
    }
    if (!is_choice($data['gender'] ?? null, ['M', 'F'])) $errors['gender'] = 'Select a gender.';
    $email = $data['email'] ?? null;
    if (is_blank($email)) {
        $errors['email'] = 'Email is required.';
    } elseif (!is_valid_email((string) $email)) {
        $errors['email'] = 'Enter a valid email address.';
    }
    if (!are_choices($data['meansOfId'] ?? null, MEANS_OF_ID)) $errors['meansOfId'] = 'Select at least one means of ID.';
    $income = $data['sourceOfIncome'] ?? null;
    if (!is_choice($income, SOURCE_OF_INCOME_OPTIONS)) {
        $errors['sourceOfIncome'] = 'Select a source of income.';
    } elseif ($income === 'other' && is_blank($data['sourceOfIncomeOther'] ?? null)) {
        $errors['sourceOfIncomeOther'] = 'Please specify the source of income.';
    }
    $purpose = $data['purposeOfRelationship'] ?? null;
    if (!is_choice($purpose, PURPOSE_OPTIONS)) {
        $errors['purposeOfRelationship'] = 'Select the purpose of the relationship.';
    } elseif ($purpose === 'other' && is_blank($data['purposeOther'] ?? null)) {
        $errors['purposeOther'] = 'Please specify the purpose.';
    }
    if (!are_choices($data['expectedTransactionTypes'] ?? null, TRANSACTION_TYPES)) {
        $errors['expectedTransactionTypes'] = 'Select at least one transaction type.';
    }
    return validation_result($errors);
}

function validate_individual_declaration(array $data): array
{
    $errors = [];
    if (is_blank($data['declarationName'] ?? null)) $errors['declarationName'] = 'Name is required.';
    if (is_blank($data['signatureName'] ?? null)) $errors['signatureName'] = 'Typed signature is required.';
    if (is_blank($data['signatureDate'] ?? null)) $errors['signatureDate'] = 'Signature date is required.';
    if (empty($data['signatureAgree'])) $errors['signatureAgree'] = 'You must confirm this constitutes your signature.';
    return validation_result($errors);
}
```

- [ ] **Step 4:** Run the validator suite → all pass.
- [ ] **Step 5: Commit** `feat(backend): individual customer validation`.

---

### Task 2: PDF builder and mailer — Individual (TDD)

**Files:** Modify `lib/pdf-builder.php`, `lib/mailer.php`, `preview.php`; Modify `tests/php/test_pdf_builder.php`, `tests/php/test_mailer.php`.

**Interfaces — Produces:**

```php
// $data for individual (built by the handler in Task 3)
['customerType'=>'individual','submittedAt'=>..,'fields'=>[/* sanitised POST */],'documents'=>[['id','label','submitted']],'consent'=>bool]
const MEANS_OF_ID_LABELS, TRANSACTION_TYPE_LABELS, SOURCE_OF_INCOME_LABELS, PURPOSE_LABELS;   // value → display text
function individual_pdf_sections(array $data): array;    // same ['title','groups'=>[['subtitle','rows']]] shape as corporate
function build_individual_pdf(array $data): string;
function build_submission_pdf(array $data): string;     // dispatch: corporate|individual, else throw InvalidArgumentException
function submission_summary(array $data): array;        // ['kind','nameLabel','name','email']; corporate: nameLabel 'Company'; individual: kind 'Individual KYC / CDD', nameLabel 'Customer'
```

- [ ] **Step 1: Failing tests.** `test_pdf_builder.php` — add `sample_individual_data()` (customerType `individual`, `fields` = a full valid person incl. `declarationName 'Jane Doe'`, `signatureName`, `signatureDate '2026-09-15'`, `meansOfId ['nin','drivers_license']`, `expectedTransactionTypes ['cash','transfer']`, `sourceOfIncome 'other'` + `sourceOfIncomeOther 'Gift'`, `purposeOfRelationship 'loan'`, `gender 'F'`; `documents` two rows; `consent true`) and tests:

```php
test_case('build_submission_pdf renders an individual submission', function () {
    $pdf = build_submission_pdf(sample_individual_data());
    assert_true(strpos($pdf, '%PDF-') === 0); assert_true(strlen($pdf) > 1000);
});
test_case('individual_pdf_sections lists sections A-C and formats choices', function () {
    $s = individual_pdf_sections(sample_individual_data());
    assert_equal(['Section A: Customer Information','Section B: Verification Documents','Section C: Declaration'], array_map(fn($x) => $x['title'], $s));
    $a = array_column($s[0]['groups'][0]['rows'], 1, 0);
    assert_equal('Female', $a['Gender']); assert_equal('NIN, Driver\'s License', $a['Means of ID']);
    assert_equal('Other: Gift', $a['Source of Income']); assert_equal('Loan', $a['Purpose of Relationship']);
    assert_equal('Cash, Transfer', $a['Expected Transaction Type']); assert_equal('500,000', $a['Expected Monthly Turnover (NGN)']);
    $b = array_column($s[1]['groups'][0]['rows'], 1, 0);
    assert_equal('Submitted', $b['Valid Means of ID']); assert_equal('Given', $b['Consent to processing']);
    $c = array_column($s[2]['groups'][0]['rows'], 1, 0);
    assert_equal('Jane Doe', $c['Name']); assert_equal('2026-09-15', $c['Date']);
});
test_case('individual sections tolerate missing/odd fields', function () {
    $d = sample_individual_data(); $d['fields']['meansOfId'] = 'nin'; unset($d['fields']['expectedTransactionTypes']); $d['fields']['gender'] = 'X';
    $s = individual_pdf_sections($d); $a = array_column($s[0]['groups'][0]['rows'], 1, 0);
    assert_equal('', $a['Means of ID']); assert_equal('', $a['Expected Transaction Type']); assert_equal('', $a['Gender']);
    assert_true(strpos(build_submission_pdf($d), '%PDF-') === 0);
});
test_case('build_submission_pdf rejects an unknown customer type', function () {
    $threw = false; try { build_submission_pdf(['customerType' => 'partnership']); } catch (InvalidArgumentException $e) { $threw = true; }
    assert_true($threw);
});
```

`test_mailer.php` — add:

```php
test_case('submission_summary describes an individual', function () {
    $d = ['customerType'=>'individual','fields'=>['fullName'=>'Jane Doe','email'=>'jane@example.com']];
    assert_equal(['kind'=>'Individual KYC / CDD','nameLabel'=>'Customer','name'=>'Jane Doe','email'=>'jane@example.com'], submission_summary($d));
});
test_case('individual admin subject and confirmation go to the person', function () {
    $fakes = []; $factory = function () use (&$fakes) { return $fakes[] = new FakePHPMailer(); };
    $d = ['customerType'=>'individual','submittedAt'=>'x','fields'=>['fullName'=>'Jane Doe','email'=>'jane@example.com']];
    $r = send_submission_emails($d, '%PDF', [], $factory);
    assert_equal(true, $r['success']); assert_equal('New Individual KYC / CDD Submission — Jane Doe', $fakes[0]->Subject);
    assert_equal(['jane@example.com'], $fakes[1]->sentTo);
    assert_true(strpos(build_admin_email_html($d), 'Jane Doe') !== false); assert_true(strpos(build_confirmation_email_html($d), 'Individual KYC / CDD') !== false);
});
```

and update the existing corporate summary test's expected array to include `'nameLabel' => 'Company'`.

- [ ] **Step 2:** run both suites → FAIL.
- [ ] **Step 3: Implement `lib/pdf-builder.php`.** Extract the body of `build_corporate_pdf` into:

```php
function render_pdf(string $title, string $subject, array $data, array $sections): string
{
    $pdf = new TCPDF('P', 'mm', 'A4', true, 'UTF-8', false);
    $pdf->SetCreator('Woodhall Capital KYC Form');
    $pdf->SetAuthor('Woodhall Capital');
    $pdf->SetTitle($title . ' — ' . $subject);
    /* … identical to the current build_corporate_pdf body from setPrintHeader through the section loop,
       with the heading Cell text = $title and the loop iterating $sections … */
    return $pdf->Output('', 'S');
}

function build_corporate_pdf(array $data): string
{
    return render_pdf('Corporate KYC / CDD Submission', (string) ($data['fields']['companyName'] ?? ''), $data, corporate_pdf_sections($data));
}

function build_individual_pdf(array $data): string
{
    return render_pdf('Individual KYC / CDD Submission', (string) ($data['fields']['fullName'] ?? ''), $data, individual_pdf_sections($data));
}

function build_submission_pdf(array $data): string
{
    switch ($data['customerType'] ?? '') {
        case 'corporate':
            return build_corporate_pdf($data);
        case 'individual':
            return build_individual_pdf($data);
        default:
            throw new InvalidArgumentException('Unsupported customer type.');
    }
}
```

(Do the extraction under the existing green corporate PDF tests; the corporate sample data carries `customerType => 'corporate'`.) Add label maps and sections:

```php
const MEANS_OF_ID_LABELS = ['nin' => 'NIN', 'bvn' => 'BVN', 'passport' => "Int'l Passport", 'drivers_license' => "Driver's License", 'voters_card' => "Voter's Card"];
const TRANSACTION_TYPE_LABELS = ['cash' => 'Cash', 'transfer' => 'Transfer', 'cheque' => 'Cheque'];
const SOURCE_OF_INCOME_LABELS = ['salary' => 'Salary', 'business' => 'Business', 'investment' => 'Investment', 'inheritance' => 'Inheritance', 'other' => 'Other'];
const PURPOSE_LABELS = ['loan' => 'Loan', 'lease' => 'Lease', 'investment' => 'Investment', 'other' => 'Other'];

function pdf_choice_list($values, array $labels): string
{
    if (!is_array($values)) {
        return '';
    }
    $out = [];
    foreach ($values as $v) {
        if (is_string($v) && isset($labels[$v])) {
            $out[] = $labels[$v];
        }
    }
    return implode(', ', $out);
}

function pdf_choice_with_other($value, array $labels, $other): string
{
    if (!is_string($value) || !isset($labels[$value])) {
        return '';
    }
    return $value === 'other' && is_string($other) && $other !== '' ? 'Other: ' . $other : $labels[$value];
}

function individual_pdf_sections(array $data): array
{
    $f = $data['fields'] ?? [];
    $v = fn(string $k): string => is_string($f[$k] ?? null) ? $f[$k] : '';
    $gender = ['M' => 'Male', 'F' => 'Female'][$f['gender'] ?? ''] ?? '';
    $docRows = array_map(
        fn(array $doc): array => [$doc['label'], !empty($doc['submitted']) ? 'Submitted' : 'Not submitted'],
        $data['documents'] ?? []
    );
    $docRows[] = ['Consent to processing', !empty($data['consent']) ? 'Given' : 'Not given'];

    return [
        ['title' => 'Section A: Customer Information', 'groups' => [['subtitle' => null, 'rows' => [
            ['Full Name', $v('fullName')], ['Date of Birth', $v('dateOfBirth')], ['Place of Birth', $v('placeOfBirth')], ['Gender', $gender],
            ['Nationality', $v('nationality')], ['Country of Residence', $v('countryOfResidence')],
            ['Residential Address', $v('residentialAddress')], ['LGA', $v('lga')], ['State', $v('state')],
            ['Phone No', $v('phone')], ['Email', $v('email')],
            ['Means of ID', pdf_choice_list($f['meansOfId'] ?? null, MEANS_OF_ID_LABELS)],
            ['ID No', $v('idNumber')], ['ID Expiry Date', $v('idExpiry')], ['BVN', $v('bvn')], ['NIN', $v('nin')],
            ['Occupation', $v('occupation')], ['Employer/Business Name', $v('employerName')], ['Office Address', $v('officeAddress')],
            ['Source of Income', pdf_choice_with_other($f['sourceOfIncome'] ?? null, SOURCE_OF_INCOME_LABELS, $f['sourceOfIncomeOther'] ?? null)],
            ['Source of Wealth', $v('sourceOfWealth')],
            ['Purpose of Relationship', pdf_choice_with_other($f['purposeOfRelationship'] ?? null, PURPOSE_LABELS, $f['purposeOther'] ?? null)],
            ['Expected Monthly Turnover (NGN)', $v('expectedMonthlyTurnover')],
            ['Expected Transaction Type', pdf_choice_list($f['expectedTransactionTypes'] ?? null, TRANSACTION_TYPE_LABELS)],
        ]]]],
        ['title' => 'Section B: Verification Documents', 'groups' => [['subtitle' => null, 'rows' => $docRows]]],
        ['title' => 'Section C: Declaration', 'groups' => [['subtitle' => null, 'rows' => [
            ['Declaration', 'I hereby declare that the information provided is true and correct. I authorize Woodhall Capital to verify my details with NIBSS, NIMC, Credit Bureaus and report to NFIU/CBN as required by law.'],
            ['Name', $v('declarationName')], ['Typed Signature', $v('signatureName')], ['Date', $v('signatureDate')],
            ['Typed signature agreed', 'Yes'],
        ]]]],
    ];
}
```

- [ ] **Step 4: Implement `lib/mailer.php`.** Replace `submission_summary` with:

```php
function submission_summary(array $data): array
{
    $fields = $data['fields'] ?? [];
    $str = fn(string $k): string => is_string($fields[$k] ?? null) ? $fields[$k] : '';
    if (($data['customerType'] ?? 'corporate') === 'individual') {
        return ['kind' => 'Individual KYC / CDD', 'nameLabel' => 'Customer', 'name' => $str('fullName'), 'email' => $str('email')];
    }
    return ['kind' => 'Corporate KYC / CDD', 'nameLabel' => 'Company', 'name' => $str('companyName'), 'email' => $str('companyEmail')];
}
```

`build_admin_email_html`: heading `"New {$kind} Submission"`, paragraph `<strong>{nameLabel}:</strong> {name}` (escape all four via `htmlspecialchars`, `$summary = submission_summary($data)`). `build_confirmation_email_html`: `"We have received the {kind} submission for <strong>{name}</strong>."`. `send_submission_emails` already uses the summary for subject/recipient.

- [ ] **Step 5: `preview.php`** — add a `preview_individual_data()` and use it when `($_GET['type'] ?? '') === 'individual'` (a valid person like the PDF test's, plus the four individual documents with their labels and `consent`); default stays corporate. Only `build_*` functions are called.
- [ ] **Step 6:** run `test_pdf_builder.php`, `test_mailer.php`, `php -l preview.php` → pass. Render an individual sample PDF to a scratch file and view page 1 to check the layout.
- [ ] **Step 7: Commit** `feat(backend): individual PDF layout and mailer summary`.

---

### Task 3: Submission handler — Individual (TDD)

**Files:** Modify `lib/submission-handler.php`, `tests/php/test_submission_handler.php`.

**Interfaces — Consumes:** Tasks 1–2. **Produces:** `handle_submission` accepts `customerType=individual`; `const INDIVIDUAL_DOCUMENT_LABELS`; `parse_documents_input(array $post, array $files, array $ids, array $labels): array`; `collect_uploads(array $documents, array $files, int $directorCount = 0, bool $withSeal = false): array`; `deliver_submission(array $data, array $uploads, callable $sendEmails): array` (PDF → send → cleanup → result).

Refactor first under the existing green tests: move the tail of `handle_corporate_submission` (attachments, PDF, send, cleanup, result) into `deliver_submission`, generalise `parse_documents_input` and `collect_uploads` as above, and pass `CORPORATE_DOCUMENT_IDS/LABELS`, `min(count($rows), MAX_DIRECTORS)`, `true` from the corporate path. Then add the individual path:

```php
const INDIVIDUAL_DOCUMENT_LABELS = [
    'valid_means_of_id' => 'Valid Means of ID',
    'proof_of_address' => 'Proof of Address (less than 3 months): Utility Bill / Bank Statement',
    'passport_photograph' => 'Passport Photograph',
    'signature_mandate_card' => 'Signature Mandate Card',
];

function collect_upload_errors(array $uploads, array &$errors): array   // returns the checkable entries; adds PHP-level upload errors
{ /* the PHP-error loop + validate_uploads merge that currently lives in handle_corporate_submission */ }

function handle_individual_submission(array $post, array $files, callable $sendEmails): array
{
    $documents = parse_documents_input($post, $files, INDIVIDUAL_DOCUMENT_IDS, INDIVIDUAL_DOCUMENT_LABELS);
    $consent = !empty($post['consent']);
    $errors = array_merge(
        validate_individual_person($post)['errors'],
        validate_documents_consent($consent)['errors'],
        validate_individual_declaration($post)['errors']
    );
    $uploads = collect_uploads($documents, $files);
    $errors = array_merge($errors, collect_upload_errors($uploads, $errors));  // adds PHP-level + type/size/_total errors
    if (count($errors) > 0) {
        return failure($errors);
    }
    $data = [
        'customerType' => 'individual', 'submittedAt' => date('Y-m-d H:i:s'), 'fields' => $post,
        'documents' => array_map(fn(array $d): array => ['id' => $d['id'], 'label' => $d['label'], 'submitted' => $d['submitted']], $documents),
        'consent' => $consent,
    ];
    return deliver_submission($data, $uploads, $sendEmails);
}
```

and in `handle_submission` replace the single-type check with a `switch` on `$post['customerType'] ?? null` (`'corporate'`, `'individual'`, default → `failure(['customerType' => 'Unsupported customer type.'])`).

- [ ] **Step 1: Failing tests** — in `test_submission_handler.php`: change the "unsupported customerType" case's `['customerType'=>'individual']` to `['customerType'=>'partnership']`, then add `sample_individual_post()` (a valid person as in Task 1 plus `'customerType'=>'individual','documents'=>['valid_means_of_id'=>['submitted'=>'on']],'consent'=>'on','declarationName'=>'Jane Doe','signatureName'=>'Jane Doe','signatureDate'=>'2026-09-15','signatureAgree'=>'on'`) and:

```php
test_case('individual: empty submission returns field errors', function () {
    $r = handle_submission(['customerType'=>'individual'], []);
    foreach (['fullName','email','meansOfId','consent','declarationName'] as $k) assert_true(isset($r['errors'][$k]), $k);
});
test_case('individual: succeeds and hands the sender the individual data shape', function () {
    $d = null; $r = handle_submission(sample_individual_post(), [], ok_sender($d));
    assert_equal(true, $r['success']); assert_equal('individual', $d['customerType']);
    assert_equal('Jane Doe', $d['fields']['fullName']); assert_equal(['nin','passport'], $d['fields']['meansOfId']);
    assert_equal(4, count($d['documents'])); assert_equal(true, $d['documents'][0]['submitted']); assert_equal(true, $d['consent']);
});
test_case('individual: hostile array shapes are rejected, not fatal', function () {
    foreach ([['meansOfId'=>'nin'], ['meansOfId'=>[['nin']]], ['expectedTransactionTypes'=>[['cash']]], ['documents'=>'x']] as $o) {
        $r = handle_submission(sample_individual_post($o), [], ok_sender()); assert_equal(false, $r['success'], json_encode($o));
    }
});
test_case('individual: strips header injection from text fields', function () {
    $d = null; handle_submission(sample_individual_post(['fullName'=>"Jane\r\nBcc: a@evil.com", 'email'=>"jane@example.com"]), [], ok_sender($d));
    assert_equal('JaneBcc: a@evil.com', $d['fields']['fullName']);
});
test_case('individual: attaches a ticked document with a slot-prefixed name; ignores an unticked bad file', function () {
    $a = tmp_file(); $b = tmp_file(); $att = null;
    $files = merge_files(files_entry('documents', ['valid_means_of_id','file'], upload('id.pdf', $a)), files_entry('documents', ['passport_photograph','file'], upload('x.exe', $b)));
    $r = handle_submission(sample_individual_post(), $files, ok_sender($d, $att));
    assert_equal(true, $r['success']); assert_equal(['valid_means_of_id - id.pdf'], array_column($att, 'originalName'));
    assert_true(!file_exists($a)); @unlink($b);
});
test_case('individual: blocks a ticked document with a disallowed type and a PHP-level upload failure', function () {
    $tmp = tmp_file(); $called = false;
    $post = sample_individual_post(['documents'=>['valid_means_of_id'=>['submitted'=>'on'], 'proof_of_address'=>['submitted'=>'on']]]);
    $files = merge_files(files_entry('documents', ['valid_means_of_id','file'], upload('virus.exe', $tmp)), files_entry('documents', ['proof_of_address','file'], upload('big.pdf', '', 0, UPLOAD_ERR_INI_SIZE)));
    $r = handle_submission($post, $files, function () use (&$called) { $called = true; return ['success'=>true,'error'=>null]; });
    assert_equal('File type not allowed: virus.exe', $r['errors']['valid_means_of_id']); assert_true(isset($r['errors']['proof_of_address'])); assert_true(!$called); @unlink($tmp);
});
test_case('individual: email failures do not expose internals', function () {
    $r = handle_submission(sample_individual_post(), [], fn() => ['success'=>false,'error'=>'SMTP down']);
    assert_equal(false, $r['success']); assert_true(strpos($r['message'], 'SMTP') === false);
});
test_case('a corporate post still works after the refactor', function () {
    $r = handle_submission(sample_post(), [], ok_sender()); assert_equal(true, $r['success']);
});
```

- [ ] **Step 2:** run `test_submission_handler.php` → the new tests FAIL (corporate ones stay green through the refactor).
- [ ] **Step 3: Implement** as above. After the refactor, all 13 existing handler tests must still pass before adding the individual path.
- [ ] **Step 4:** run all four PHP suites and `php -l submit.php lib/*.php` → pass.
- [ ] **Step 5: Commit** `feat(backend): individual submission handler`.

---

### Task 4: Frontend types, validation and flow config — Individual (TDD)

**Files:** Modify `frontend/src/types.ts`, `lib/validation.ts`, `lib/documents.ts`, `test-utils.ts`, `flows/corporate.ts`; Create `flows/narrow.ts`, `flows/individual.ts`; Modify `lib/validation.test.ts`, `flows/corporate.test.ts`; Create `flows/individual.test.ts`.

**Interfaces — Produces:**

```ts
// types.ts
export type CustomerType = 'corporate' | 'individual';
export type MeansOfId = 'nin' | 'bvn' | 'passport' | 'drivers_license' | 'voters_card';
export type TransactionType = 'cash' | 'transfer' | 'cheque';
export type Gender = '' | 'M' | 'F';
export type IncomeSource = '' | 'salary' | 'business' | 'investment' | 'inheritance' | 'other';
export type Purpose = '' | 'loan' | 'lease' | 'investment' | 'other';
export interface IndividualPerson { fullName; dateOfBirth; placeOfBirth; nationality; countryOfResidence; residentialAddress; lga; state; phone; email; idNumber; idExpiry; bvn; nin; occupation; employerName; officeAddress; sourceOfIncomeOther; sourceOfWealth; purposeOther; expectedMonthlyTurnover: string; gender: Gender; meansOfId: MeansOfId[]; sourceOfIncome: IncomeSource; purposeOfRelationship: Purpose; expectedTransactionTypes: TransactionType[] }
export interface IndividualDeclaration { declarationName: string; signatureName: string; signatureDate: string; signatureAgree: boolean }
export interface CorporateForm { customerType: 'corporate'; /* existing FormState fields: entity, directors, docs, consent, funds, declaration, seal */ }
export interface IndividualForm { customerType: 'individual'; person: IndividualPerson; docs: Record<string, DocState>; consent: boolean; declaration: IndividualDeclaration }
export type FormState = CorporateForm | IndividualForm;
// validation.ts (new / changed)
export const INDIVIDUAL_DOCUMENT_IDS: readonly string[];
export const MEANS_OF_ID_OPTIONS, TRANSACTION_TYPE_OPTIONS, INCOME_OPTIONS, PURPOSE_OPTIONS;   // [{value,label}]
export function collectUploads(form: CorporateForm): { key: string; file: File }[];              // param type narrowed
export function validateIndividualPerson(p: Partial<IndividualPerson>): Errors;
export function validateIndividualDocuments(form: IndividualForm): Errors;   // consent + ticked-doc meta + _total
export function validateIndividualDeclaration(d: Partial<IndividualDeclaration>): Errors;
// flows/narrow.ts
export function asCorporate(f: FormState): CorporateForm; export function asIndividual(f: FormState): IndividualForm;   // throw on mismatch
// flows/individual.ts
export const individualFlow: Flow;  // steps: person, documents, declaration
```

Rename every existing use of the old corporate `FormState` type (in `validation.ts`, `flows/corporate.ts`, `lib/*`, `test-utils.ts`) to `CorporateForm`; `makeForm()` in `test-utils.ts` returns a `CorporateForm` with `customerType: 'corporate'`; add `makeIndividual(o?)` (a blank `IndividualForm`, `customerType:'individual'`, docs for the 4 ids) and `validPerson` (a complete valid `IndividualPerson`).

`flows/corporate.ts`: every step validator/touchKeys narrows with `asCorporate(f)`; `FLOWS: Record<CustomerType, Flow> = { corporate: corporateFlow, individual: individualFlow }`.

`flows/individual.ts`:

```ts
const PERSON_FIELDS = ['fullName','dateOfBirth','placeOfBirth','gender','nationality','countryOfResidence','residentialAddress','lga','state','phone','email','meansOfId','idNumber','idExpiry','bvn','nin','occupation','employerName','officeAddress','sourceOfIncome','sourceOfIncomeOther','sourceOfWealth','purposeOfRelationship','purposeOther','expectedMonthlyTurnover','expectedTransactionTypes'];
const DECLARATION_FIELDS = ['declarationName', 'signatureName', 'signatureDate', 'signatureAgree'];
export const individualFlow: Flow = { id: 'individual', steps: [
  step('person', 'Customer Information', PERSON_FIELDS, (f) => validateIndividualPerson(asIndividual(f).person)),
  step('documents', 'Documents', ['consent'], (f) => validateIndividualDocuments(asIndividual(f))),
  step('declaration', 'Declaration', DECLARATION_FIELDS, (f) => validateIndividualDeclaration(asIndividual(f).declaration)),
] };
```

(export the `step()` helper from `flows/corporate.ts` or move it to `flows/step.ts` and import in both.)

`validation.ts` individual code:

```ts
export const MEANS_OF_ID_OPTIONS: { value: MeansOfId; label: string }[] = [
  { value: 'nin', label: 'NIN' }, { value: 'bvn', label: 'BVN' }, { value: 'passport', label: "Int'l Passport" },
  { value: 'drivers_license', label: "Driver's License" }, { value: 'voters_card', label: "Voter's Card" },
];
export const TRANSACTION_TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'cash', label: 'Cash' }, { value: 'transfer', label: 'Transfer' }, { value: 'cheque', label: 'Cheque' },
];
export const INCOME_OPTIONS = [{ value: 'salary', label: 'Salary' }, { value: 'business', label: 'Business' }, { value: 'investment', label: 'Investment' }, { value: 'inheritance', label: 'Inheritance' }, { value: 'other', label: 'Other' }];
export const PURPOSE_OPTIONS = [{ value: 'loan', label: 'Loan' }, { value: 'lease', label: 'Lease' }, { value: 'investment', label: 'Investment' }, { value: 'other', label: 'Other' }];
export const INDIVIDUAL_DOCUMENT_IDS: readonly string[] = ['valid_means_of_id', 'proof_of_address', 'passport_photograph', 'signature_mandate_card'];

function uploadErrors(uploads: { key: string; file: File }[]): Errors {
  const errors: Errors = {};
  let total = 0;
  uploads.forEach(({ key, file }) => {
    const meta = validateFileMeta(file);
    if (!meta.valid) errors[key] = meta.error as string;
    else total += file.size;
  });
  if (total > MAX_TOTAL_SIZE) errors._total = 'Total attachments exceed the 20MB limit.';
  return errors;
}
// validateDocuments(form: CorporateForm) becomes: { ...uploadErrors(collectUploads(form)), ...(form.consent ? {} : { consent: 'Consent to processing is required.' }) }

export function validateIndividualPerson(p: Partial<IndividualPerson>): Errors {
  const errors: Errors = {};
  const required: [keyof IndividualPerson, string][] = [
    ['fullName', 'Full name is required.'], ['dateOfBirth', 'Date of birth is required.'], ['placeOfBirth', 'Place of birth is required.'],
    ['nationality', 'Nationality is required.'], ['countryOfResidence', 'Country of residence is required.'],
    ['residentialAddress', 'Residential address is required.'], ['lga', 'LGA is required.'], ['state', 'State is required.'],
    ['phone', 'Phone number is required.'], ['idNumber', 'ID number is required.'], ['bvn', 'BVN is required.'], ['nin', 'NIN is required.'],
    ['occupation', 'Occupation is required.'], ['sourceOfWealth', 'Source of wealth is required.'],
    ['expectedMonthlyTurnover', 'Expected monthly turnover is required.'],
  ];
  required.forEach(([key, message]) => { if (isBlank(p[key])) errors[key] = message; });
  if (p.gender !== 'M' && p.gender !== 'F') errors.gender = 'Select a gender.';
  if (isBlank(p.email)) errors.email = 'Email is required.';
  else if (!isValidEmail(p.email as string)) errors.email = 'Enter a valid email address.';
  if (!p.meansOfId || p.meansOfId.length === 0) errors.meansOfId = 'Select at least one means of ID.';
  if (!p.sourceOfIncome) errors.sourceOfIncome = 'Select a source of income.';
  else if (p.sourceOfIncome === 'other' && isBlank(p.sourceOfIncomeOther)) errors.sourceOfIncomeOther = 'Please specify the source of income.';
  if (!p.purposeOfRelationship) errors.purposeOfRelationship = 'Select the purpose of the relationship.';
  else if (p.purposeOfRelationship === 'other' && isBlank(p.purposeOther)) errors.purposeOther = 'Please specify the purpose.';
  if (!p.expectedTransactionTypes || p.expectedTransactionTypes.length === 0) errors.expectedTransactionTypes = 'Select at least one transaction type.';
  return errors;
}

export function validateIndividualDocuments(form: IndividualForm): Errors {
  const uploads = INDIVIDUAL_DOCUMENT_IDS.flatMap((id) => { const d = form.docs[id]; return d && d.submitted && d.file ? [{ key: id, file: d.file }] : []; });
  return { ...uploadErrors(uploads), ...(form.consent ? {} : { consent: 'Consent to processing is required.' }) };
}

export function validateIndividualDeclaration(d: Partial<IndividualDeclaration>): Errors {
  const errors: Errors = {};
  if (isBlank(d.declarationName)) errors.declarationName = 'Name is required.';
  if (isBlank(d.signatureName)) errors.signatureName = 'Typed signature is required.';
  if (isBlank(d.signatureDate)) errors.signatureDate = 'Signature date is required.';
  if (!d.signatureAgree) errors.signatureAgree = 'You must confirm this constitutes your signature.';
  return errors;
}
```

`lib/documents.ts` gains `INDIVIDUAL_DOCUMENT_LABELS` (same four labels as the PHP constant).

- [ ] **Step 1: Failing tests.** `validation.test.ts`: keep all M1 cases (types updated via `makeForm`), add: individual required-field flags (all 21 keys present on `{}`; `idExpiry`/`employerName`/`officeAddress`/`sourceOfIncomeOther`/`purposeOther` absent); a full `validPerson` passes; bad email; Other needs text both for income and purpose, and clearing `sourceOfIncome` to a non-other value drops the text error; empty `meansOfId` / `expectedTransactionTypes` errors; `gender: ''` errors; `validateIndividualDocuments`: consent required, unticked bad file ignored, ticked `a.exe` → `errors.valid_means_of_id === 'File type not allowed: a.exe'`, four 4.5MB ticked files → `_total`; `validateIndividualDeclaration` messages. `flows/individual.test.ts`: three steps in order `person, documents, declaration`; ownership of every `PERSON_FIELDS` key → 1, `consent` → 2, `signatureAgree`/`declarationName` → 3, `_total`/`valid_means_of_id`/`customerType` → unowned; each step validates its slice on `makeIndividual()`; `asCorporate(makeIndividual())` and `asIndividual(makeForm())` throw. `flows/corporate.test.ts`: unchanged assertions still pass.
- [ ] **Step 2:** `cd frontend && npx vitest run src/lib/validation.test.ts src/flows` → FAIL.
- [ ] **Step 3: Implement** everything above.
- [ ] **Step 4:** run the same command → pass. (Other frontend suites are expected red until Tasks 5–8: they still use `FormState` as corporate and `state.form`.)
- [ ] **Step 5: Commit** `feat(frontend): individual types, validation and flow`.

---

### Task 5: Initial state, autosave and FormData — Individual (TDD)

**Files:** Modify `frontend/src/lib/initial-state.ts`, `autosave.ts`, `submit.ts`, `test-utils.ts` and their tests.

**Interfaces — Produces:**

```ts
export function initialCorporateForm(): CorporateForm;      // was initialState()
export function initialIndividualForm(): IndividualForm;
export function emptyDirector(): Director;                  // unchanged
// autosave.ts
export type Draft = CorporateDraft | IndividualDraft;        // discriminated on customerType
export interface IndividualDraft { v: 2; customerType: 'individual'; person: Record<string, string | string[]>; declaration: Record<string, string | boolean>; documents: Record<string, boolean>; consent: boolean }
export function serialize(form: FormState): Draft;
export function applyDraft(form: CorporateForm, d: CorporateDraft): CorporateForm;
export function applyIndividualDraft(form: IndividualForm, d: IndividualDraft): IndividualForm;
export function loadDraft(): Draft | null;   // accepts v2 with customerType 'corporate' (or missing → corporate) and 'individual'; rejects others
export function saveDraft(form: FormState): void; clearDraft(): void; hasAnyContent(d: Draft | null): boolean;
// submit.ts
export function buildFormData(form: FormState): FormData;   // switch on customerType
export function postSubmission(form: FormState, fetchImpl?: typeof fetch): Promise<SubmitResult>;
```

Individual FormData: `customerType=individual`; every scalar `person` field by name (including empty strings; `gender` only when set); `meansOfId[]` and `expectedTransactionTypes[]` appended once per chosen value; declaration fields by name (`declarationName`, `signatureName`, `signatureDate`), `signatureAgree=on` when true; `consent=on`; ticked documents as in corporate (`documents[id][submitted]=on` + `documents[id][file]`). Individual draft serialisation stores `person` (arrays preserved), `declaration`, `documents`, `consent`; `applyIndividualDraft` only accepts known string fields, array members that are valid option values (filter unknown), valid `gender`/`sourceOfIncome`/`purposeOfRelationship` values (else `''`), and `signatureAgree === true`.

- [ ] **Step 1: Failing tests** — `autosave.test.ts`: keep the M1 cases (using `initialCorporateForm`), add: individual round-trip (person text + `meansOfId ['nin','voters_card']` + `sourceOfIncome 'other'`/text + docs + consent + agree, no files stored), `loadDraft` accepts an individual draft and a corporate draft with no `customerType`, rejects `customerType: 'partnership'`, `applyIndividualDraft` tolerates malformed input (non-array `meansOfId`, unknown option values, numbers for strings), `hasAnyContent` false for an empty individual draft and true when any checkbox/array/text is set, `serialize` dispatches on the form's discriminator. `submit.test.ts`: keep M1 cases; add the individual contract test (`meansOfId[]` via `fd.getAll('meansOfId[]')` equals the chosen values in order; `expectedTransactionTypes[]` likewise; `customerType`; `email`; ticked doc + file; unticked doc omitted; `consent`/`signatureAgree`; nothing appended for empty arrays).
- [ ] **Step 2:** run `src/lib/autosave.test.ts src/lib/submit.test.ts` → FAIL.
- [ ] **Step 3: Implement.** `initial-state.ts`: rename `initialState` → `initialCorporateForm` (adds `customerType: 'corporate'`), add `initialIndividualForm()`:

```ts
export function initialIndividualForm(): IndividualForm {
  const docs: Record<string, DocState> = {};
  INDIVIDUAL_DOCUMENT_IDS.forEach((id) => { docs[id] = { submitted: false, file: null }; });
  return {
    customerType: 'individual',
    person: {
      fullName: '', dateOfBirth: '', placeOfBirth: '', nationality: '', countryOfResidence: '', residentialAddress: '', lga: '', state: '', phone: '', email: '',
      idNumber: '', idExpiry: '', bvn: '', nin: '', occupation: '', employerName: '', officeAddress: '', sourceOfIncomeOther: '', sourceOfWealth: '',
      purposeOther: '', expectedMonthlyTurnover: '', gender: '', meansOfId: [], sourceOfIncome: '', purposeOfRelationship: '', expectedTransactionTypes: [],
    },
    docs, consent: false,
    declaration: { declarationName: '', signatureName: '', signatureDate: '', signatureAgree: false },
  };
}
```

`autosave.ts`: rename the existing `Draft` to `CorporateDraft` (its `customerType` becomes `'corporate'`, and `loadDraft` fills a missing `customerType` with `'corporate'`), add the individual pieces above, and make `serialize`, `hasAnyContent` switch on `customerType`. `submit.ts`: `buildFormData` switches; the corporate branch is the M1 body unchanged; add `buildIndividualFormData(form: IndividualForm)` with the contract above. `test-utils.ts`: `emptyState = initialCorporateForm`, add `emptyIndividual = initialIndividualForm`.
- [ ] **Step 4:** run the lib + flows suites → pass.
- [ ] **Step 5: Commit** `feat(frontend): individual draft autosave and FormData contract`.

---

### Task 6: Reducer — customer type and active form (TDD)

**Files:** Modify `frontend/src/lib/reducer.ts`, `reducer.test.ts`.

**Interfaces — Produces:**

```ts
export type FieldGroup = 'entity' | 'funds' | 'declaration' | 'person';
export type ChoiceName = 'meansOfId' | 'expectedTransactionTypes';
export interface AppState { customerType: CustomerType | null; corporate: CorporateForm; individual: IndividualForm; step: number; touched: Record<string, boolean>; errors: Errors; status: 'idle'|'submitting'|'done'; draftRestored: boolean }
// new actions: { type: 'selectType'; customerType: CustomerType } | { type: 'clearType' } | { type: 'toggleChoice'; name: ChoiceName; value: string }
export function activeForm(s: AppState): FormState | null;
export function flowOf(s: { customerType: CustomerType | null }): Flow;   // falls back to corporate when null (callers check customerType first)
export function initialAppState(): AppState;                                // customerType: null
export function stepErrors(form: FormState, flow: Flow, step: number): Errors;   // unchanged signature
export function fieldStep(flow: Flow, key: string): number | null;              // unchanged
```

Semantics: before a type is selected only `selectType`, `reset`, `restoreDraft`, `submitting`, `done` do anything (others return the same state). `selectType` sets the type, `step: 1`, clears `touched`/`errors` (each form's data is kept). `clearType` does the same with `customerType: null`. `withForm` writes the form back to `corporate` or `individual` by its discriminator. `setField` applies when `a.group in form` (`declaration` exists on both forms; `person` only individual; `entity`/`funds` only corporate), otherwise no-op. `setConsent`/`setDocSubmitted`/`setDocFile` act on the active form. Directors/seal actions act only when the type is `corporate`. `toggleChoice` acts only on the individual `person` array named (adds if absent, removes if present, keeps option order stable by appending). `restoreDraft` dispatches on `draft.customerType` (sets `customerType`, applies to the matching form, sets `draftRestored`). `reset` returns `initialAppState()` (selector shows again).

- [ ] **Step 1: Failing tests** — update the M1 reducer tests (`s.form.X` → `s.corporate.X`; start each test with `selectType` corporate via a `corp()` helper returning `run(initialAppState(), { type: 'selectType', customerType: 'corporate' })`; `atStep(n)` = `run(corp(), { type: 'goTo', step: n })`) and add:
  - initial state has `customerType: null`; `next`/`setField`/`addDirector` before selecting a type return the identical state object.
  - `selectType` sets type/step 1 and clears touched/errors; selecting corporate, typing a company name, `clearType`, selecting individual, typing a full name, `clearType`, selecting corporate again → both values still present and `errors`/`touched` empty (no leak).
  - individual `next` on empty person sets `errors.fullName`; a fully filled person (`setField` group `person` for scalars + `toggleChoice` for arrays + `gender`/`sourceOfIncome`/`purposeOfRelationship` via `setField`) advances to 2; step 2 with consent → 3.
  - `toggleChoice` adds, removes, and ignores values when the type is corporate; toggling `meansOfId` twice returns to empty.
  - "Other" stale error: set `sourceOfIncome` `other` with blank text, `touch` `sourceOfIncomeOther` → error; then `setField` `sourceOfIncome` `salary` → no `sourceOfIncomeOther` error remains.
  - `setField` with group `person` while corporate is active is a no-op; group `declaration` edits the active form's own declaration.
  - `setConsent`/`setDocSubmitted` on individual write to `individual.docs`/`consent` and leave corporate untouched.
  - `restoreDraft` with an individual draft sets `customerType: 'individual'`, fills `individual.person`, flags `draftRestored`; with a corporate draft sets `'corporate'`; `reset` → `customerType: null`, `draftRestored: false`.
  - `serverErrors({ meansOfId: 'x' })` on individual → step 1; `{ signatureDate: 'x', consent: 'y' }` → step 2; `{ _total: 'x', valid_means_of_id: 'y' }` → unchanged.
  - `fieldStep(FLOWS.individual, …)` mappings; `back` floor and `next` ceiling use the active flow's length (3 for individual, 5 for corporate).
- [ ] **Step 2:** `npx vitest run src/lib/reducer.test.ts` → FAIL.
- [ ] **Step 3: Implement** the reducer (same structure as M1's with the changes above; `activeForm(s)` returns `s.customerType === 'corporate' ? s.corporate : s.customerType === 'individual' ? s.individual : null`; in `reducer`, `const form = activeForm(s)` and an early return for the no-type guard).
- [ ] **Step 4:** run lib + flows suites → pass.
- [ ] **Step 5: Commit** `feat(frontend): customer-type aware reducer`.

---

### Task 7: Components — selector and Individual steps (TDD)

**Files:** Create `components/TypeSelector.tsx`, `ChoiceGroup.tsx`, `CheckboxGroup.tsx`, `DocumentsStep.tsx`, `SubmitActions.tsx`, `IndividualStep1Person.tsx`, `IndividualStep2Documents.tsx`, `IndividualStep3Declaration.tsx`; Modify `TextField.tsx`, `Step2Directors.tsx`, `DirectorRow.tsx`, `Step3Documents.tsx`, `Step5Declaration.tsx`, `steps.test.tsx`.

**Interfaces — Consumes:** Task 6 `AppState`/`Action`/`activeForm`. **Produces:**

```ts
TypeSelector({ onSelect: (t: CustomerType) => void })                       // buttons "Individual customer" / "Corporate customer"
ChoiceGroup({ state, dispatch, group: 'person', name: string, label: string, options: {value:string;label:string}[] })   // radios, role="radiogroup" aria-label=label; touches on change; error from state.errors[name]
CheckboxGroup({ state, dispatch, name: ChoiceName, label, options })      // role="group" aria-label=label; dispatches toggleChoice + touch
DocumentsStep({ state, dispatch, onNext, onBack, heading, intro, ids, labels, nextLabel })   // the current Step3Documents body, reading activeForm(state).docs / .consent
SubmitActions({ state, onBack })                                            // Back + Submit buttons (Submitting… / Submit Form), extracted from Step5Declaration
IndividualStep1Person, IndividualStep2Documents, IndividualStep3Declaration: (props: StepProps) => JSX
TextField: group: 'entity' | 'funds' | 'declaration' | 'person'; type adds 'tel'; value read from the ACTIVE form's group
```

Corporate components change only their state access (`state.form.X` → `state.corporate.X`); `Step3Documents` becomes a thin wrapper around `DocumentsStep` (ids `DOCUMENT_IDS`, labels `DOCUMENT_LABELS`, heading `Section C: Required Documents`, intro `Tick each document submitted and attach a copy where available.`, next label `Next: Source of Funds`); `Step5Declaration` uses `SubmitActions`.

**Behavior contract:**
- `TypeSelector`: heading `Who is this form for?` (Vanitas-safe), two large buttons with one-line descriptions (`Individual customer` — "For a person opening an account or applying for a facility."; `Corporate customer` — "For a company, with its directors and beneficial owners."). Clicking calls `onSelect`.
- `IndividualStep1Person` (`Section A: Customer Information`): fields in order — Full Name, Date of Birth (date), Place of Birth, Gender (`ChoiceGroup`: Male=`M`, Female=`F`), Nationality, Country of Residence, Residential Address (multiline), LGA, State, Phone No (`tel`), Email (email), Means of ID (`CheckboxGroup`, `MEANS_OF_ID_OPTIONS`), ID No, Expiry Date (date; label `Expiry Date (if any)`), BVN, NIN, Occupation, `Employer/Business Name (if any)`, `Office Address (if any)` (multiline), Source of Income (`ChoiceGroup` `INCOME_OPTIONS`; when `other`, a text input `Please specify` id `sourceOfIncomeOther` with its own error), Source of Wealth, Purpose of Relationship (`ChoiceGroup` `PURPOSE_OPTIONS`; `other` reveals `purposeOther` likewise), `Expected Monthly Turnover (₦)`, Expected Transaction Type (`CheckboxGroup`, `TRANSACTION_TYPE_OPTIONS`). Only a `Next: Documents` button plus the "Change customer type" affordance lives in App, not here.
- `IndividualStep2Documents`: `DocumentsStep` with heading `Section B: Verification Documents`, intro `Tick each document submitted and attach a copy where available. Proof of address must be less than 3 months old.`, `INDIVIDUAL_DOCUMENT_IDS` / `INDIVIDUAL_DOCUMENT_LABELS`, next label `Next: Declaration`; same consent checkbox text as corporate.
- `IndividualStep3Declaration` (`Section C: Declaration`): paragraph `I hereby declare that the information provided is true and correct. I authorize Woodhall Capital to verify my details with NIBSS, NIMC, Credit Bureaus and report to NFIU/CBN as required by law.`; TextFields (group `declaration`) `declarationName` (`Name`), `signatureName` (`Typed Signature (type your full name)`), `signatureDate` (`Date`, date); checkbox `signatureAgree` (`I agree that the typed name above constitutes my signature.`); `SubmitActions`.

- [ ] **Step 1: Failing tests** (`steps.test.tsx`, same `Host` pattern but `Host` inits via `forType(type, step)` = reducer-applied `selectType` + `goTo`): update every M1 test for `state.corporate`; add:
  - `TypeSelector` renders both buttons and calls `onSelect` with the right type.
  - `IndividualStep1Person`: required error only after blur (Full Name); all labels above present (`getByLabelText`, scoped with `within(getByRole('group'|'radiogroup', {name}))` for BVN/NIN/Investment to avoid duplicate-label ambiguity); Gender radios set `M`/`F` (readout span); Means of ID checkboxes toggle multiple and untoggle; `Please specify` appears only for Source of Income = Other and is independent of the purpose one, and vanishes when another option is chosen; error text for `meansOfId` renders inside its group; Email invalid message after blur.
  - `IndividualStep2Documents`: 4 labels, file input only after ticking, consent error from state.
  - `IndividualStep3Declaration`: three text fields + agree + submit states (`Submitting…` disabled with Back disabled).
  - Corporate `Step3Documents`/`Step5Declaration` tests keep passing (proves the extraction).
- [ ] **Step 2:** `npx vitest run src/components` → FAIL.
- [ ] **Step 3: Implement** per the contracts (Tailwind classes reuse `Field`, `inputClass`, `Button`; radio/checkbox rows: `<label className="mr-4 inline-block"><input …/> {label}</label>`).
- [ ] **Step 4:** run component tests → pass.
- [ ] **Step 5: Commit** `feat(frontend): type selector and individual step components`.

---

### Task 8: App wiring and end-to-end UI tests (TDD)

**Files:** Modify `frontend/src/App.tsx`, `src/dev/prefill.ts`, `src/App.test.tsx`.

**Interfaces — Consumes:** Tasks 4–7. **Produces:** default export `App`.

Behavior changes vs M1 `App.tsx`:
- Lazy init: `loadDraft()` with content → `reducer(initialAppState(), { type: 'restoreDraft', draft })` (which selects the type); otherwise `customerType` is `null`.
- While `state.customerType === null` the card shows `TypeSelector` (no progress bar, no banner) and selecting dispatches `selectType`.
- `STEP_COMPONENTS: Record<CustomerType, ((p: StepProps) => JSX.Element)[]>` = `{ corporate: [Step1Entity, Step2Directors, Step3Documents, Step4Funds, Step5Declaration], individual: [IndividualStep1Person, IndividualStep2Documents, IndividualStep3Declaration] }`.
- `flow = flowOf(state)`; all step math uses the active flow; `submitterEmail(state)` = `corporate.entity.companyEmail` or `individual.person.email`; `postSubmission(activeForm)`; `saveDraft(activeForm)` (skipped when no type, when `status === 'done'`, and on first mount).
- On step 1 show a small `← Change customer type` text button above the progress bar (dispatches `clearType`); the draft banner still shows when `draftRestored`; "Clear and start over" dispatches `reset` + `clearDraft()` (back to the selector).
- Dev prefill button: `prefillActions(type)` where `type = customerType ?? 'corporate'`, prepending `selectType` when none is selected; corporate data unchanged, plus an individual dataset (valid `person` incl. `toggleChoice` for `meansOfId` `nin` and `passport` and `expectedTransactionTypes` `transfer`, docs `valid_means_of_id` + `proof_of_address` ticked, consent, declaration + agree).

- [ ] **Step 1: Failing tests** (`App.test.tsx`): update the M1 suite — add `chooseCorporate(user)` (clicks `Corporate customer`) at the start of each journey helper (`toDirectors` etc.) and in tests that interact with the form directly; the draft tests now expect the restored flow to be shown without choosing a type (a v2 corporate draft with content → Company Name visible with the banner), a draft with no content → the selector. Add:
  - initial render shows the selector and no progress bar; choosing Individual shows `Section A: Customer Information` with a 3-step progress bar (`Step 1 of 3`… via `getByTestId('progress-step-3')` present, `progress-step-4` absent); choosing Corporate shows 5.
  - `← Change customer type` returns to the selector; typed values survive a round trip within the session.
  - individual journey helpers (`fillPerson`, `toIndividualDocuments`, `toIndividualDeclaration`, `submitIndividual`): empty Next shows `Full name is required.`; filled → Documents; consent required; happy path submit → `fetch` called once with FormData `customerType=individual`, `email`, `meansOfId[]` values, `expectedTransactionTypes[]`, ticked doc; confirmation shows the individual's email; draft removed.
  - individual server error `{ email: 'Email already registered' }` → back on step 1 with the message; `{ signatureDate: 'bad' }` → Declaration... (earliest owning step is 3 → stays) shows message; `{ _total: … }` alert-only; network error / non-JSON alert; double-submit sends one request.
  - an individual draft restores into the individual flow with values (banner visible); a draft with `customerType: 'partnership'` or v1 is ignored (selector shown); "Clear and start over" returns to the selector and removes the key.
  - autosave writes an individual draft after the debounce and does not write anything while on the selector.
- [ ] **Step 2:** `npx vitest run src/App.test.tsx` → FAIL.
- [ ] **Step 3: Implement** the App and prefill changes.
- [ ] **Step 4:** full frontend suite: `cd frontend && npm test && npx tsc -b && npm run build`; `grep -c "Fill test data" dist/assets/*.js` → `0`; `npm run lint` shows no new warnings.
- [ ] **Step 5: Commit** `feat(frontend): customer type selector and individual wizard`.

---

### Task 9: Docs and verification

**Files:** Modify `README.md`.

- [ ] **Step 1: README** — describe both forms (Individual: 3 steps), update structure (`flows/individual.ts`, `TypeSelector`, `DocumentsStep`…), extend "Request contract" with `customerType=individual`, the individual field names, `meansOfId[]`/`expectedTransactionTypes[]` array fields and the four document ids, and drop "backend accepts corporate only".
- [ ] **Step 2: Full verification** — frontend `npm test && npx tsc -b && npm run build`; all four PHP suites; `php -l submit.php lib/*.php preview.php`; `scripts/package.sh` (zip has `assets/logos/`, `submit.php`, no `preview.php`/`tests/`).
- [ ] **Step 3: Visual check (never POST)** — `npx vite --port 5173` only; Playwright (from `~/.npm/_npx/*/node_modules/playwright`) with `fonts.googleapis/gstatic` and `**/submit.php` routes aborted; screenshot the selector, then each step of the Individual flow (using the dev prefill button) at 1024px and 375px; view them. Kill the server.
- [ ] **Step 4: Commit** `docs: describe the individual flow and selector`.

---

## Self-Review

- **Spec coverage:** selector (T6–T8), Individual steps A/B/C with every field, required/optional rules, Other-text rules, ≥1 choices (T1, T4, T7), documents + consent (T3, T4, T7), declaration (T1, T4, T7), PDF layout (T2), email summary/confirmation to the person (T2, T3), contract with array fields (T3, T5), draft per type and restore (T5, T6, T8), README (T9). Internal/official-use sections stay excluded.
- **Type/name consistency:** `CorporateForm`/`IndividualForm`/`FormState`, `AppState.corporate/individual/customerType`, `activeForm`, `flowOf`, `FLOWS`, `asCorporate/asIndividual`, `initialCorporateForm/initialIndividualForm`, `applyDraft/applyIndividualDraft`, `MEANS_OF_ID_OPTIONS` etc. are referenced identically across tasks; PHP constants and label maps match the client option values.
- **Placeholders:** Task 7/8 test bullets enumerate concrete cases and are written out in full during execution (same convention as M1); no TBD/TODO remains.
