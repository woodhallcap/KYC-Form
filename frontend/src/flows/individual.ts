import {
  INDIVIDUAL_DOCUMENT_IDS, validateIndividualDeclaration, validateIndividualDocuments, validateIndividualPerson,
} from '../lib/validation';
import type { Flow } from './types';
import { asIndividual } from './narrow';
import { step } from './step';

const PERSON_FIELDS = [
  'fullName', 'dateOfBirth', 'placeOfBirth', 'gender', 'nationality', 'countryOfResidence', 'residentialAddress', 'lga', 'state', 'phone', 'email',
  'meansOfId', 'idNumber', 'idExpiry', 'bvn', 'nin', 'occupation', 'employerName', 'officeAddress', 'sourceOfIncome', 'sourceOfIncomeOther',
  'sourceOfWealth', 'purposeOfRelationship', 'purposeOther', 'expectedMonthlyTurnover', 'expectedTransactionTypes',
];
const DECLARATION_FIELDS = ['declarationName', 'signatureName', 'signatureDate', 'signatureAgree'];

export const individualFlow: Flow = {
  id: 'individual',
  steps: [
    step('person', 'Customer Information', PERSON_FIELDS, (f) => validateIndividualPerson(asIndividual(f).person)),
    step('documents', 'Documents', ['consent', ...INDIVIDUAL_DOCUMENT_IDS], (f) => validateIndividualDocuments(asIndividual(f))),
    step('declaration', 'Declaration', DECLARATION_FIELDS, (f) => validateIndividualDeclaration(asIndividual(f).declaration)),
  ],
};
