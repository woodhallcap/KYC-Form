<?php
declare(strict_types=1);

require __DIR__ . '/test_helper.php';
require __DIR__ . '/../../lib/pdf-builder.php';

function sample_corporate_data(): array
{
    return [
        'customerType' => 'corporate',
        'submittedAt' => '2026-09-15 14:00:00',
        'fields' => [
            'companyName' => 'Acme Trading Ltd', 'rcNumber' => 'RC123456', 'dateOfIncorporation' => '2015-04-01',
            'registeredAddress' => '1 Marina Road, Lagos', 'businessAddress' => '', 'natureOfBusiness' => 'Trade finance',
            'tin' => 'TIN000111', 'companyEmail' => 'info@acme.com', 'bankAccountNumber' => '0011223344', 'bankName' => 'First Bank',
            'sourceOfFunds' => 'Trade proceeds', 'facilityAmount' => '5,000,000',
            'signatory1Name' => 'Jane Doe', 'signatory1Date' => '2026-09-15', 'signatory2Name' => 'John Roe', 'signatory2Date' => '2026-09-15',
        ],
        'directors' => [
            ['name' => 'Jane Doe', 'designation' => 'MD', 'bvn' => '111', 'nin' => '222', 'shareholdingPercent' => '60', 'nationality' => 'Nigerian', 'pep' => 'no', 'residentialAddress' => '1 Rd', 'attachments' => ['id', 'nin']],
            ['name' => 'John Roe', 'designation' => 'Director', 'bvn' => '333', 'nin' => '444', 'shareholdingPercent' => '40', 'nationality' => 'Ghanaian', 'pep' => 'yes', 'residentialAddress' => '2 Rd', 'attachments' => []],
        ],
        'documents' => [
            ['id' => 'certificate_of_incorporation', 'label' => 'CAC Certificate of Incorporation', 'submitted' => true],
            ['id' => 'cac_forms', 'label' => 'CAC Forms', 'submitted' => false],
        ],
        'consent' => true,
        'sealAttached' => true,
    ];
}

test_case('build_submission_pdf returns a valid PDF binary for a corporate submission', function () {
    $pdf = build_submission_pdf(sample_corporate_data());
    assert_true(strpos($pdf, '%PDF-') === 0);
    assert_true(strlen($pdf) > 1000);
});

test_case('corporate_pdf_sections lists sections A-E in order', function () {
    $titles = array_map(fn($s) => $s['title'], corporate_pdf_sections(sample_corporate_data()));
    assert_equal([
        'Section A: Entity Information',
        'Section B: Directors, Signatories & UBOs (>5%)',
        'Section C: Required Documents',
        'Section D: Source of Funds',
        'Section E: Declaration',
    ], $titles);
});

test_case('corporate_pdf_sections renders one group per director with labelled rows', function () {
    $b = corporate_pdf_sections(sample_corporate_data())[1];
    assert_equal(2, count($b['groups']));
    assert_equal('Director / Signatory / UBO 2', $b['groups'][1]['subtitle']);
    $rows = array_column($b['groups'][1]['rows'], 1, 0);
    assert_equal('John Roe', $rows['Name']);
    assert_equal('40%', $rows['% Shareholding']);
    assert_equal('Yes', $rows['PEP']);
    assert_equal('None', $rows['Attachments']);
    assert_equal('ID, NIN', array_column($b['groups'][0]['rows'], 1, 0)['Attachments']);
});

test_case('corporate_pdf_sections shows documents, funds, declaration and seal', function () {
    $s = corporate_pdf_sections(sample_corporate_data());
    $docs = array_column($s[2]['groups'][0]['rows'], 1, 0);
    assert_equal('Submitted', $docs['CAC Certificate of Incorporation']);
    assert_equal('Not submitted', $docs['CAC Forms']);
    assert_equal('Given', $docs['Consent to processing']);
    $funds = array_column($s[3]['groups'][0]['rows'], 1, 0);
    assert_equal('Trade proceeds', $funds['Source of Funds']);
    assert_equal('5,000,000', $funds['Facility Amount Requested (NGN)']);
    $decl = array_column($s[4]['groups'][0]['rows'], 1, 0);
    assert_equal('Jane Doe', $decl['Authorized Signatory 1']);
    assert_equal('2026-09-15', $decl['Signatory 1 Date']);
    assert_equal('Attached', $decl['Company Seal']);
});

test_case('build_submission_pdf survives missing/empty directors', function () {
    $d = sample_corporate_data();
    $d['directors'] = [];
    assert_true(strpos(build_submission_pdf($d), '%PDF-') === 0);
});

function sample_individual_data(): array
{
    return [
        'customerType' => 'individual',
        'submittedAt' => '2026-09-15 14:00:00',
        'fields' => [
            'fullName' => 'Jane Doe', 'dateOfBirth' => '1990-01-01', 'placeOfBirth' => 'Lagos', 'gender' => 'F', 'nationality' => 'Nigerian',
            'countryOfResidence' => 'Nigeria', 'residentialAddress' => '1 Rd', 'lga' => 'Ikeja', 'state' => 'Lagos', 'phone' => '08000000000',
            'email' => 'jane@example.com', 'meansOfId' => ['nin', 'drivers_license'], 'idNumber' => 'A123', 'idExpiry' => '', 'bvn' => '222', 'nin' => '333',
            'occupation' => 'Engineer', 'employerName' => '', 'officeAddress' => '', 'sourceOfIncome' => 'other', 'sourceOfIncomeOther' => 'Gift',
            'sourceOfWealth' => 'Savings', 'purposeOfRelationship' => 'loan', 'purposeOther' => '', 'expectedMonthlyTurnover' => '500,000',
            'expectedTransactionTypes' => ['cash', 'transfer'],
            'declarationName' => 'Jane Doe', 'signatureName' => 'Jane Doe', 'signatureDate' => '2026-09-15',
        ],
        'documents' => [
            ['id' => 'valid_means_of_id', 'label' => 'Valid Means of ID', 'submitted' => true],
            ['id' => 'passport_photograph', 'label' => 'Passport Photograph', 'submitted' => false],
        ],
        'consent' => true,
    ];
}

test_case('build_submission_pdf renders an individual submission', function () {
    $pdf = build_submission_pdf(sample_individual_data());
    assert_true(strpos($pdf, '%PDF-') === 0);
    assert_true(strlen($pdf) > 1000);
});

test_case('individual_pdf_sections lists sections A-C and formats choices', function () {
    $s = individual_pdf_sections(sample_individual_data());
    assert_equal(['Section A: Customer Information', 'Section B: Verification Documents', 'Section C: Declaration'], array_map(fn($x) => $x['title'], $s));
    $a = array_column($s[0]['groups'][0]['rows'], 1, 0);
    assert_equal('Female', $a['Gender']);
    assert_equal("NIN, Driver's License", $a['Means of ID']);
    assert_equal('Other: Gift', $a['Source of Income']);
    assert_equal('Loan', $a['Purpose of Relationship']);
    assert_equal('Cash, Transfer', $a['Expected Transaction Type']);
    assert_equal('500,000', $a['Expected Monthly Turnover (NGN)']);
    $b = array_column($s[1]['groups'][0]['rows'], 1, 0);
    assert_equal('Submitted', $b['Valid Means of ID']);
    assert_equal('Given', $b['Consent to processing']);
    $c = array_column($s[2]['groups'][0]['rows'], 1, 0);
    assert_equal('Jane Doe', $c['Name']);
    assert_equal('2026-09-15', $c['Date']);
});

test_case('individual sections tolerate missing/odd fields', function () {
    $d = sample_individual_data();
    $d['fields']['meansOfId'] = 'nin';
    unset($d['fields']['expectedTransactionTypes']);
    $d['fields']['gender'] = 'X';
    $a = array_column(individual_pdf_sections($d)[0]['groups'][0]['rows'], 1, 0);
    assert_equal('', $a['Means of ID']);
    assert_equal('', $a['Expected Transaction Type']);
    assert_equal('', $a['Gender']);
    assert_true(strpos(build_submission_pdf($d), '%PDF-') === 0);
});

test_case('build_submission_pdf rejects an unknown customer type', function () {
    $threw = false;
    try {
        build_submission_pdf(['customerType' => 'partnership']);
    } catch (InvalidArgumentException $e) {
        $threw = true;
    }
    assert_true($threw);
});

test_case('declarations name Woodhall Finance Company Ltd and nothing says Woodhall Capital', function () {
    $corporate = json_encode(corporate_pdf_sections(sample_corporate_data()));
    $individual = json_encode(individual_pdf_sections(sample_individual_data()));
    assert_true(strpos($corporate, 'Woodhall Finance Company Ltd') !== false);
    assert_true(strpos($individual, 'Woodhall Finance Company Ltd') !== false);
    assert_true(strpos($corporate . $individual, 'Woodhall Capital') === false);
});

test_case('the PDF source no longer credits Woodhall Capital', function () {
    assert_true(strpos(file_get_contents(__DIR__ . '/../../lib/pdf-builder.php'), 'Woodhall Capital') === false);
});

test_summary();
