import type { DocState } from '../types';
import { FileTile } from './FileTile';

interface DocumentRowProps {
  id: string;
  label: string;
  doc: DocState;
  error?: string;
  onToggle: (submitted: boolean) => void;
  onFile: (file: File | null) => void;
}

export function DocumentRow({ id, label, doc, error, onToggle, onFile }: DocumentRowProps) {
  return (
    <div
      className={`mb-3 rounded-2xl border p-4 transition ${doc.submitted ? 'border-primary/40 bg-cream' : 'border-[#e4dad2] bg-white'}`}
      data-doc-id={id}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={doc.submitted}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-1 size-4 accent-primary"
        />
        <span>{label}</span>
      </label>
      {doc.submitted && (
        <div className="mt-3 sm:ml-7">
          <FileTile label={`File for ${label}`} file={doc.file} onChange={onFile} error={error} />
        </div>
      )}
    </div>
  );
}
