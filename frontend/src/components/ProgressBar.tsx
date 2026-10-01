import { CheckIcon } from './icons';

interface ProgressBarProps {
  titles: string[];
  step: number;
}

/** Numbered stepper on wider screens, compact bar on phones. */
export function ProgressBar({ titles, step }: ProgressBarProps) {
  const total = titles.length;
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="m-0 hidden list-none p-0 sm:flex">
        {titles.map((title, index) => {
          const n = index + 1;
          const state = n === step ? 'active' : n < step ? 'complete' : 'upcoming';
          const circle =
            state === 'active'
              ? 'bg-primary text-white'
              : state === 'complete'
                ? 'bg-accent text-primary'
                : 'border border-primary/25 bg-white text-primary/60';
          return (
            <li
              key={n}
              data-testid={`progress-step-${n}`}
              data-state={state}
              aria-current={state === 'active' ? 'step' : undefined}
              className="relative flex flex-1 flex-col items-center gap-2 text-center"
            >
              {n < total && (
                <span
                  aria-hidden="true"
                  className={`absolute top-[17px] left-[calc(50%+26px)] h-0.5 w-[calc(100%-52px)] ${n < step ? 'bg-accent' : 'bg-primary/15'}`}
                />
              )}
              <span className={`relative grid size-9 place-items-center rounded-full text-sm font-semibold ${circle}`}>
                {state === 'complete' ? <CheckIcon className="size-4" /> : n}
              </span>
              <span className={`px-1 text-[13px] leading-tight ${state === 'active' ? 'font-semibold text-primary' : 'text-ink/70'}`}>
                {title}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="sm:hidden">
        <span className="mb-2 block text-[13px] font-semibold text-primary">
          Step {step} of {total}: {titles[step - 1]}
        </span>
        <div className="h-1.5 overflow-hidden rounded-full bg-bg-alt">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200"
            style={{ width: `${(step / total) * 100}%` }}
          />
        </div>
      </div>
      <p className="mt-5 mb-0 text-center text-xs text-ink/60">Your progress is saved automatically on this device.</p>
    </nav>
  );
}
