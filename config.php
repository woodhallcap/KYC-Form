<?php
declare(strict_types=1);

// Placeholder per spec section 8 — replace with the real compliance inbox before go-live.
define('RECIPIENT_EMAIL', 'placeholder-compliance@woodhallcap.com');
define('RECIPIENT_NAME', 'Woodhall Capital Compliance');

// Leave SMTP_HOST empty to fall back to PHP's mail() function.
define('SMTP_HOST', '');
define('SMTP_PORT', 587);
define('SMTP_USERNAME', '');
define('SMTP_PASSWORD', '');
define('SMTP_SECURE', 'tls');
define('MAIL_FROM_ADDRESS', 'no-reply@woodhallcap.com');
define('MAIL_FROM_NAME', 'Woodhall Capital');

define('MAX_FILE_SIZE_BYTES', 5 * 1024 * 1024);
define('MAX_TOTAL_SIZE_BYTES', 20 * 1024 * 1024);
