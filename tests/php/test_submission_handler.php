<?php
declare(strict_types=1);

require __DIR__ . '/test_helper.php';
require __DIR__ . '/../../config.php';
require __DIR__ . '/../../lib/submission-handler.php';

function sample_post(array $overrides = []): array
{
    $base = [
        'companyName' => 'Acme Trading Ltd',
        'rcNumber' => 'RC123456',
        'dateOfIncorporation' => '2015-04-01',
        'legalStatus' => 'private',
        'registeredAddress' => '1 Marina Road, Lagos',
        'natureOfBusiness' => 'Trade finance',
        'tin' => 'TIN000111',
        'companyEmail' => 'info@acme.com',
        'bankAccountNumber' => '0011223344',
        'bankName' => 'First Bank',
        'documents' => ['certificate_of_incorporation' => ['submitted' => '1']],
        'consent' => '1',
        'certifyingName' => 'Jane Doe',
        'designation' => 'Director',
        'signatureName' => 'Jane Doe',
        'signatureAgree' => '1',
    ];
    return array_replace($base, $overrides);
}

test_case('handle_submission returns errors for missing required fields', function () {
    $result = handle_submission([], []);
    assert_equal(false, $result['success']);
    assert_true(isset($result['errors']['companyName']));
});

test_case('handle_submission succeeds and calls the injected email sender', function () {
    $called = false;
    $fakeSend = function (array $data, string $pdfBytes, array $attachments) use (&$called) {
        $called = true;
        assert_true(strpos($pdfBytes, '%PDF-') === 0);
        return ['success' => true, 'error' => null];
    };

    $result = handle_submission(sample_post(), [], $fakeSend);

    assert_equal(true, $result['success']);
    assert_true($called);
});

test_case('handle_submission surfaces email failures without exposing internals', function () {
    $fakeSend = function () {
        return ['success' => false, 'error' => 'SMTP down'];
    };

    $result = handle_submission(sample_post(), [], $fakeSend);

    assert_equal(false, $result['success']);
});

test_summary();
