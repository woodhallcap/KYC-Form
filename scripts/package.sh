#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
(cd frontend && npm ci && npm run build)
OUT=build/woodhall-kyc
rm -rf build && mkdir -p "$OUT/docs"
cp -R frontend/dist/. "$OUT/"
cp submit.php config.php .htaccess .user.ini "$OUT/"
cp -R lib vendor "$OUT/"
mkdir -p "$OUT/assets" && cp -R assets/logos "$OUT/assets/logos"  # read by lib/pdf-builder.php and lib/mailer.php
cp docs/.htaccess "$OUT/docs/.htaccess"
(cd build && zip -qr woodhall-kyc-deploy.zip woodhall-kyc)
echo "Built build/woodhall-kyc-deploy.zip"
