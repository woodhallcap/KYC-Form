import type { Dispatch } from 'react';
import { INCOME_OPTIONS, MEANS_OF_ID_OPTIONS, PURPOSE_OPTIONS, TRANSACTION_TYPE_OPTIONS } from '../lib/validation';
import type { Action, AppState } from '../lib/reducer';
import { Button } from './Button';
import { CheckboxGroup } from './CheckboxGroup';
import { ChoiceGroup } from './ChoiceGroup';
import { Field, inputClass } from './Field';
import { TextField } from './TextField';
import type { StepProps } from './stepProps';

interface OtherTextProps {
  state: AppState;
  dispatch: Dispatch<Action>;
  name: 'sourceOfIncomeOther' | 'purposeOther';
  ariaLabel: string;
}

/** The "Please specify" input revealed when a choice is Other. */
function OtherText({ state, dispatch, name, ariaLabel }: OtherTextProps) {
  const error = state.errors[name];
  return (
    <Field error={error}>
      <input
        type="text"
        id={name}
        name={name}
        aria-label={ariaLabel}
        placeholder="Please specify"
        value={state.individual.person[name]}
        className={inputClass(!!error)}
        onChange={(e) => dispatch({ type: 'setField', group: 'person', name, value: e.target.value })}
        onBlur={() => dispatch({ type: 'touch', name })}
      />
    </Field>
  );
}

export function IndividualStep1Person({ state, dispatch, onNext }: StepProps) {
  const { person } = state.individual;
  const common = { state, dispatch, group: 'person' as const };
  return (
    <section>
      <h2>Section A: Customer Information</h2>
      <TextField {...common} name="fullName" label="Full Name" placeholder="e.g. Jane Doe" />
      <TextField {...common} name="dateOfBirth" label="Date of Birth" type="date" />
      <TextField {...common} name="placeOfBirth" label="Place of Birth" placeholder="e.g. Lagos" />
      <ChoiceGroup
        state={state}
        dispatch={dispatch}
        name="gender"
        label="Gender"
        options={[{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }]}
      />
      <TextField {...common} name="nationality" label="Nationality" placeholder="e.g. Nigerian" />
      <TextField {...common} name="countryOfResidence" label="Country of Residence" placeholder="e.g. Nigeria" />
      <TextField {...common} name="residentialAddress" label="Residential Address" placeholder="e.g. 12 Marina Road, Lagos Island, Lagos" multiline />
      <TextField {...common} name="lga" label="LGA" placeholder="e.g. Eti-Osa" />
      <TextField {...common} name="state" label="State" placeholder="e.g. Lagos" />
      <TextField {...common} name="phone" label="Phone No" type="tel" placeholder="e.g. 08012345678" />
      <TextField {...common} name="email" label="Email" type="email" placeholder="e.g. jane@example.com" />
      <CheckboxGroup state={state} dispatch={dispatch} name="meansOfId" label="Means of ID" options={MEANS_OF_ID_OPTIONS} />
      <TextField {...common} name="idNumber" label="ID No" />
      <TextField {...common} name="idExpiry" label="Expiry Date (if any)" type="date" />
      <TextField {...common} name="bvn" label="BVN" />
      <TextField {...common} name="nin" label="NIN" />
      <TextField {...common} name="occupation" label="Occupation" placeholder="e.g. Engineer" />
      <TextField {...common} name="employerName" label="Employer/Business Name (if any)" />
      <TextField {...common} name="officeAddress" label="Office Address (if any)" multiline />
      <ChoiceGroup state={state} dispatch={dispatch} name="sourceOfIncome" label="Source of Income" options={INCOME_OPTIONS} />
      {person.sourceOfIncome === 'other' && (
        <OtherText state={state} dispatch={dispatch} name="sourceOfIncomeOther" ariaLabel="Specify source of income" />
      )}
      <TextField {...common} name="sourceOfWealth" label="Source of Wealth" />
      <ChoiceGroup state={state} dispatch={dispatch} name="purposeOfRelationship" label="Purpose of Relationship" options={PURPOSE_OPTIONS} />
      {person.purposeOfRelationship === 'other' && (
        <OtherText state={state} dispatch={dispatch} name="purposeOther" ariaLabel="Specify purpose" />
      )}
      <TextField {...common} name="expectedMonthlyTurnover" label="Expected Monthly Turnover (₦)" placeholder="e.g. 500,000" />
      <CheckboxGroup
        state={state}
        dispatch={dispatch}
        name="expectedTransactionTypes"
        label="Expected Transaction Type"
        options={TRANSACTION_TYPE_OPTIONS}
      />

      <div className="mt-7 flex justify-between">
        <span />
        <Button onClick={onNext}>Next: Documents</Button>
      </div>
    </section>
  );
}
