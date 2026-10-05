<?php
declare(strict_types=1);

require __DIR__ . '/test_helper.php';
require __DIR__ . '/../../config.php';
require __DIR__ . '/../../lib/submission-handler.php';

function sample_post(array $o = []): array
{
    return array_replace([
        'customerType' => 'corporate', 'companyName' => 'Acme Trading Ltd', 'rcNumber' => 'RC123456', 'dateOfIncorporation' => '2015-04-01',
        'registeredAddress' => '1 Marina Road, Lagos', 'businessAddress' => '', 'natureOfBusiness' => 'Trade finance', 'tin' => 'TIN000111',
        'companyEmail' => 'info@acme.com', 'bankAccountNumber' => '0011223344', 'bankName' => 'First Bank',
        'directors' => [['name' => 'Jane Doe', 'designation' => 'MD', 'bvn' => '1', 'nin' => '2', 'shareholdingPercent' => '60', 'nationality' => 'Nigerian', 'pep' => 'no', 'residentialAddress' => '1 Rd']],
        'consent' => 'on',
        'sourceOfFunds' => 'Trade proceeds', 'facilityAmount' => '5,000,000',
        'signatory1Name' => 'Jane Doe', 'signatory1Date' => '2026-09-15', 'signatory2Name' => 'John Roe', 'signatory2Date' => '2026-09-15', 'signatureAgree' => 'on',
    ], $o);
}

function tmp_file(string $content = 'dummy'): string
{
    $p = tempnam(sys_get_temp_dir(), 'kyc-test-');
    file_put_contents($p, $content);
    return $p;
}

function upload(string $name, string $tmp, int $size = 5, int $err = UPLOAD_ERR_OK): array
{
    return ['name' => $name, 'tmp' => $tmp, 'size' => $size, 'err' => $err];
}

/** A PHP-style nested $_FILES entry: $path is the key path under $top. */
function files_entry(string $top, array $path, array $u): array
{
    $wrap = function ($v) use ($path) {
        for ($i = count($path) - 1; $i >= 0; $i--) {
            $v = [$path[$i] => $v];
        }
        return $v;
    };
    return [$top => ['name' => $wrap($u['name']), 'size' => $wrap($u['size']), 'tmp_name' => $wrap($u['tmp']), 'error' => $wrap($u['err'])]];
}

function merge_files(array ...$entries): array
{
    return array_replace_recursive(...$entries);
}

/** A full set of valid uploads: one file per document id and one image per image name. */
function all_files(array $docIds, array $imageNames): array
{
    $entries = [];
    foreach ($docIds as $id) {
        $entries[] = files_entry('documents', [$id], upload("$id.pdf", tmp_file()));
    }
    foreach ($imageNames as $name) {
        $entries[] = files_entry($name, [], upload("$name.png", tmp_file()));
    }
    return $entries ? array_replace_recursive(...$entries) : [];
}

function corporate_files(array $extra = []): array
{
    return array_replace_recursive(all_files(array_keys(CORPORATE_DOCUMENTS), array_keys(CORPORATE_IMAGES)), $extra);
}

function individual_files(array $extra = []): array
{
    return array_replace_recursive(all_files(array_keys(INDIVIDUAL_DOCUMENTS), array_keys(INDIVIDUAL_IMAGES)), $extra);
}

function ok_sender(?array &$captured = null, ?array &$attachments = null): callable
{
    return function (array $data, string $pdf, array $att) use (&$captured, &$attachments) {
        $captured = $data;
        $attachments = $att;
        return ['success' => true, 'error' => null];
    };
}

test_case('rejects a missing or unsupported customerType without sending', function () {
    foreach ([[], ['customerType' => 'partnership'], ['customerType' => ['x']]] as $post) {
        $called = false;
        $r = handle_submission($post, [], function () use (&$called) {
            $called = true;
            return ['success' => true, 'error' => null];
        });
        assert_equal(false, $r['success']);
        assert_true(isset($r['errors']['customerType']));
        assert_true(!$called);
    }
});

test_case('returns field errors for an otherwise empty corporate submission', function () {
    $r = handle_submission(['customerType' => 'corporate'], []);
    assert_equal(false, $r['success']);
    foreach (['companyName', 'directors', 'consent', 'sourceOfFunds', 'signatory1Name'] as $k) {
        assert_true(isset($r['errors'][$k]), $k);
    }
});

test_case('does not fatal on hostile shapes (directors as a string, 26 rows)', function () {
    $r = handle_submission(sample_post(['directors' => 'foo']), []);
    assert_equal(false, $r['success']);
    assert_true(isset($r['errors']['directors']));
    $r = handle_submission(sample_post(['directors' => array_fill(0, 26, sample_post()['directors'][0])]), []);
    assert_equal('Too many directors listed (maximum 25).', $r['errors']['directors']);
});

test_case('succeeds and hands the email sender the new data shape', function () {
    $data = null;
    $att = null;
    $r = handle_submission(sample_post(), corporate_files(), ok_sender($data, $att));
    assert_equal(true, $r['success']);
    assert_equal('corporate', $data['customerType']);
    assert_equal('Acme Trading Ltd', $data['fields']['companyName']);
    assert_equal('Jane Doe', $data['directors'][0]['name']);
    assert_equal(count(CORPORATE_DOCUMENTS), count($data['documents']));
    assert_equal(['id' => 'certificate_of_incorporation', 'label' => 'CAC Certificate of Incorporation', 'attached' => true], $data['documents'][0]);
    assert_equal(true, $data['consent']);
    assert_true(!array_key_exists('sealAttached', $data));
});

test_case('strips header-injection attempts from text fields and director rows', function () {
    $data = null;
    $post = sample_post(['companyName' => "Acme Ltd\r\nBcc: attacker@evil.com", 'registeredAddress' => "1 Marina\r\nBcc: a@evil.com"]);
    $post['directors'][0]['name'] = "Jane\r\nBcc: a@evil.com";
    handle_submission($post, corporate_files(), ok_sender($data));
    assert_equal('Acme LtdBcc: attacker@evil.com', $data['fields']['companyName']);
    assert_true(strpos($data['fields']['registeredAddress'], "\r") === false);
    assert_equal('JaneBcc: a@evil.com', $data['directors'][0]['name']);
});

test_case('attaches a document with a sanitised, slot-prefixed name and deletes temp files', function () {
    $tmp = tmp_file();
    $att = null;
    $files = corporate_files(files_entry('documents', ['certificate_of_incorporation'], upload('../../evil<>.pdf', $tmp)));
    $r = handle_submission(sample_post(), $files, ok_sender($d, $att));
    assert_equal(true, $r['success']);
    $names = array_column($att, 'originalName');
    assert_true(in_array('certificate_of_incorporation - evil__.pdf', $names, true));
    assert_true(!file_exists($tmp), 'temp file should be cleaned up');
});

test_case('rejects a corporate submission missing a required document or image, keyed by id', function () {
    $files = all_files(['certificate_of_incorporation'], ['signatory1SignatureFile']);
    $r = handle_submission(sample_post(), $files, ok_sender());
    assert_equal(false, $r['success']);
    assert_equal('CAC Status Report is required.', $r['errors']['cac_status_report']);
    assert_equal('Company seal or stamp is required.', $r['errors']['sealFile']);
    assert_true(!isset($r['errors']['corporate_id_signatories']), 'optional doc');
    assert_true(!isset($r['errors']['certificate_of_incorporation']));
});

test_case('rejects a non-image signature', function () {
    $files = corporate_files(files_entry('signatory2SignatureFile', [], upload('sig.pdf', tmp_file())));
    $r = handle_submission(sample_post(), $files, ok_sender());
    assert_equal('Upload a JPG or PNG image.', $r['errors']['signatory2SignatureFile']);
});

test_case('passes attached flags and image paths to the sender, and slot-names image attachments', function () {
    $r = handle_submission(sample_post(), corporate_files(), ok_sender($data, $att));
    assert_equal(true, $r['success']);
    $byId = array_column($data['documents'], 'attached', 'id');
    assert_equal(true, $byId['cac_status_report']);
    assert_true(isset($data['images']['sealFile']));
    assert_equal(['signatory1SignatureFile', 'signatory2SignatureFile', 'sealFile'], array_keys($data['images']));
    $names = array_column($att, 'originalName');
    assert_true(count(array_filter($names, fn($n) => strpos($n, 'signatory-1-signature - ') === 0)) === 1);
});

test_case('an optional document left out is reported as not attached', function () {
    $docIds = array_diff(array_keys(CORPORATE_DOCUMENTS), ['corporate_id_signatories']);
    $files = all_files($docIds, array_keys(CORPORATE_IMAGES));
    $r = handle_submission(sample_post(), $files, ok_sender($data, $att));
    assert_equal(true, $r['success']);
    assert_equal(false, array_column($data['documents'], 'attached', 'id')['corporate_id_signatories']);
});

test_case('blocks a document with a disallowed file type', function () {
    $tmp = tmp_file();
    $called = false;
    $files = corporate_files(files_entry('documents', ['certificate_of_incorporation'], upload('virus.exe', $tmp)));
    $r = handle_submission(sample_post(), $files, function () use (&$called) {
        $called = true;
        return ['success' => true, 'error' => null];
    });
    assert_equal('File type not allowed: virus.exe', $r['errors']['certificate_of_incorporation']);
    assert_true(!$called);
    @unlink($tmp);
});

test_case('rejects a PHP-level upload failure instead of silently dropping it', function () {
    $called = false;
    $files = corporate_files(files_entry('documents', ['certificate_of_incorporation'], upload('big.pdf', '', 0, UPLOAD_ERR_INI_SIZE)));
    $r = handle_submission(sample_post(), $files, function () use (&$called) {
        $called = true;
        return ['success' => true, 'error' => null];
    });
    assert_equal(false, $r['success']);
    assert_true(isset($r['errors']['certificate_of_incorporation']));
    assert_true(!$called);
});

test_case('attaches director files and the seal with distinct names even for identical filenames', function () {
    $a = tmp_file();
    $b = tmp_file();
    $c = tmp_file();
    $att = null;
    $d = null;
    $post = sample_post();
    $post['directors'][] = $post['directors'][0];
    $files = corporate_files(merge_files(
        files_entry('directors', [0, 'files', 'id'], upload('id.pdf', $a)),
        files_entry('directors', [1, 'files', 'id'], upload('id.pdf', $b)),
        files_entry('sealFile', [], upload('seal.png', $c))
    ));
    $r = handle_submission($post, $files, ok_sender($d, $att));
    assert_equal(true, $r['success']);
    $names = array_column($att, 'originalName');
    assert_true(in_array('company-seal - seal.png', $names, true));
    assert_true(in_array('director-1-id - id.pdf', $names, true));
    assert_true(in_array('director-2-id - id.pdf', $names, true));
    assert_true(isset($d['images']['sealFile']));
    assert_equal(['id'], $d['directors'][0]['attachments']);
    foreach ([$a, $b, $c] as $p) {
        assert_true(!file_exists($p));
    }
});

test_case('flags a director file with a bad type under directorFile.<i>.<id>', function () {
    $tmp = tmp_file();
    $files = files_entry('directors', [0, 'files', 'nin'], upload('x.exe', $tmp));
    $r = handle_submission(sample_post(), $files, ok_sender());
    assert_equal('File type not allowed: x.exe', $r['errors']['directorFile.0.nin']);
    @unlink($tmp);
});

test_case('counts documents, director files and the seal toward the 20MB total', function () {
    $t = [tmp_file(), tmp_file(), tmp_file(), tmp_file(), tmp_file()];
    $size = 4 * 1024 * 1024 + 900000;
    $files = corporate_files(merge_files(
        files_entry('documents', ['certificate_of_incorporation'], upload('a.pdf', $t[0], $size)),
        files_entry('directors', [0, 'files', 'id'], upload('b.pdf', $t[1], $size)),
        files_entry('directors', [0, 'files', 'nin'], upload('c.pdf', $t[2], $size)),
        files_entry('directors', [0, 'files', 'bvn'], upload('d.pdf', $t[3], $size)),
        files_entry('sealFile', [], upload('e.png', $t[4], $size))
    ));
    $r = handle_submission(sample_post(), $files, ok_sender());
    assert_equal('Total attachments exceed the 20MB limit.', $r['errors']['_total']);
    foreach ($t as $p) {
        @unlink($p);
    }
});

test_case('surfaces email failures without exposing internals', function () {
    $r = handle_submission(sample_post(), corporate_files(), fn() => ['success' => false, 'error' => 'SMTP down']);
    assert_equal(false, $r['success']);
    assert_true(strpos($r['message'], 'SMTP') === false);
});

function sample_individual_post(array $o = []): array
{
    return array_replace([
        'customerType' => 'individual',
        'fullName' => 'Jane Doe', 'dateOfBirth' => '1990-01-01', 'placeOfBirth' => 'Lagos', 'gender' => 'F', 'nationality' => 'Nigerian',
        'countryOfResidence' => 'Nigeria', 'residentialAddress' => '1 Rd', 'lga' => 'Ikeja', 'state' => 'Lagos', 'phone' => '08000000000',
        'email' => 'jane@example.com', 'meansOfId' => ['nin', 'passport'], 'idNumber' => 'A123', 'bvn' => '222', 'nin' => '333',
        'occupation' => 'Engineer', 'employerName' => 'Acme Ltd', 'officeAddress' => '2 Office Rd', 'sourceOfIncome' => 'salary', 'sourceOfWealth' => 'Savings', 'purposeOfRelationship' => 'loan',
        'officialEmail' => 'jane@work.example.com', 'consent' => 'on',
        'declarationName' => 'Jane Doe', 'signatureDate' => '2026-09-15', 'signatureAgree' => 'on',
    ], $o);
}

test_case('individual: empty submission returns field errors', function () {
    $r = handle_submission(['customerType' => 'individual'], []);
    foreach (['fullName', 'email', 'meansOfId', 'consent', 'declarationName'] as $k) {
        assert_true(isset($r['errors'][$k]), $k);
    }
});

test_case('individual: succeeds and hands the sender the individual data shape', function () {
    $d = null;
    $r = handle_submission(sample_individual_post(), individual_files(), ok_sender($d));
    assert_equal(true, $r['success']);
    assert_equal('individual', $d['customerType']);
    assert_equal('Jane Doe', $d['fields']['fullName']);
    assert_equal(['nin', 'passport'], $d['fields']['meansOfId']);
    assert_equal(count(INDIVIDUAL_DOCUMENTS), count($d['documents']));
    assert_equal(['id' => 'valid_means_of_id', 'label' => 'Valid Means of ID', 'attached' => true], $d['documents'][0]);
    assert_equal(['signatureFile'], array_keys($d['images']));
    assert_equal(true, $d['consent']);
});

test_case('an individual submission needs the five required documents and the signature image', function () {
    $r = handle_submission(['customerType' => 'individual'], [], ok_sender());
    foreach (['valid_means_of_id', 'proof_of_address_utility', 'proof_of_address_statement', 'bank_statement_12_months', 'passport_photograph', 'signatureFile'] as $k) {
        assert_true(isset($r['errors'][$k]), $k);
    }
    foreach (['work_id', 'employment_letter', 'signature_mandate_card'] as $k) {
        assert_true(!isset($r['errors'][$k]), $k);
    }
});

test_case('individual: hostile array shapes are rejected, not fatal', function () {
    foreach ([['meansOfId' => 'nin'], ['meansOfId' => [['nin']]]] as $o) {
        $r = handle_submission(sample_individual_post($o), individual_files(), ok_sender());
        assert_equal(false, $r['success'], json_encode($o));
    }
});

test_case('individual: strips header injection from text fields', function () {
    $d = null;
    handle_submission(sample_individual_post(['fullName' => "Jane\r\nBcc: a@evil.com"]), individual_files(), ok_sender($d));
    assert_equal('JaneBcc: a@evil.com', $d['fields']['fullName']);
});

test_case('individual: attaches a document and the signature with slot-prefixed names and deletes temp files', function () {
    $a = tmp_file();
    $b = tmp_file();
    $att = null;
    $files = individual_files(merge_files(
        files_entry('documents', ['valid_means_of_id'], upload('id.pdf', $a)),
        files_entry('signatureFile', [], upload('sig.png', $b))
    ));
    $r = handle_submission(sample_individual_post(), $files, ok_sender($d, $att));
    assert_equal(true, $r['success']);
    $names = array_column($att, 'originalName');
    assert_true(in_array('valid_means_of_id - id.pdf', $names, true));
    assert_true(in_array('signature - sig.png', $names, true));
    assert_true(!file_exists($a) && !file_exists($b));
});

test_case('individual: blocks a document with a disallowed type and a PHP-level upload failure', function () {
    $tmp = tmp_file();
    $called = false;
    $files = individual_files(merge_files(
        files_entry('documents', ['valid_means_of_id'], upload('virus.exe', $tmp)),
        files_entry('documents', ['passport_photograph'], upload('big.pdf', '', 0, UPLOAD_ERR_INI_SIZE))
    ));
    $r = handle_submission(sample_individual_post(), $files, function () use (&$called) {
        $called = true;
        return ['success' => true, 'error' => null];
    });
    assert_equal('File type not allowed: virus.exe', $r['errors']['valid_means_of_id']);
    assert_true(isset($r['errors']['passport_photograph']));
    assert_true(!$called);
    @unlink($tmp);
});

test_case('individual: email failures do not expose internals', function () {
    $r = handle_submission(sample_individual_post(), individual_files(), fn() => ['success' => false, 'error' => 'SMTP down']);
    assert_equal(false, $r['success']);
    assert_true(strpos($r['message'], 'SMTP') === false);
});

test_case('a corporate post still works alongside the individual path', function () {
    $r = handle_submission(sample_post(), corporate_files(), ok_sender());
    assert_equal(true, $r['success']);
});

test_case('a PDF build failure returns the send error, skips the sender and deletes temp files', function () {
    $tmp = tmp_file();
    $files = corporate_files(files_entry('documents', ['certificate_of_incorporation'], upload('coi.pdf', $tmp)));
    $sent = false;
    $sender = function () use (&$sent) {
        $sent = true;
        return ['success' => true, 'error' => null];
    };
    $throwing = function (array $data): string {
        throw new RuntimeException('pdf boom');
    };
    $prev = ini_set('error_log', '/dev/null');
    $uploads = collect_uploads(parse_documents_input($files, CORPORATE_DOCUMENTS), $files);
    $r = deliver_submission(['customerType' => 'corporate'], $uploads, $sender, $throwing);
    ini_set('error_log', (string) $prev);
    assert_equal(false, $r['success']);
    assert_equal('We could not send your submission. Please try again shortly.', $r['message']);
    assert_true(!$sent, 'sender must not be called');
    assert_true(!file_exists($tmp), 'temp file should be deleted');
});

test_summary();
