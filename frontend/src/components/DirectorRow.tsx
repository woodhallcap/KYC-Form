import type { Dispatch } from 'react';
import { DIRECTOR_FILE_IDS } from '../lib/validation';
import type { Action, AppState } from '../lib/reducer';
import type { DirectorField, DirectorFileId } from '../types';
import { Field, inputClass } from './Field';

interface DirectorRowProps {
  index: number;
  state: AppState;
  dispatch: Dispatch<Action>;
  canRemove: boolean;
}

const FILE_LABELS: Record<DirectorFileId, string> = {
  id: 'ID',
  bvn: 'BVN',
  nin: 'NIN',
  proof_of_address: 'Proof of address',
};

export function DirectorRow({ index, state, dispatch, canRemove }: DirectorRowProps) {
  const row = state.corporate.directors[index];
  const n = index + 1;
  const errorOf = (field: DirectorField) => state.errors[`directors.${index}.${field}`];
  const touch = (field: DirectorField) => dispatch({ type: 'touch', name: `directors.${index}.${field}` });

  const text = (field: DirectorField, label: string, opts: { multiline?: boolean; inputMode?: 'decimal' } = {}) => {
    const id = `directors-${index}-${field}`;
    const common = {
      id,
      value: row[field],
      className: inputClass(!!errorOf(field)),
      onBlur: () => touch(field),
      onChange: (e: { target: { value: string } }) =>
        dispatch({ type: 'setDirectorField', index, name: field, value: e.target.value }),
    };
    return (
      <Field label={label} htmlFor={id} error={errorOf(field)}>
        {opts.multiline ? (
          <textarea {...common} rows={2} />
        ) : (
          <input {...common} type="text" inputMode={opts.inputMode} />
        )}
      </Field>
    );
  };

  return (
    <div role="group" aria-label={`Director ${n}`} className="mb-4 rounded-lg border border-[#E4DAD2] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="!mb-0 text-lg">Person {n}</h3>
        <button
          type="button"
          aria-label={`Remove director ${n}`}
          disabled={!canRemove}
          onClick={() => dispatch({ type: 'removeDirector', index })}
          className="cursor-pointer rounded-full border border-primary bg-transparent px-3.5 py-1.5 text-[13px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Remove
        </button>
      </div>

      {text('name', 'Name')}
      {text('designation', 'Designation')}
      {text('bvn', 'BVN')}
      {text('nin', 'NIN')}
      {text('shareholdingPercent', '% Shareholding', { inputMode: 'decimal' })}
      {text('nationality', 'Nationality')}

      <Field error={errorOf('pep')}>
        <span className="mb-1.5 block font-semibold">PEP</span>
        {(['yes', 'no'] as const).map((value) => (
          <label key={value} className="mr-4 inline-block">
            <input
              type="radio"
              name={`pep-${index}`}
              value={value}
              checked={row.pep === value}
              onChange={() => {
                dispatch({ type: 'setDirectorField', index, name: 'pep', value });
                touch('pep');
              }}
            />{' '}
            {value === 'yes' ? 'Yes' : 'No'}
          </label>
        ))}
      </Field>

      {text('residentialAddress', 'Residential Address', { multiline: true })}

      <div>
        <span className="mb-1.5 block font-semibold">Attachments (optional)</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {DIRECTOR_FILE_IDS.map((fileId) => (
            <div key={fileId} className="text-sm">
              <span>{FILE_LABELS[fileId]}</span>
              <input
                type="file"
                aria-label={`Director ${n} ${FILE_LABELS[fileId]} file`}
                accept=".pdf,.jpg,.jpeg,.png,.docx"
                className="mt-1 block w-full"
                onChange={(e) =>
                  dispatch({ type: 'setDirectorFile', index, fileId, file: e.target.files?.[0] ?? null })
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
