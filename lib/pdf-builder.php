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
    return build_corporate_pdf($data);
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
            ['Certification', 'We certify that the above information is true. We understand Woodhall Capital is obligated to report suspicious transactions to NFIU.'],
            ['Authorized Signatory 1', $v('signatory1Name')], ['Signatory 1 Date', $v('signatory1Date')],
            ['Authorized Signatory 2', $v('signatory2Name')], ['Signatory 2 Date', $v('signatory2Date')],
            ['Company Seal', !empty($data['sealAttached']) ? 'Attached' : 'Not provided'],
            ['Typed signatures agreed', 'Yes'],
        ]]]],
    ];
}

function build_corporate_pdf(array $data): string
{
    $pdf = new TCPDF('P', 'mm', 'A4', true, 'UTF-8', false);
    $pdf->SetCreator('Woodhall Capital KYC Form');
    $pdf->SetAuthor('Woodhall Capital');
    $pdf->SetTitle('Corporate KYC / CDD Submission — ' . ($data['fields']['companyName'] ?? ''));
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(true);
    $pdf->SetMargins(18, 18, 18);
    $pdf->SetAutoPageBreak(true, 18);
    $pdf->AddPage();

    $primary = [14, 64, 51];
    $ink = [22, 22, 22];

    $logoPath = __DIR__ . '/../assets/logos/woodhall-capital-logo-full-colour-rgb-1.png';
    if (file_exists($logoPath)) {
        $pdf->Image($logoPath, 18, 10, 24, 0, 'PNG');
    }
    pdf_watermark($pdf, $logoPath);

    $pdf->SetY(30);
    $pdf->SetTextColor($primary[0], $primary[1], $primary[2]);
    $pdf->SetFont('helvetica', 'B', 16);
    $pdf->Cell(0, 10, 'Corporate KYC / CDD Submission', 0, 1, 'C');
    $pdf->SetFont('helvetica', '', 10);
    $pdf->SetTextColor($ink[0], $ink[1], $ink[2]);
    $pdf->Cell(0, 6, 'Submitted: ' . ($data['submittedAt'] ?? ''), 0, 1, 'C');
    $pdf->Ln(PDF_SPACE_LG);

    foreach (corporate_pdf_sections($data) as $index => $section) {
        if ($index > 0) {
            $pdf->Ln(PDF_SPACE_LG);
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
    $y = ($pageHeight - $watermarkWidth) / 2;

    $pdf->StartTransform();
    $pdf->SetAlpha(0.06);
    $pdf->Image($logoPath, $x, $y, $watermarkWidth, 0, 'PNG');
    $pdf->SetAlpha(1);
    $pdf->StopTransform();
}
