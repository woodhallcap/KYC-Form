<?php
declare(strict_types=1);

require_once __DIR__ . '/../vendor/tcpdf/tcpdf.php';

function build_submission_pdf(array $data): string
{
    $pdf = new TCPDF('P', 'mm', 'A4', true, 'UTF-8', false);
    $pdf->SetCreator('Woodhall Capital KYC Form');
    $pdf->SetAuthor('Woodhall Capital');
    $pdf->SetTitle('Corporate KYC / CDD Submission — ' . ($data['step1']['companyName'] ?? ''));
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
    $pdf->Ln(6);

    pdf_section_title($pdf, 'Section A: Entity Information', $primary);
    $step1Rows = [
        ['Company Name', $data['step1']['companyName'] ?? ''],
        ['RC Number', $data['step1']['rcNumber'] ?? ''],
        ['Date of Incorporation', $data['step1']['dateOfIncorporation'] ?? ''],
        ['Legal Status', pdf_legal_status_label($data['step1'] ?? [])],
        ['Registered Address', $data['step1']['registeredAddress'] ?? ''],
        ['Business/Operating Address', $data['step1']['businessAddress'] ?? ''],
        ['Nature of Business', $data['step1']['natureOfBusiness'] ?? ''],
        ['Tax Identification Number', $data['step1']['tin'] ?? ''],
        ['Company Email', $data['step1']['companyEmail'] ?? ''],
        ['Website', $data['step1']['website'] ?? ''],
        ['Corporate Bank Account Number', $data['step1']['bankAccountNumber'] ?? ''],
        ['Bank', $data['step1']['bankName'] ?? ''],
    ];
    pdf_field_table($pdf, $step1Rows);

    $pdf->Ln(4);
    pdf_section_title($pdf, 'Section B: KYC / CDD Documentation', $primary);
    $documentRows = array_map(function (array $doc): array {
        return [$doc['label'], !empty($doc['submitted']) ? 'Submitted' : 'Not submitted'];
    }, $data['documents'] ?? []);
    pdf_field_table($pdf, $documentRows);
    $pdf->Ln(2);
    $pdf->SetFont('helvetica', 'I', 9);
    $pdf->MultiCell(0, 5, 'Consent to processing: ' . (!empty($data['consent']) ? 'Given' : 'Not given'), 0, 'L');

    $pdf->Ln(4);
    pdf_section_title($pdf, 'Section C: Declaration', $primary);
    $step3Rows = [
        ['Name', $data['step3']['certifyingName'] ?? ''],
        ['Designation', $data['step3']['designation'] ?? ''],
        ['Typed Signature', $data['step3']['signatureName'] ?? ''],
        ['Date', $data['submittedAt'] ?? ''],
    ];
    pdf_field_table($pdf, $step3Rows);

    return $pdf->Output('', 'S');
}

function pdf_legal_status_label(array $step1): string
{
    $status = $step1['legalStatus'] ?? '';
    if ($status === 'private') return 'Private Limited Company';
    if ($status === 'public') return 'Public Limited Company';
    if ($status === 'other') return 'Other: ' . ($step1['legalStatusOther'] ?? '');
    return '';
}

function pdf_section_title(TCPDF $pdf, string $title, array $color): void
{
    $pdf->SetFont('helvetica', 'B', 13);
    $pdf->SetTextColor($color[0], $color[1], $color[2]);
    $pdf->Cell(0, 8, $title, 0, 1, 'L');
    $pdf->SetDrawColor($color[0], $color[1], $color[2]);
    $pdf->Line($pdf->GetX(), $pdf->GetY(), $pdf->GetX() + 174, $pdf->GetY());
    $pdf->Ln(3);
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
        $rowHeight = max($labelHeight, $valueHeight, 6);

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
