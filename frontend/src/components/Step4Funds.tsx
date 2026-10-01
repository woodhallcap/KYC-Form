import { Button } from './Button';
import { TextField } from './TextField';
import type { StepProps } from './stepProps';

export function Step4Funds({ state, dispatch, onNext, onBack }: StepProps) {
  const common = { state, dispatch, group: 'funds' as const };
  return (
    <section>
      <h2>Section D: Source of Funds</h2>
      <TextField {...common} name="sourceOfFunds" label="Source of Funds" placeholder="e.g. Proceeds from import/export trade" multiline />
      <TextField {...common} name="facilityAmount" label="Facility Amount Requested (₦)" placeholder="e.g. 5,000,000" />

      <div className="mt-7 flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Next: Declaration</Button>
      </div>
    </section>
  );
}
