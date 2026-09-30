import { CHIRON_STEP_ACTIONS_BOOK1 } from './chiron-step-actions-book1.js';
import { CHIRON_STEP_ACTIONS_BOOK2 } from './chiron-step-actions-book2.js';

export const CHIRON_STEP_ACTIONS = {
  setNumber: '42083',
  actions: [...CHIRON_STEP_ACTIONS_BOOK1.actions, ...CHIRON_STEP_ACTIONS_BOOK2.actions],
};
