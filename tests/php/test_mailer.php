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
    public array $embeddedImages = [];
    public bool $shouldFail = false;

    public function isSMTP(): void {}
    public function isHTML(bool $v): void {}
    public function setFrom(string $address, string $name = ''): void {}
    public function addAddress(string $address, string $name = ''): void
    {
        $this->sentTo[] = $address;
    }
    public function addEmbeddedImage(string $path, string $cid, string $name = ''): void
    {
        $this->embeddedImages[] = $cid;
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
    'customerType' => 'corporate',
    'submittedAt' => '2026-09-15 14:00:00',
    'fields' => ['companyName' => 'Acme Trading Ltd', 'companyEmail' => 'info@acme.com'],
    'documents' => [
        ['id' => 'certificate_of_incorporation', 'label' => 'CAC Certificate of Incorporation', 'attached' => true],
        ['id' => 'cac_status_report', 'label' => 'CAC Status Report', 'attached' => true],
        ['id' => 'corporate_id_signatories', 'label' => 'Corporate ID of Authorized Signatories', 'attached' => false],
    ],
];

test_case('build_admin_email_html includes company name and the logo image', function () use ($sampleData) {
    $html = build_admin_email_html($sampleData);
    assert_true(strpos($html, 'Acme Trading Ltd') !== false);
    assert_true(strpos($html, 'cid:woodhall-logo') !== false);
    assert_true(strpos($html, '<img') !== false);
});

test_case('build_confirmation_email_html includes company name and the logo image', function () use ($sampleData) {
    $html = build_confirmation_email_html($sampleData);
    assert_true(strpos($html, 'Acme Trading Ltd') !== false);
    assert_true(strpos($html, 'cid:woodhall-logo') !== false);
});

test_case('build_admin_email_html accepts a custom logo source (used by the dev preview page)', function () use ($sampleData) {
    $html = build_admin_email_html($sampleData, 'assets/logos/woodhall-finance-darkbg.png');
    assert_true(strpos($html, 'assets/logos/woodhall-finance-darkbg.png') !== false);
    assert_true(strpos($html, 'cid:woodhall-logo') === false);
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
    assert_equal(RECIPIENT_EMAILS, $fakes[0]->sentTo);
    assert_equal(['info@acme.com'], $fakes[1]->sentTo);
    assert_true(in_array('woodhall-kyc-submission.pdf', $fakes[0]->attachments, true));
    assert_true(in_array('woodhall-logo', $fakes[0]->embeddedImages, true), 'Admin email should embed the logo');
    assert_true(in_array('woodhall-logo', $fakes[1]->embeddedImages, true), 'Confirmation email should embed the logo');
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

test_case('submission_summary describes a corporate submission', function () use ($sampleData) {
    assert_equal(['kind' => 'Corporate KYC / CDD', 'nameLabel' => 'Company', 'name' => 'Acme Trading Ltd', 'email' => 'info@acme.com'], submission_summary($sampleData));
});

test_case('send_submission_emails skips the confirmation when there is no submitter email', function () {
    $fakes = [];
    $factory = function () use (&$fakes) {
        return $fakes[] = new FakePHPMailer();
    };
    $r = send_submission_emails(['customerType' => 'corporate', 'submittedAt' => 'x', 'fields' => ['companyName' => 'A', 'companyEmail' => '']], '%PDF', [], $factory);
    assert_equal(true, $r['success']);
    assert_equal(1, count($fakes));
});

test_case('admin email subject names the type and the company', function () use ($sampleData) {
    $fakes = [];
    $factory = function () use (&$fakes) {
        return $fakes[] = new FakePHPMailer();
    };
    send_submission_emails($sampleData, '%PDF', [], $factory);
    assert_equal('New Corporate KYC / CDD Submission — Acme Trading Ltd', $fakes[0]->Subject);
});

test_case('submission_summary describes an individual', function () {
    $d = ['customerType' => 'individual', 'fields' => ['fullName' => 'Jane Doe', 'email' => 'jane@example.com']];
    assert_equal(['kind' => 'Individual KYC / CDD', 'nameLabel' => 'Customer', 'name' => 'Jane Doe', 'email' => 'jane@example.com'], submission_summary($d));
});

test_case('individual admin subject and confirmation go to the person', function () {
    $fakes = [];
    $factory = function () use (&$fakes) {
        return $fakes[] = new FakePHPMailer();
    };
    $d = ['customerType' => 'individual', 'submittedAt' => 'x', 'fields' => ['fullName' => 'Jane Doe', 'email' => 'jane@example.com']];
    $r = send_submission_emails($d, '%PDF', [], $factory);
    assert_equal(true, $r['success']);
    assert_equal('New Individual KYC / CDD Submission — Jane Doe', $fakes[0]->Subject);
    assert_equal(['jane@example.com'], $fakes[1]->sentTo);
    assert_true(strpos(build_admin_email_html($d), 'Jane Doe') !== false);
    assert_true(strpos(build_confirmation_email_html($d), 'Individual KYC / CDD') !== false);
});

test_case('admin email goes to every configured recipient and lists only attached documents', function () use ($sampleData) {
    $fakes = [];
    $factory = function () use (&$fakes) {
        return $fakes[] = new FakePHPMailer();
    };
    send_submission_emails($sampleData, '%PDF', [], $factory);
    assert_equal(RECIPIENT_EMAILS, $fakes[0]->sentTo);
    $html = build_admin_email_html($sampleData);
    assert_true(strpos($html, 'Documents attached:') !== false);
    assert_true(strpos($html, 'CAC Status Report') !== false);
    assert_true(strpos($html, 'Corporate ID of Authorized Signatories') === false);
});

test_case('emails say Woodhall Finance, never Woodhall Capital', function () use ($sampleData) {
    $all = build_admin_email_html($sampleData) . build_confirmation_email_html($sampleData);
    assert_true(strpos($all, 'Woodhall Capital') === false);
    assert_true(strpos($all, 'Woodhall Finance') !== false);
});

test_case('confirmation explains what happens next and gives a contact address', function () use ($sampleData) {
    $html = build_confirmation_email_html($sampleData);
    assert_true(strpos($html, 'What happens next') !== false);
    assert_true(strpos($html, 'info@woodhallfinanceltd.com') !== false);
});

test_case('confirmation subject names Woodhall Finance', function () use ($sampleData) {
    $fakes = [];
    $factory = function () use (&$fakes) {
        return $fakes[] = new FakePHPMailer();
    };
    send_submission_emails($sampleData, '%PDF', [], $factory);
    assert_equal('We received your Woodhall Finance KYC submission', $fakes[1]->Subject);
});

test_summary();
