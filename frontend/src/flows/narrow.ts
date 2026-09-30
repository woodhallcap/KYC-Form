import type { CorporateForm, FormState, IndividualForm } from '../types';

export function asCorporate(f: FormState): CorporateForm {
  if (f.customerType !== 'corporate') throw new Error('Expected the corporate form');
  return f;
}

export function asIndividual(f: FormState): IndividualForm {
  if (f.customerType !== 'individual') throw new Error('Expected the individual form');
  return f;
}
