import { useEffect, useReducer, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { BrandPanel } from './components/BrandPanel';
import { Confirmation } from './components/Confirmation';
import { DraftBanner } from './components/DraftBanner';
import { Pill } from './components/Pill';
import { ProgressBar } from './components/ProgressBar';
import { SiteFooter } from './components/SiteFooter';
import { IndividualStep1Person } from './components/IndividualStep1Person';
import { IndividualStep2Documents } from './components/IndividualStep2Documents';
import { IndividualStep3Declaration } from './components/IndividualStep3Declaration';
import { Step1Entity } from './components/Step1Entity';
import { Step2Directors } from './components/Step2Directors';
import { Step3Documents } from './components/Step3Documents';
import { Step4Funds } from './components/Step4Funds';
import { Step5Declaration } from './components/Step5Declaration';
import type { StepProps } from './components/stepProps';
import { TypeSelector } from './components/TypeSelector';
import { prefillActions } from './dev/prefill';
import { clearDraft, hasAnyContent, loadDraft, saveDraft } from './lib/autosave';
import { CUSTOMER_LABEL } from './lib/copy';
import { activeForm, fieldStep, flowOf, initialAppState, reducer, stepErrors } from './lib/reducer';
import type { AppState } from './lib/reducer';
import type { Flow } from './flows/types';
import type { CustomerType, Errors } from './types';
import { postSubmission } from './lib/submit';

const AUTOSAVE_DEBOUNCE_MS = 800;

/** One component per flow step, in order, for each customer type. */
const STEP_COMPONENTS: Record<CustomerType, ((props: StepProps) => React.JSX.Element | null)[]> = {
  corporate: [Step1Entity, Step2Directors, Step3Documents, Step4Funds, Step5Declaration],
  individual: [IndividualStep1Person, IndividualStep2Documents, IndividualStep3Declaration],
};

/** Where the confirmation copy goes: the company email or the individual's email. */
function submitterEmail(state: AppState): string {
  return state.customerType === 'individual' ? state.individual.person.email : state.corporate.entity.companyEmail;
}

function init() {
  const state = initialAppState();
  const draft = loadDraft();
  return hasAnyContent(draft) ? reducer(state, { type: 'restoreDraft', draft: draft! }) : state;
}

function alertUnmatched(flow: Flow, errors: Errors) {
  const unmatched = Object.keys(errors)
    .filter((key) => fieldStep(flow, key) === null)
    .map((key) => errors[key]);
  if (unmatched.length > 0) alert(unmatched.join('\n'));
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const { step, status, customerType } = state;
  const form = activeForm(state);
  const flow = flowOf(state);
  const lastStep = flow.steps.length;
  const sending = useRef(false);
  const mounted = useRef(false);
  const [prevStep, setPrevStep] = useState(step);
  const [direction, setDirection] = useState<'right' | 'left'>('right');
  if (prevStep !== step) {
    setPrevStep(step);
    setDirection(step > prevStep ? 'right' : 'left');
  }

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (status === 'done' || !form) return;
    const timer = window.setTimeout(() => saveDraft(form), AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [form, status]);

  const onNext = () => {
    if (!form) return;
    alertUnmatched(flow, stepErrors(form, flow, step));
    dispatch({ type: 'next' });
  };
  const onBack = () => dispatch({ type: 'back' });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form || sending.current || status !== 'idle') return;
    if (Object.keys(stepErrors(form, flow, lastStep)).length > 0) {
      dispatch({ type: 'next' });
      return;
    }
    sending.current = true;
    dispatch({ type: 'submitting', value: true });
    try {
      const payload = await postSubmission(form);
      if (payload.success) {
        clearDraft();
        dispatch({ type: 'done' });
        return;
      }
      dispatch({ type: 'submitting', value: false });
      if (payload.errors && Object.keys(payload.errors).length > 0) {
        dispatch({ type: 'serverErrors', errors: payload.errors });
        alertUnmatched(flow, payload.errors);
      }
      alert(payload.message || 'Submission failed. Please check the form and try again.');
    } catch {
      dispatch({ type: 'submitting', value: false });
      alert('Network error. Please try again.');
    } finally {
      sending.current = false;
    }
  }

  const stepProps = { state, dispatch, onNext, onBack };
  const slide = direction === 'right' ? 'motion-safe:animate-slide-in-right' : 'motion-safe:animate-slide-in-left';

  return (
    <>
      <div className="mx-auto max-w-[1120px] px-4 py-6 sm:px-6 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          <BrandPanel customerType={customerType} />
          <main className="rounded-brand bg-white p-5 shadow-card sm:p-9">
            {!customerType ? (
              <TypeSelector onSelect={(type) => dispatch({ type: 'selectType', customerType: type })} />
            ) : status === 'done' ? (
              <Confirmation email={submitterEmail(state)} />
            ) : (
              <>
                {state.draftRestored && (
                  <DraftBanner
                    onClear={() => {
                      dispatch({ type: 'reset' });
                      clearDraft();
                    }}
                  />
                )}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <Pill>{CUSTOMER_LABEL[customerType]}</Pill>
                  {step === 1 && (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'clearType' })}
                      className="cursor-pointer bg-transparent p-0 text-sm font-medium text-primary underline underline-offset-2"
                    >
                      Change customer type
                    </button>
                  )}
                </div>
                <ProgressBar titles={flow.steps.map((st) => st.title)} step={step} />
                <form noValidate onSubmit={onSubmit}>
                  <div key={step} className={slide}>
                    {(() => {
                      const StepComponent = STEP_COMPONENTS[customerType][step - 1];
                      return <StepComponent {...stepProps} />;
                    })()}
                  </div>
                </form>
              </>
            )}
          </main>
        </div>
        <SiteFooter />
      </div>
      {import.meta.env.DEV && status !== 'done' && (
        <button
          type="button"
          onClick={() => {
            if (!customerType) dispatch({ type: 'selectType', customerType: 'corporate' });
            prefillActions(customerType ?? 'corporate').forEach(dispatch);
          }}
          className="fixed bottom-4 right-4 z-[100] cursor-pointer rounded-md border border-dashed border-[#7A5B00] bg-[#FFF3CD] px-3.5 py-2 text-[13px] text-[#7A5B00]"
        >
          Fill test data (dev only)
        </button>
      )}
    </>
  );
}
