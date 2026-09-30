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

test_summary();
