import type { Errors, FormState } from '../types';
import type { FlowStep } from './types';

export function step(
  id: string,
  title: string,
  fields: string[],
  validate: (f: FormState) => Errors,
  opts: { prefix?: string; extraTouch?: (f: FormState) => string[] } = {},
): FlowStep {
  return {
    id,
    title,
    validate,
    owns: (key) => fields.includes(key) || (!!opts.prefix && key.startsWith(opts.prefix)),
    touchKeys: (form) => [...fields, ...(opts.extraTouch ? opts.extraTouch(form) : [])],
  };
}
