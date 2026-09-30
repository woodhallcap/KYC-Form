export function DraftBanner({ onClear }: { onClear: () => void }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-accent bg-bg-alt px-3.5 py-2.5 text-sm text-primary">
      <span>We restored your unsaved draft.</span>
      <button
        type="button"
        onClick={onClear}
        className="cursor-pointer whitespace-nowrap rounded-full border border-primary bg-transparent px-3.5 py-1.5 text-[13px] font-semibold text-primary"
      >
        Clear and start over
      </button>
    </div>
  );
}
