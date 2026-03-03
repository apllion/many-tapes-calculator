import { useState, useEffect, useRef } from 'react';
import { useAppState } from './hooks/useAppState.js';
import { useSync } from './hooks/useSync.js';
import { addAutosave } from './lib/saves.js';
import TapeSwitcher from './components/TapeSwitcher/TapeSwitcher.jsx';
import Tape from './components/Tape/Tape.jsx';
import { computeRunningTotals } from '../shared/calculate.js';
import TotalTape from './components/TotalTape/TotalTape.jsx';
import NumberInput from './components/NumberInput/NumberInput.jsx';
import styles from './App.module.css';

export default function App() {
  const { state, dispatch, rawDispatch, activeTape } = useAppState();
  const sync = useSync(state, rawDispatch);
  const d = sync.syncDispatch;
  const [editingId, setEditingId] = useState(null);
  const [editingMode, setEditingMode] = useState(null); // null | 'text' | 'number'
  const [totalConfigOpen, setTotalConfigOpen] = useState(false);
  const [configRequest, setConfigRequest] = useState(null);
  const [previewEntry, setPreviewEntry] = useState(null);
  const [editingInput, setEditingInput] = useState(null);
  const [keypadMode, setKeypadMode] = useState('normal');
  const [clearMode, setClearMode] = useState(false);
  const clearModeTimer = useRef(null);

  const viewingTotal = !!activeTape.totalConfig;
  // Autosave every 5 minutes, skip if nothing changed
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastAutosaveJson = useRef(null);
  useEffect(() => {
    const interval = setInterval(() => {
      const json = JSON.stringify(stateRef.current);
      if (json !== lastAutosaveJson.current) {
        lastAutosaveJson.current = json;
        addAutosave(stateRef.current);
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Clear editing when switching to total view
  if (viewingTotal && editingId) {
    setEditingId(null);
    setEditingMode(null);
  }

  function handleSelect(id, mode) {
    if (id === editingId && mode === editingMode) {
      setEditingId(null);
      setEditingMode(null);
    } else {
      setEditingId(id);
      setEditingMode(mode);
    }
  }

  const settings = state.settings || {};

  const editingEntry = editingId
    ? activeTape.tape.find((e) => e.id === editingId) ?? null
    : null;

  const { totals, subProducts } = computeRunningTotals(activeTape.tape, settings.calculationMode);
  const lastIndex = totals.length - 1;
  const subtotal = lastIndex >= 0 ? totals[lastIndex] : 0;
  const currentSubProduct = lastIndex >= 0 ? subProducts[lastIndex] : null;

  return (
    <div className={styles.app}>
      <TapeSwitcher
        tapes={state.tapes}
        activeTapeId={state.activeTapeId}
        dispatch={d}
        settings={settings}
        onAddTape={() => { d({ type: 'ADD_TAPE' }); setConfigRequest('tape'); }}
        onAddTotal={() => { d({ type: 'ADD_TAPE', totalConfig: { startingValue: 0, members: [] } }); setConfigRequest('total'); }}
        clearMode={clearMode}
        onClearTape={(tapeId) => {
          d({ type: 'DELETE_TAPE', tapeId });
          setClearMode(false);
          clearTimeout(clearModeTimer.current);
        }}
      />
      {viewingTotal ? (
        <TotalTape tape={activeTape} tapes={state.tapes} settings={settings} dispatch={d} showDeselected={totalConfigOpen} />
      ) : (
        <Tape
          tape={activeTape.tape}
          editingId={editingId}
          editingMode={editingMode}
          onSelect={handleSelect}
          settings={settings}
          previewEntry={previewEntry}
          editingInput={editingInput}
          clearMode={clearMode}
          onClearEntry={(entryId) => {
            d({ type: 'DELETE_ENTRY', entryId });
            setClearMode(false);
            clearTimeout(clearModeTimer.current);
          }}
        />
      )}
      <NumberInput
        dispatch={d}
        editingEntry={editingEntry}
        editingMode={editingMode}
        onDoneEditing={() => { setEditingId(null); setEditingMode(null); }}
        onSelectEntry={handleSelect}
        subtotal={subtotal}
        currentSubProduct={currentSubProduct}
        activeTapeId={state.activeTapeId}
        activeTapeName={activeTape.name}
        activeTapeColor={activeTape.color || null}
        appState={state}
        activeTape={activeTape}
        viewingTotal={viewingTotal}
        sync={sync}
        onTotalConfigChange={setTotalConfigOpen}
        configRequest={configRequest}
        onConfigDone={() => setConfigRequest(null)}
        onPreviewChange={setPreviewEntry}
        onEditingInputChange={setEditingInput}
        onKeypadModeChange={setKeypadMode}
        clearMode={clearMode}
        setClearMode={setClearMode}
        clearModeTimer={clearModeTimer}
      />
    </div>
  );
}
