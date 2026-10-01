import { MAX_DIRECTORS } from '../lib/validation';
import { Button } from './Button';
import { DirectorRow } from './DirectorRow';
import { SectionHeading } from './SectionHeading';
import type { StepProps } from './stepProps';

export function Step2Directors({ state, dispatch, onNext, onBack }: StepProps) {
  const { directors } = state.corporate;
  return (
    <section>
      <SectionHeading text="Section B: Directors, Signatories and UBOs" />
      <p>
        List every director, signatory and ultimate beneficial owner (UBO) holding more than 5% of the company.
        Attach ID, BVN, NIN and proof of address for each person where available.
      </p>

      {directors.map((_, index) => (
        <DirectorRow key={index} index={index} state={state} dispatch={dispatch} canRemove={directors.length > 1} />
      ))}

      {state.errors.directors && (
        <p role="alert" className="mb-3 text-[13px] text-error">
          {state.errors.directors}
        </p>
      )}

      <Button
        variant="secondary"
        disabled={directors.length >= MAX_DIRECTORS}
        onClick={() => dispatch({ type: 'addDirector' })}
      >
        Add another person
      </Button>

      <div className="mt-7 flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button arrow onClick={onNext}>
          Next: Documents
        </Button>
      </div>
    </section>
  );
}
