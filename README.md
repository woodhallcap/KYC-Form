# Woodhall Capital — Corporate KYC / CDD Form

A public web form that digitizes Woodhall Capital's Corporate Account Opening and
Customer Due Diligence process. On submission it:

1. Generates a branded, print-ready PDF of the full submission.
2. Emails that PDF (plus any uploaded supporting documents) to compliance.
3. Emails a confirmation copy of the PDF to the submitter.

## Tech stack

Static HTML/CSS/JS front end (no build step, no framework) backed by a PHP endpoint.
No Composer dependency at deploy time — PHPMailer and TCPDF are vendored directly
into `vendor/` since Bluehost shared hosting doesn't guarantee Composer is available.

- **Front end:** vanilla JS (ES5-safe), vanilla CSS
- **Backend:** PHP 8+
- **Email:** [PHPMailer](https://github.com/PHPMailer/PHPMailer) (vendored, no Composer)
- **PDF generation:** [TCPDF](https://github.com/tecnickcom/TCPDF) (vendored, pruned to the 14 core fonts only)
- **Tests:** Node's built-in `node:test` for JS, a small custom assertion harness for PHP (no PHPUnit dependency)

## Project structure

```
index.html                 3-step wizard markup
assets/css/style.css       brand styling, layout, responsive rules
assets/js/validation.js    shared client-side field validation
assets/js/form.js          step navigation, inline validation, submission
assets/js/autosave.js      localStorage draft autosave/restore
assets/js/dev-tools.js     dev-only prefill button (localhost only)
assets/logos/              brand logos (full-colour, reverse, cropped emblem)
assets/fonts/               Vanitas heading font
config.php                 recipient email, SMTP settings, upload limits
submit.php                 HTTP entry point — validates and orchestrates a submission
lib/validator.php          shared server-side validation + input sanitization
lib/pdf-builder.php        renders the print-ready submission PDF (TCPDF)
lib/mailer.php             builds and sends the admin + confirmation emails (PHPMailer)
lib/submission-handler.php orchestrates validation → PDF → email → cleanup
preview.php                dev-only preview of the emails/PDF using sample data
vendor/                    vendored PHPMailer + TCPDF (no Composer)
tests/js/                  JS unit tests (node:test)
tests/php/                 PHP unit tests (custom harness)
```

## Local development

Requires PHP 8+ and Node.js (for running the JS test suite only — no Node server is
used at runtime).

```bash
php -S localhost:8000
```

Then open `http://localhost:8000/index.html`.

On `localhost`/`127.0.0.1` only, a **"Fill test data (dev only)"** button appears
in the bottom-right corner to speed up manual testing — it never appears on the
live site.

## Configuration

Before deploying, edit `config.php`:

| Constant | Purpose |
|---|---|
| `RECIPIENT_EMAIL` / `RECIPIENT_NAME` | **Placeholder — must be replaced** with the real compliance inbox before go-live. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` / `SMTP_SECURE` | Leave `SMTP_HOST` empty to fall back to PHP's built-in `mail()`; set these for real SMTP delivery. |
| `MAIL_FROM_ADDRESS` / `MAIL_FROM_NAME` | From-address used on both outgoing emails. |
| `MAX_FILE_SIZE_BYTES` / `MAX_TOTAL_SIZE_BYTES` | Per-file (5MB) and total (20MB) upload caps. |

`.user.ini` raises PHP's own `upload_max_filesize`/`post_max_size` ini limits to
comfortably exceed the app's caps above — without it, some hosts' lower defaults
would silently reject uploads before the app's own validation ever runs.

## Previewing emails and the PDF

`preview.php` renders the admin email, confirmation email, and generated PDF using
sample data — no real submission or send involved. It's restricted to local
requests (`127.0.0.1`/`::1`) and is **not linked from the public form**.

```
http://localhost:8000/preview.php
```

**Delete `preview.php` before deploying to production** — it has no authentication
beyond the IP check.

## Running tests

```bash
# JS validation tests
node --test tests/js/validation.test.js

# PHP tests (suppress harmless PHP 8.4+ deprecation notices from TCPDF's
# legacy XML parser calls)
php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_validator.php
php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_pdf_builder.php
php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_mailer.php
php -d error_reporting="E_ALL & ~E_DEPRECATED" tests/php/test_submission_handler.php
```

## Deploying to Bluehost

1. Upload the entire project (including `vendor/`, `.user.ini`, and `.htaccess`
   if added later) via FTP/File Manager to the target directory.
2. Set the real values in `config.php` (recipient email, SMTP credentials).
3. Delete `preview.php` and `assets/js/dev-tools.js`'s script tag reference in
   `index.html` (or just delete `preview.php` — the dev prefill button already
   hides itself outside `localhost`).
4. Confirm PHP 8+ is selected in the hosting control panel.
5. Submit a real test form end-to-end and confirm both emails arrive with the
   PDF and any attachments intact.

## Security notes

- Server-side validation (`lib/validator.php`) is authoritative — client-side
  validation is a UX convenience only.
- All text input is sanitized (control characters stripped, CR/LF stripped from
  single-line fields) before use, to prevent email header injection.
- Uploaded filenames are sanitized before being used as email attachment names.
- No database is used anywhere in this app, so SQL injection is not an applicable
  attack surface here.
