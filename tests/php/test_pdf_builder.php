<?php
declare(strict_types=1);

require __DIR__ . '/test_helper.php';
require __DIR__ . '/../../lib/pdf-builder.php';

test_case('build_submission_pdf returns a valid PDF binary', function () {
    $pdfBytes = build_submission_pdf([
        'submittedAt' => '2026-09-15 14:00:00',
        'step1' => [
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
        ],
        'documents' => [
            ['label' => 'Certificate of Incorporation', 'submitted' => true],
            ['label' => 'CAC Status Report', 'submitted' => false],
        ],
        'consent' => true,
        'step3' => [
            'certifyingName' => 'Jane Doe',
            'designation' => 'Director',
            'signatureName' => 'Jane Doe',
        ],
    ]);

    assert_true(strpos($pdfBytes, '%PDF-') === 0, 'PDF output should start with the %PDF- header');
    assert_true(strlen($pdfBytes) > 1000, 'PDF output should be non-trivial in size');
});

test_summary();
