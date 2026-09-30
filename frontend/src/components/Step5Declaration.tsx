import { Field } from './Field';
import { SubmitActions } from './SubmitActions';
import { TextField } from './TextField';
import type { StepProps } from './stepProps';

export function Step5Declaration({ state, dispatch, onBack }: StepProps) {
  const common = { state, dispatch, group: 'declaration' as const };
  return (
    <section>
      <h2>Section E: Declaration</h2>
      <p>
        We certify that the above information is true. We understand Woodhall Capital is obligated to report
        suspicious transactions to NFIU.
      </p>

      <TextField {...common} name="signatory1Name" label="Authorized Signatory 1 — Name" placeholder="Type your full legal name" />
      <TextField {...common} name="signatory1Date" label="Authorized Signatory 1 — Date" type="date" />
      <TextField {...common} name="signatory2Name" label="Authorized Signatory 2 — Name" placeholder="Type your full legal name" />
      <TextField {...common} name="signatory2Date" label="Authorized Signatory 2 — Date" type="date" />

      <Field label="Company Seal (optional)" error={state.errors.sealFile}>
        <input
          type="file"
          aria-label="Company seal (optional)"
          accept=".pdf,.jpg,.jpeg,.png,.docx"
          onChange={(e) => dispatch({ type: 'setSeal', file: e.target.files?.[0] ?? null })}
        />
      </Field>

      <Field error={state.errors.signatureAgree}>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            id="signatureAgree"
            name="signatureAgree"
            checked={state.corporate.declaration.signatureAgree}
            className="mt-1"
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
