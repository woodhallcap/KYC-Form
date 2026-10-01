import type { AppState } from '../lib/reducer';
import { Button } from './Button';

interface SubmitActionsProps {
  state: AppState;
  onBack: () => void;
}

/** Back + Submit buttons for the last step of any flow. */
export function SubmitActions({ state, onBack }: SubmitActionsProps) {
  const submitting = state.status === 'submitting';
  return (
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
  );
}
