import type { ReactNode } from 'react';

export function inputClass(hasError: boolean): string {
  return (
    'w-full rounded-md border px-3 py-2.5 font-body text-[15px] ' +
    (hasError ? 'border-error' : 'border-[#D8CFC8]')
  );
}

interface FieldProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, children }: FieldProps) {
  return (
    <div className="mb-5">
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block font-semibold">
          {label}
        </label>
      )}
      {children}
      {error && (
        <p role="alert" className="mt-1 text-[13px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}
