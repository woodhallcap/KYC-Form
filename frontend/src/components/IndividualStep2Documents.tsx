import { INDIVIDUAL_DOCUMENTS } from '../lib/documents';
import { DocumentsStep } from './DocumentsStep';
import type { StepProps } from './stepProps';

export function IndividualStep2Documents(props: StepProps) {
  return (
    <DocumentsStep
      {...props}
      heading="Section B: Verification Documents"
      intro="Attach a copy of each required document. Files can be PDF, JPG, PNG or DOCX, up to 5MB each. Proof of address must be less than 3 months old."
      documents={INDIVIDUAL_DOCUMENTS}
      consentText="I consent to the use, processing, verification, retention, and disclosure of the information and documents provided for due diligence, compliance, and the furtherance of our business relationship."
      nextLabel="Next: Declaration"
    />
  );
}
