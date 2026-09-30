import { Button } from './Button';
import { Field, inputClass } from './Field';
import { TextField } from './TextField';
import type { StepProps } from './stepProps';

const LEGAL_STATUSES = [
  { value: 'private', label: 'Private Limited Company' },
  { value: 'public', label: 'Public Limited Company' },
  { value: 'other', label: 'Other' },
];

export function Step1Entity({ state, dispatch, onNext }: StepProps) {
  const { step1 } = state.form;
  const common = { state, dispatch, group: 'step1' as const };
  return (
    <section>
      <h2>Section A: Entity Information</h2>
      <TextField {...common} name="companyName" label="Company Name" placeholder="e.g. Acme Trading Limited" />
      <TextField {...common} name="rcNumber" label="RC Number" placeholder="e.g. RC1234567" />
      <TextField {...common} name="dateOfIncorporation" label="Date of Incorporation" type="date" />

      <Field error={state.errors.legalStatus ?? state.errors.legalStatusOther}>
        <span className="mb-1.5 block font-semibold">Legal Status</span>
        {LEGAL_STATUSES.map((o) => (
          <label key={o.value} className="block">
            <input
              type="radio"
              name="legalStatus"
              value={o.value}
              checked={step1.legalStatus === o.value}
              onChange={() => {
                dispatch({ type: 'setField', group: 'step1', name: 'legalStatus', value: o.value });
                dispatch({ type: 'touch', name: 'legalStatus' });
              }}
            />{' '}
            {o.label}
          </label>
        ))}
        {step1.legalStatus === 'other' && (
          <input
            type="text"
            id="legalStatusOther"
            name="legalStatusOther"
            placeholder="Please specify"
            value={step1.legalStatusOther}
            className={`mt-2 ${inputClass(!!state.errors.legalStatusOther)}`}
            onChange={(e) =>
              dispatch({ type: 'setField', group: 'step1', name: 'legalStatusOther', value: e.target.value })
            }
            onBlur={() => dispatch({ type: 'touch', name: 'legalStatusOther' })}
          />
        )}
      </Field>

      <TextField
        {...common}
        name="registeredAddress"
        label="Registered Address"
        placeholder="e.g. 12 Marina Road, Lagos Island, Lagos"
        multiline
      />
      <TextField
        {...common}
        name="businessAddress"
        label="Business/Operating Address (if different)"
        placeholder="e.g. 4 Adeola Odeku Street, Victoria Island, Lagos"
        multiline
      />
      <TextField {...common} name="natureOfBusiness" label="Nature of Business" placeholder="e.g. Import/export trade finance" />
      <TextField {...common} name="tin" label="Tax Identification Number (TIN)" placeholder="e.g. 12345678-0001" />
      <TextField {...common} name="companyEmail" label="Company Email" type="email" placeholder="e.g. finance@acmetrading.com" />
      <TextField {...common} name="website" label="Website (if any)" placeholder="e.g. https://acmetrading.com" />
      <TextField {...common} name="bankAccountNumber" label="Corporate Bank Account Number" placeholder="e.g. 0123456789" />
      <TextField {...common} name="bankName" label="Bank" placeholder="e.g. First Bank of Nigeria" />

      <div className="mt-7 flex justify-between">
        <span />
        <Button onClick={onNext}>Next: KYC Documents</Button>
      </div>
    </section>
  );
}
