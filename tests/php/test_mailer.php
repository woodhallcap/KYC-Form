<?php
declare(strict_types=1);

require __DIR__ . '/test_helper.php';
require __DIR__ . '/../../config.php';
require __DIR__ . '/../../lib/mailer.php';

class FakePHPMailer
{
    public array $sentTo = [];
    public string $Subject = '';
    public string $Body = '';
    public string $ErrorInfo = '';
    public string $CharSet = '';
    public array $attachments = [];
    public bool $shouldFail = false;

    public function isSMTP(): void {}
    public function isHTML(bool $v): void {}
    public function setFrom(string $address, string $name = ''): void {}
    public function addAddress(string $address, string $name = ''): void
    {
        $this->sentTo[] = $address;
    }
    public function addStringAttachment(string $content, string $name, string $encoding = '', string $type = ''): void
    {
        $this->attachments[] = $name;
    }
    public function addAttachment(string $path, string $name = ''): void
    {
        $this->attachments[] = $name;
    }
    public function send(): bool
    {
        if ($this->shouldFail) {
            $this->ErrorInfo = 'Simulated failure';
            return false;
        }
        return true;
    }
}

$sampleData = [
    'submittedAt' => '2026-09-15 14:00:00',
    'step1' => ['companyName' => 'Acme Trading Ltd', 'companyEmail' => 'info@acme.com'],
];

test_case('build_admin_email_html includes company name', function () use ($sampleData) {
    $html = build_admin_email_html($sampleData);
    assert_true(strpos($html, 'Acme Trading Ltd') !== false);
});

test_case('build_confirmation_email_html includes company name', function () use ($sampleData) {
    $html = build_confirmation_email_html($sampleData);
    assert_true(strpos($html, 'Acme Trading Ltd') !== false);
});

test_case('send_submission_emails sends to admin and submitter on success', function () use ($sampleData) {
    $fakes = [];
    $factory = function () use (&$fakes) {
        $fake = new FakePHPMailer();
        $fakes[] = $fake;
        return $fake;
    };

    $result = send_submission_emails($sampleData, '%PDF-fake-bytes', [], $factory);

    assert_equal(true, $result['success']);
    assert_equal(2, count($fakes));
    assert_equal([RECIPIENT_EMAIL], $fakes[0]->sentTo);
    assert_equal(['info@acme.com'], $fakes[1]->sentTo);
    assert_true(in_array('woodhall-kyc-submission.pdf', $fakes[0]->attachments, true));
});

test_case('send_submission_emails reports failure when admin send fails', function () use ($sampleData) {
    $factory = function () {
        $fake = new FakePHPMailer();
        $fake->shouldFail = true;
        return $fake;
    };

    $result = send_submission_emails($sampleData, '%PDF-fake-bytes', [], $factory);

    assert_equal(false, $result['success']);
    assert_true(strpos($result['error'], 'admin notification') !== false);
});

test_summary();
