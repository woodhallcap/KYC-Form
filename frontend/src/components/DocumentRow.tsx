import type { DocState } from '../types';

interface DocumentRowProps {
  id: string;
  label: string;
  doc: DocState;
  onToggle: (submitted: boolean) => void;
  onFile: (file: File | null) => void;
}

export function DocumentRow({ id, label, doc, onToggle, onFile }: DocumentRowProps) {
  return (
    <div className="mb-3 rounded-lg border border-[#E4DAD2] p-4" data-doc-id={id}>
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={doc.submitted} onChange={(e) => onToggle(e.target.checked)} className="mt-1" />
        <span>{label}</span>
      </label>
      {doc.submitted && (
        <div className="mt-2.5">
          <input
            type="file"
            aria-label={`File for ${label}`}
            accept=".pdf,.jpg,.jpeg,.png,.docx"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </div>
      )}
    </div>
  );
}
