<?php
declare(strict_types=1);

require_once __DIR__ . '/validator.php';
require_once __DIR__ . '/pdf-builder.php';
require_once __DIR__ . '/mailer.php';

const CORPORATE_DOCUMENT_LABELS = [
    'certificate_of_incorporation' => 'CAC Certificate of Incorporation',
    'cac_forms' => 'CAC Forms CAC2.3 / CAC1.1 - Directors & Shareholders',
    'memorandum_articles' => 'Memorandum & Articles of Association',
    'board_resolution' => 'Board Resolution to open account and obtain facility',
    'company_bank_statement' => 'Company Bank Statement - Last 12 months',
    'corporate_id_signatories' => 'Corporate ID of Authorized Signatories',
];

/**
 * Pull one upload out of PHP's nested $_FILES layout, e.g. the field
 * directors[0][files][id] lives at $_FILES['directors']['name'][0]['files']['id'].
 * Returns null when no file was chosen at that path.
 */
function extract_upload(array $files, string $top, array $path): ?array
{
    if (!isset($files[$top]['name'])) {
        return null;
    }
    $meta = [];
    foreach (['name', 'size', 'tmp_name', 'error'] as $key) {
        $node = $files[$top][$key] ?? null;
        foreach ($path as $segment) {
            if (!is_array($node) || !array_key_exists($segment, $node)) {
                return null;
            }
            $node = $node[$segment];
        }
        if ($node === null || is_array($node)) {
            return null;
        }
        $meta[$key] = $node;
    }
    return $meta['name'] === '' ? null : $meta;
}

function upload_error_message(int $code): string
{
    switch ($code) {
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            return 'This file is too large to upload.';
        case UPLOAD_ERR_PARTIAL:
            return 'This file was only partially uploaded. Please try again.';
        default:
            return 'This file could not be uploaded. Please try again.';
    }
}

function parse_documents_input(array $post, array $files): array
{
    $docsPost = is_array($post['documents'] ?? null) ? $post['documents'] : [];
    $documents = [];
    foreach (CORPORATE_DOCUMENT_IDS as $id) {
        $submitted = is_array($docsPost[$id] ?? null) && !empty($docsPost[$id]['submitted']);
        $documents[] = [
            'id' => $id,
            'label' => CORPORATE_DOCUMENT_LABELS[$id],
            'submitted' => $submitted,
            // Only ticked documents count; a file left on an unticked row is ignored.
            'file' => $submitted ? extract_upload($files, 'documents', [$id, 'file']) : null,
        ];
    }
    return $documents;
}

/** Every upload that will be validated and attached: ['key', 'slot', 'file']. */
function collect_uploads(array $documents, array $files, int $directorCount): array
{
    $uploads = [];
    foreach ($documents as $doc) {
        if ($doc['file'] !== null) {
            $uploads[] = ['key' => $doc['id'], 'slot' => $doc['id'], 'file' => $doc['file']];
        }
    }
    for ($i = 0; $i < $directorCount; $i++) {
        foreach (DIRECTOR_FILE_IDS as $fileId) {
            $meta = extract_upload($files, 'directors', [$i, 'files', $fileId]);
            if ($meta !== null) {
                $uploads[] = ['key' => "directorFile.$i.$fileId", 'slot' => 'director-' . ($i + 1) . '-' . $fileId, 'file' => $meta];
            }
        }
    }
    $seal = extract_upload($files, 'sealFile', []);
    if ($seal !== null) {
        $uploads[] = ['key' => 'sealFile', 'slot' => 'company-seal', 'file' => $seal];
    }
    return $uploads;
}

function failure(array $errors, string $message = 'Please correct the highlighted fields.'): array
{
    return ['success' => false, 'errors' => $errors, 'message' => $message];
}

function handle_submission(array $post, array $files, ?callable $sendEmails = null): array
{
    $sendEmails = $sendEmails ?? 'send_submission_emails';
    $post = sanitize_submission_input($post);

    if (($post['customerType'] ?? null) !== 'corporate') {
        return failure(['customerType' => 'Unsupported customer type.']);
    }
    return handle_corporate_submission($post, $files, $sendEmails);
}

function handle_corporate_submission(array $post, array $files, callable $sendEmails): array
{
    $rows = is_array($post['directors'] ?? null) ? array_values($post['directors']) : [];
    $documents = parse_documents_input($post, $files);
    $consent = !empty($post['consent']);

    $errors = array_merge(
        validate_entity($post)['errors'],
        validate_directors($post['directors'] ?? null)['errors'],
        validate_documents_consent($consent)['errors'],
        validate_funds($post)['errors'],
        validate_declaration($post)['errors']
    );

    $uploads = collect_uploads($documents, $files, min(count($rows), MAX_DIRECTORS));
    $checkable = [];
    foreach ($uploads as $upload) {
        $code = $upload['file']['error'] ?? UPLOAD_ERR_NO_FILE;
        if ($code !== UPLOAD_ERR_OK) {
            $errors[$upload['key']] = upload_error_message((int) $code);
        } else {
            $checkable[] = ['key' => $upload['key'], 'file' => $upload['file']];
        }
    }
    $errors = array_merge($errors, validate_uploads($checkable)['errors']);

    if (count($errors) > 0) {
        return failure($errors);
    }

    $directorRows = [];
    foreach ($rows as $i => $row) {
        $prefix = "directorFile.$i.";
        $attached = [];
        foreach ($uploads as $upload) {
            if (strpos($upload['key'], $prefix) === 0) {
                $attached[] = substr($upload['key'], strlen($prefix));
            }
        }
        $row['attachments'] = $attached;
        $directorRows[] = $row;
    }

    $sealAttached = false;
    $attachments = [];
    foreach ($uploads as $upload) {
        if ($upload['key'] === 'sealFile') {
            $sealAttached = true;
        }
        $attachments[] = [
            'tmpPath' => $upload['file']['tmp_name'],
            'originalName' => $upload['slot'] . ' - ' . sanitize_filename((string) $upload['file']['name']),
        ];
    }

    $data = [
        'customerType' => 'corporate',
        'submittedAt' => date('Y-m-d H:i:s'),
        'fields' => $post,
        'directors' => $directorRows,
        'documents' => array_map(
            fn(array $d): array => ['id' => $d['id'], 'label' => $d['label'], 'submitted' => $d['submitted']],
            $documents
        ),
        'consent' => $consent,
        'sealAttached' => $sealAttached,
    ];

    $pdfBytes = build_submission_pdf($data);
    $emailResult = call_user_func($sendEmails, $data, $pdfBytes, $attachments);

    foreach ($attachments as $attachment) {
        if (file_exists($attachment['tmpPath'])) {
            @unlink($attachment['tmpPath']);
        }
    }

    if (!$emailResult['success']) {
        return failure([], 'We could not send your submission. Please try again shortly.');
    }
    return ['success' => true, 'errors' => [], 'message' => 'Submission received.'];
}
