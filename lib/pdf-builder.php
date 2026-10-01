<?php
declare(strict_types=1);

require_once __DIR__ . '/../vendor/tcpdf/tcpdf.php';

// Spacing scale (mm) used consistently throughout this PDF layout, so
// gaps between rows, sections, and blocks all come from the same scale
// rather than one-off magic numbers.
const PDF_SPACE_SM = 2;
const PDF_SPACE_MD = 4;
const PDF_SPACE_LG = 8;

function build_submission_pdf(array $data): string
{
    switch ($data['customerType'] ?? '') {
        case 'corporate':
            return build_corporate_pdf($data);
        case 'individual':
            return build_individual_pdf($data);
        default:
            throw new InvalidArgumentException('Unsupported customer type.');
    }
}

function pdf_yes_no(string $value): string
{
    return $value === 'yes' ? 'Yes' : ($value === 'no' ? 'No' : '');
}

function corporate_pdf_sections(array $data): array
{
    $f = $data['fields'] ?? [];
    $v = fn(string $k): string => (string) ($f[$k] ?? '');

    $directorGroups = [];
    foreach (array_values($data['directors'] ?? []) as $i => $d) {
        $attached = array_map(
            fn($id) => $id === 'proof_of_address' ? 'Proof of address' : strtoupper((string) $id),
            $d['attachments'] ?? []
        );
        $directorGroups[] = [
            'subtitle' => 'Director / Signatory / UBO ' . ($i + 1),
            'rows' => [
                ['Name', (string) ($d['name'] ?? '')],
                ['Designation', (string) ($d['designation'] ?? '')],
                ['BVN', (string) ($d['bvn'] ?? '')],
                ['NIN', (string) ($d['nin'] ?? '')],
                ['% Shareholding', ($d['shareholdingPercent'] ?? '') !== '' ? $d['shareholdingPercent'] . '%' : ''],
                ['Nationality', (string) ($d['nationality'] ?? '')],
                ['PEP', pdf_yes_no((string) ($d['pep'] ?? ''))],
                ['Residential Address', (string) ($d['residentialAddress'] ?? '')],
                ['Attachments', count($attached) > 0 ? implode(', ', $attached) : 'None'],
            ],
        ];
    }

    $docRows = array_map(
        fn(array $doc): array => [$doc['label'], !empty($doc['submitted']) ? 'Submitted' : 'Not submitted'],
        $data['documents'] ?? []
    );
    $docRows[] = ['Consent to processing', !empty($data['consent']) ? 'Given' : 'Not given'];

    return [
        ['title' => 'Section A: Entity Information', 'groups' => [['subtitle' => null, 'rows' => [
            ['Company Name', $v('companyName')], ['RC Number', $v('rcNumber')], ['Date of Incorporation', $v('dateOfIncorporation')],
            ['Registered Address', $v('registeredAddress')], ['Business Address', $v('businessAddress')],
            ['Nature of Business', $v('natureOfBusiness')], ['Tax Identification Number', $v('tin')],
            ['Company Email', $v('companyEmail')], ['Corporate Bank Account', $v('bankAccountNumber')], ['Bank', $v('bankName')],
        ]]]],
        ['title' => 'Section B: Directors, Signatories & UBOs (>5%)', 'groups' => $directorGroups],
        ['title' => 'Section C: Required Documents', 'groups' => [['subtitle' => null, 'rows' => $docRows]]],
        ['title' => 'Section D: Source of Funds', 'groups' => [['subtitle' => null, 'rows' => [
            ['Source of Funds', $v('sourceOfFunds')], ['Facility Amount Requested (NGN)', $v('facilityAmount')],
        ]]]],
        ['title' => 'Section E: Declaration', 'groups' => [['subtitle' => null, 'rows' => [
            ['Certification', 'We certify that the above information is true. We understand Woodhall Finance Company Ltd is obligated to report suspicious transactions to NFIU.'],
            ['Authorized Signatory 1', $v('signatory1Name')], ['Signatory 1 Date', $v('signatory1Date')],
            ['Authorized Signatory 2', $v('signatory2Name')], ['Signatory 2 Date', $v('signatory2Date')],
            ['Company Seal', !empty($data['sealAttached']) ? 'Attached' : 'Not provided'],
            ['Typed signatures agreed', 'Yes'],
        ]]]],
    ];
}

function render_pdf(string $title, string $subject, array $data, array $sections): string
{
    $pdf = new TCPDF('P', 'mm', 'A4', true, 'UTF-8', false);
    $pdf->SetCreator('Woodhall Finance KYC Form');
    $pdf->SetAuthor('Woodhall Finance');
    $pdf->SetTitle($title . ' — ' . $subject);
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(true);
    $pdf->SetMargins(18, 18, 18);
    $pdf->SetAutoPageBreak(true, 18);
    $pdf->AddPage();

    $primary = [34, 72, 52];
    $ink = [22, 22, 22];

    $logoPath = __DIR__ . '/../assets/logos/woodhall-finance.png';
    if (file_exists($logoPath)) {
        $pdf->Image($logoPath, 18, 10, 52, 0, 'PNG');
    }
    pdf_watermark($pdf, $logoPath);

    $pdf->SetY(32);
    $pdf->SetTextColor($primary[0], $primary[1], $primary[2]);
    $pdf->SetFont('helvetica', 'B', 16);
    $pdf->Cell(0, 10, $title, 0, 1, 'C');
    $pdf->SetFont('helvetica', '', 10);
    $pdf->SetTextColor($ink[0], $ink[1], $ink[2]);
    $pdf->Cell(0, 6, 'Submitted: ' . ($data['submittedAt'] ?? ''), 0, 1, 'C');
    $pdf->Ln(PDF_SPACE_LG);

    foreach ($sections as $index => $section) {
        if ($index > 0) {
            $pdf->Ln(PDF_SPACE_LG);
        }
        if ($pdf->GetY() + 40 > $pdf->getPageHeight() - 18) {
            $pdf->AddPage();
        }
        pdf_section_title($pdf, $section['title'], $primary);
        foreach ($section['groups'] as $group) {
            $neededHeight = 12 + count($group['rows']) * 8;
            if ($group['subtitle'] !== null && $pdf->GetY() + $neededHeight > $pdf->getPageHeight() - 18) {
                $pdf->AddPage();
            }
            if ($group['subtitle'] !== null) {
                $pdf->SetFont('helvetica', 'B', 11);
                $pdf->Cell(0, 7, $group['subtitle'], 0, 1, 'L');
                $pdf->SetFont('helvetica', '', 10);
            }
            pdf_field_table($pdf, $group['rows']);
            $pdf->Ln(PDF_SPACE_SM);
        }
    }

    return $pdf->Output('', 'S');
}

function build_corporate_pdf(array $data): string
{
    return render_pdf('Corporate KYC / CDD Submission', (string) ($data['fields']['companyName'] ?? ''), $data, corporate_pdf_sections($data));
}

function build_individual_pdf(array $data): string
{
    $name = is_string($data['fields']['fullName'] ?? null) ? $data['fields']['fullName'] : '';
    return render_pdf('Individual KYC / CDD Submission', $name, $data, individual_pdf_sections($data));
}

const MEANS_OF_ID_LABELS = ['nin' => 'NIN', 'bvn' => 'BVN', 'passport' => "Int'l Passport", 'drivers_license' => "Driver's License", 'voters_card' => "Voter's Card"];
const TRANSACTION_TYPE_LABELS = ['cash' => 'Cash', 'transfer' => 'Transfer', 'cheque' => 'Cheque'];
const SOURCE_OF_INCOME_LABELS = ['salary' => 'Salary', 'business' => 'Business', 'investment' => 'Investment', 'inheritance' => 'Inheritance', 'other' => 'Other'];
const PURPOSE_LABELS = ['loan' => 'Loan', 'lease' => 'Lease', 'investment' => 'Investment', 'other' => 'Other'];

function pdf_choice_list($values, array $labels): string
{
    if (!is_array($values)) {
        return '';
    }
    $out = [];
    foreach ($values as $v) {
        if (is_string($v) && isset($labels[$v])) {
            $out[] = $labels[$v];
        }
    }
    return implode(', ', $out);
}

function pdf_choice_with_other($value, array $labels, $other): string
{
    if (!is_string($value) || !isset($labels[$value])) {
        return '';
    }
    return $value === 'other' && is_string($other) && $other !== '' ? 'Other: ' . $other : $labels[$value];
}

function individual_pdf_sections(array $data): array
{
    $f = $data['fields'] ?? [];
    $v = fn(string $k): string => is_string($f[$k] ?? null) ? $f[$k] : '';
    $gender = ['M' => 'Male', 'F' => 'Female'][is_string($f['gender'] ?? null) ? $f['gender'] : ''] ?? '';
    $docRows = array_map(
        fn(array $doc): array => [$doc['label'], !empty($doc['submitted']) ? 'Submitted' : 'Not submitted'],
        $data['documents'] ?? []
    );
    $docRows[] = ['Consent to processing', !empty($data['consent']) ? 'Given' : 'Not given'];

    return [
        ['title' => 'Section A: Customer Information', 'groups' => [['subtitle' => null, 'rows' => [
            ['Full Name', $v('fullName')], ['Date of Birth', $v('dateOfBirth')], ['Place of Birth', $v('placeOfBirth')], ['Gender', $gender],
            ['Nationality', $v('nationality')], ['Country of Residence', $v('countryOfResidence')],
            ['Residential Address', $v('residentialAddress')], ['LGA', $v('lga')], ['State', $v('state')],
            ['Phone No', $v('phone')], ['Email', $v('email')],
            ['Means of ID', pdf_choice_list($f['meansOfId'] ?? null, MEANS_OF_ID_LABELS)],
            ['ID No', $v('idNumber')], ['ID Expiry Date', $v('idExpiry')], ['BVN', $v('bvn')], ['NIN', $v('nin')],
            ['Occupation', $v('occupation')], ['Employer/Business Name', $v('employerName')], ['Office Address', $v('officeAddress')],
            ['Source of Income', pdf_choice_with_other($f['sourceOfIncome'] ?? null, SOURCE_OF_INCOME_LABELS, $f['sourceOfIncomeOther'] ?? null)],
            ['Source of Wealth', $v('sourceOfWealth')],
            ['Purpose of Relationship', pdf_choice_with_other($f['purposeOfRelationship'] ?? null, PURPOSE_LABELS, $f['purposeOther'] ?? null)],
            ['Expected Monthly Turnover (NGN)', $v('expectedMonthlyTurnover')],
            ['Expected Transaction Type', pdf_choice_list($f['expectedTransactionTypes'] ?? null, TRANSACTION_TYPE_LABELS)],
        ]]]],
        ['title' => 'Section B: Verification Documents', 'groups' => [['subtitle' => null, 'rows' => $docRows]]],
        ['title' => 'Section C: Declaration', 'groups' => [['subtitle' => null, 'rows' => [
            ['Declaration', 'I hereby declare that the information provided is true and correct. I authorize Woodhall Finance Company Ltd to verify my details with NIBSS, NIMC, Credit Bureaus and report to NFIU/CBN as required by law.'],
            ['Name', $v('declarationName')], ['Typed Signature', $v('signatureName')], ['Date', $v('signatureDate')],
            ['Typed signature agreed', 'Yes'],
        ]]]],
    ];
}

function pdf_section_title(TCPDF $pdf, string $title, array $color): void
{
    $pdf->SetFont('helvetica', 'B', 13);
    $pdf->SetTextColor($color[0], $color[1], $color[2]);
    $pdf->Cell(0, 8, $title, 0, 1, 'L');
    $pdf->SetDrawColor($color[0], $color[1], $color[2]);
    $pdf->Line($pdf->GetX(), $pdf->GetY(), $pdf->GetX() + 174, $pdf->GetY());
    $pdf->Ln(PDF_SPACE_MD);
    $pdf->SetTextColor(22, 22, 22);
    $pdf->SetFont('helvetica', '', 10);
}

function pdf_field_table(TCPDF $pdf, array $rows): void
{
    $labelWidth = 55;
    $margins = $pdf->getMargins();
    $valueWidth = $pdf->getPageWidth() - $margins['left'] - $margins['right'] - $labelWidth;

    foreach ($rows as [$label, $value]) {
        $displayValue = $value !== '' ? $value : '—';

        $pdf->SetFont('helvetica', 'B', 10);
        $labelHeight = $pdf->getStringHeight($labelWidth, $label);
        $pdf->SetFont('helvetica', '', 10);
        $valueHeight = $pdf->getStringHeight($valueWidth, $displayValue);
        $rowHeight = max($labelHeight, $valueHeight, 6) + PDF_SPACE_SM;

        $bottomLimit = $pdf->getPageHeight() - $margins['bottom'];
        if ($pdf->GetY() + $rowHeight > $bottomLimit) {
            $pdf->AddPage();
        }

        $pdf->SetFont('helvetica', 'B', 10);
        $pdf->MultiCell($labelWidth, $rowHeight, $label, 0, 'L', false, 0);
        $pdf->SetFont('helvetica', '', 10);
        $pdf->MultiCell($valueWidth, $rowHeight, $displayValue, 0, 'L', false, 1);
    }
}

function pdf_watermark(TCPDF $pdf, string $logoPath): void
{
    if (!file_exists($logoPath)) {
        return;
    }
    $pageWidth = $pdf->getPageWidth();
    $pageHeight = $pdf->getPageHeight();
    $watermarkWidth = 140;
    $x = ($pageWidth - $watermarkWidth) / 2;
    $size = @getimagesize($logoPath);
    $watermarkHeight = $size ? $watermarkWidth * $size[1] / $size[0] : $watermarkWidth;
    $y = ($pageHeight - $watermarkHeight) / 2;

    $pdf->StartTransform();
    $pdf->SetAlpha(0.06);
    $pdf->Image($logoPath, $x, $y, $watermarkWidth, 0, 'PNG');
    $pdf->SetAlpha(1);
    $pdf->StopTransform();
}
