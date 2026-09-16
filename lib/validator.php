<?php
declare(strict_types=1);

const ALLOWED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'docx'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TOTAL_SIZE = 20 * 1024 * 1024;

const DOCUMENT_IDS = [
    'certificate_of_incorporation',
    'cac_status_report',
    'memorandum_articles',
    'directors_id',
    'bvn_nin',
    'utility_bill',
    'corporate_profile',
    'regulatory_licences',
    'bank_statements',
    'audited_financials',
    'personal_financial_info',
    'aml_certificate',
];

function is_blank($value): bool
{
    return $value === null || trim((string) $value) === '';
}

function is_valid_email(string $value): bool
{
    return filter_var($value, FILTER_VALIDATE_EMAIL) !== false;
}

function validate_step1(array $data): array
{
    $errors = [];
    if (is_blank($data['companyName'] ?? null)) $errors['companyName'] = 'Company name is required.';
    if (is_blank($data['rcNumber'] ?? null)) $errors['rcNumber'] = 'RC number is required.';
    if (is_blank($data['dateOfIncorporation'] ?? null)) $errors['dateOfIncorporation'] = 'Date of incorporation is required.';
    $legalStatus = $data['legalStatus'] ?? null;
    if (is_blank($legalStatus)) {
        $errors['legalStatus'] = 'Legal status is required.';
    } elseif ($legalStatus === 'other' && is_blank($data['legalStatusOther'] ?? null)) {
        $errors['legalStatusOther'] = 'Please specify the legal status.';
    }
    if (is_blank($data['registeredAddress'] ?? null)) $errors['registeredAddress'] = 'Registered address is required.';
    if (is_blank($data['natureOfBusiness'] ?? null)) $errors['natureOfBusiness'] = 'Nature of business is required.';
    if (is_blank($data['tin'] ?? null)) $errors['tin'] = 'Tax identification number is required.';
    $email = $data['companyEmail'] ?? null;
    if (is_blank($email)) {
        $errors['companyEmail'] = 'Company email is required.';
    } elseif (!is_valid_email((string) $email)) {
        $errors['companyEmail'] = 'Enter a valid email address.';
    }
    if (is_blank($data['bankAccountNumber'] ?? null)) $errors['bankAccountNumber'] = 'Corporate bank account number is required.';
    if (is_blank($data['bankName'] ?? null)) $errors['bankName'] = 'Bank name is required.';

    return ['valid' => count($errors) === 0, 'errors' => $errors];
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

function validate_step2(array $documents, bool $consent): array
{
    $errors = [];
    $totalSize = 0;
    foreach ($documents as $doc) {
        if (!empty($doc['submitted']) && !empty($doc['file'])) {
            $result = validate_file_meta($doc['file']);
            if (!$result['valid']) {
                $errors[$doc['id']] = $result['error'];
            } else {
                $totalSize += $doc['file']['size'] ?? 0;
            }
        }
    }
    if ($totalSize > MAX_TOTAL_SIZE) {
        $errors['_total'] = 'Total attachments exceed the 20MB limit.';
    }
    if (!$consent) {
        $errors['consent'] = 'Consent to processing is required.';
    }
    return ['valid' => count($errors) === 0, 'errors' => $errors];
}

function validate_step3(array $data): array
{
    $errors = [];
    if (is_blank($data['certifyingName'] ?? null)) $errors['certifyingName'] = 'Certifying name is required.';
    if (is_blank($data['designation'] ?? null)) $errors['designation'] = 'Designation is required.';
    if (is_blank($data['signatureName'] ?? null)) $errors['signatureName'] = 'Typed signature is required.';
    if (empty($data['signatureAgree'])) $errors['signatureAgree'] = 'You must confirm this constitutes your signature.';
    return ['valid' => count($errors) === 0, 'errors' => $errors];
}
