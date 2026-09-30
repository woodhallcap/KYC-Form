import type { CustomerType, Errors, FormState } from '../types';

export interface FlowStep {
  id: string;
  title: string;
  /** Does this error/touch key belong to this step? */
  owns(key: string): boolean;
  /** Keys marked touched when the user presses Next on this step. */
  touchKeys(form: FormState): string[];
  validate(form: FormState): Errors;
}

export interface Flow {
  id: CustomerType;
  steps: FlowStep[];
}
