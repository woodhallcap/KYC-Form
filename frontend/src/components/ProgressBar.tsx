export const STEP_NAMES: Record<1 | 2 | 3, string> = {
  1: 'Entity Information',
  2: 'KYC / CDD Documents',
  3: 'Declaration',
};

export function ProgressBar({ step }: { step: 1 | 2 | 3 }) {
  const steps = [1, 2, 3] as const;
  return (
    <>
      <div className="mb-8 hidden justify-between gap-2 sm:flex">
        {steps.map((n) => {
          const tone =
            n === step ? 'bg-primary text-white' : n < step ? 'bg-accent text-primary' : 'bg-bg-alt text-primary';
          return (
            <div
              key={n}
              data-testid={`progress-step-${n}`}
              className={`flex-1 rounded-full px-1.5 py-2.5 text-center text-[13px] font-semibold tracking-[0.03em] ${tone}`}
            >
              {n}. {STEP_NAMES[n]}
            </div>
          );
        })}
      </div>
      <div className="mb-6 sm:hidden">
        <span className="mb-2 block text-[13px] font-semibold text-primary">
          Step {step} of 3: {STEP_NAMES[step]}
        </span>
        <div className="h-1.5 overflow-hidden rounded-full bg-bg-alt">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>
    </>
  );
}
