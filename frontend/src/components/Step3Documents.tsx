import { DOCUMENT_LABELS } from '../lib/documents';
import { DOCUMENT_IDS } from '../lib/validation';
import { Button } from './Button';
import { DocumentRow } from './DocumentRow';
import { Field } from './Field';
import type { StepProps } from './stepProps';

export function Step3Documents({ state, dispatch, onNext, onBack }: StepProps) {
  return (
    <section>
      <h2>Section C: Required Documents</h2>
      <p>Tick each document submitted and attach a copy where available.</p>

      <div>
        {DOCUMENT_IDS.map((id) => (
          <DocumentRow
            key={id}
            id={id}
            label={DOCUMENT_LABELS[id]}
            doc={state.form.docs[id]}
            onToggle={(value) => dispatch({ type: 'setDocSubmitted', id, value })}
            onFile={(file) => dispatch({ type: 'setDocFile', id, file })}
          />
        ))}
      </div>

      <div className="mt-5">
        <Field error={state.errors.consent}>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              id="consent"
              name="consent"
              checked={state.form.consent}
              className="mt-1"
              onChange={(e) => {
                dispatch({ type: 'setConsent', value: e.target.checked });
                dispatch({ type: 'touch', name: 'consent' });
              }}
            />
            <span>
              We consent to the use, processing, verification, retention, and disclosure of the information and
              documents provided for due diligence, compliance, and the furtherance of our business relationship.
            </span>
          </label>
        </Field>
      </div>

      <div className="mt-7 flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Next: Source of Funds</Button>
      </div>
    </section>
  );
}
