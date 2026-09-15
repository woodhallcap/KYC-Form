<?php
declare(strict_types=1);

require_once __DIR__ . '/validator.php';
require_once __DIR__ . '/pdf-builder.php';
require_once __DIR__ . '/mailer.php';

const DOCUMENT_LABELS = [
    'certificate_of_incorporation' => 'Certificate of Incorporation',
    'cac_status_report' => 'CAC Status Report',
    'memorandum_articles' => 'Memorandum and Articles of Association',
    'directors_id' => 'Valid means of identification for each director, signatory, and UBO above five per cent shareholding',
    'bvn_nin' => 'Bank Verification Number (BVN) and National Identification Number (NIN) for each director, signatory, and Ultimate Beneficial Owner above five per cent shareholding',
    'utility_bill' => 'Recent residential utility bill or proof of address for the company / director(s)',
    'corporate_profile' => 'Company corporate profile',
    'regulatory_licences' => 'Applicable regulatory licences and permits, where the business is engaged in a regulated activity',
    'bank_statements' => "One year's bank statements from the company's operating account(s)",
    'audited_financials' => 'Three-year audited financial statements and current-year management accounts',
    'personal_financial_info' => 'Personal Financial Information (PFI) (where applicable)',
    'aml_certificate' => 'Anti-Money Laundering (AML) compliance certificate, where the customer is itself a regulated financial institution',
];

function parse_documents_input(array $post, array $files): array
{
    $documents = [];
    foreach (DOCUMENT_IDS as $id) {
        $submitted = !empty($post['documents'][$id]['submitted']);
        $fileMeta = null;
        $uploadedFileName = $files['documents']['name'][$id]['file'] ?? '';
        if ($uploadedFileName !== '') {
            $fileMeta = [
                'name' => $files['documents']['name'][$id]['file'],
                'size' => $files['documents']['size'][$id]['file'],
                'tmp_name' => $files['documents']['tmp_name'][$id]['file'],
                'error' => $files['documents']['error'][$id]['file'],
            ];
        }
        $documents[] = [
            'id' => $id,
            'label' => DOCUMENT_LABELS[$id],
            'submitted' => $submitted,
            'file' => $fileMeta,
        ];
    }
    return $documents;
}

function handle_submission(array $post, array $files, ?callable $sendEmails = null): array
{
    $sendEmails = $sendEmails ?? 'send_submission_emails';

    $step1Result = validate_step1($post);

    $documents = parse_documents_input($post, $files);
    $consent = !empty($post['consent']);
    $step2Result = validate_step2($documents, $consent);

    $step3Result = validate_step3($post);

    $errors = array_merge($step1Result['errors'], $step2Result['errors'], $step3Result['errors']);
    if (count($errors) > 0) {
        return ['success' => false, 'errors' => $errors, 'message' => 'Please correct the highlighted fields.'];
    }

    $submittedAt = date('Y-m-d H:i:s');
    $data = [
        'submittedAt' => $submittedAt,
        'step1' => $post,
        'documents' => $documents,
        'consent' => $consent,
        'step3' => $post,
    ];

    $pdfBytes = build_submission_pdf($data);

    $attachments = [];
    foreach ($documents as $doc) {
        if ($doc['file'] !== null && ($doc['file']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
            $attachments[] = [
                'tmpPath' => $doc['file']['tmp_name'],
                'originalName' => $doc['file']['name'],
            ];
        }
    }

    $emailResult = call_user_func($sendEmails, $data, $pdfBytes, $attachments);

    foreach ($attachments as $attachment) {
        if (file_exists($attachment['tmpPath'])) {
            @unlink($attachment['tmpPath']);
        }
    }

    if (!$emailResult['success']) {
        return ['success' => false, 'errors' => [], 'message' => 'We could not send your submission. Please try again shortly.'];
    }

    return ['success' => true, 'errors' => [], 'message' => 'Submission received.'];
}
