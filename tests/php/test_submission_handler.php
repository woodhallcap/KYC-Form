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

test_case('handle_submission rejects a file that failed PHP-level upload limits instead of silently dropping it', function () {
    $files = [
        'documents' => [
            'name' => ['certificate_of_incorporation' => ['file' => 'big.pdf']],
            'size' => ['certificate_of_incorporation' => ['file' => 0]],
            'tmp_name' => ['certificate_of_incorporation' => ['file' => '']],
            'error' => ['certificate_of_incorporation' => ['file' => UPLOAD_ERR_INI_SIZE]],
        ],
    ];
    $called = false;
    $fakeSend = function () use (&$called) {
        $called = true;
        return ['success' => true, 'error' => null];
    };

    $result = handle_submission(sample_post(), $files, $fakeSend);

    assert_equal(false, $result['success']);
    assert_true(isset($result['errors']['certificate_of_incorporation']));
    assert_true(!$called, 'Should not attempt to email a submission with a failed upload');
});

test_case('handle_submission strips header-injection attempts from text fields before sending', function () {
    $capturedData = null;
    $fakeSend = function (array $data) use (&$capturedData) {
        $capturedData = $data;
        return ['success' => true, 'error' => null];
    };

    $post = sample_post([
        'companyName' => "Acme Ltd\r\nBcc: attacker@evil.com",
        'registeredAddress' => "1 Marina Road\r\nBcc: attacker@evil.com",
    ]);

    $result = handle_submission($post, [], $fakeSend);

    assert_equal(true, $result['success']);
    assert_true(strpos($capturedData['step1']['companyName'], "\r") === false);
    assert_true(strpos($capturedData['step1']['companyName'], "\n") === false);
    assert_equal("Acme LtdBcc: attacker@evil.com", $capturedData['step1']['companyName']);
    assert_true(strpos($capturedData['step1']['registeredAddress'], "\r") === false);
});

test_case('handle_submission sanitizes uploaded filenames before attaching to email', function () {
    $tmpFile = tempnam(sys_get_temp_dir(), 'kyc-test-');
    file_put_contents($tmpFile, 'dummy content');

    $files = [
        'documents' => [
            'name' => ['certificate_of_incorporation' => ['file' => '../../evil<>.pdf']],
            'size' => ['certificate_of_incorporation' => ['file' => 13]],
            'tmp_name' => ['certificate_of_incorporation' => ['file' => $tmpFile]],
            'error' => ['certificate_of_incorporation' => ['file' => UPLOAD_ERR_OK]],
        ],
    ];

    $capturedAttachments = null;
    $fakeSend = function (array $data, string $pdfBytes, array $attachments) use (&$capturedAttachments) {
        $capturedAttachments = $attachments;
        return ['success' => true, 'error' => null];
    };

    handle_submission(sample_post(), $files, $fakeSend);

    assert_equal('evil__.pdf', $capturedAttachments[0]['originalName']);
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
