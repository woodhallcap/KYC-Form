import { describe, it, expect } from 'vitest';
import { prefillActions } from './prefill';
import { activeForm, flowOf, initialAppState, reducer, stepErrors } from '../lib/reducer';
import type { Action } from '../lib/reducer';
import type { CustomerType } from '../types';

function filled(type: CustomerType) {
  const actions: Action[] = [{ type: 'selectType', customerType: type }, ...prefillActions(type)];
  return actions.reduce(reducer, initialAppState());
}

describe('dev "Fill test data" button', () => {
  (['corporate', 'individual'] as const).forEach((type) => {
    it(`fills the ${type} form so that every step passes validation and the visitor can reach the end`, () => {
      let state = filled(type);
      const flow = flowOf(state);
      for (let step = 1; step < flow.steps.length; step++) {
        state = reducer(state, { type: 'next' });
        expect(state.step, `${type} step ${step}`).toBe(step + 1);
      }
      expect(stepErrors(activeForm(state)!, flow, flow.steps.length)).toEqual({});
    });
  });

  it('attaches a file to every individual document, because the form now requires them', () => {
    const files = prefillActions('individual').filter((a) => a.type === 'setDocFile' && a.file instanceof File);
    expect(files).toHaveLength(5);
  });
});
