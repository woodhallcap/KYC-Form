<?php
declare(strict_types=1);

require_once __DIR__ . '/validator.php';
require_once __DIR__ . '/pdf-builder.php';
require_once __DIR__ . '/mailer.php';

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

function parse_documents_input(array $files, array $specs): array
{
    $documents = [];
    foreach ($specs as $id => $spec) {
        $documents[] = [
            'id' => $id,
            'label' => $spec['label'],
            'required' => $spec['required'],
            'file' => extract_upload($files, 'documents', [$id]),
        ];
    }
    return $documents;
}

function missing_document_errors(array $documents): array
{
    $errors = [];
    foreach ($documents as $doc) {
        if ($doc['required'] && $doc['file'] === null) {
            $errors[$doc['id']] = $doc['label'] . ' is required.';
        }
    }
    return $errors;
}

/** Signature/seal uploads: [uploads, errors for the missing ones]. */
function collect_images(array $files, array $specs): array
{
    $uploads = [];
    $errors = [];
    foreach ($specs as $name => $spec) {
        $meta = extract_upload($files, $name, []);
        if ($meta === null) {
            $errors[$name] = $spec['missing'];
        } else {
            $uploads[] = ['key' => $name, 'slot' => $spec['slot'], 'file' => $meta, 'image' => true];
        }
    }
    return [$uploads, $errors];
}

/** Image name => temp path, for attached images only. */
function image_paths(array $uploads): array
{
    $paths = [];
    foreach ($uploads as $u) {
        if (!empty($u['image'])) {
            $paths[$u['key']] = (string) $u['file']['tmp_name'];
        }
    }
    return $paths;
}

/** Every document and director upload that will be validated and attached: ['key', 'slot', 'file']. */
function collect_uploads(array $documents, array $files, int $directorCount = 0): array
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

    switch ($post['customerType'] ?? null) {
        case 'corporate':
            return handle_corporate_submission($post, $files, $sendEmails);
        case 'individual':
            return handle_individual_submission($post, $files, $sendEmails);
        default:
            return failure(['customerType' => 'Unsupported customer type.']);
    }
}

/** PHP-level upload failures + type/size/total checks. Returns the errors found. */
function collect_upload_errors(array $uploads): array
{
    $errors = [];
    $checkable = [];
    foreach ($uploads as $upload) {
        $code = $upload['file']['error'] ?? UPLOAD_ERR_NO_FILE;
        if ($code !== UPLOAD_ERR_OK) {
            $errors[$upload['key']] = upload_error_message((int) $code);
        } else {
            $checkable[] = ['key' => $upload['key'], 'file' => $upload['file'], 'image' => !empty($upload['image'])];
        }
    }
    return array_merge($errors, validate_uploads($checkable)['errors']);
}

/** Build the PDF, send the emails, always clean up temp files, and shape the result. */
function deliver_submission(array $data, array $uploads, callable $sendEmails, ?callable $buildPdf = null): array
{
    $buildPdf = $buildPdf ?? 'build_submission_pdf';
    $attachments = [];
    foreach ($uploads as $upload) {
        $attachments[] = [
            'tmpPath' => $upload['file']['tmp_name'],
            'originalName' => $upload['slot'] . ' - ' . sanitize_filename((string) $upload['file']['name']),
        ];
    }

    try {
        try {
            $pdfBytes = call_user_func($buildPdf, $data);
        } catch (Throwable $e) {
            error_log('KYC submission PDF build failed: ' . get_class($e));
            return failure([], 'We could not send your submission. Please try again shortly.');
        }
        $emailResult = call_user_func($sendEmails, $data, $pdfBytes, $attachments);
    } finally {
        foreach ($attachments as $attachment) {
            if (file_exists($attachment['tmpPath'])) {
                @unlink($attachment['tmpPath']);
            }
        }
    }

    if (!$emailResult['success']) {
        return failure([], 'We could not send your submission. Please try again shortly.');
    }
    return ['success' => true, 'errors' => [], 'message' => 'Submission received.'];
}

function summarise_documents(array $documents): array
{
    return array_map(
        fn(array $d): array => ['id' => $d['id'], 'label' => $d['label'], 'attached' => $d['file'] !== null],
        $documents
    );
}

function handle_corporate_submission(array $post, array $files, callable $sendEmails): array
{
    $rows = is_array($post['directors'] ?? null) ? array_values($post['directors']) : [];
    $documents = parse_documents_input($files, CORPORATE_DOCUMENTS);
    [$images, $imageErrors] = collect_images($files, CORPORATE_IMAGES);
    $consent = !empty($post['consent']);

    $uploads = array_merge(collect_uploads($documents, $files, min(count($rows), MAX_DIRECTORS)), $images);
    $errors = array_merge(
        validate_entity($post)['errors'],
        validate_directors($post['directors'] ?? null)['errors'],
        validate_documents_consent($consent)['errors'],
        validate_funds($post)['errors'],
        validate_declaration($post)['errors'],
        missing_document_errors($documents),
        $imageErrors,
        collect_upload_errors($uploads)
    );
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

    $data = [
        'customerType' => 'corporate',
        'submittedAt' => date('Y-m-d H:i:s'),
        'fields' => $post,
        'directors' => $directorRows,
        'documents' => summarise_documents($documents),
        'consent' => $consent,
        'images' => image_paths($images),
    ];
    return deliver_submission($data, $uploads, $sendEmails);
}

function handle_individual_submission(array $post, array $files, callable $sendEmails): array
{
    $documents = parse_documents_input($files, INDIVIDUAL_DOCUMENTS);
    [$images, $imageErrors] = collect_images($files, INDIVIDUAL_IMAGES);
    $consent = !empty($post['consent']);

    $uploads = array_merge(collect_uploads($documents, $files), $images);
    $errors = array_merge(
        validate_individual_person($post)['errors'],
        validate_documents_consent($consent)['errors'],
        validate_individual_declaration($post)['errors'],
        missing_document_errors($documents),
        $imageErrors,
        collect_upload_errors($uploads)
    );
    if (count($errors) > 0) {
        return failure($errors);
    }

    $data = [
        'customerType' => 'individual',
        'submittedAt' => date('Y-m-d H:i:s'),
        'fields' => $post,
        'documents' => summarise_documents($documents),
        'consent' => $consent,
        'images' => image_paths($images),
    ];
    return deliver_submission($data, $uploads, $sendEmails);
}
