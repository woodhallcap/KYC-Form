export interface DocumentSpec {
  id: string;
  label: string;
  required: boolean;
}

export const CORPORATE_DOCUMENTS: readonly DocumentSpec[] = [
  { id: 'certificate_of_incorporation', label: 'CAC Certificate of Incorporation', required: true },
  { id: 'cac_status_report', label: 'CAC Status Report', required: true },
  { id: 'cac_forms', label: 'CAC Forms CAC2.3 / CAC1.1 - Directors & Shareholders', required: true },
  { id: 'memorandum_articles', label: 'Memorandum & Articles of Association', required: true },
  { id: 'board_resolution', label: 'Board Resolution to open account and obtain facility', required: true },
  { id: 'company_bank_statement', label: 'Company Bank Statement - Last 12 months', required: true },
  { id: 'government_id_signatories', label: 'Valid Government-issued ID of Authorized Signatories', required: true },
  { id: 'passport_photograph_signatories', label: 'Recent Passport Photograph of Authorized Signatories', required: true },
  { id: 'corporate_id_signatories', label: 'Corporate ID of Authorized Signatories', required: false },
];

export const INDIVIDUAL_DOCUMENTS: readonly DocumentSpec[] = [
  { id: 'valid_means_of_id', label: 'Valid Means of ID', required: true },
  { id: 'proof_of_address_utility', label: 'Proof of Address: Utility Bill (less than 3 months old)', required: true },
  { id: 'proof_of_address_statement', label: 'Proof of Address: Bank Statement (less than 3 months old)', required: true },
  { id: 'bank_statement_12_months', label: 'Bank Statement - Last 12 months', required: true },
  { id: 'passport_photograph', label: 'Recent Passport Photograph', required: true },
  { id: 'work_id', label: 'Work ID', required: false },
  { id: 'employment_letter', label: 'Employment Letter', required: false },
  { id: 'signature_mandate_card', label: 'Signature Mandate Card', required: false },
];
