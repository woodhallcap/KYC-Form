import type { Dispatch } from 'react';
import { activeForm } from '../lib/reducer';
import type { Action, AppState } from '../lib/reducer';
import { Field, inputClass } from './Field';

interface TextFieldProps {
  state: AppState;
  dispatch: Dispatch<Action>;
  group: 'entity' | 'funds' | 'declaration' | 'person';
  name: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'date' | 'tel';
  multiline?: boolean;
}

export function TextField({ state, dispatch, group, name, label, placeholder, type = 'text', multiline }: TextFieldProps) {
  const groups = activeForm(state) as unknown as Record<string, Record<string, string>> | null;
  const value = groups?.[group]?.[name] ?? '';
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
