import { DOCUMENT_LABELS } from '../lib/documents';
import { DOCUMENT_IDS } from '../lib/validation';
import { DocumentsStep } from './DocumentsStep';
import type { StepProps } from './stepProps';

export function Step3Documents(props: StepProps) {
  return (
    <DocumentsStep
      {...props}
      heading="Section C: Required Documents"
      intro="Attach every document below to continue. Each file can be a PDF, JPG, PNG or DOCX, up to 5MB."
      ids={DOCUMENT_IDS}
      labels={DOCUMENT_LABELS}
      consentText="We consent to the use, processing, verification, retention, and disclosure of the information and documents provided for due diligence, compliance, and the furtherance of our business relationship."
      nextLabel="Next: Source of Funds"
    />
  );
}
