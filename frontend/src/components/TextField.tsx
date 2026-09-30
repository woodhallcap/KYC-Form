import type { Dispatch } from 'react';
import type { Action, AppState } from '../lib/reducer';
import { Field, inputClass } from './Field';

interface TextFieldProps {
  state: AppState;
  dispatch: Dispatch<Action>;
  group: 'step1' | 'step3';
  name: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'date';
  multiline?: boolean;
}

export function TextField({ state, dispatch, group, name, label, placeholder, type = 'text', multiline }: TextFieldProps) {
  const value = (state.form[group] as unknown as Record<string, string>)[name];
  const error = state.errors[name];
  const props = {
    id: name,
    name,
    value,
    placeholder,
    className: inputClass(!!error),
    onBlur: () => dispatch({ type: 'touch', name }),
  };
  return (
    <Field label={label} htmlFor={name} error={error}>
      {multiline ? (
        <textarea
          {...props}
          rows={2}
          onChange={(e) => dispatch({ type: 'setField', group, name, value: e.target.value })}
        />
      ) : (
        <input
          {...props}
          type={type}
          onChange={(e) => dispatch({ type: 'setField', group, name, value: e.target.value })}
        />
      )}
    </Field>
  );
}
