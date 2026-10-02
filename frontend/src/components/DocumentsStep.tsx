import { activeForm } from '../lib/reducer';
import { Button } from './Button';
import { Field } from './Field';
import { RequiredDocumentRow } from './RequiredDocumentRow';
import { SectionHeading } from './SectionHeading';
import type { StepProps } from './stepProps';

interface DocumentsStepProps extends StepProps {
  heading: string;
  intro: string;
  ids: readonly string[];
  labels: Record<string, string>;
  consentText: string;
  nextLabel: string;
}

/** The required-document list (a file for every document) plus consent, shared by both flows. */
export function DocumentsStep({ state, dispatch, onNext, onBack, heading, intro, ids, labels, consentText, nextLabel }: DocumentsStepProps) {
  const form = activeForm(state);
  if (!form) return null;
  return (
    <section>
      <SectionHeading text={heading} />
      <p>{intro}</p>

      <div>
        {ids.map((id) => (
          <RequiredDocumentRow
            key={id}
            id={id}
            label={labels[id]}
            doc={form.docs[id]}
            error={state.errors[id]}
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
