import { Field } from './Field';
import { FieldGrid } from './FieldGrid';
import { FileTile } from './FileTile';
import { SectionHeading } from './SectionHeading';
import { SubmitActions } from './SubmitActions';
import { TextField } from './TextField';
import type { StepProps } from './stepProps';

export function Step5Declaration({ state, dispatch, onBack }: StepProps) {
  const common = { state, dispatch, group: 'declaration' as const };
  return (
    <section>
      <SectionHeading text="Section E: Declaration" />
      <p>
        We certify that the above information is true. We understand Woodhall Capital is obligated to report
        suspicious transactions to NFIU.
      </p>

      <FieldGrid>
        <TextField {...common} name="signatory1Name" label="Authorized Signatory 1 — Name" placeholder="Type your full legal name" />
        <TextField {...common} name="signatory1Date" label="Authorized Signatory 1 — Date" type="date" />
        <TextField {...common} name="signatory2Name" label="Authorized Signatory 2 — Name" placeholder="Type your full legal name" />
        <TextField {...common} name="signatory2Date" label="Authorized Signatory 2 — Date" type="date" />
      </FieldGrid>

      <div className="mb-5">
        <FileTile
          label="Company seal (optional)"
          caption="Company seal (optional)"
          file={state.corporate.seal}
          onChange={(file) => dispatch({ type: 'setSeal', file })}
          error={state.errors.sealFile}
        />
      </div>

      <Field error={state.errors.signatureAgree}>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            id="signatureAgree"
            name="signatureAgree"
            checked={state.corporate.declaration.signatureAgree}
            className="mt-1 size-4 accent-primary"
            onChange={(e) => {
              dispatch({ type: 'setField', group: 'declaration', name: 'signatureAgree', value: e.target.checked });
              dispatch({ type: 'touch', name: 'signatureAgree' });
            }}
          />
          <span>I agree that the typed names above constitute our signatures.</span>
        </label>
      </Field>

      <SubmitActions state={state} onBack={onBack} />
    </section>
  );
}
