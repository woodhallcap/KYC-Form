import { DIRECTOR_FIELDS } from '../types';
import type { CustomerType } from '../types';
import {
  validateDeclaration, validateDirectors, validateDocuments, validateEntity, validateFunds,
} from '../lib/validation';
import type { Flow } from './types';
import { individualFlow } from './individual';
import { asCorporate } from './narrow';
import { step } from './step';

export const ENTITY_FIELDS = [
  'companyName', 'rcNumber', 'dateOfIncorporation', 'registeredAddress', 'businessAddress',
  'natureOfBusiness', 'tin', 'companyEmail', 'bankAccountNumber', 'bankName',
];
const FUNDS_FIELDS = ['sourceOfFunds', 'facilityAmount'];
const DECLARATION_FIELDS = ['signatory1Name', 'signatory1Date', 'signatory2Name', 'signatory2Date', 'signatureAgree'];

export const corporateFlow: Flow = {
  id: 'corporate',
  steps: [
    step('entity', 'Entity Information', ENTITY_FIELDS, (f) => validateEntity(asCorporate(f).entity)),
    step('directors', 'Directors & UBOs', ['directors'], (f) => validateDirectors(asCorporate(f).directors), {
      prefix: 'directors.',
      extraTouch: (f) => asCorporate(f).directors.flatMap((_, i) => DIRECTOR_FIELDS.map((n) => `directors.${i}.${n}`)),
    }),
    step('documents', 'Documents', ['consent'], (f) => validateDocuments(asCorporate(f))),
    step('funds', 'Source of Funds', FUNDS_FIELDS, (f) => validateFunds(asCorporate(f).funds)),
    step('declaration', 'Declaration', DECLARATION_FIELDS, (f) => { const c = asCorporate(f); return validateDeclaration(c.declaration, c.seal); }),
  ],
};

export const FLOWS: Record<CustomerType, Flow> = { corporate: corporateFlow, individual: individualFlow };
