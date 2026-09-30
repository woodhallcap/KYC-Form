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
        'customerType' => 'corporate',
        'submittedAt' => date('Y-m-d H:i:s'),
        'fields' => [
            'companyName' => 'Acme Trading Ltd',
            'rcNumber' => 'RC1234567',
            'dateOfIncorporation' => '2015-04-01',
            'registeredAddress' => '12 Marina Road, Lagos Island, Lagos',
            'businessAddress' => '4 Adeola Odeku Street, Victoria Island, Lagos',
            'natureOfBusiness' => 'Import/export trade finance',
            'tin' => '12345678-0001',
            'companyEmail' => 'finance@acmetrading.com',
            'bankAccountNumber' => '0123456789',
            'bankName' => 'First Bank of Nigeria',
            'sourceOfFunds' => 'Proceeds from import/export trade',
            'facilityAmount' => '5,000,000',
            'signatory1Name' => 'Jane Doe',
            'signatory1Date' => date('Y-m-d'),
            'signatory2Name' => 'John Roe',
            'signatory2Date' => date('Y-m-d'),
        ],
        'directors' => [
            ['name' => 'Jane Doe', 'designation' => 'Managing Director', 'bvn' => '22212345678', 'nin' => '12345678901', 'shareholdingPercent' => '60', 'nationality' => 'Nigerian', 'pep' => 'no', 'residentialAddress' => '1 Banana Island Road, Ikoyi, Lagos', 'attachments' => ['id', 'bvn', 'nin', 'proof_of_address']],
            ['name' => 'John Roe', 'designation' => 'Director', 'bvn' => '22298765432', 'nin' => '10987654321', 'shareholdingPercent' => '40', 'nationality' => 'Ghanaian', 'pep' => 'yes', 'residentialAddress' => '7 Independence Avenue, Accra', 'attachments' => []],
        ],
        'documents' => [
            ['id' => 'certificate_of_incorporation', 'label' => 'CAC Certificate of Incorporation', 'submitted' => true],
            ['id' => 'cac_forms', 'label' => 'CAC Forms CAC2.3 / CAC1.1 - Directors & Shareholders', 'submitted' => true],
            ['id' => 'memorandum_articles', 'label' => 'Memorandum & Articles of Association', 'submitted' => false],
            ['id' => 'board_resolution', 'label' => 'Board Resolution to open account and obtain facility', 'submitted' => true],
            ['id' => 'company_bank_statement', 'label' => 'Company Bank Statement - Last 12 months', 'submitted' => true],
            ['id' => 'corporate_id_signatories', 'label' => 'Corporate ID of Authorized Signatories', 'submitted' => false],
        ],
        'consent' => true,
        'sealAttached' => true,
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

// The real emails embed the logo via a PHPMailer CID reference (cid:woodhall-logo),
// which only resolves inside an email client — for this browser-based preview we
// swap in a normal relative path so the logo actually renders in the iframe.
$previewLogoSrc = 'assets/logos/woodhall-capital-logo-reverse-rgb-1.png';
$adminHtml = build_admin_email_html($data, $previewLogoSrc);
$confirmationHtml = build_confirmation_email_html($data, $previewLogoSrc);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Dev Preview — Woodhall KYC Form</title>
<style>
  /* Spacing scale used consistently on this page: 8 / 16 / 24 / 32 (px). */
  body { font-family: -apple-system, sans-serif; background: #F4E7E1; margin: 0; padding: 32px; color: #161616; line-height: 1.6; }
  h1 { color: #0E4033; margin: 0 0 24px 0; }
  .panel { background: #fff; border-radius: 8px; padding: 32px; margin-bottom: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
  .panel h2 { margin: 0 0 16px 0; color: #0E4033; font-size: 18px; }
  .panel p { margin: 0 0 16px 0; }
  iframe { width: 100%; border: 1px solid #ddd; border-radius: 6px; display: block; }
  .email-frame { height: 420px; }
  .pdf-frame { height: 800px; }
  .notice { background: #FFF3CD; color: #7A5B00; padding: 16px; border-radius: 6px; margin-bottom: 24px; font-size: 14px; }
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
