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
        'documents' => ['certificate_of_incorporation' => ['submitted' => 'on']], 'consent' => 'on',
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

function ok_sender(?array &$captured = null, ?array &$attachments = null): callable
{
    return function (array $data, string $pdf, array $att) use (&$captured, &$attachments) {
        $captured = $data;
        $attachments = $att;
        return ['success' => true, 'error' => null];
    };
}

test_case('rejects a missing or unsupported customerType without sending', function () {
    foreach ([[], ['customerType' => 'individual'], ['customerType' => ['x']]] as $post) {
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

test_case('does not fatal on hostile shapes (directors/documents as strings, 26 rows)', function () {
    $r = handle_submission(sample_post(['directors' => 'foo', 'documents' => 'bar']), []);
    assert_equal(false, $r['success']);
    assert_true(isset($r['errors']['directors']));
    $r = handle_submission(sample_post(['directors' => array_fill(0, 26, sample_post()['directors'][0])]), []);
    assert_equal('Too many directors listed (maximum 25).', $r['errors']['directors']);
});

test_case('succeeds and hands the email sender the new data shape', function () {
    $data = null;
    $att = null;
    $r = handle_submission(sample_post(), [], ok_sender($data, $att));
    assert_equal(true, $r['success']);
    assert_equal('corporate', $data['customerType']);
    assert_equal('Acme Trading Ltd', $data['fields']['companyName']);
    assert_equal('Jane Doe', $data['directors'][0]['name']);
    assert_equal(6, count($data['documents']));
    assert_equal(true, $data['documents'][0]['submitted']);
    assert_equal(true, $data['consent']);
    assert_equal(false, $data['sealAttached']);
});

test_case('strips header-injection attempts from text fields and director rows', function () {
    $data = null;
    $post = sample_post(['companyName' => "Acme Ltd\r\nBcc: attacker@evil.com", 'registeredAddress' => "1 Marina\r\nBcc: a@evil.com"]);
    $post['directors'][0]['name'] = "Jane\r\nBcc: a@evil.com";
    handle_submission($post, [], ok_sender($data));
    assert_equal('Acme LtdBcc: attacker@evil.com', $data['fields']['companyName']);
    assert_true(strpos($data['fields']['registeredAddress'], "\r") === false);
    assert_equal('JaneBcc: a@evil.com', $data['directors'][0]['name']);
});

test_case('attaches a ticked document with a sanitised, slot-prefixed name and deletes temp files', function () {
    $tmp = tmp_file();
    $att = null;
    $files = files_entry('documents', ['certificate_of_incorporation', 'file'], upload('../../evil<>.pdf', $tmp));
    handle_submission(sample_post(), $files, ok_sender($d, $att));
    assert_equal('certificate_of_incorporation - evil__.pdf', $att[0]['originalName']);
    assert_true(!file_exists($tmp), 'temp file should be cleaned up');
});

test_case('ignores an UNTICKED document even when its file is invalid or oversized', function () {
    $tmp = tmp_file();
    $att = null;
    $files = files_entry('documents', ['cac_forms', 'file'], upload('virus.exe', $tmp, 9 * 1024 * 1024));
    $r = handle_submission(sample_post(), $files, ok_sender($d, $att));
    assert_equal(true, $r['success']);
    assert_equal(0, count($att));
    @unlink($tmp);
});

test_case('blocks a ticked document with a disallowed file type', function () {
    $tmp = tmp_file();
    $called = false;
    $files = files_entry('documents', ['certificate_of_incorporation', 'file'], upload('virus.exe', $tmp));
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
    $files = files_entry('documents', ['certificate_of_incorporation', 'file'], upload('big.pdf', '', 0, UPLOAD_ERR_INI_SIZE));
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
    $files = merge_files(
        files_entry('directors', [0, 'files', 'id'], upload('id.pdf', $a)),
        files_entry('directors', [1, 'files', 'id'], upload('id.pdf', $b)),
        files_entry('sealFile', [], upload('seal.png', $c))
    );
    $r = handle_submission($post, $files, ok_sender($d, $att));
    assert_equal(true, $r['success']);
    $names = array_column($att, 'originalName');
    sort($names);
    assert_equal(['company-seal - seal.png', 'director-1-id - id.pdf', 'director-2-id - id.pdf'], $names);
    assert_equal(true, $d['sealAttached']);
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

test_case('counts documents, directors files and the seal toward the 20MB total', function () {
    $t = [tmp_file(), tmp_file(), tmp_file(), tmp_file(), tmp_file()];
    $size = 4 * 1024 * 1024 + 900000;
    $files = merge_files(
        files_entry('documents', ['certificate_of_incorporation', 'file'], upload('a.pdf', $t[0], $size)),
        files_entry('directors', [0, 'files', 'id'], upload('b.pdf', $t[1], $size)),
        files_entry('directors', [0, 'files', 'nin'], upload('c.pdf', $t[2], $size)),
        files_entry('directors', [0, 'files', 'bvn'], upload('d.pdf', $t[3], $size)),
        files_entry('sealFile', [], upload('e.png', $t[4], $size))
    );
    $r = handle_submission(sample_post(), $files, ok_sender());
    assert_equal('Total attachments exceed the 20MB limit.', $r['errors']['_total']);
    foreach ($t as $p) {
        @unlink($p);
    }
});

test_case('surfaces email failures without exposing internals', function () {
    $r = handle_submission(sample_post(), [], fn() => ['success' => false, 'error' => 'SMTP down']);
    assert_equal(false, $r['success']);
    assert_true(strpos($r['message'], 'SMTP') === false);
});

test_summary();
