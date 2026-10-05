import type { DocumentSpec } from '../lib/documents';
import { activeForm } from '../lib/reducer';
import { Button } from './Button';
import { DocumentRow } from './DocumentRow';
import { Field } from './Field';
import { SectionHeading } from './SectionHeading';
import type { StepProps } from './stepProps';

interface DocumentsStepProps extends StepProps {
  heading: string;
  intro: string;
  documents: readonly DocumentSpec[];
  consentText: string;
  nextLabel: string;
}

/** The required/optional document upload tiles plus consent, shared by both flows. */
export function DocumentsStep({ state, dispatch, onNext, onBack, heading, intro, documents, consentText, nextLabel }: DocumentsStepProps) {
  const form = activeForm(state);
  if (!form) return null;
  return (
    <section>
      <SectionHeading text={heading} />
      <p>{intro}</p>

      <div>
        {documents.map((d) => (
          <DocumentRow
            key={d.id}
            id={d.id}
            label={d.label}
            required={d.required}
            file={form.docs[d.id] ?? null}
            error={state.errors[d.id]}
            onFile={(file) => {
              dispatch({ type: 'setDocFile', id: d.id, file });
              dispatch({ type: 'touch', name: d.id });
            }}
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
              checked={form.consent}
              className="mt-1"
              onChange={(e) => {
                dispatch({ type: 'setConsent', value: e.target.checked });
                dispatch({ type: 'touch', name: 'consent' });
              }}
            />
            <span>{consentText}</span>
          </label>
        </Field>
      </div>

      <div className="mt-7 flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button arrow onClick={onNext}>
          {nextLabel}
        </Button>
      </div>
    </section>
  );
}
