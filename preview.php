<?php
declare(strict_types=1);

/**
 * Dev-only preview of the outgoing emails and the generated PDF, using
 * sample data. Not linked from the public form. Restricted to local
 * requests as a safety net — delete this file before deploying to
 * production.
 */

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);

$remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '';
if (!in_array($remoteAddr, ['127.0.0.1', '::1'], true)) {
    http_response_code(403);
    echo 'Not available.';
    exit;
}

require_once __DIR__ . '/lib/pdf-builder.php';
require_once __DIR__ . '/lib/mailer.php';

function preview_sample_data(): array
{
    return [
        'submittedAt' => date('Y-m-d H:i:s'),
        'step1' => [
            'companyName' => 'Acme Trading Ltd',
            'rcNumber' => 'RC1234567',
            'dateOfIncorporation' => '2015-04-01',
            'legalStatus' => 'private',
            'registeredAddress' => '12 Marina Road, Lagos Island, Lagos',
            'businessAddress' => '4 Adeola Odeku Street, Victoria Island, Lagos',
            'natureOfBusiness' => 'Import/export trade finance',
            'tin' => '12345678-0001',
            'companyEmail' => 'finance@acmetrading.com',
            'website' => 'https://acmetrading.com',
            'bankAccountNumber' => '0123456789',
            'bankName' => 'First Bank of Nigeria',
        ],
        'documents' => [
            ['label' => 'Certificate of Incorporation', 'submitted' => true],
            ['label' => 'CAC Status Report', 'submitted' => true],
            ['label' => 'Memorandum and Articles of Association', 'submitted' => false],
            ['label' => 'Valid means of identification for each director, signatory, and UBO above five per cent shareholding', 'submitted' => true],
            ['label' => 'Bank Verification Number (BVN) and National Identification Number (NIN) for each director, signatory, and Ultimate Beneficial Owner above five per cent shareholding', 'submitted' => false],
            ['label' => 'Recent residential utility bill or proof of address for the company / director(s)', 'submitted' => true],
            ['label' => 'Company corporate profile', 'submitted' => true],
            ['label' => 'Applicable regulatory licences and permits, where the business is engaged in a regulated activity', 'submitted' => false],
            ['label' => "One year's bank statements from the company's operating account(s)", 'submitted' => true],
            ['label' => 'Three-year audited financial statements and current-year management accounts', 'submitted' => false],
            ['label' => 'Personal Financial Information (PFI) (where applicable)', 'submitted' => false],
            ['label' => 'Anti-Money Laundering (AML) compliance certificate, where the customer is itself a regulated financial institution', 'submitted' => false],
        ],
        'consent' => true,
        'step3' => [
            'certifyingName' => 'Jane Doe',
            'designation' => 'Managing Director',
            'signatureName' => 'Jane Doe',
        ],
    ];
}

$data = preview_sample_data();

if (($_GET['view'] ?? '') === 'pdf') {
    $pdfBytes = build_submission_pdf($data);
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="preview-submission.pdf"');
    header('Content-Length: ' . strlen($pdfBytes));
    echo $pdfBytes;
    exit;
}

$adminHtml = build_admin_email_html($data);
$confirmationHtml = build_confirmation_email_html($data);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Dev Preview — Woodhall KYC Form</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #F4E7E1; margin: 0; padding: 24px; color: #161616; }
  h1 { color: #0E4033; }
  .panel { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
  .panel h2 { margin-top: 0; color: #0E4033; font-size: 18px; }
  iframe { width: 100%; border: 1px solid #ddd; border-radius: 6px; }
  .email-frame { height: 320px; }
  .pdf-frame { height: 800px; }
  .notice { background: #FFF3CD; color: #7A5B00; padding: 10px 14px; border-radius: 6px; margin-bottom: 20px; font-size: 14px; }
</style>
</head>
<body>
  <div class="notice">Dev-only preview using sample data — not linked from the public form, restricted to local requests. Delete before deploying.</div>
  <h1>Woodhall KYC Form — Email &amp; PDF Preview</h1>

  <div class="panel">
    <h2>Admin notification email</h2>
    <iframe class="email-frame" srcdoc="<?php echo htmlspecialchars($adminHtml, ENT_QUOTES); ?>"></iframe>
  </div>

  <div class="panel">
    <h2>Submitter confirmation email</h2>
    <iframe class="email-frame" srcdoc="<?php echo htmlspecialchars($confirmationHtml, ENT_QUOTES); ?>"></iframe>
  </div>

  <div class="panel">
    <h2>Generated PDF (attached to both emails)</h2>
    <p><a href="preview.php?view=pdf" target="_blank">Open in new tab</a></p>
    <iframe class="pdf-frame" src="preview.php?view=pdf"></iframe>
  </div>
</body>
</html>
