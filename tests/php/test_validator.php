<?php
declare(strict_types=1);

require __DIR__ . '/test_helper.php';
require __DIR__ . '/../../lib/validator.php';

test_case('validate_step1 flags all required fields when empty', function () {
    $result = validate_step1([]);
    assert_equal(false, $result['valid']);
    assert_true(isset($result['errors']['companyName']));
    assert_true(isset($result['errors']['companyEmail']));
});

test_case('validate_step1 passes with all required fields present', function () {
    $result = validate_step1([
        'companyName' => 'Acme Ltd',
        'rcNumber' => 'RC123',
        'dateOfIncorporation' => '2020-01-01',
        'legalStatus' => 'private',
        'registeredAddress' => '1 Main St',
        'natureOfBusiness' => 'Trading',
        'tin' => 'TIN123',
        'companyEmail' => 'info@acme.com',
        'bankAccountNumber' => '0123456789',
        'bankName' => 'First Bank',
    ]);
    assert_equal(true, $result['valid']);
});

test_case('validate_step1 rejects invalid email', function () {
    $result = validate_step1(['companyEmail' => 'not-an-email']);
    assert_equal('Enter a valid email address.', $result['errors']['companyEmail']);
});

test_case('validate_step1 requires legalStatusOther when legalStatus is other', function () {
    $result = validate_step1(['legalStatus' => 'other']);
    assert_true(isset($result['errors']['legalStatusOther']));
});

test_case('validate_file_meta rejects disallowed extensions', function () {
    $result = validate_file_meta(['name' => 'virus.exe', 'size' => 100]);
    assert_equal(false, $result['valid']);
});

test_case('validate_file_meta rejects oversized files', function () {
    $result = validate_file_meta(['name' => 'doc.pdf', 'size' => 6 * 1024 * 1024]);
    assert_equal(false, $result['valid']);
});

test_case('validate_step2 requires consent', function () {
    $result = validate_step2([], false);
    assert_equal(false, $result['valid']);
    assert_true(isset($result['errors']['_consent']));
});

test_case('validate_step2 flags total size over 20MB', function () {
    $documents = array_map(function ($id) {
        return ['id' => $id, 'submitted' => true, 'file' => ['name' => "{$id}.pdf", 'size' => 4.5 * 1024 * 1024]];
    }, array_slice(DOCUMENT_IDS, 0, 5));
    $result = validate_step2($documents, true);
    assert_true(isset($result['errors']['_total']));
});

test_case('validate_step3 requires signature agreement', function () {
    $result = validate_step3([
        'certifyingName' => 'Jane Doe',
        'designation' => 'CEO',
        'signatureName' => 'Jane Doe',
        'signatureAgree' => false,
    ]);
    assert_equal(false, $result['valid']);
    assert_true(isset($result['errors']['signatureAgree']));
});

test_case('validate_step3 passes with all fields valid', function () {
    $result = validate_step3([
        'certifyingName' => 'Jane Doe',
        'designation' => 'CEO',
        'signatureName' => 'Jane Doe',
        'signatureAgree' => true,
    ]);
    assert_equal(true, $result['valid']);
});

test_summary();
