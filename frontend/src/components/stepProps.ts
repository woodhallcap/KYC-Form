import type { Dispatch } from 'react';
import type { Action, AppState } from '../lib/reducer';

export interface StepProps {
  state: AppState;
  dispatch: Dispatch<Action>;
  onNext: () => void;
  onBack: () => void;
}
