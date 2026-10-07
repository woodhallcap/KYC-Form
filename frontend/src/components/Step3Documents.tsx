import { CORPORATE_DOCUMENTS } from '../lib/documents';
import { DocumentsStep } from './DocumentsStep';
import type { StepProps } from './stepProps';

export function Step3Documents(props: StepProps) {
  return (
    <DocumentsStep
      {...props}
      heading="Section C: Required Documents"
      intro="Attach a copy of each required document. Files can be PDF, JPG, PNG or DOCX, up to 5MB each."
      documents={CORPORATE_DOCUMENTS}
      consentText="We consent to the use, processing, verification, retention, and disclosure of the information and documents provided for due diligence, compliance, and the furtherance of our business relationship."
      nextLabel="Next: Source of Funds"
    />
  );
}
