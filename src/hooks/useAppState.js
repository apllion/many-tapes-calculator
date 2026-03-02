import { useReducer, useEffect } from 'react';
import { loadState, saveState } from '../lib/storage.js';
import { reducer, enrichAction } from '../../shared/reducer.js';

export { enrichAction };

export function useAppState() {
  const [state, rawDispatch] = useReducer(reducer, null, loadState);

  // Enriching dispatch: auto-populates tapeId and pre-generates IDs
  function dispatch(action) {
    rawDispatch(enrichAction(action, state));
  }

  useEffect(() => {
    saveState(state);
  }, [state]);

  const activeTape = state.tapes.find(
    (a) => a.id === state.activeTapeId
  );

  return { state, dispatch, rawDispatch, activeTape };
}
