<?php
declare(strict_types=1);

require __DIR__ . '/test_helper.php';
require __DIR__ . '/../../lib/validator.php';

function valid_entity(): array
{
    return ['companyName' => 'Acme Ltd', 'rcNumber' => 'RC1', 'dateOfIncorporation' => '2020-01-01', 'registeredAddress' => '1 Main St',
        'natureOfBusiness' => 'Trading', 'tin' => 'T1', 'companyEmail' => 'info@acme.com', 'bankAccountNumber' => '01', 'bankName' => 'First Bank'];
}

function valid_director(array $o = []): array
{
    return array_replace(['name' => 'Jane', 'designation' => 'MD', 'bvn' => '1', 'nin' => '2', 'shareholdingPercent' => '50',
        'nationality' => 'Nigerian', 'pep' => 'no', 'residentialAddress' => '1 Rd'], $o);
}

function int_size(float $mb): int
{
    return (int) ($mb * 1024 * 1024);
}

test_case('validate_entity flags all required fields when empty', function () {
    $r = validate_entity([]);
    assert_equal(false, $r['valid']);
    foreach (['companyName', 'rcNumber', 'dateOfIncorporation', 'registeredAddress', 'natureOfBusiness', 'tin', 'companyEmail', 'bankAccountNumber', 'bankName'] as $k) {
        assert_true(isset($r['errors'][$k]), $k);
    }
    assert_true(!isset($r['errors']['businessAddress']));
});

test_case('validate_entity passes with all required fields and rejects a bad email', function () {
    assert_equal(true, validate_entity(valid_entity())['valid']);
    assert_equal('Enter a valid email address.', validate_entity(array_replace(valid_entity(), ['companyEmail' => 'nope']))['errors']['companyEmail']);
});

test_case('validate_directors requires at least one row and caps the list', function () {
    assert_equal('Add at least one director, signatory or UBO.', validate_directors([])['errors']['directors']);
    assert_equal('Add at least one director, signatory or UBO.', validate_directors('foo')['errors']['directors']);
    assert_equal('Too many directors listed (maximum 25).', validate_directors(array_fill(0, 26, valid_director()))['errors']['directors']);
});

test_case('validate_directors keys errors by row index', function () {
    $r = validate_directors([valid_director(), valid_director(['name' => '', 'pep' => ''])]);
    assert_equal(false, $r['valid']);
    assert_equal('Name is required.', $r['errors']['directors.1.name']);
    assert_equal('Select Yes or No.', $r['errors']['directors.1.pep']);
    assert_true(!isset($r['errors']['directors.0.name']));
});

test_case('validate_directors percentage boundaries', function () {
    foreach (['0', '100', '12.5'] as $ok) {
        assert_equal(true, validate_directors([valid_director(['shareholdingPercent' => $ok])])['valid'], $ok);
    }
    foreach (['abc', '-1', '101', '1e2'] as $bad) {
        assert_equal('Enter a percentage between 0 and 100.', validate_directors([valid_director(['shareholdingPercent' => $bad])])['errors']['directors.0.shareholdingPercent'], $bad);
    }
    assert_equal('% shareholding is required.', validate_directors([valid_director(['shareholdingPercent' => ''])])['errors']['directors.0.shareholdingPercent']);
});

test_case('validate_directors survives non-array rows and array values', function () {
    $r = validate_directors(['oops', valid_director(['name' => ['x']])]);
    assert_equal(false, $r['valid']);
    assert_true(isset($r['errors']['directors.0.name']));
    assert_true(isset($r['errors']['directors.1.name']));
});

test_case('validate_file_meta rejects disallowed extensions', function () {
    assert_equal(false, validate_file_meta(['name' => 'virus.exe', 'size' => 100])['valid']);
});

test_case('validate_file_meta rejects oversized files', function () {
    assert_equal(false, validate_file_meta(['name' => 'doc.pdf', 'size' => 6 * 1024 * 1024])['valid']);
});

test_case('validate_uploads rejects bad types/sizes and flags the 20MB total', function () {
    $r = validate_uploads([['key' => 'a', 'file' => ['name' => 'x.exe', 'size' => 1]], ['key' => 'b', 'file' => ['name' => 'y.pdf', 'size' => 6 * 1024 * 1024]]]);
    assert_equal('File type not allowed: x.exe', $r['errors']['a']);
    assert_equal('File exceeds 5MB limit: y.pdf', $r['errors']['b']);
    $many = array_map(fn($i) => ['key' => "k$i", 'file' => ['name' => "f$i.pdf", 'size' => int_size(4.5)]], range(1, 5));
    assert_true(isset(validate_uploads($many)['errors']['_total']));
    assert_equal(true, validate_uploads([])['valid']);
});

test_case('validate_documents_consent requires consent', function () {
    assert_equal('Consent to processing is required.', validate_documents_consent(false)['errors']['consent']);
    assert_equal(true, validate_documents_consent(true)['valid']);
});

test_case('validate_funds requires both fields', function () {
    assert_equal(['sourceOfFunds', 'facilityAmount'], array_keys(validate_funds([])['errors']));
    assert_equal(true, validate_funds(['sourceOfFunds' => 'Sales', 'facilityAmount' => '5,000,000'])['valid']);
});

test_case('validate_declaration requires both signatories, dates and agreement', function () {
    $r = validate_declaration([]);
    foreach (['signatory1Name', 'signatory1Date', 'signatory2Name', 'signatory2Date', 'signatureAgree'] as $k) {
        assert_true(isset($r['errors'][$k]), $k);
    }
    assert_equal(true, validate_declaration(['signatory1Name' => 'A', 'signatory1Date' => '2026-01-01', 'signatory2Name' => 'B', 'signatory2Date' => '2026-01-01', 'signatureAgree' => 'on'])['valid']);
});

test_case('sanitize_text strips CR/LF and control characters, trims whitespace', function () {
    assert_equal('Acme LtdBcc: evil@example.com', sanitize_text("  Acme Ltd\r\nBcc: evil@example.com  "));
});

test_case('sanitize_text strips null bytes and other control characters', function () {
    assert_equal('AcmeLtd', sanitize_text("Acme\x00\x01\x1FLtd"));
});

test_case('sanitize_multiline_text preserves single newlines but strips other control characters', function () {
    assert_equal("1 Marina Road\nLagosIsland", sanitize_multiline_text("1 Marina Road\r\nLagos\x00Island"));
});

test_case('sanitize_filename strips path components and dangerous characters', function () {
    assert_equal('passwd', sanitize_filename('../../etc/passwd'));
    assert_equal('file.pdf', sanitize_filename('my/file.pdf'));
    assert_equal('my__file.pdf', sanitize_filename('my<>file.pdf'));
    assert_equal('document', sanitize_filename(''));
});

test_case('sanitize_submission_input cleans known fields and leaves other keys alone', function () {
    $r = sanitize_submission_input([
        'companyName' => "Acme\r\nLtd",
        'registeredAddress' => "1 Marina Road\r\nLagos",
        'documents' => ['certificate_of_incorporation' => ['submitted' => '1']],
    ]);
    assert_equal('AcmeLtd', $r['companyName']);
    assert_equal("1 Marina Road\nLagos", $r['registeredAddress']);
    assert_equal(['certificate_of_incorporation' => ['submitted' => '1']], $r['documents']);
});

test_case('sanitize_submission_input cleans director rows, re-indexes, and drops non-array rows', function () {
    $r = sanitize_submission_input(['companyName' => "Acme\r\nLtd", 'directors' => [5 => ['name' => "Jane\r\nBcc: x", 'residentialAddress' => "1 Rd\r\nLagos"], 9 => 'junk']]);
    assert_equal('AcmeLtd', $r['companyName']);
    assert_equal([0], array_keys($r['directors']));
    assert_equal('JaneBcc: x', $r['directors'][0]['name']);
    assert_equal("1 Rd\nLagos", $r['directors'][0]['residentialAddress']);
});

test_case('sanitize_submission_input leaves a non-array directors value alone', function () {
    assert_equal('foo', sanitize_submission_input(['directors' => 'foo'])['directors']);
});

test_case('is_blank treats arrays as blank', function () {
    assert_equal(true, is_blank(['x']));
});

function valid_person(array $o = []): array
{
    return array_replace([
        'fullName' => 'Jane Doe', 'dateOfBirth' => '1990-01-01', 'placeOfBirth' => 'Lagos', 'gender' => 'F', 'nationality' => 'Nigerian',
        'countryOfResidence' => 'Nigeria', 'residentialAddress' => '1 Rd', 'lga' => 'Ikeja', 'state' => 'Lagos', 'phone' => '08000000000', 'email' => 'jane@example.com',
        'meansOfId' => ['nin', 'passport'], 'idNumber' => 'A123', 'bvn' => '222', 'nin' => '333', 'occupation' => 'Engineer', 'employerName' => 'Acme Engineering', 'officeAddress' => '4 Adeola Odeku Street, Victoria Island',
        'sourceOfIncome' => 'salary', 'sourceOfWealth' => 'Savings', 'purposeOfRelationship' => 'loan',
        'expectedMonthlyTurnover' => '500,000', 'expectedTransactionTypes' => ['transfer'],
    ], $o);
}

test_case('validate_individual_person flags every required field when empty, but not the optional ones', function () {
    $r = validate_individual_person([]);
    foreach (['fullName', 'dateOfBirth', 'placeOfBirth', 'gender', 'nationality', 'countryOfResidence', 'residentialAddress', 'lga', 'state', 'phone', 'email', 'meansOfId', 'idNumber', 'bvn', 'nin', 'occupation', 'employerName', 'officeAddress', 'sourceOfIncome', 'sourceOfWealth', 'purposeOfRelationship', 'expectedMonthlyTurnover', 'expectedTransactionTypes'] as $k) {
        assert_true(isset($r['errors'][$k]), $k);
    }
    foreach (['idExpiry', 'sourceOfIncomeOther', 'purposeOther'] as $k) {
        assert_true(!isset($r['errors'][$k]), $k);
    }
});

test_case('validate_individual_person passes a complete person and checks the email', function () {
    assert_equal(true, validate_individual_person(valid_person())['valid']);
    assert_equal('Enter a valid email address.', validate_individual_person(valid_person(['email' => 'nope']))['errors']['email']);
});

test_case('validate_individual_person: Other needs its text, other choices do not', function () {
    assert_equal('Please specify the source of income.', validate_individual_person(valid_person(['sourceOfIncome' => 'other']))['errors']['sourceOfIncomeOther']);
    assert_equal('Please specify the purpose.', validate_individual_person(valid_person(['purposeOfRelationship' => 'other']))['errors']['purposeOther']);
    assert_equal(true, validate_individual_person(valid_person(['sourceOfIncome' => 'other', 'sourceOfIncomeOther' => 'Gift', 'purposeOfRelationship' => 'other', 'purposeOther' => 'Trade']))['valid']);
    assert_true(!isset(validate_individual_person(valid_person(['sourceOfIncomeOther' => '']))['errors']['sourceOfIncomeOther']));
});

test_case('validate_individual_person rejects unknown/odd choice values without fataling', function () {
    foreach (['gender' => 'X', 'sourceOfIncome' => 'lottery', 'purposeOfRelationship' => 'gift'] as $k => $v) {
        assert_true(isset(validate_individual_person(valid_person([$k => $v]))['errors'][$k]), $k);
    }
    foreach ([['nin', 'bogus'], 'nin', [['nin']], [], [1, 2]] as $bad) {
        assert_equal('Select at least one means of ID.', validate_individual_person(valid_person(['meansOfId' => $bad]))['errors']['meansOfId'], json_encode($bad));
    }
    foreach ([['cash', 'bogus'], 'cash', [], [['cash']]] as $bad) {
        assert_equal('Select at least one transaction type.', validate_individual_person(valid_person(['expectedTransactionTypes' => $bad]))['errors']['expectedTransactionTypes'], json_encode($bad));
    }
    assert_true(isset(validate_individual_person(valid_person(['fullName' => ['x']]))['errors']['fullName']));
});

test_case('validate_individual_declaration requires name, signature, date and agreement', function () {
    $r = validate_individual_declaration([]);
    foreach (['declarationName', 'signatureName', 'signatureDate', 'signatureAgree'] as $k) {
        assert_true(isset($r['errors'][$k]), $k);
    }
    assert_equal(true, validate_individual_declaration(['declarationName' => 'A', 'signatureName' => 'A', 'signatureDate' => '2026-01-01', 'signatureAgree' => 'on'])['valid']);
});

test_case('sanitize_submission_input cleans individual fields and array fields', function () {
    $r = sanitize_submission_input(['fullName' => "Jane\r\nBcc: x", 'residentialAddress' => "1 Rd\r\nLagos", 'officeAddress' => "2 Rd\x00", 'meansOfId' => ["nin\r\n", ['x'], 5, 'bvn'], 'expectedTransactionTypes' => 'cash']);
    assert_equal('JaneBcc: x', $r['fullName']);
    assert_equal("1 Rd\nLagos", $r['residentialAddress']);
    assert_equal('2 Rd', $r['officeAddress']);
    assert_equal(['nin', 'bvn'], $r['meansOfId']);
    assert_equal('cash', $r['expectedTransactionTypes']);
});

test_case('validate_individual_person requires employer and office address, and only the expiry date stays optional in items 1-8', function () {
    $r = validate_individual_person(valid_person(['employerName' => '', 'officeAddress' => '   ']));
    assert_equal('Employer or business name is required.', $r['errors']['employerName']);
    assert_equal('Office address is required.', $r['errors']['officeAddress']);
    assert_equal(true, validate_individual_person(valid_person(['idExpiry' => '']))['valid']);
    assert_equal(true, validate_individual_person(valid_person(['idExpiry' => '2030-06-30']))['valid']);
});

test_case('validate_required_documents asks for every document and only counts a ticked one with a file', function () {
    $docs = [
        ['id' => 'a', 'submitted' => true, 'file' => ['name' => 'a.pdf', 'size' => 1]],
        ['id' => 'b', 'submitted' => false, 'file' => null],
        ['id' => 'c', 'submitted' => true, 'file' => null],
        ['id' => 'd', 'submitted' => false, 'file' => ['name' => 'd.pdf', 'size' => 1]],
    ];
    $r = validate_required_documents($docs);
    assert_equal(false, $r['valid']);
    assert_equal(['b', 'c', 'd'], array_keys($r['errors']));
    assert_equal('This document is required.', $r['errors']['b']);
    assert_equal(true, validate_required_documents([$docs[0]])['valid']);
    assert_equal(true, validate_required_documents([])['valid']);
});

test_case('the individual document list is the five uploads, with utility bill and bank statement separate', function () {
    assert_equal(['valid_means_of_id', 'utility_bill', 'bank_statement', 'passport_photograph', 'signature_mandate_card'], INDIVIDUAL_DOCUMENT_IDS);
});

test_summary();
