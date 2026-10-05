import { Field } from './Field';
import { FieldGrid } from './FieldGrid';
import { FileTile } from './FileTile';
import { SectionHeading } from './SectionHeading';
import { SubmitActions } from './SubmitActions';
import { TextField } from './TextField';
import { CORPORATE_IMAGES } from '../lib/validation';
import type { ImageSpec } from '../lib/validation';
import type { CorporateForm } from '../types';
import type { StepProps } from './stepProps';

export function Step5Declaration({ state, dispatch, onBack }: StepProps) {
  const common = { state, dispatch, group: 'declaration' as const };
  const imageTile = (spec: ImageSpec) => (
    <FileTile
      imageOnly
      label={spec.label}
      caption={spec.label}
      file={state.corporate.images[spec.name as keyof CorporateForm['images']]}
      error={state.errors[spec.name]}
      onChange={(file) => {
        dispatch({ type: 'setImage', name: spec.name, file });
        dispatch({ type: 'touch', name: spec.name });
      }}
    />
  );
  return (
    <section>
      <SectionHeading text="Section E: Declaration" />
      <p>
        We certify that the above information is true. We understand Woodhall Finance Company Ltd is obligated to report
        suspicious transactions to NFIU.
      </p>

      <p className="text-sm text-ink/70">Sign on plain white paper, then upload a clear photo or scan.</p>

      {([1, 2] as const).map((n) => {
        const spec = CORPORATE_IMAGES[n - 1];
        return (
          <div key={n} className="mb-5">
            <FieldGrid>
              <TextField {...common} name={`signatory${n}Name`} label={`Authorized Signatory ${n} — Name`} placeholder="Type your full legal name" />
              <TextField {...common} name={`signatory${n}Date`} label={`Authorized Signatory ${n} — Date`} type="date" />
            </FieldGrid>
            {imageTile(spec)}
          </div>
        );
      })}
      <div className="mb-5">
        {imageTile(CORPORATE_IMAGES[2])}
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
          <span>We confirm the attached images are our own handwritten signatures.</span>
        </label>
      </Field>

      <SubmitActions state={state} onBack={onBack} />
    </section>
  );
}
