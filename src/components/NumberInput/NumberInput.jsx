import { useState, useEffect, useRef } from 'react';
import * as v from 'valibot';
import { AppStateSchema } from '../../schemas/tape.js';
import { formatNumber, FORMAT_LABELS, FORMAT_ORDER } from '../../lib/format.js';
import { loadSaves, getSave, addSave, deleteSave, loadAutosaves, getAutosave, addAutosave } from '../../lib/saves.js';
import { generateId } from '../../../shared/ids.js';
import styles from './NumberInput.module.css';

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const DEFAULT_PALETTE = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
  '#3498db', '#9b59b6', '#e91e63', '#795548', '#607d8b',
  '#34495e', '#95a5a6', '#ffffff', '#2d3436', '#ff6b6b',
];

const SHORTCUT_COUNT = 18;

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function NumberInput({ dispatch, editingEntry, editingMode, onDoneEditing, onSelectEntry, subtotal, currentSubProduct, activeTapeId, activeTapeName, activeTapeColor, appState, activeTotal, viewingTotal, sync, onTotalConfigChange, configRequest, onConfigDone, onPreviewChange, onKeypadModeChange }) {
  const [input, setInput] = useState('');
  const [keypadMode, setKeypadMode] = useState('normal');
  const [freshEdit, setFreshEdit] = useState(false);
  const [quickSaved, setQuickSaved] = useState(false);
  const [saves, setSaves] = useState([]);
  const [autosaves, setAutosaves] = useState([]);
  const textRef = useRef(null);
  const fileRef = useRef(null);
  const colorRef = useRef(null);
  const colorIndexRef = useRef(null);
  const saveLongRef = useRef(null);
  const shortcutLongRef = useRef(null);
  const activeShortcutRef = useRef(null); // { index, entryId } when editing a recalled shortcut
  const addedTotalRef = useRef(false);
  const isEditing = editingEntry !== null;

  // Notify parent when keypadMode changes
  useEffect(() => {
    onKeypadModeChange?.(keypadMode);
  }, [keypadMode]);

  // When an entry is selected for editing, load its value into the display
  useEffect(() => {
    if (!editingEntry) return;
    if (editingMode === 'text') {
      setInput(editingEntry.text || '');
      setFreshEdit(false);
    } else if (editingMode === 'number') {
      if (editingEntry.op === '=' || editingEntry.op === 'T') {
        setInput('');
        setFreshEdit(false);
      } else if (editingEntry.value === null) {
        setInput('');
        setFreshEdit(false);
      } else {
        setInput(String(editingEntry.value));
        setFreshEdit(true);
      }
    }
  }, [editingEntry?.id, editingMode]);

  // Auto-focus text input when entering text editing or name/config keypad
  useEffect(() => {
    if ((editingMode === 'text' || keypadMode === 'tape' || keypadMode === 'total' || keypadMode === 'saves' || keypadMode === 'room') && textRef.current) {
      textRef.current.focus();
    }
  }, [keypadMode, editingMode]);

  // Notify parent when total config keypad opens/closes
  useEffect(() => {
    if (onTotalConfigChange) {
      onTotalConfigChange(keypadMode === 'total');
    }
  }, [keypadMode, onTotalConfigChange]);

  // Sync input when switching tapes while on name keypad
  useEffect(() => {
    if (keypadMode === 'tape' && !viewingTotal) {
      setInput(activeTapeName);
    }
  }, [activeTapeId]);

  // Don't auto-open total config when selecting a total tape; reset when leaving
  useEffect(() => {
    if (activeTotal) {
      if (addedTotalRef.current) {
        addedTotalRef.current = false;
      } else {
        setInput('');
        setKeypadMode('normal');
      }
    } else {
      if (keypadMode === 'tape' || keypadMode === 'total') {
        setInput('');
        setKeypadMode('normal');
      }
    }
  }, [activeTotal?.id]);

  // Open config when a tape/total is added via TapeSwitcher
  useEffect(() => {
    if (!configRequest) return;
    if (configRequest === 'tape') {
      setInput(activeTapeName);
      setKeypadMode('tape');
    } else if (configRequest === 'total' && activeTotal) {
      setInput(activeTotal.name);
      setKeypadMode('total');
    }
    onConfigDone();
  }, [configRequest]);

  // Send live preview to tape
  useEffect(() => {
    if (!onPreviewChange) return;
    if (isEditing || viewingTotal) { onPreviewChange(null); return; }
    if (input && keypadMode === 'normal') {
      const value = parseFloat(input);
      if (!isNaN(value)) {
        onPreviewChange({ op: '+', value });
        return;
      }
    }
    onPreviewChange(null);
  }, [input, keypadMode, isEditing, viewingTotal]);

  // Clear active shortcut tracking when editing a different entry
  useEffect(() => {
    if (activeShortcutRef.current && editingEntry?.id !== activeShortcutRef.current.entryId) {
      activeShortcutRef.current = null;
    }
  }, [editingEntry?.id]);

  // Keyboard input for PC
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (keypadMode !== 'normal') return;
      const key = e.key;
      if (key >= '0' && key <= '9') { press(key); e.preventDefault(); }
      else if (key === '.') { press('.'); e.preventDefault(); }
      else if (key === '+') { submit('+'); e.preventDefault(); }
      else if (key === '-') { submit('-'); e.preventDefault(); }
      else if (key === '*') { submit('*'); e.preventDefault(); }
      else if (key === '/') { submit('/'); e.preventDefault(); }
      else if (key === '=' || key === 'Enter') { handleEq(); e.preventDefault(); }
      else if (key === 'Backspace') { backspace(); e.preventDefault(); }
      else if (key === 'Escape') { clear(); e.preventDefault(); }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  function submit(op) {
    setFreshEdit(false);
    if (isEditing) {
      if (editingEntry.op === '=' || editingEntry.op === 'T' || editingEntry.op === 'text') {
        setInput('');
        onDoneEditing();
        return;
      }
      const value = parseFloat(input);
      const updates = {};
      if (!isNaN(value) && (value !== 0 || editingEntry.value === null)) {
        updates.value = value;
      }
      if (op !== '=') {
        updates.op = op;
      }
      if (Object.keys(updates).length > 0) {
        dispatch({ type: 'UPDATE_ENTRY', entryId: editingEntry.id, updates });
      }
      // Update the source shortcut if this entry was recalled from one
      if (activeShortcutRef.current) {
        const finalValue = updates.value ?? editingEntry.value;
        const finalOp = updates.op ?? editingEntry.op;
        const triple = {};
        if (editingEntry.text) triple.text = editingEntry.text;
        if (finalValue != null) triple.value = finalValue;
        if (finalOp) triple.op = finalOp;
        dispatch({ type: 'SET_SHORTCUT_STORE', index: activeShortcutRef.current.index, data: triple });
        activeShortcutRef.current = null;
      }
      setInput('');
      onDoneEditing();
      return;
    }

    if (op === '=') {
      const value = parseFloat(input);
      if (!isNaN(value) && input.trim() !== '') {
        dispatch({ type: 'ADD_ENTRY_AND_TOTAL', value });
        setInput('');
      } else {
        const tape = appState.tapes.find((a) => a.id === activeTapeId)?.tape || [];
        const lastEntry = tape[tape.length - 1];
        if (lastEntry && lastEntry.op === '=') {
          // s= followed by = → upgrade to T=
          dispatch({ type: 'UPDATE_ENTRY', entryId: lastEntry.id, updates: { op: 'T' } });
        } else if (lastEntry && lastEntry.op !== 'T') {
          // empty input + = → add s= (subtotal)
          dispatch({ type: 'ADD_ENTRY', op: '=', value: 0 });
        }
      }
      return;
    }
    const value = parseFloat(input);
    if (isNaN(value) || !input.trim()) {
      const tape = appState.tapes.find((a) => a.id === activeTapeId)?.tape || [];
      for (let i = tape.length - 1; i >= 0; i--) {
        const entry = tape[i];
        if (entry.op !== '=' && entry.op !== 'T' && entry.op !== 'text') {
          if (entry.op !== op) {
            dispatch({ type: 'UPDATE_ENTRY', entryId: entry.id, updates: { op } });
          }
          break;
        }
      }
      return;
    }
    dispatch({ type: 'ADD_ENTRY', op, value });
    setInput('');
  }

  function confirmText() {
    if (!isEditing) return;
    const updates = input ? { text: input } : { text: undefined };
    dispatch({ type: 'UPDATE_ENTRY', entryId: editingEntry.id, updates });
    setInput('');
    onDoneEditing();
  }

  // Long-press handler for C button
  const clearRef = useRef(null);
  function onClearDown() {
    clearRef.current = setTimeout(() => {
      clearRef.current = 'fired';
      clear();
      setKeypadMode('normal');
    }, 600);
  }
  function onClearUp() {
    if (clearRef.current === 'fired') {
      clearRef.current = null;
      return;
    }
    clearTimeout(clearRef.current);
    clearRef.current = null;
  }
  function onClearCancel() {
    clearTimeout(clearRef.current);
    clearRef.current = null;
  }

  function press(digit) {
    if (freshEdit) {
      setInput(digit);
      setFreshEdit(false);
      return;
    }
    setInput((prev) => prev + digit);
  }

  function backspace() {
    setFreshEdit(false);
    setInput((prev) => prev.slice(0, -1));
  }

  function clear() {
    setFreshEdit(false);
    if (isEditing) {
      setInput('');
      onDoneEditing();
      return;
    }
    if (input) {
      setInput('');
    } else {
      dispatch({ type: 'CLEAR_TAPE' });
    }
  }

  function handleNew() {
    const newId = generateId();
    if (isEditing) {
      dispatch({ type: 'INSERT_ENTRY', afterId: editingEntry.id, entryId: newId, op: '+', value: null });
    } else {
      dispatch({ type: 'ADD_ENTRY', entryId: newId, op: '+', value: null });
    }
    setInput('');
    onSelectEntry(newId, 'number');
  }

  function handleEq() {
    if (viewingTotal) {
      const value = parseFloat(input);
      if (!isNaN(value) && input.trim() !== '') {
        dispatch({ type: 'SET_TOTAL_STARTING_VALUE', totalId: activeTotal.id, value });
        setInput('');
      } else {
        const startVal = activeTotal.startingValue || 0;
        setInput(startVal !== 0 ? String(startVal) : '');
      }
      return;
    }
    submit('=');
  }

  function toggleSign() {
    setFreshEdit(false);
    setInput((prev) => {
      if (!prev || prev === '0') return prev;
      return prev.startsWith('-') ? prev.slice(1) : '-' + prev;
    });
  }



  const fmt = appState.settings?.numberFormat;
  function formatValue(n) {
    return formatNumber(n, fmt);
  }

  function quickSave() {
    const all = loadSaves();
    const existing = all.find((s) => s.name === 'Quicksave');
    if (existing) deleteSave(existing.id);
    addSave('Quicksave', appState);
    setQuickSaved(true);
    setTimeout(() => setQuickSaved(false), 1200);
  }

  function exportAll() {
    downloadJSON(appState, 'calculator-data.json');
  }

  function importData() {
    fileRef.current?.click();
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const validated = v.parse(AppStateSchema, data);
        addAutosave(appState);
        dispatch({ type: 'LOAD_STATE', state: validated });
      } catch {
        // invalid file — ignore silently
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function saveTapeName() {
    if (viewingTotal && activeTotal) {
      if (input && input !== activeTotal.name) {
        dispatch({ type: 'RENAME_TOTAL', totalId: activeTotal.id, name: input });
      }
    } else {
      if (input && input !== activeTapeName) {
        dispatch({ type: 'RENAME_TAPE', tapeId: activeTapeId, name: input });
      }
    }
    setInput('');
  }

  const palette = appState.settings?.palette || DEFAULT_PALETTE;

  // Long-press color button to edit its color
  const colorLongRef = useRef(null);
  function onColorDown(index) {
    colorLongRef.current = setTimeout(() => {
      colorLongRef.current = 'fired';
      colorIndexRef.current = index;
      if (colorRef.current) {
        colorRef.current.value = palette[index];
        colorRef.current.click();
      }
    }, 600);
  }
  function onColorUp(index) {
    if (colorLongRef.current === 'fired') {
      colorLongRef.current = null;
      return;
    }
    clearTimeout(colorLongRef.current);
    colorLongRef.current = null;
    if (viewingTotal && activeTotal) {
      dispatch({ type: 'SET_TOTAL_COLOR', totalId: activeTotal.id, color: palette[index] });
    } else {
      dispatch({ type: 'SET_TAPE_COLOR', tapeId: activeTapeId, color: palette[index] });
    }
  }
  function onColorCancel() {
    clearTimeout(colorLongRef.current);
    colorLongRef.current = null;
  }
  function onColorChange(e) {
    const idx = colorIndexRef.current;
    if (idx === null) return;
    const newColor = e.target.value;
    const newPalette = [...palette];
    newPalette[idx] = newColor;
    dispatch({ type: 'SET_SETTING', key: 'palette', value: newPalette });
    if (viewingTotal && activeTotal) {
      dispatch({ type: 'SET_TOTAL_COLOR', totalId: activeTotal.id, color: newColor });
    } else {
      dispatch({ type: 'SET_TAPE_COLOR', tapeId: activeTapeId, color: newColor });
    }
  }

  // Reset all long-press refs when page resumes from suspension (iOS Safari)
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        for (const ref of [clearRef, saveLongRef, colorLongRef, shortcutLongRef]) {
          if (ref.current !== null) {
            if (ref.current !== 'fired') clearTimeout(ref.current);
            ref.current = null;
          }
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const empty = <button className={styles.emptyBtn} disabled />;

  const rawShortcuts = appState.settings?.shortcutStores || [];
  const shortcutStores = Array.from({ length: SHORTCUT_COUNT }, (_, i) => rawShortcuts[i] || null);

  function shortcutPreview(slot) {
    if (!slot) return '';
    const parts = [];
    if (slot.text) parts.push(slot.text);
    if (slot.value != null) parts.push(String(slot.value));
    if (slot.op && slot.op !== '+') parts.push(slot.op);
    return parts.join(' ').slice(0, 8);
  }

  function shortcutSave(index) {
    const val = parseFloat(input);
    const hasNumber = !isNaN(val) && input.trim() !== '';
    const hasText = editingEntry?.text;
    if (!hasNumber && !hasText) return;
    const triple = {};
    if (hasNumber) triple.value = val;
    if (editingEntry) {
      if (editingEntry.op && editingEntry.op !== '=' && editingEntry.op !== 'T' && editingEntry.op !== 'text') {
        triple.op = editingEntry.op;
      }
      if (editingEntry.text) triple.text = editingEntry.text;
    }
    dispatch({ type: 'SET_SHORTCUT_STORE', index, data: triple });
  }

  function shortcutRecall(index) {
    const stored = shortcutStores[index];
    if (!stored) return;
    const newId = generateId();
    const entry = {
      entryId: newId,
      op: stored.op || '+',
      value: stored.value ?? null,
      ...(stored.text ? { text: stored.text } : {}),
    };
    if (isEditing) {
      dispatch({ type: 'INSERT_ENTRY', afterId: editingEntry.id, ...entry });
    } else {
      dispatch({ type: 'ADD_ENTRY', ...entry });
    }
    setInput(stored.value != null ? String(stored.value) : '');
    onSelectEntry(newId, 'number');
    activeShortcutRef.current = { index, entryId: newId };
  }

  function onShortcutDown(index) {
    if (!shortcutStores[index]) return;
    shortcutLongRef.current = setTimeout(() => {
      shortcutLongRef.current = 'fired';
      dispatch({ type: 'CLEAR_SHORTCUT_STORE', index });
    }, 600);
  }
  function onShortcutUp(index) {
    if (shortcutLongRef.current === 'fired') {
      shortcutLongRef.current = null;
      return;
    }
    clearTimeout(shortcutLongRef.current);
    shortcutLongRef.current = null;
    if (shortcutStores[index]) {
      shortcutRecall(index);
    } else {
      shortcutSave(index);
    }
  }
  function onShortcutCancel() {
    clearTimeout(shortcutLongRef.current);
    shortcutLongRef.current = null;
  }

  function renderKeypad() {
    if (keypadMode === 'total' && activeTotal) {
      const totalColor = activeTotal.color;
      return (
        <div className={styles.grid}>
          <button className={styles.navBtn} onClick={() => { saveTapeName(); setKeypadMode('normal'); }}>BACK</button>
          <button className={styles.fnBtn} onClick={() => dispatch({ type: 'MOVE_TOTAL_LEFT', totalId: activeTotal.id })}>&larr;</button>
          <button className={styles.fnBtn} onClick={() => dispatch({ type: 'MOVE_TOTAL_RIGHT', totalId: activeTotal.id })}>&rarr;</button>
          <button className={styles.fnBtn} style={{ fontSize: '0.8rem' }} onClick={() => {
            const value = parseFloat(input);
            if (!isNaN(value) && input.trim() !== '') {
              dispatch({ type: 'SET_TOTAL_STARTING_VALUE', totalId: activeTotal.id, value });
              setInput('');
            } else {
              const startVal = activeTotal.startingValue || 0;
              setInput(startVal !== 0 ? String(startVal) : '');
            }
          }}>Start</button>
          {palette.map((hex, i) => (
            <button
              key={i}
              className={`${styles.colorBtn} ${styles.longPress} ${totalColor === hex ? styles.colorActive : ''}`}
              style={{ background: hex }}
              onPointerDown={() => onColorDown(i)}
              onPointerUp={() => onColorUp(i)}
              onPointerCancel={onColorCancel}
              onContextMenu={(e) => e.preventDefault()}
            />
          ))}
        </div>
      );
    }

    if (keypadMode === 'tape') {
      return (
        <div className={styles.grid}>
          <button className={styles.navBtn} onClick={() => { saveTapeName(); setKeypadMode('normal'); }}>BACK</button>
          <button className={styles.fnBtn} onClick={() => dispatch({ type: 'MOVE_TAPE_LEFT', tapeId: activeTapeId })}>&larr;</button>
          <button className={styles.fnBtn} onClick={() => dispatch({ type: 'MOVE_TAPE_RIGHT', tapeId: activeTapeId })}>&rarr;</button>
          <button className={styles.fnBtn} style={{ fontSize: '0.55rem' }} onClick={() => dispatch({ type: 'SET_SETTING', key: 'palette', value: DEFAULT_PALETTE })}>Reset Colors</button>
          {palette.map((hex, i) => (
            <button
              key={i}
              className={`${styles.colorBtn} ${styles.longPress} ${activeTapeColor === hex ? styles.colorActive : ''}`}
              style={{ background: hex }}
              onPointerDown={() => onColorDown(i)}
              onPointerUp={() => onColorUp(i)}
              onPointerCancel={onColorCancel}
              onContextMenu={(e) => e.preventDefault()}
            />
          ))}
        </div>
      );
    }

    if (keypadMode === 'room') {
      const connected = sync.status === 'connected';
      const connecting = sync.status === 'connecting';
      const inRoom = sync.roomId !== null;
      return (
        <div className={styles.grid}>
          <button className={styles.navBtn} onClick={() => { setInput(''); setKeypadMode('normal'); }}>BACK</button>
          {!inRoom ? (
            <>
              <button className={styles.wideBtn} style={{ gridColumn: 'span 3' }} onClick={() => {
                const code = sync.createRoom();
                setInput(code);
              }}>Create Room</button>
              <button className={styles.wideBtn} style={{ gridColumn: 'span 4' }} onClick={() => {
                const code = input.trim();
                if (code.length >= 4) {
                  sync.joinRoom(code);
                  setInput('');
                }
              }}>Join Room</button>
            </>
          ) : (
            <>
              <button className={styles.wideBtn} style={{ gridColumn: 'span 3' }} onClick={() => {
                sync.leaveRoom();
                setInput('');
              }}>Leave Room</button>
              <div className={styles.roomInfo}>
                <span className={styles.roomCode}>{sync.roomId}</span>
                <span className={styles.roomStatus}>
                  <span className={`${styles.roomDot} ${connected ? styles.roomDotOn : connecting ? styles.roomDotWait : ''}`} />
                  {connected ? `${sync.peerCount} peer${sync.peerCount !== 1 ? 's' : ''}` : connecting ? 'waiting\u2026' : 'offline'}
                </span>
              </div>
            </>
          )}
        </div>
      );
    }

    if (keypadMode === 'saves') {
      function doSave() {
        const name = input.trim() || `Save ${saves.length + 1}`;
        addSave(name, appState);
        setInput('');
        setSaves(loadSaves());
      }
      return (
        <div className={styles.savesContainer}>
          <div className={styles.savesHeader}>
            <button className={styles.navBtn} onClick={() => { setInput(''); setKeypadMode('normal'); }}>BACK</button>
            <button className={styles.wideBtn} onClick={doSave}>SAVE</button>
          </div>
          <div className={styles.savesList}>
            {saves.map((s) => (
              <div key={s.id} className={styles.saveItem} onClick={() => {
                deleteSave(s.id);
                addSave(s.name, appState);
                setSaves(loadSaves());
              }}>
                <span className={styles.saveName}>{s.name}</span>
                <span className={styles.saveDate}>{relativeTime(s.timestamp)}</span>
              </div>
            ))}
            {saves.length === 0 && (
              <div className={styles.saveItem} style={{ justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                No saves yet
              </div>
            )}
          </div>
        </div>
      );
    }

    if (keypadMode === 'loads') {
      function loadSaveItem(id, isAutosave) {
        const save = isAutosave ? getAutosave(id) : getSave(id);
        if (save) {
          addAutosave(appState);
          dispatch({ type: 'LOAD_STATE', state: save.state });
          setKeypadMode('normal');
        }
      }
      return (
        <div className={styles.savesContainer}>
          <div className={styles.savesHeader}>
            <button className={styles.navBtn} onClick={() => { setInput(''); setKeypadMode('normal'); }}>BACK</button>
          </div>
          <div className={styles.savesList}>
            {saves.map((s) => (
              <div
                key={s.id}
                className={styles.saveItem}
                onClick={() => loadSaveItem(s.id, false)}
              >
                <span className={styles.saveName}>{s.name}</span>
                <span className={styles.saveDate}>{relativeTime(s.timestamp)}</span>
                <span
                  className={styles.saveDelete}
                  onClick={(e) => { e.stopPropagation(); deleteSave(s.id); setSaves(loadSaves()); }}
                >&times;</span>
              </div>
            ))}
            {saves.length === 0 && autosaves.length === 0 && (
              <div className={styles.saveItem} style={{ justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                No saves yet
              </div>
            )}
            {autosaves.length > 0 && (
              <>
                <div className={styles.saveItem} style={{ justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.7rem', minHeight: 0, padding: '4px 0 0' }}>
                  Autosaves
                </div>
                {autosaves.map((s) => (
                  <div
                    key={s.id}
                    className={styles.saveItem}
                    onClick={() => loadSaveItem(s.id, true)}
                  >
                    <span className={styles.saveName}>{s.name}</span>
                    <span className={styles.saveDate}>{relativeTime(s.timestamp)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      );
    }

    if (keypadMode === 'setup') {
      const currentFmt = appState.settings?.numberFormat || '2dec';
      const colorNeg = appState.settings?.colorNegatives || false;
      const calcMode = appState.settings?.calculationMode || 'arithmetic';
      return (
        <div className={styles.grid}>
          <button className={styles.navBtn} onClick={() => { setInput(''); setKeypadMode('normal'); }}>BACK</button>
          {empty}{empty}{empty}

          {FORMAT_ORDER.map((key) => (
            <button
              key={key}
              className={`${styles.wideBtn} ${currentFmt === key ? styles.toggleOn : ''}`}
              onClick={() => dispatch({ type: 'SET_SETTING', key: 'numberFormat', value: key })}
            >
              {FORMAT_LABELS[key]}
            </button>
          ))}

          <button
            className={`${styles.wideBtn} ${colorNeg ? styles.toggleOn : ''}`}
            style={{ gridColumn: 'span 2' }}
            onClick={() => dispatch({ type: 'SET_SETTING', key: 'colorNegatives', value: !colorNeg })}
          >
            {colorNeg ? 'Color (\u2212): ON' : 'Color (\u2212): OFF'}
          </button>
          <button
            className={`${styles.wideBtn} ${calcMode === 'adding' ? styles.toggleOn : ''}`}
            style={{ gridColumn: 'span 2' }}
            onClick={() => dispatch({ type: 'SET_SETTING', key: 'calculationMode', value: calcMode === 'adding' ? 'arithmetic' : 'adding' })}
          >
            {calcMode === 'adding' ? 'Adding Machine' : 'Arithmetic'}
          </button>
          <button className={styles.wideBtn} style={{ gridColumn: 'span 2' }} onClick={exportAll}>Export</button>
          <button className={styles.wideBtn} style={{ gridColumn: 'span 2' }} onClick={importData}>Import</button>
        </div>
      );
    }

    if (keypadMode === 'menu') {
      return (
        <div className={styles.grid}>
          <button className={styles.navBtn} onClick={() => { setInput(''); setKeypadMode('normal'); }}>BACK</button>
          {empty}{empty}{empty}
          <button className={styles.wideBtn} onClick={() => {
            if (viewingTotal && activeTotal) {
              setInput(activeTotal.name);
              setKeypadMode('total');
            } else {
              setInput(activeTapeName);
              setKeypadMode('tape');
            }
          }}>{viewingTotal ? 'TOTAL' : 'TAPE'}</button>
          {empty}{empty}{empty}
          <button className={styles.wideBtn} onClick={() => setKeypadMode('setup')}>SETUP</button>
          <button className={styles.wideBtn} onClick={() => { setSaves(loadSaves()); setAutosaves(loadAutosaves()); setInput(''); setKeypadMode('saves'); }}>SAVE</button>
          <button className={styles.wideBtn} onClick={() => { setSaves(loadSaves()); setAutosaves(loadAutosaves()); setInput(''); setKeypadMode('loads'); }}>LOAD</button>
          <button className={styles.wideBtn} onClick={() => { setInput(''); setKeypadMode('room'); }}>ROOM</button>
        </div>
      );
    }

    // Normal keypad
    const opDisabled = viewingTotal;
    return (
      <div className={styles.keypadRow}>
        <div className={styles.sideColumn}>
          <button className={styles.modeBtn} onClick={() => setKeypadMode('menu')}>MODE</button>
          <button
            className={`${styles.quickSaveBtn} ${quickSaved ? styles.quickSaved : ''}`}
            onClick={quickSave}
          >{quickSaved ? '\u2713' : '\u2193'}</button>
          <button className={styles.newBtn} onClick={handleNew}>NL</button>
          <button
            className={`${styles.clearBtn} ${styles.longPress}`}
            onPointerDown={onClearDown}
            onPointerUp={onClearUp}
            onPointerCancel={onClearCancel}
            onContextMenu={(e) => e.preventDefault()}
          >C</button>
          {empty}
        </div>
        <div className={styles.grid}>
          <button className={styles.fnBtn} onClick={toggleSign}>&plusmn;</button>
          <button className={styles.fnBtn} onClick={backspace}>&larr;</button>
          <button className={styles.opBtn} onClick={opDisabled ? undefined : () => submit('/')} disabled={opDisabled}>&divide;</button>
          <button className={styles.opBtn} onClick={opDisabled ? undefined : () => submit('*')} disabled={opDisabled}>&times;</button>

          <button className={styles.numBtn} onClick={() => press('7')}>7</button>
          <button className={styles.numBtn} onClick={() => press('8')}>8</button>
          <button className={styles.numBtn} onClick={() => press('9')}>9</button>
          <button className={styles.opBtn} onClick={opDisabled ? undefined : () => submit('-')} disabled={opDisabled}>&minus;</button>

          <button className={styles.numBtn} onClick={() => press('4')}>4</button>
          <button className={styles.numBtn} onClick={() => press('5')}>5</button>
          <button className={styles.numBtn} onClick={() => press('6')}>6</button>
          <button className={styles.opBtn} onClick={opDisabled ? undefined : () => submit('+')} disabled={opDisabled}>+</button>

          <button className={styles.numBtn} onClick={() => press('1')}>1</button>
          <button className={styles.numBtn} onClick={() => press('2')}>2</button>
          <button className={styles.numBtn} onClick={() => press('3')}>3</button>
          <button className={styles.eqBtn} onClick={handleEq}>=</button>

          <button className={styles.numBtn} style={{ gridColumn: 'span 3' }} onClick={() => press('0')}>0</button>
          <button className={styles.numBtn} onClick={() => press('.')}>.</button>
        </div>
      </div>
    );
  }

  const isTextInput = editingMode === 'text' || keypadMode === 'tape' || keypadMode === 'total' || keypadMode === 'saves' || keypadMode === 'room';

  function getDisplayLabel() {
    if (isEditing && editingMode === 'text') return 'EDIT TEXT';
    if (isEditing) return 'EDIT';
    if (keypadMode === 'total') return '\u03A3 NAME';
    if (keypadMode === 'tape') return 'TAPE';
    if (keypadMode === 'setup') return 'SETUP';
    if (keypadMode === 'saves') return 'SAVE';
    if (keypadMode === 'loads') return 'LOAD';
    if (keypadMode === 'room') return 'ROOM';
    if (keypadMode === 'menu') return 'MENU';
    if (viewingTotal) return '\u03A3';
    return formatValue(currentSubProduct !== null ? currentSubProduct : subtotal);
  }

  const displayContent = (
    <>
      <input type="file" accept=".json" ref={fileRef} onChange={handleImportFile} style={{ display: 'none' }} />
      <input type="color" ref={colorRef} onChange={onColorChange} style={{ display: 'none' }} />
      <div className={styles.display}>
        <span
          className={`${styles.subtotal} ${isEditing ? styles.subtotalClickable : ''}`}
          onClick={isEditing ? () => {
            const oppositeMode = editingMode === 'text' ? 'number' : 'text';
            onSelectEntry(editingEntry.id, oppositeMode);
          } : undefined}
        >
          {getDisplayLabel()}
        </span>
        {isTextInput ? (
          <input
            ref={textRef}
            type="text"
            className={styles.textInput}
            value={input}
            onChange={(e) => setInput(keypadMode === 'room' ? e.target.value.toUpperCase() : e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (editingMode === 'text') { confirmText(); }
                else if (keypadMode === 'room') {
                  const code = input.trim();
                  if (code.length >= 4) { sync.joinRoom(code); setInput(''); }
                } else if (keypadMode === 'saves') {
                  const name = input.trim() || `Save ${saves.length + 1}`;
                  addSave(name, appState);
                  setInput('');
                  setSaves(loadSaves());
                } else { saveTapeName(); }
              }
            }}
            style={keypadMode === 'room' ? { textTransform: 'uppercase' } : undefined}
            placeholder={editingMode === 'text' ? 'Type text\u2026' : keypadMode === 'room' ? 'Room code\u2026' : keypadMode === 'saves' ? 'Save name\u2026' : viewingTotal ? 'Total name\u2026' : 'Tape name\u2026'}
          />
        ) : (
          <span>{input || '0'}</span>
        )}
      </div>
    </>
  );

  const shortcutSidebar = (
    <div className={styles.shortcutSidebar}>
      {shortcutStores.map((slot, i) => (
        <button
          key={i}
          className={`${slot ? `${styles.shortcutBtn} ${styles.longPress}` : styles.shortcutEmpty}`}
          onPointerDown={() => onShortcutDown(i)}
          onPointerUp={() => onShortcutUp(i)}
          onPointerCancel={onShortcutCancel}
          onContextMenu={(e) => e.preventDefault()}
        >
          {shortcutPreview(slot)}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {shortcutSidebar}
      <div className={`${styles.container} ${isEditing ? styles.editing : ''}`}>
        {displayContent}
        {renderKeypad()}
      </div>
    </>
  );
}
