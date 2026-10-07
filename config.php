<?php
declare(strict_types=1);

// Every address here receives the new-submission notification with the PDF and documents.
define('RECIPIENT_EMAILS', ['credit@woodhallfinanceltd.com']);
define('RECIPIENT_NAME', 'Woodhall Finance');

// Leave SMTP_HOST empty to fall back to PHP's mail() function.
define('SMTP_HOST', '');
define('SMTP_PORT', 587);
define('SMTP_USERNAME', '');
define('SMTP_PASSWORD', '');
define('SMTP_SECURE', 'tls');
// Sending setup is pending: see docs/email-setup-microsoft-365.md.
define('MAIL_FROM_ADDRESS', 'no-reply@woodhallfinanceltd.com');
define('MAIL_FROM_NAME', 'Woodhall Finance');
define('CONTACT_EMAIL', 'info@woodhallfinanceltd.com');

define('MAX_FILE_SIZE_BYTES', 5 * 1024 * 1024);
define('MAX_TOTAL_SIZE_BYTES', 20 * 1024 * 1024);
