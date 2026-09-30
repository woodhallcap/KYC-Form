<?php
declare(strict_types=1);

const ALLOWED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'docx'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TOTAL_SIZE = 20 * 1024 * 1024;

const CORPORATE_DOCUMENT_IDS = [
    'certificate_of_incorporation', 'cac_forms', 'memorandum_articles',
    'board_resolution', 'company_bank_statement', 'corporate_id_signatories',
];
const DIRECTOR_FILE_IDS = ['id', 'bvn', 'nin', 'proof_of_address'];
const MAX_DIRECTORS = 25;

const SINGLE_LINE_TEXT_FIELDS = [
    'customerType', 'companyName', 'rcNumber', 'dateOfIncorporation', 'natureOfBusiness', 'tin', 'companyEmail',
    'bankAccountNumber', 'bankName', 'sourceOfFunds', 'facilityAmount',
    'signatory1Name', 'signatory1Date', 'signatory2Name', 'signatory2Date',
];
const MULTILINE_TEXT_FIELDS = ['registeredAddress', 'businessAddress'];
const DIRECTOR_SINGLE_LINE_FIELDS = ['name', 'designation', 'bvn', 'nin', 'shareholdingPercent', 'nationality', 'pep'];
const DIRECTOR_MULTILINE_FIELDS = ['residentialAddress'];

function is_blank($value): bool
{
    if ($value !== null && !is_scalar($value)) {
        return true;
    }
    return $value === null || trim((string) $value) === '';
}

function sanitize_text(string $value): string
{
    $value = str_replace(["\r\n", "\r", "\n"], '', $value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value);
    return trim($value);
}

function sanitize_multiline_text(string $value): string
{
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value);
    return trim($value);
}

function sanitize_filename(string $name): string
{
    $name = basename($name);
    $name = preg_replace('/[\x00-\x1F\x7F<>:"\/\\\\|?*]/', '_', $name);
    $name = trim($name);
    if ($name === '') {
        $name = 'document';
    }
    return mb_substr($name, 0, 150);
}

function sanitize_submission_input(array $post): array
{
    foreach (SINGLE_LINE_TEXT_FIELDS as $field) {
        if (isset($post[$field]) && is_string($post[$field])) {
            $post[$field] = sanitize_text($post[$field]);
        }
    }
    foreach (MULTILINE_TEXT_FIELDS as $field) {
        if (isset($post[$field]) && is_string($post[$field])) {
            $post[$field] = sanitize_multiline_text($post[$field]);
        }
    }
    if (isset($post['directors']) && is_array($post['directors'])) {
        $rows = [];
        foreach ($post['directors'] as $row) {
            if (!is_array($row)) {
                continue;
            }
            foreach (DIRECTOR_SINGLE_LINE_FIELDS as $field) {
                if (isset($row[$field]) && is_string($row[$field])) {
                    $row[$field] = sanitize_text($row[$field]);
                }
            }
            foreach (DIRECTOR_MULTILINE_FIELDS as $field) {
                if (isset($row[$field]) && is_string($row[$field])) {
                    $row[$field] = sanitize_multiline_text($row[$field]);
                }
            }
            $rows[] = $row;
        }
        $post['directors'] = $rows;
    }
    return $post;
}

function is_valid_email(string $value): bool
{
    return filter_var($value, FILTER_VALIDATE_EMAIL) !== false;
}

function validation_result(array $errors): array
{
    return ['valid' => count($errors) === 0, 'errors' => $errors];
}

function validate_entity(array $data): array
{
    $errors = [];
    $required = [
        'companyName' => 'Company name is required.',
        'rcNumber' => 'RC number is required.',
        'dateOfIncorporation' => 'Date of incorporation is required.',
        'registeredAddress' => 'Registered address is required.',
        'natureOfBusiness' => 'Nature of business is required.',
        'tin' => 'Tax identification number is required.',
    ];
    foreach ($required as $field => $message) {
        if (is_blank($data[$field] ?? null)) $errors[$field] = $message;
    }
    $email = $data['companyEmail'] ?? null;
    if (is_blank($email)) {
        $errors['companyEmail'] = 'Company email is required.';
    } elseif (!is_valid_email((string) $email)) {
        $errors['companyEmail'] = 'Enter a valid email address.';
    }
    if (is_blank($data['bankAccountNumber'] ?? null)) $errors['bankAccountNumber'] = 'Corporate bank account number is required.';
    if (is_blank($data['bankName'] ?? null)) $errors['bankName'] = 'Bank name is required.';
    return validation_result($errors);
}

function validate_directors($rows): array
{
    if (!is_array($rows) || count($rows) === 0) {
        return validation_result(['directors' => 'Add at least one director, signatory or UBO.']);
    }
    if (count($rows) > MAX_DIRECTORS) {
        return validation_result(['directors' => 'Too many directors listed (maximum ' . MAX_DIRECTORS . ').']);
    }
    $required = [
        'name' => 'Name is required.',
        'designation' => 'Designation is required.',
        'bvn' => 'BVN is required.',
        'nin' => 'NIN is required.',
        'nationality' => 'Nationality is required.',
        'residentialAddress' => 'Residential address is required.',
    ];
    $errors = [];
    foreach (array_values($rows) as $i => $row) {
        $row = is_array($row) ? $row : [];
        foreach ($required as $field => $message) {
            if (is_blank($row[$field] ?? null)) $errors["directors.$i.$field"] = $message;
        }
        $pct = $row['shareholdingPercent'] ?? null;
        if (is_blank($pct)) {
            $errors["directors.$i.shareholdingPercent"] = '% shareholding is required.';
        } elseif (!preg_match('/^\d+(\.\d+)?$/', (string) $pct) || (float) $pct > 100) {
            $errors["directors.$i.shareholdingPercent"] = 'Enter a percentage between 0 and 100.';
        }
        if (!in_array($row['pep'] ?? '', ['yes', 'no'], true)) {
            $errors["directors.$i.pep"] = 'Select Yes or No.';
        }
    }
    return validation_result($errors);
}

function validate_file_meta(array $file): array
{
    $name = $file['name'] ?? '';
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (!in_array($ext, ALLOWED_FILE_EXTENSIONS, true)) {
        return ['valid' => false, 'error' => "File type not allowed: {$name}"];
    }
    if (($file['size'] ?? 0) > MAX_FILE_SIZE) {
        return ['valid' => false, 'error' => "File exceeds 5MB limit: {$name}"];
    }
    return ['valid' => true, 'error' => null];
}

function validate_uploads(array $entries): array
{
    $errors = [];
    $totalSize = 0;
    foreach ($entries as $entry) {
        $result = validate_file_meta($entry['file']);
        if (!$result['valid']) {
            $errors[$entry['key']] = $result['error'];
        } else {
            $totalSize += (int) ($entry['file']['size'] ?? 0);
        }
    }
    if ($totalSize > MAX_TOTAL_SIZE) {
        $errors['_total'] = 'Total attachments exceed the 20MB limit.';
    }
    return validation_result($errors);
}

function validate_documents_consent(bool $consent): array
{
    return validation_result($consent ? [] : ['consent' => 'Consent to processing is required.']);
}

function validate_funds(array $data): array
{
    $errors = [];
    if (is_blank($data['sourceOfFunds'] ?? null)) $errors['sourceOfFunds'] = 'Source of funds is required.';
    if (is_blank($data['facilityAmount'] ?? null)) $errors['facilityAmount'] = 'Facility amount requested is required.';
    return validation_result($errors);
}

function validate_declaration(array $data): array
{
    $errors = [];
    foreach ([1, 2] as $n) {
        if (is_blank($data["signatory{$n}Name"] ?? null)) $errors["signatory{$n}Name"] = "Authorized signatory {$n} name is required.";
        if (is_blank($data["signatory{$n}Date"] ?? null)) $errors["signatory{$n}Date"] = "Authorized signatory {$n} date is required.";
    }
    if (empty($data['signatureAgree'])) $errors['signatureAgree'] = 'You must confirm this constitutes your signature.';
    return validation_result($errors);
}
