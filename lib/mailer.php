<?php
declare(strict_types=1);

require_once __DIR__ . '/../vendor/phpmailer/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;

const EMAIL_LOGO_CID = 'woodhall-logo';

// Spacing scale (px) used consistently throughout these email templates —
// the same 8/16/24/32 rule as the rest of the app, so every gap (between
// paragraphs, around the logo, around the shell) comes from one scale
// instead of one-off values.
const EMAIL_SPACE_SM = 8;
const EMAIL_SPACE_MD = 16;
const EMAIL_SPACE_LG = 24;
const EMAIL_SPACE_XL = 32;

function email_paragraph(string $html, bool $isLast = false): string
{
    $marginBottom = $isLast ? 0 : EMAIL_SPACE_MD;
    return "<p style=\"margin:0 0 {$marginBottom}px 0;\">{$html}</p>";
}

function build_email_shell(string $innerHtml, string $logoSrc): string
{
    $logoSrcAttr = htmlspecialchars($logoSrc, ENT_QUOTES);
    $xl = EMAIL_SPACE_XL;
    $lg = EMAIL_SPACE_LG;
    $md = EMAIL_SPACE_MD;
    return "<div style=\"font-family:-apple-system,Helvetica,Arial,sans-serif;background:#F4E7E1;padding:{$xl}px 16px;margin:0;\">"
        . "<div style=\"max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:10px;overflow:hidden;\">"
        . "<div style=\"background:#0E4033;padding:{$xl}px {$lg}px;text-align:center;\">"
        . "<img src=\"{$logoSrcAttr}\" alt=\"Woodhall Capital\" style=\"height:56px;display:block;margin:0 auto;\">"
        . '</div>'
        . "<div style=\"padding:{$xl}px {$lg}px;color:#161616;font-size:15px;line-height:1.6;\">"
        . $innerHtml
        . '</div>'
        . "<div style=\"padding:{$md}px {$lg}px {$lg}px;text-align:center;color:#8a8a8a;font-size:12px;border-top:1px solid #EEE2DA;margin-top:{$md}px;\">"
        . 'Woodhall Capital &mdash; A uniquely elevated financial advisory firm'
        . '</div>'
        . '</div>'
        . '</div>';
}

function build_admin_email_html(array $data, string $logoSrc = 'cid:woodhall-logo'): string
{
    $companyName = htmlspecialchars($data['step1']['companyName'] ?? '', ENT_QUOTES);
    $submittedAt = htmlspecialchars($data['submittedAt'] ?? '', ENT_QUOTES);
    $md = EMAIL_SPACE_MD;
    $inner = "<h2 style=\"color:#0E4033;margin:0 0 {$md}px 0;font-size:20px;\">New Corporate KYC / CDD Submission</h2>"
        . email_paragraph("<strong>Company:</strong> {$companyName}")
        . email_paragraph("<strong>Submitted:</strong> {$submittedAt}")
        . email_paragraph('The full submission is attached as a print-ready PDF, along with any supporting documents provided.', true);
    return build_email_shell($inner, $logoSrc);
}

function build_confirmation_email_html(array $data, string $logoSrc = 'cid:woodhall-logo'): string
{
    $companyName = htmlspecialchars($data['step1']['companyName'] ?? '', ENT_QUOTES);
    $md = EMAIL_SPACE_MD;
    $inner = "<h2 style=\"color:#0E4033;margin:0 0 {$md}px 0;font-size:20px;\">Thank you for your submission</h2>"
        . email_paragraph("We have received the Corporate KYC / CDD submission for <strong>{$companyName}</strong>.")
        . email_paragraph('A copy of your submission, formatted for printing, is attached for your records.')
        . email_paragraph('&mdash; Woodhall Capital', true);
    return build_email_shell($inner, $logoSrc);
}

function configure_base_mailer(object $mailer): void
{
    if (SMTP_HOST !== '') {
        $mailer->isSMTP();
        $mailer->Host = SMTP_HOST;
        $mailer->Port = SMTP_PORT;
        $mailer->SMTPAuth = true;
        $mailer->Username = SMTP_USERNAME;
        $mailer->Password = SMTP_PASSWORD;
        $mailer->SMTPSecure = SMTP_SECURE;
    }
    $mailer->setFrom(MAIL_FROM_ADDRESS, MAIL_FROM_NAME);
    $mailer->isHTML(true);
    $mailer->CharSet = 'UTF-8';
}

function send_submission_emails(
    array $data,
    string $pdfBytes,
    array $attachments,
    ?callable $mailerFactory = null
): array {
    $mailerFactory = $mailerFactory ?? function () {
        return new PHPMailer(true);
    };

    $pdfFileName = 'woodhall-kyc-submission.pdf';
    $companyName = $data['step1']['companyName'] ?? 'submitter';
    $logoPath = __DIR__ . '/../assets/logos/woodhall-capital-logo-reverse-rgb-1.png';

    try {
        $admin = $mailerFactory();
        configure_base_mailer($admin);
        if (file_exists($logoPath)) {
            $admin->addEmbeddedImage($logoPath, EMAIL_LOGO_CID, 'woodhall-logo.png');
        }
        $admin->addAddress(RECIPIENT_EMAIL, RECIPIENT_NAME);
        $admin->Subject = 'New Corporate KYC / CDD Submission — ' . $companyName;
        $admin->Body = build_admin_email_html($data);
        $admin->addStringAttachment($pdfBytes, $pdfFileName, 'base64', 'application/pdf');
        foreach ($attachments as $attachment) {
            $admin->addAttachment($attachment['tmpPath'], $attachment['originalName']);
        }
        if (!$admin->send()) {
            return ['success' => false, 'error' => 'Failed to send admin notification: ' . $admin->ErrorInfo];
        }

        $submitterEmail = $data['step1']['companyEmail'] ?? '';
        if ($submitterEmail !== '') {
            $confirmation = $mailerFactory();
            configure_base_mailer($confirmation);
            if (file_exists($logoPath)) {
                $confirmation->addEmbeddedImage($logoPath, EMAIL_LOGO_CID, 'woodhall-logo.png');
            }
            $confirmation->addAddress($submitterEmail, $companyName);
            $confirmation->Subject = 'We received your Woodhall Capital KYC submission';
            $confirmation->Body = build_confirmation_email_html($data);
            $confirmation->addStringAttachment($pdfBytes, $pdfFileName, 'base64', 'application/pdf');
            if (!$confirmation->send()) {
                return ['success' => false, 'error' => 'Failed to send confirmation email: ' . $confirmation->ErrorInfo];
            }
        }

        return ['success' => true, 'error' => null];
    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}
