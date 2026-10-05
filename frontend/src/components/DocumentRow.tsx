import { FileTile } from './FileTile';

interface DocumentRowProps {
  id: string;
  label: string;
  required: boolean;
  file: File | null;
  error?: string;
  onFile: (file: File | null) => void;
}

export function DocumentRow({ id, label, required, file, error, onFile }: DocumentRowProps) {
  return (
    <div className={`mb-3 rounded-2xl border p-4 transition ${file ? 'border-primary/40 bg-cream' : 'border-[#e4dad2] bg-white'}`} data-doc-id={id}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="font-medium">{label}</span>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${required ? 'bg-primary/10 text-primary' : 'bg-ink/5 text-ink/60'}`}>
          {required ? 'Required' : 'Optional'}
        </span>
      </div>
      <FileTile label={label} file={file} onChange={onFile} error={error} />
    </div>
  );
}
