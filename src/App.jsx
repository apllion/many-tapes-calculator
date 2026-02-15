import { useState, useEffect, useRef } from 'react';
import { useAppState } from './hooks/useAppState.js';
import { useSync } from './hooks/useSync.js';
import { addAutosave } from './lib/saves.js';
import TapeSwitcher from './components/TapeSwitcher/TapeSwitcher.jsx';
import Tape, { computeRunningTotals } from './components/Tape/Tape.jsx';
import TotalTape from './components/TotalTape/TotalTape.jsx';
import NumberInput from './components/NumberInput/NumberInput.jsx';
import styles from './App.module.css';

export default function App() {
  const { state, dispatch, rawDispatch, activeTape, activeTotal } = useAppState();
  const sync = useSync(state, rawDispatch);
  const d = sync.syncDispatch;
  const [editingId, setEditingId] = useState(null);
  const [totalConfigOpen, setTotalConfigOpen] = useState(false);
  const [configRequest, setConfigRequest] = useState(null);
  const [previewEntry, setPreviewEntry] = useState(null);
  // Autosave every 5 minutes, skip if nothing changed
  const lastAutosaveJson = useRef(null);
  useEffect(() => {
    const interval = setInterval(() => {
      const json = JSON.stringify(state);
      if (json !== lastAutosaveJson.current) {
        lastAutosaveJson.current = json;
        addAutosave(state);
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [state]);

  const viewingTotal = activeTotal !== null;

  // Clear editing when switching to total view
  if (viewingTotal && editingId) {
    setEditingId(null);
  }

  const settings = state.settings || {};

  const editingEntry = editingId
    ? activeTape.tape.find((e) => e.id === editingId) ?? null
    : null;

  const { totals, subProducts } = computeRunningTotals(activeTape.tape, settings.calculationMode);
  const lastIndex = totals.length - 1;
  const subtotal = lastIndex >= 0 ? totals[lastIndex] : 0;
  const currentSubProduct = lastIndex >= 0 ? subProducts[lastIndex] : null;

  // When editing a line, memory store operates from that line's position
  const editingIndex = editingId
    ? activeTape.tape.findIndex((e) => e.id === editingId)
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

  return (
    <div className={styles.app}>
      <TapeSwitcher
        tapes={state.tapes}
        activeTapeId={state.activeTapeId}
        totals={state.totals || []}
        activeTotalId={state.activeTotalId}
        dispatch={d}
        settings={settings}
        onAddTape={() => { d({ type: 'ADD_TAPE' }); setConfigRequest('name'); }}
        onAddTotal={() => { d({ type: 'ADD_TOTAL' }); setConfigRequest('total'); }}
      />
      {viewingTotal ? (
        <TotalTape total={activeTotal} tapes={state.tapes} settings={settings} dispatch={d} showDeselected={totalConfigOpen} />
      ) : (
        <Tape
          tape={activeTape.tape}
          dispatch={d}
          editingId={editingId}
          onSelect={setEditingId}
          settings={settings}
          previewEntry={previewEntry}
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
        activeTapeId={state.activeTapeId}
        activeTapeName={activeTape.name}
        activeTapeColor={activeTape.color || null}
        appState={state}
        activeTotal={activeTotal}
        viewingTotal={viewingTotal}
        sync={sync}
        onTotalConfigChange={setTotalConfigOpen}
        configRequest={configRequest}
        onConfigDone={() => setConfigRequest(null)}
        onPreviewChange={setPreviewEntry}
      />
    </div>
  );
}
