<?php
declare(strict_types=1);

require_once __DIR__ . '/../vendor/phpmailer/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;

function build_admin_email_html(array $data): string
{
    $companyName = htmlspecialchars($data['step1']['companyName'] ?? '', ENT_QUOTES);
    $submittedAt = htmlspecialchars($data['submittedAt'] ?? '', ENT_QUOTES);
    return '<div style="font-family:sans-serif;color:#161616;">'
        . '<h2 style="color:#0E4033;">New Corporate KYC / CDD Submission</h2>'
        . "<p><strong>Company:</strong> {$companyName}</p>"
        . "<p><strong>Submitted:</strong> {$submittedAt}</p>"
        . '<p>The full submission is attached as a print-ready PDF, along with any supporting documents provided.</p>'
        . '</div>';
}

function build_confirmation_email_html(array $data): string
{
    $companyName = htmlspecialchars($data['step1']['companyName'] ?? '', ENT_QUOTES);
    return '<div style="font-family:sans-serif;color:#161616;">'
        . '<h2 style="color:#0E4033;">Thank you for your submission</h2>'
        . "<p>We have received the Corporate KYC / CDD submission for <strong>{$companyName}</strong>.</p>"
        . '<p>A copy of your submission, formatted for printing, is attached for your records.</p>'
        . '<p>— Woodhall Capital</p>'
        . '</div>';
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

    try {
        $admin = $mailerFactory();
        configure_base_mailer($admin);
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
