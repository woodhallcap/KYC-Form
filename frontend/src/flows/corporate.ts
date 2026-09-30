import { DIRECTOR_FIELDS } from '../types';
import type { CustomerType, Errors, FormState } from '../types';
import {
  validateDeclaration, validateDirectors, validateDocuments, validateEntity, validateFunds,
} from '../lib/validation';
import type { Flow, FlowStep } from './types';

export const ENTITY_FIELDS = [
  'companyName', 'rcNumber', 'dateOfIncorporation', 'registeredAddress', 'businessAddress',
  'natureOfBusiness', 'tin', 'companyEmail', 'bankAccountNumber', 'bankName',
];
const FUNDS_FIELDS = ['sourceOfFunds', 'facilityAmount'];
const DECLARATION_FIELDS = ['signatory1Name', 'signatory1Date', 'signatory2Name', 'signatory2Date', 'signatureAgree'];

function step(
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

export const corporateFlow: Flow = {
  id: 'corporate',
  steps: [
    step('entity', 'Entity Information', ENTITY_FIELDS, (f) => validateEntity(f.entity)),
    step('directors', 'Directors & UBOs', ['directors'], (f) => validateDirectors(f.directors), {
      prefix: 'directors.',
      extraTouch: (f) => f.directors.flatMap((_, i) => DIRECTOR_FIELDS.map((n) => `directors.${i}.${n}`)),
    }),
    step('documents', 'Documents', ['consent'], validateDocuments),
    step('funds', 'Source of Funds', FUNDS_FIELDS, (f) => validateFunds(f.funds)),
    step('declaration', 'Declaration', DECLARATION_FIELDS, (f) => validateDeclaration(f.declaration, f.seal)),
  ],
};

export const FLOWS: Record<CustomerType, Flow> = { corporate: corporateFlow };
