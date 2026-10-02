<?php
declare(strict_types=1);

require __DIR__ . '/test_helper.php';
require __DIR__ . '/../../config.php';
require __DIR__ . '/../../lib/submission-handler.php';

const CORPORATE_DOCS = ['certificate_of_incorporation', 'cac_forms', 'memorandum_articles', 'board_resolution', 'company_bank_statement', 'corporate_id_signatories'];
const INDIVIDUAL_DOCS = ['valid_means_of_id', 'utility_bill', 'bank_statement', 'passport_photograph', 'signature_mandate_card'];

function sample_post(array $o = []): array
{
    $documents = [];
    foreach (CORPORATE_DOCS as $id) {
        $documents[$id] = ['submitted' => 'on'];
    }
    return array_replace([
        'customerType' => 'corporate', 'companyName' => 'Acme Trading Ltd', 'rcNumber' => 'RC123456', 'dateOfIncorporation' => '2015-04-01',
        'registeredAddress' => '1 Marina Road, Lagos', 'businessAddress' => '', 'natureOfBusiness' => 'Trade finance', 'tin' => 'TIN000111',
        'companyEmail' => 'info@acme.com', 'bankAccountNumber' => '0011223344', 'bankName' => 'First Bank',
        'directors' => [['name' => 'Jane Doe', 'designation' => 'MD', 'bvn' => '1', 'nin' => '2', 'shareholdingPercent' => '60', 'nationality' => 'Nigerian', 'pep' => 'no', 'residentialAddress' => '1 Rd']],
        'documents' => $documents, 'consent' => 'on',
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

/** Uploads for the given document ids. Returns [$files, $tmpPaths]. */
function document_files(array $ids, int $size = 5): array
{
    $entries = [];
    $tmps = [];
    foreach ($ids as $id) {
        $tmp = tmp_file();
        $tmps[] = $tmp;
        $entries[] = files_entry('documents', [$id, 'file'], upload($id . '.pdf', $tmp, $size));
    }
    return [merge_files(...$entries), $tmps];
}

function corporate_files(array $ids = CORPORATE_DOCS, int $size = 5): array
{
    return document_files($ids, $size);
}

function individual_files(array $ids = INDIVIDUAL_DOCS, int $size = 5): array
{
    return document_files($ids, $size);
}

function int_mb(float $mb): int
{
    return (int) ($mb * 1024 * 1024);
}

function cleanup(array $tmps): void
{
    foreach ($tmps as $p) {
        @unlink($p);
    }
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

test_case('returns field errors for an otherwise empty corporate submission, including every required document', function () {
    $r = handle_submission(['customerType' => 'corporate'], []);
    assert_equal(false, $r['success']);
    foreach (['companyName', 'directors', 'consent', 'sourceOfFunds', 'signatory1Name'] as $k) {
        assert_true(isset($r['errors'][$k]), $k);
    }
    foreach (CORPORATE_DOCS as $id) {
        assert_equal('This document is required.', $r['errors'][$id], $id);
    }
});

test_case('does not fatal on hostile shapes (directors/documents as strings, 26 rows)', function () {
    $r = handle_submission(sample_post(['directors' => 'foo', 'documents' => 'bar']), []);
    assert_equal(false, $r['success']);
    assert_true(isset($r['errors']['directors']));
    foreach (CORPORATE_DOCS as $id) {
        assert_equal('This document is required.', $r['errors'][$id], $id);
    }
    $r = handle_submission(sample_post(['directors' => array_fill(0, 26, sample_post()['directors'][0])]), []);
    assert_equal('Too many directors listed (maximum 25).', $r['errors']['directors']);
});

test_case('succeeds with all six documents and hands the email sender the new data shape', function () {
    [$files, $tmps] = corporate_files();
    $data = null;
    $att = null;
    $r = handle_submission(sample_post(), $files, ok_sender($data, $att));
    assert_equal(true, $r['success']);
    assert_equal('corporate', $data['customerType']);
    assert_equal('Acme Trading Ltd', $data['fields']['companyName']);
    assert_equal('Jane Doe', $data['directors'][0]['name']);
    assert_equal(6, count($data['documents']));
    foreach ($data['documents'] as $doc) {
        assert_equal(true, $doc['submitted'], $doc['id']);
    }
    assert_equal(true, $data['consent']);
    assert_equal(false, $data['sealAttached']);
    assert_equal(6, count($att));
    cleanup($tmps);
});

test_case('strips header-injection attempts from text fields and director rows', function () {
    [$files, $tmps] = corporate_files();
    $data = null;
    $post = sample_post(['companyName' => "Acme Ltd\r\nBcc: attacker@evil.com", 'registeredAddress' => "1 Marina\r\nBcc: a@evil.com"]);
    $post['directors'][0]['name'] = "Jane\r\nBcc: a@evil.com";
    handle_submission($post, $files, ok_sender($data));
    assert_equal('Acme LtdBcc: attacker@evil.com', $data['fields']['companyName']);
    assert_true(strpos($data['fields']['registeredAddress'], "\r") === false);
    assert_equal('JaneBcc: a@evil.com', $data['directors'][0]['name']);
    cleanup($tmps);
});

test_case('attaches every document with a sanitised, slot-prefixed name and deletes the temp files', function () {
    [$files, $tmps] = corporate_files(array_slice(CORPORATE_DOCS, 1));
    $evil = tmp_file();
    $files = merge_files($files, files_entry('documents', ['certificate_of_incorporation', 'file'], upload('../../evil<>.pdf', $evil)));
    $att = null;
    $r = handle_submission(sample_post(), $files, ok_sender($d, $att));
    assert_equal(true, $r['success']);
    $names = array_column($att, 'originalName');
    assert_true(in_array('certificate_of_incorporation - evil__.pdf', $names, true));
    assert_true(in_array('company_bank_statement - company_bank_statement.pdf', $names, true));
    assert_equal(6, count($names));
    foreach (array_merge($tmps, [$evil]) as $p) {
        assert_true(!file_exists($p), 'temp file should be cleaned up');
    }
});

test_case('a missing document blocks the submission and is named by id', function () {
    foreach (CORPORATE_DOCS as $missing) {
        [$files, $tmps] = corporate_files(array_values(array_diff(CORPORATE_DOCS, [$missing])));
        $called = false;
        $r = handle_submission(sample_post(), $files, function () use (&$called) {
            $called = true;
            return ['success' => true, 'error' => null];
        });
        assert_equal(false, $r['success'], $missing);
        assert_equal([$missing], array_keys(array_intersect_key($r['errors'], array_flip(CORPORATE_DOCS))), $missing);
        assert_equal('This document is required.', $r['errors'][$missing]);
        assert_true(!$called, 'must not send without every document');
        cleanup($tmps);
    }
});

test_case('a ticked document without a file, or a file whose box was not ticked, counts as missing', function () {
    [$files, $tmps] = corporate_files(array_slice(CORPORATE_DOCS, 1));
    $r = handle_submission(sample_post(), $files, ok_sender());
    assert_equal('This document is required.', $r['errors']['certificate_of_incorporation']);
    cleanup($tmps);
    [$files, $tmps] = corporate_files();
    $post = sample_post();
    unset($post['documents']['cac_forms']);
    $r = handle_submission($post, $files, ok_sender());
    assert_equal('This document is required.', $r['errors']['cac_forms']);
    cleanup($tmps);
});

test_case('blocks a document with a disallowed file type', function () {
    [$files, $tmps] = corporate_files(array_slice(CORPORATE_DOCS, 1));
    $bad = tmp_file();
    $files = merge_files($files, files_entry('documents', ['certificate_of_incorporation', 'file'], upload('virus.exe', $bad)));
    $called = false;
    $r = handle_submission(sample_post(), $files, function () use (&$called) {
        $called = true;
        return ['success' => true, 'error' => null];
    });
    assert_equal('File type not allowed: virus.exe', $r['errors']['certificate_of_incorporation']);
    assert_true(!isset($r['errors']['cac_forms']));
    assert_true(!$called);
    cleanup($tmps);
    @unlink($bad);
});

test_case('rejects a PHP-level upload failure instead of silently dropping it', function () {
    [$files, $tmps] = corporate_files(array_slice(CORPORATE_DOCS, 1));
    $files = merge_files($files, files_entry('documents', ['certificate_of_incorporation', 'file'], upload('big.pdf', '', 0, UPLOAD_ERR_INI_SIZE)));
    $called = false;
    $r = handle_submission(sample_post(), $files, function () use (&$called) {
        $called = true;
        return ['success' => true, 'error' => null];
    });
    assert_equal(false, $r['success']);
    assert_true(isset($r['errors']['certificate_of_incorporation']));
    assert_true(!$called);
    cleanup($tmps);
});

test_case('attaches director files and the seal with distinct names even for identical filenames', function () {
    [$docFiles, $docTmps] = corporate_files();
    $a = tmp_file();
    $b = tmp_file();
    $c = tmp_file();
    $att = null;
    $d = null;
    $post = sample_post();
    $post['directors'][] = $post['directors'][0];
    $files = merge_files(
        $docFiles,
        files_entry('directors', [0, 'files', 'id'], upload('id.pdf', $a)),
        files_entry('directors', [1, 'files', 'id'], upload('id.pdf', $b)),
        files_entry('sealFile', [], upload('seal.png', $c))
    );
    $r = handle_submission($post, $files, ok_sender($d, $att));
    assert_equal(true, $r['success']);
    $names = array_values(array_filter(array_column($att, 'originalName'), fn($n) => strpos($n, 'director-') === 0 || strpos($n, 'company-seal') === 0));
    sort($names);
    assert_equal(['company-seal - seal.png', 'director-1-id - id.pdf', 'director-2-id - id.pdf'], $names);
    assert_equal(9, count($att));
    assert_equal(true, $d['sealAttached']);
    assert_equal(['id'], $d['directors'][0]['attachments']);
    foreach (array_merge($docTmps, [$a, $b, $c]) as $p) {
        assert_true(!file_exists($p));
    }
});

test_case('flags a director file with a bad type under directorFile.<i>.<id>', function () {
    [$docFiles, $docTmps] = corporate_files();
    $tmp = tmp_file();
    $files = merge_files($docFiles, files_entry('directors', [0, 'files', 'nin'], upload('x.exe', $tmp)));
    $r = handle_submission(sample_post(), $files, ok_sender());
    assert_equal('File type not allowed: x.exe', $r['errors']['directorFile.0.nin']);
    cleanup($docTmps);
    @unlink($tmp);
});

test_case('counts documents, directors files and the seal toward the 20MB total', function () {
    [$docFiles, $docTmps] = corporate_files(CORPORATE_DOCS, int_mb(2));
    $t = [tmp_file(), tmp_file(), tmp_file(), tmp_file()];
    $size = int_mb(2.5);
    $withoutSeal = merge_files(
        $docFiles,
        files_entry('directors', [0, 'files', 'id'], upload('b.pdf', $t[0], $size)),
        files_entry('directors', [0, 'files', 'nin'], upload('c.pdf', $t[1], $size)),
        files_entry('directors', [0, 'files', 'bvn'], upload('d.pdf', $t[2], $size))
    );
    $files = merge_files($withoutSeal, files_entry('sealFile', [], upload('e.png', $t[3], $size)));
    $r = handle_submission(sample_post(), $files, ok_sender());
    assert_equal('Total attachments exceed the 20MB limit.', $r['errors']['_total']);
    assert_equal(true, handle_submission(sample_post(), $withoutSeal, ok_sender())['success']);
    cleanup($docTmps);
    cleanup($t);
});

test_case('surfaces email failures without exposing internals', function () {
    [$files, $tmps] = corporate_files();
    $r = handle_submission(sample_post(), $files, fn() => ['success' => false, 'error' => 'SMTP down']);
    assert_equal(false, $r['success']);
    assert_true(strpos($r['message'], 'SMTP') === false);
    cleanup($tmps);
});

function sample_individual_post(array $o = []): array
{
    $documents = [];
    foreach (INDIVIDUAL_DOCS as $id) {
        $documents[$id] = ['submitted' => 'on'];
    }
    return array_replace([
        'customerType' => 'individual',
        'fullName' => 'Jane Doe', 'dateOfBirth' => '1990-01-01', 'placeOfBirth' => 'Lagos', 'gender' => 'F', 'nationality' => 'Nigerian',
        'countryOfResidence' => 'Nigeria', 'residentialAddress' => '1 Rd', 'lga' => 'Ikeja', 'state' => 'Lagos', 'phone' => '08000000000',
        'email' => 'jane@example.com', 'meansOfId' => ['nin', 'passport'], 'idNumber' => 'A123', 'bvn' => '222', 'nin' => '333',
        'occupation' => 'Engineer', 'employerName' => 'Acme Engineering', 'officeAddress' => '4 Adeola Odeku Street, Victoria Island',
        'sourceOfIncome' => 'salary', 'sourceOfWealth' => 'Savings', 'purposeOfRelationship' => 'loan',
        'expectedMonthlyTurnover' => '500,000', 'expectedTransactionTypes' => ['transfer'],
        'documents' => $documents, 'consent' => 'on',
        'declarationName' => 'Jane Doe', 'signatureName' => 'Jane Doe', 'signatureDate' => '2026-09-15', 'signatureAgree' => 'on',
    ], $o);
}

test_case('individual: empty submission returns field errors, including every required document', function () {
    $r = handle_submission(['customerType' => 'individual'], []);
    foreach (['fullName', 'email', 'meansOfId', 'employerName', 'officeAddress', 'consent', 'declarationName'] as $k) {
        assert_true(isset($r['errors'][$k]), $k);
    }
    foreach (INDIVIDUAL_DOCS as $id) {
        assert_equal('This document is required.', $r['errors'][$id], $id);
    }
});

test_case('individual: succeeds with all five documents and hands the sender the individual data shape', function () {
    [$files, $tmps] = individual_files();
    $d = null;
    $r = handle_submission(sample_individual_post(), $files, ok_sender($d));
    assert_equal(true, $r['success']);
    assert_equal('individual', $d['customerType']);
    assert_equal('Jane Doe', $d['fields']['fullName']);
    assert_equal(['nin', 'passport'], $d['fields']['meansOfId']);
    assert_equal(5, count($d['documents']));
    foreach ($d['documents'] as $doc) {
        assert_equal(true, $doc['submitted'], $doc['id']);
    }
    assert_equal(true, $d['consent']);
    cleanup($tmps);
});

test_case('individual: a missing document blocks the submission and is named by id', function () {
    foreach (INDIVIDUAL_DOCS as $missing) {
        [$files, $tmps] = individual_files(array_values(array_diff(INDIVIDUAL_DOCS, [$missing])));
        $called = false;
        $r = handle_submission(sample_individual_post(), $files, function () use (&$called) {
            $called = true;
            return ['success' => true, 'error' => null];
        });
        assert_equal(false, $r['success'], $missing);
        assert_equal(['' . $missing], array_keys(array_intersect_key($r['errors'], array_flip(INDIVIDUAL_DOCS))), $missing);
        assert_equal('This document is required.', $r['errors'][$missing]);
        assert_true(!$called, 'must not send without every document');
        cleanup($tmps);
    }
});

test_case('individual: a ticked document without a file, or a file whose box was not ticked, counts as missing', function () {
    [$files, $tmps] = individual_files(['valid_means_of_id', 'bank_statement', 'passport_photograph', 'signature_mandate_card']);
    $r = handle_submission(sample_individual_post(), $files, ok_sender());
    assert_equal('This document is required.', $r['errors']['utility_bill']);
    cleanup($tmps);
    [$files, $tmps] = individual_files();
    $post = sample_individual_post();
    unset($post['documents']['passport_photograph']);
    $r = handle_submission($post, $files, ok_sender());
    assert_equal('This document is required.', $r['errors']['passport_photograph']);
    cleanup($tmps);
});

test_case('individual: hostile array shapes are rejected, not fatal', function () {
    foreach ([['meansOfId' => 'nin'], ['meansOfId' => [['nin']]], ['expectedTransactionTypes' => [['cash']]]] as $o) {
        [$files, $tmps] = individual_files();
        $r = handle_submission(sample_individual_post($o), $files, ok_sender());
        assert_equal(false, $r['success'], json_encode($o));
        cleanup($tmps);
    }
});

test_case('individual: a non-array documents value means no documents were provided, and does not fatal', function () {
    $r = handle_submission(sample_individual_post(['documents' => 'x']), [], ok_sender());
    assert_equal(false, $r['success']);
    foreach (INDIVIDUAL_DOCS as $id) {
        assert_equal('This document is required.', $r['errors'][$id], $id);
    }
});

test_case('individual: strips header injection from text fields', function () {
    [$files, $tmps] = individual_files();
    $d = null;
    handle_submission(sample_individual_post(['fullName' => "Jane\r\nBcc: a@evil.com"]), $files, ok_sender($d));
    assert_equal('JaneBcc: a@evil.com', $d['fields']['fullName']);
    cleanup($tmps);
});

test_case('individual: attaches all five documents with slot-prefixed names and deletes the temp files', function () {
    [$files, $tmps] = individual_files();
    $att = null;
    $r = handle_submission(sample_individual_post(), $files, ok_sender($d, $att));
    assert_equal(true, $r['success']);
    $names = array_column($att, 'originalName');
    sort($names);
    assert_equal([
        'bank_statement - bank_statement.pdf', 'passport_photograph - passport_photograph.pdf', 'signature_mandate_card - signature_mandate_card.pdf',
        'utility_bill - utility_bill.pdf', 'valid_means_of_id - valid_means_of_id.pdf',
    ], $names);
    foreach ($tmps as $p) {
        assert_true(!file_exists($p), 'temp file should be cleaned up');
    }
});

test_case('individual: five documents can exceed the 20MB total even though each is under 5MB', function () {
    [$files, $tmps] = individual_files(INDIVIDUAL_DOCS, int_mb(4.5));
    $called = false;
    $r = handle_submission(sample_individual_post(), $files, function () use (&$called) {
        $called = true;
        return ['success' => true, 'error' => null];
    });
    assert_equal('Total attachments exceed the 20MB limit.', $r['errors']['_total']);
    assert_true(!$called);
    cleanup($tmps);
    [$files, $tmps] = individual_files(INDIVIDUAL_DOCS, int_mb(3.9));
    assert_equal(true, handle_submission(sample_individual_post(), $files, ok_sender())['success']);
    cleanup($tmps);
});

test_case('individual: blocks a document with a disallowed type and a PHP-level upload failure', function () {
    [$files, $tmps] = individual_files(['valid_means_of_id', 'bank_statement', 'signature_mandate_card']);
    $bad = tmp_file();
    $files = merge_files(
        $files,
        files_entry('documents', ['utility_bill', 'file'], upload('virus.exe', $bad)),
        files_entry('documents', ['passport_photograph', 'file'], upload('big.pdf', '', 0, UPLOAD_ERR_INI_SIZE))
    );
    $called = false;
    $r = handle_submission(sample_individual_post(), $files, function () use (&$called) {
        $called = true;
        return ['success' => true, 'error' => null];
    });
    assert_equal('File type not allowed: virus.exe', $r['errors']['utility_bill']);
    assert_true(isset($r['errors']['passport_photograph']));
    assert_true(!isset($r['errors']['valid_means_of_id']));
    assert_true(!$called);
    cleanup($tmps);
    @unlink($bad);
});

test_case('individual: email failures do not expose internals', function () {
    [$files, $tmps] = individual_files();
    $r = handle_submission(sample_individual_post(), $files, fn() => ['success' => false, 'error' => 'SMTP down']);
    assert_equal(false, $r['success']);
    assert_true(strpos($r['message'], 'SMTP') === false);
    cleanup($tmps);
});

test_case('a corporate post still works alongside the individual path', function () {
    [$files, $tmps] = corporate_files();
    $r = handle_submission(sample_post(), $files, ok_sender());
    assert_equal(true, $r['success']);
    cleanup($tmps);
});

test_summary();
