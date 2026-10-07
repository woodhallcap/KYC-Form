<?php
declare(strict_types=1);

const ALLOWED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'docx'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TOTAL_SIZE = 20 * 1024 * 1024;

const IMAGE_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png'];

const CORPORATE_DOCUMENTS = [
    'certificate_of_incorporation' => ['label' => 'CAC Certificate of Incorporation', 'required' => true],
    'cac_status_report' => ['label' => 'CAC Status Report', 'required' => true],
    'cac_forms' => ['label' => 'CAC Forms CAC2.3 / CAC1.1 - Directors & Shareholders', 'required' => true],
    'memorandum_articles' => ['label' => 'Memorandum & Articles of Association', 'required' => true],
    'board_resolution' => ['label' => 'Board Resolution to open account and obtain facility', 'required' => true],
    'company_bank_statement' => ['label' => 'Company Bank Statement - Last 12 months', 'required' => true],
    'government_id_signatories' => ['label' => 'Valid Government-issued ID of Authorized Signatories', 'required' => true],
    'passport_photograph_signatories' => ['label' => 'Recent Passport Photograph of Authorized Signatories', 'required' => true],
    'corporate_id_signatories' => ['label' => 'Corporate ID of Authorized Signatories', 'required' => true],
];

const INDIVIDUAL_DOCUMENTS = [
    'valid_means_of_id' => ['label' => 'Valid Means of ID', 'required' => true],
    'proof_of_address_utility' => ['label' => 'Proof of Address: Utility Bill (less than 3 months old)', 'required' => true],
    'proof_of_address_statement' => ['label' => 'Proof of Address: Bank Statement (less than 3 months old)', 'required' => true],
    'bank_statement_12_months' => ['label' => 'Bank Statement - Last 12 months', 'required' => true],
    'passport_photograph' => ['label' => 'Recent Passport Photograph', 'required' => true],
    'work_id' => ['label' => 'Work ID', 'required' => true],
    'employment_letter' => ['label' => 'Employment Letter', 'required' => true],
    'signature_mandate_card' => ['label' => 'Signature Mandate Card', 'required' => true],
];

const CORPORATE_IMAGES = [
    'signatory1SignatureFile' => ['slot' => 'signatory-1-signature', 'missing' => 'Authorized signatory 1 signature is required.'],
    'signatory2SignatureFile' => ['slot' => 'signatory-2-signature', 'missing' => 'Authorized signatory 2 signature is required.'],
    'sealFile' => ['slot' => 'company-seal', 'missing' => 'Company seal or stamp is required.'],
];
const INDIVIDUAL_IMAGES = [
    'signatureFile' => ['slot' => 'signature', 'missing' => 'Handwritten signature is required.'],
];

const DIRECTOR_FILE_IDS = ['id', 'bvn', 'nin', 'proof_of_address'];
const MAX_DIRECTORS = 25;

const MEANS_OF_ID = ['nin', 'passport', 'drivers_license', 'voters_card'];
const SOURCE_OF_INCOME_OPTIONS = ['salary', 'business', 'investment', 'inheritance', 'other'];
const PURPOSE_OPTIONS = ['loan', 'lease', 'investment', 'other'];
const ARRAY_TEXT_FIELDS = ['meansOfId'];

const SINGLE_LINE_TEXT_FIELDS = [
    'customerType', 'companyName', 'rcNumber', 'dateOfIncorporation', 'natureOfBusiness', 'tin', 'companyEmail',
    'bankAccountNumber', 'bankName', 'sourceOfFunds', 'facilityAmount',
    'signatory1Name', 'signatory1Date', 'signatory2Name', 'signatory2Date',
    'fullName', 'dateOfBirth', 'placeOfBirth', 'gender', 'nationality', 'countryOfResidence', 'lga', 'state', 'phone', 'email',
    'idNumber', 'idExpiry', 'bvn', 'nin', 'occupation', 'employerName', 'officialEmail', 'sourceOfIncome', 'sourceOfIncomeOther', 'sourceOfWealth',
    'purposeOfRelationship', 'purposeOther', 'declarationName', 'signatureDate',
];
const MULTILINE_TEXT_FIELDS = ['registeredAddress', 'businessAddress', 'residentialAddress', 'officeAddress'];
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
    foreach (ARRAY_TEXT_FIELDS as $field) {
        if (isset($post[$field]) && is_array($post[$field])) {
            $clean = [];
            foreach ($post[$field] as $item) {
                if (is_string($item)) {
                    $clean[] = sanitize_text($item);
                }
            }
            $post[$field] = $clean;
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
        'rcNumber' => 'Business registration number is required.',
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

function validate_image_meta(array $file): array
{
    $name = $file['name'] ?? '';
    if (!in_array(strtolower(pathinfo($name, PATHINFO_EXTENSION)), IMAGE_FILE_EXTENSIONS, true)) {
        return ['valid' => false, 'error' => 'Upload a JPG or PNG image.'];
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
        $result = !empty($entry['image']) ? validate_image_meta($entry['file']) : validate_file_meta($entry['file']);
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
    if (empty($data['signatureAgree'])) $errors['signatureAgree'] = 'You must confirm the attached images are your signatures.';
    return validation_result($errors);
}

function is_choice($value, array $options): bool
{
    return is_string($value) && in_array($value, $options, true);
}

function are_choices($value, array $options): bool
{
    if (!is_array($value) || count($value) === 0) {
        return false;
    }
    foreach ($value as $item) {
        if (!is_choice($item, $options)) {
            return false;
        }
    }
    return true;
}

function validate_individual_person(array $data): array
{
    $errors = [];
    $required = [
        'fullName' => 'Full name is required.', 'dateOfBirth' => 'Date of birth is required.',
        'placeOfBirth' => 'Place of birth is required.', 'nationality' => 'Nationality is required.',
        'countryOfResidence' => 'Country of residence is required.', 'residentialAddress' => 'Residential address is required.',
        'lga' => 'LGA is required.', 'state' => 'State is required.', 'phone' => 'Phone number is required.',
        'bvn' => 'BVN is required.', 'nin' => 'NIN is required.',
        'occupation' => 'Occupation is required.', 'employerName' => 'Employer/business name is required.',
        'officeAddress' => 'Office address is required.', 'sourceOfWealth' => 'Source of wealth is required.',
    ];
    foreach ($required as $field => $message) {
        if (is_blank($data[$field] ?? null)) $errors[$field] = $message;
    }
    if (!is_choice($data['gender'] ?? null, ['M', 'F'])) $errors['gender'] = 'Select a gender.';
    $email = $data['email'] ?? null;
    if (is_blank($email)) {
        $errors['email'] = 'Email is required.';
    } elseif (!is_valid_email((string) $email)) {
        $errors['email'] = 'Enter a valid email address.';
    }
    $officialEmail = $data['officialEmail'] ?? null;
    if (is_blank($officialEmail)) {
        $errors['officialEmail'] = 'Official email is required.';
    } elseif (!is_valid_email((string) $officialEmail)) {
        $errors['officialEmail'] = 'Enter a valid email address.';
    }
    if (!are_choices($data['meansOfId'] ?? null, MEANS_OF_ID)) $errors['meansOfId'] = 'Select at least one means of ID.';
    $income = $data['sourceOfIncome'] ?? null;
    if (!is_choice($income, SOURCE_OF_INCOME_OPTIONS)) {
        $errors['sourceOfIncome'] = 'Select a source of income.';
    } elseif ($income === 'other' && is_blank($data['sourceOfIncomeOther'] ?? null)) {
        $errors['sourceOfIncomeOther'] = 'Please specify the source of income.';
    }
    $purpose = $data['purposeOfRelationship'] ?? null;
    if (!is_choice($purpose, PURPOSE_OPTIONS)) {
        $errors['purposeOfRelationship'] = 'Select the purpose of the relationship.';
    } elseif ($purpose === 'other' && is_blank($data['purposeOther'] ?? null)) {
        $errors['purposeOther'] = 'Please specify the purpose.';
    }
    return validation_result($errors);
}

function validate_individual_declaration(array $data): array
{
    $errors = [];
    if (is_blank($data['declarationName'] ?? null)) $errors['declarationName'] = 'Name is required.';
    if (is_blank($data['signatureDate'] ?? null)) $errors['signatureDate'] = 'Signature date is required.';
    if (empty($data['signatureAgree'])) $errors['signatureAgree'] = 'You must confirm the attached image is your signature.';
    return validation_result($errors);
}
