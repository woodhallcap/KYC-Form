import { Field } from './Field';
import { FileTile } from './FileTile';
import { SectionHeading } from './SectionHeading';
import { SubmitActions } from './SubmitActions';
import { TextField } from './TextField';
import type { StepProps } from './stepProps';
import { INDIVIDUAL_IMAGES } from '../lib/validation';

export function IndividualStep3Declaration({ state, dispatch, onBack }: StepProps) {
  const common = { state, dispatch, group: 'declaration' as const };
  const spec = INDIVIDUAL_IMAGES[0];
  return (
    <section>
      <SectionHeading text="Section C: Declaration" />
      <p>
        I hereby declare that the information provided is true and correct. I authorize Woodhall Finance Company Ltd to verify my
        details with NIBSS, NIMC, Credit Bureaus and report to NFIU/CBN as required by law.
      </p>

      <TextField {...common} name="declarationName" label="Full Name" placeholder="e.g. Jane Doe" />
      <TextField {...common} name="signatureDate" label="Date" type="date" />

      <p className="text-sm text-ink/70">Sign on plain white paper, then upload a clear photo or scan.</p>
      <div className="mb-5">
        <FileTile
          imageOnly
          label={spec.label}
          caption={spec.label}
          file={state.individual.images.signatureFile}
          error={state.errors.signatureFile}
          onChange={(file) => {
            dispatch({ type: 'setImage', name: 'signatureFile', file });
            dispatch({ type: 'touch', name: 'signatureFile' });
          }}
        />
      </div>

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
          <span>I confirm the attached image is my own handwritten signature.</span>
        </label>
      </Field>

      <SubmitActions state={state} onBack={onBack} />
    </section>
  );
}
