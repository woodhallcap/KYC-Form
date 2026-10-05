import { useId, useRef } from 'react';
import { formatFileSize } from '../lib/format';
import { validateFileMeta, validateImageMeta } from '../lib/validation';
import { FileIcon, UploadIcon, XIcon } from './icons';

interface FileTileProps {
  /** Accessible name of the file input (also used for the remove button). */
  label: string;
  /** Visible caption above the tile, when the surrounding layout needs one. */
  caption?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  /** An error from elsewhere (for example the server); a problem with the file itself takes precedence. */
  error?: string;
  /** Signature and seal images: JPG or PNG only. */
  imageOnly?: boolean;
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.docx';
const IMAGE_ACCEPT = '.jpg,.jpeg,.png,image/jpeg,image/png';

/** Tap-to-add upload: shows the chosen file with its size, a remove button, and file problems inline. */
export function FileTile({ label, caption, file, onChange, error, imageOnly }: FileTileProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const message = (file ? (imageOnly ? validateImageMeta(file) : validateFileMeta(file)).error : null) ?? error ?? null;

  return (
    <div>
      {caption && <span className="mb-1.5 block text-sm font-medium">{caption}</span>}
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-cream px-3.5 py-2.5">
          <FileIcon className="size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-sm font-medium">{file.name}</p>
            <p className="m-0 text-xs text-ink/60">{formatFileSize(file.size)}</p>
          </div>
          <button
            type="button"
            aria-label={`Remove ${label}`}
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-primary transition hover:bg-primary/10"
            onClick={() => {
              if (input.current) input.current.value = '';
              onChange(null);
            }}
          >
            <XIcon className="size-4" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-white px-3.5 py-3 text-primary transition hover:bg-cream focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
        >
          <UploadIcon className="size-5 shrink-0" />
          <span>
            <span className="block text-sm font-medium">Add a file</span>
            <span className="block text-xs text-ink/60">{imageOnly ? 'JPG or PNG photo or scan, up to 5MB' : 'PDF, JPG, PNG or DOCX, up to 5MB'}</span>
          </span>
        </label>
      )}
      <input
        ref={input}
        id={id}
        type="file"
        aria-label={label}
        accept={imageOnly ? IMAGE_ACCEPT : ACCEPT}
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {message && (
        <p role="alert" className="mt-1 mb-0 text-[13px] text-error">
          {message}
        </p>
      )}
    </div>
  );
}
