import { useState } from 'react';
import { useAppState } from './hooks/useAppState.js';
import { useSync } from './hooks/useSync.js';
import AccountSwitcher from './components/AccountSwitcher/AccountSwitcher.jsx';
import Tape, { computeRunningTotals } from './components/Tape/Tape.jsx';
import SummaryTape from './components/SummaryTape/SummaryTape.jsx';
import NumberInput from './components/NumberInput/NumberInput.jsx';
import styles from './App.module.css';

export default function App() {
  const { state, dispatch, rawDispatch, activeAccount, activeSummary } = useAppState();
  const sync = useSync(state, rawDispatch);
  const d = sync.syncDispatch;
  const [editingId, setEditingId] = useState(null);

  const viewingSummary = activeSummary !== null;

  // Clear editing when switching to summary view
  if (viewingSummary && editingId) {
    setEditingId(null);
  }

  const editingEntry = editingId
    ? activeAccount.tape.find((e) => e.id === editingId) ?? null
    : null;

  const { totals, subProducts } = computeRunningTotals(activeAccount.tape);
  const lastIndex = totals.length - 1;
  const subtotal = lastIndex >= 0 ? totals[lastIndex] : 0;
  const currentSubProduct = lastIndex >= 0 ? subProducts[lastIndex] : null;

  // When editing a line, memory store operates from that line's position
  const editingIndex = editingId
    ? activeAccount.tape.findIndex((e) => e.id === editingId)
    : -1;
  const storeSubtotal = editingIndex >= 0 ? totals[editingIndex] : subtotal;

  // Scan upward from position (or tape end) to find last sub-product
  const scanFrom = editingIndex >= 0 ? editingIndex : lastIndex;
  let storeSubProduct = null;
  for (let i = scanFrom; i >= 0; i--) {
    if (subProducts[i] !== null) {
      storeSubProduct = subProducts[i];
      break;
    }
  }

  const settings = state.settings || {};

  return (
    <div className={styles.app}>
      <AccountSwitcher
        accounts={state.accounts}
        activeAccountId={state.activeAccountId}
        summaries={state.summaries || []}
        activeSummaryId={state.activeSummaryId}
        dispatch={d}
      />
      {viewingSummary ? (
        <SummaryTape summary={activeSummary} accounts={state.accounts} settings={settings} dispatch={d} />
      ) : (
        <Tape
          tape={activeAccount.tape}
          dispatch={d}
          editingId={editingId}
          onSelect={setEditingId}
          settings={settings}
        />
      )}
      <NumberInput
        dispatch={d}
        editingEntry={editingEntry}
        onDoneEditing={() => setEditingId(null)}
        subtotal={subtotal}
        currentSubProduct={currentSubProduct}
        storeSubtotal={storeSubtotal}
        storeSubProduct={storeSubProduct}
        activeAccountId={state.activeAccountId}
        activeAccountName={activeAccount.name}
        activeAccountColor={activeAccount.color || null}
        appState={state}
        activeSummary={activeSummary}
        viewingSummary={viewingSummary}
        sync={sync}
      />
    </div>
  );
}
