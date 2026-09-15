<?php
declare(strict_types=1);

// Suppress PHP 8.4+ deprecation notices from vendored libraries (TCPDF's legacy
// XML parser calls) so they never leak into the JSON response body.
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', '0');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lib/submission-handler.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$result = handle_submission($_POST, $_FILES);

if (!$result['success']) {
    http_response_code(empty($result['errors']) ? 502 : 422);
}

echo json_encode($result);
