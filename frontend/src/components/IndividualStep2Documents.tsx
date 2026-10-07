import { INDIVIDUAL_DOCUMENT_LABELS } from '../lib/documents';
import { INDIVIDUAL_DOCUMENT_IDS } from '../lib/validation';
import { DocumentsStep } from './DocumentsStep';
import type { StepProps } from './stepProps';

export function IndividualStep2Documents(props: StepProps) {
  return (
    <DocumentsStep
      {...props}
      heading="Section B: Verification Documents"
      intro="Attach every document below to continue. The utility bill and the bank statement must each be less than 3 months old."
      ids={INDIVIDUAL_DOCUMENT_IDS}
      labels={INDIVIDUAL_DOCUMENT_LABELS}
      consentText="I consent to the use, processing, verification, retention, and disclosure of the information and documents provided for due diligence, compliance, and the furtherance of our business relationship."
      nextLabel="Next: Declaration"
    />
  );
}
