import { Button } from './Button';
import { Field } from './Field';
import { TextField } from './TextField';
import type { StepProps } from './stepProps';

export function Step3Declaration({ state, dispatch, onBack }: StepProps) {
  const submitting = state.status === 'submitting';
  const common = { state, dispatch, group: 'step3' as const };
  return (
    <section>
      <h2>Section C: Declaration</h2>
      <p>
        We, the undersigned, certify that the information provided above is true and complete to the best of our
        knowledge, and that any material misstatement may result in the decline or termination of this relationship.
      </p>

      <TextField {...common} name="certifyingName" label="Name" placeholder="e.g. Jane Doe" />
      <TextField {...common} name="designation" label="Designation" placeholder="e.g. Managing Director" />
      <TextField
        {...common}
        name="signatureName"
        label="Typed Signature (type your full name)"
        placeholder="Type your full legal name"
      />

      <Field error={state.errors.signatureAgree}>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            id="signatureAgree"
            name="signatureAgree"
            checked={state.form.step3.signatureAgree}
            className="mt-1"
            onChange={(e) => {
              dispatch({ type: 'setField', group: 'step3', name: 'signatureAgree', value: e.target.checked });
              dispatch({ type: 'touch', name: 'signatureAgree' });
            }}
          />
          <span>I agree that the typed name above constitutes my signature.</span>
        </label>
      </Field>

      <div className="mt-7 flex justify-between">
        <Button variant="secondary" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && (
            <span className="size-3.5 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin" />
          )}
          <span>{submitting ? 'Submitting…' : 'Submit Form'}</span>
        </Button>
      </div>
    </section>
  );
}
