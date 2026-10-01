import type { Dispatch } from 'react';
import type { Action, AppState } from '../lib/reducer';
import { Field } from './Field';

interface Option {
  value: string;
  label: string;
}

interface ChoiceGroupProps {
  state: AppState;
  dispatch: Dispatch<Action>;
  name: string;
  label: string;
  options: Option[];
}

/** A single-choice radio group bound to `person[name]`. */
export function ChoiceGroup({ state, dispatch, name, label, options }: ChoiceGroupProps) {
  const current = (state.individual.person as unknown as Record<string, unknown>)[name];
  return (
    <Field error={state.errors[name]}>
      <div role="radiogroup" aria-label={label}>
        <span className="mb-1.5 block font-semibold">{label}</span>
        {options.map((option) => (
          <label key={option.value} className="mr-4 inline-block">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={current === option.value}
              onChange={() => {
                dispatch({ type: 'setField', group: 'person', name, value: option.value });
                dispatch({ type: 'touch', name });
              }}
            />{' '}
            {option.label}
          </label>
        ))}
      </div>
    </Field>
  );
}
