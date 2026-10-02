import type { DocState } from '../types';
import { FileTile } from './FileTile';

interface RequiredDocumentRowProps {
  id: string;
  label: string;
  doc: DocState;
  error?: string;
  onFile: (file: File | null) => void;
}

/** A document that must be attached: no tick-box, the file itself is the proof. */
export function RequiredDocumentRow({ id, label, doc, error, onFile }: RequiredDocumentRowProps) {
  const attached = doc.file !== null;
  return (
    <div
      data-doc-id={id}
      data-testid={`doc-${id}`}
      className={`mb-3 rounded-2xl border p-4 transition ${attached ? 'border-primary/40 bg-cream' : 'border-[#e4dad2] bg-white'}`}
    >
      <p className="mb-3 font-medium">{label}</p>
      <FileTile label={`File for ${label}`} file={doc.file} onChange={onFile} error={error} />
    </div>
  );
}
