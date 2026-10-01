import type { Dispatch } from 'react';
import type { Action, AppState, ChoiceName } from '../lib/reducer';
import { Field } from './Field';

interface Option {
  value: string;
  label: string;
}

interface CheckboxGroupProps {
  state: AppState;
  dispatch: Dispatch<Action>;
  name: ChoiceName;
  label: string;
  options: Option[];
}

/** A multi-choice checkbox group bound to the `person[name]` array. */
export function CheckboxGroup({ state, dispatch, name, label, options }: CheckboxGroupProps) {
  const chosen = state.individual.person[name] as string[];
  return (
    <Field error={state.errors[name]}>
      <div role="group" aria-label={label}>
        <span className="mb-1.5 block font-semibold">{label}</span>
        {options.map((option) => (
          <label key={option.value} className="mr-4 inline-block">
            <input
              type="checkbox"
              value={option.value}
              checked={chosen.includes(option.value)}
              onChange={() => {
                dispatch({ type: 'toggleChoice', name, value: option.value });
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
