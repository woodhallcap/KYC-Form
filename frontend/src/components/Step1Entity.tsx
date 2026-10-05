import { Button } from './Button';
import { FieldGrid } from './FieldGrid';
import { SectionHeading } from './SectionHeading';
import { TextField } from './TextField';
import type { StepProps } from './stepProps';

export function Step1Entity({ state, dispatch, onNext }: StepProps) {
  const common = { state, dispatch, group: 'entity' as const };
  return (
    <section>
      <SectionHeading text="Section A: Entity Information" />
      <TextField {...common} name="companyName" label="Company Name" placeholder="e.g. Acme Trading Limited" />
      <FieldGrid>
        <TextField {...common} name="rcNumber" label="Business Registration Number (BN / RC)" placeholder="e.g. RC1234567 or BN1234567" />
        <TextField {...common} name="dateOfIncorporation" label="Date of Incorporation" type="date" />
      </FieldGrid>
      <TextField
        {...common}
        name="registeredAddress"
        label="Registered Address"
        placeholder="e.g. 12 Marina Road, Lagos Island, Lagos"
        multiline
      />
      <TextField
        {...common}
        name="businessAddress"
        label="Business/Operating Address (if different)"
        placeholder="e.g. 4 Adeola Odeku Street, Victoria Island, Lagos"
        multiline
      />
      <FieldGrid>
        <TextField {...common} name="natureOfBusiness" label="Nature of Business" placeholder="e.g. Import/export trade finance" />
        <TextField {...common} name="tin" label="Tax Identification Number (TIN)" placeholder="e.g. 12345678-0001" />
      </FieldGrid>
      <TextField {...common} name="companyEmail" label="Company Email" type="email" placeholder="e.g. finance@acmetrading.com" />
      <FieldGrid>
        <TextField {...common} name="bankAccountNumber" label="Corporate Bank Account Number" placeholder="e.g. 0123456789" />
        <TextField {...common} name="bankName" label="Bank" placeholder="e.g. First Bank of Nigeria" />
      </FieldGrid>

      <div className="mt-7 flex justify-between">
        <span />
        <Button arrow onClick={onNext}>
          Next: Directors &amp; UBOs
        </Button>
      </div>
    </section>
  );
}
