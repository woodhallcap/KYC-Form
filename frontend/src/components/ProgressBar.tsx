interface ProgressBarProps {
  titles: string[];
  step: number;
}

export function ProgressBar({ titles, step }: ProgressBarProps) {
  const total = titles.length;
  return (
    <>
      <div className="mb-8 hidden justify-between gap-2 sm:flex">
        {titles.map((title, index) => {
          const n = index + 1;
          const tone =
            n === step ? 'bg-primary text-white' : n < step ? 'bg-accent text-primary' : 'bg-bg-alt text-primary';
          return (
            <div
              key={n}
              data-testid={`progress-step-${n}`}
              className={`flex-1 rounded-full px-1 py-2.5 text-center text-xs font-semibold tracking-[0.03em] sm:text-[13px] ${tone}`}
            >
              {n}. {title}
            </div>
          );
        })}
      </div>
      <div className="mb-6 sm:hidden">
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
    </>
  );
}
