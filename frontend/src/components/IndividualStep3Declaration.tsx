import { Field } from './Field';
import { FieldGrid } from './FieldGrid';
import { SectionHeading } from './SectionHeading';
import { SubmitActions } from './SubmitActions';
import { TextField } from './TextField';
import type { StepProps } from './stepProps';

export function IndividualStep3Declaration({ state, dispatch, onBack }: StepProps) {
  const common = { state, dispatch, group: 'declaration' as const };
  return (
    <section>
      <SectionHeading text="Section C: Declaration" />
      <p>
        I hereby declare that the information provided is true and correct. I authorize Woodhall Capital to verify my
        details with NIBSS, NIMC, Credit Bureaus and report to NFIU/CBN as required by law.
      </p>

      <TextField {...common} name="declarationName" label="Name" placeholder="e.g. Jane Doe" />
      <FieldGrid>
        <TextField {...common} name="signatureName" label="Typed Signature (type your full name)" placeholder="Type your full legal name" />
        <TextField {...common} name="signatureDate" label="Date" type="date" />
      </FieldGrid>

      <Field error={state.errors.signatureAgree}>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            id="signatureAgree"
            name="signatureAgree"
            checked={state.individual.declaration.signatureAgree}
            className="mt-1 size-4 accent-primary"
            onChange={(e) => {
              dispatch({ type: 'setField', group: 'declaration', name: 'signatureAgree', value: e.target.checked });
              dispatch({ type: 'touch', name: 'signatureAgree' });
            }}
          />
          <span>I agree that the typed name above constitutes my signature.</span>
        </label>
      </Field>

      <SubmitActions state={state} onBack={onBack} />
    </section>
  );
}
