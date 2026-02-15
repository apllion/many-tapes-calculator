import { useState, useEffect, useRef } from 'react';
import * as v from 'valibot';
import { AppStateSchema } from '../../schemas/tape.js';
import { formatNumber, FORMAT_LABELS, FORMAT_ORDER } from '../../lib/format.js';
import { loadSaves, getSave, addSave, deleteSave, loadAutosaves, getAutosave, addAutosave } from '../../lib/saves.js';
import styles from './NumberInput.module.css';

const TEXT_STORE_COUNT = 18;

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

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function NumberInput({ dispatch, editingEntry, onDoneEditing, subtotal, currentSubProduct, storeSubtotal, storeSubProduct, activeTapeId, activeTapeName, activeTapeColor, appState, activeTotal, viewingTotal, sync, onTotalConfigChange, configRequest, onConfigDone, onPreviewChange }) {
  const [input, setInput] = useState('');
  const [keypadMode, setKeypadMode] = useState('normal');
  const [memoryValue, setMemoryValue] = useState(null);
  const [textStores, setTextStores] = useState(Array(TEXT_STORE_COUNT).fill(null));
  const [saves, setSaves] = useState([]);
  const [autosaves, setAutosaves] = useState([]);
  const textRef = useRef(null);
  const fileRef = useRef(null);
  const colorRef = useRef(null);
  const colorIndexRef = useRef(null);
  const saveLongRef = useRef(null);
  const addedTotalRef = useRef(false);
  const isEditing = editingEntry !== null;

  // When an entry is selected for editing, load its value into the display
  useEffect(() => {
    if (editingEntry && editingEntry.op === 'text') {
      setInput(editingEntry.text || '');
      setKeypadMode('text');
    } else if (editingEntry && editingEntry.op !== '=') {
      setInput(String(editingEntry.value));
    } else if (editingEntry && editingEntry.op === '=') {
      setInput('');
    }
  }, [editingEntry?.id]);

  // Auto-focus text input when entering text/name/total keypad
  useEffect(() => {
    if ((keypadMode === 'text' || keypadMode === 'name' || keypadMode === 'total' || keypadMode === 'saves' || keypadMode === 'room') && textRef.current) {
      textRef.current.focus();
    }
  }, [keypadMode]);

  // Notify parent when total config keypad opens/closes
  useEffect(() => {
    if (onTotalConfigChange) {
      onTotalConfigChange(keypadMode === 'total');
    }
  }, [keypadMode, onTotalConfigChange]);

  // Sync input when switching tapes while on name keypad
  useEffect(() => {
    if (keypadMode === 'name' && !viewingTotal) {
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
      if (keypadMode === 'name' || keypadMode === 'total') {
        setInput('');
        setKeypadMode('normal');
      }
    }
  }, [activeTotal?.id]);

  // Open config when a tape/total is added via TapeSwitcher
  useEffect(() => {
    if (!configRequest) return;
    if (configRequest === 'name') {
      setInput(activeTapeName);
      setKeypadMode('name');
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
      if (!isNaN(value)) { onPreviewChange({ op: '+', value }); return; }
    }
    if (input && keypadMode === 'text') {
      onPreviewChange({ op: 'text', text: input }); return;
    }
    onPreviewChange(null);
  }, [input, keypadMode, isEditing, viewingTotal]);

  function submit(op) {
    if (isEditing) {
      // Don't allow changing = or text entries via operator buttons
      if (editingEntry.op === '=' || editingEntry.op === 'T' || editingEntry.op === 'text') {
        setInput('');
        onDoneEditing();
        return;
      }
      const value = parseFloat(input);
      const updates = {};
      if (!isNaN(value) && value !== 0) {
        updates.value = value;
      }
      if (op !== '=') {
        updates.op = op;
      }
      if (Object.keys(updates).length > 0) {
        dispatch({ type: 'UPDATE_ENTRY', entryId: editingEntry.id, updates });
      }
      setInput('');
      onDoneEditing();
      return;
    }

    if (op === '=') {
      const value = parseFloat(input);
      if (!isNaN(value) && input.trim() !== '') {
        dispatch({ type: 'ADD_ENTRY_AND_TOTAL', value: value });
        setInput('');
      } else {
        // Empty input: load subtotal into input
        setInput(String(Math.round(subtotal * 100) / 100));
      }
      return;
    }
    const value = parseFloat(input);
    // Empty input: change last entry's op
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
    dispatch({ type: 'ADD_ENTRY', op, value: value });
    setInput('');
  }

  function submitText() {
    if (!input) return;
    if (isEditing && editingEntry.op === 'text') {
      dispatch({ type: 'UPDATE_ENTRY', entryId: editingEntry.id, updates: { text: input } });
      setInput('');
      onDoneEditing();
    } else {
      dispatch({ type: 'ADD_ENTRY', op: 'text', value: 0, text: input });
      setInput('');
    }
  }

  function submitTextAll() {
    if (!input || (isEditing && editingEntry.op === 'text')) return;
    dispatch({ type: 'ADD_ENTRY_ALL', op: 'text', value: 0, text: input });
    setInput('');
  }

  function textStoreAction(index) {
    if (input) {
      setTextStores((prev) => {
        const next = [...prev];
        next[index] = input;
        return next;
      });
      setInput('');
    } else if (textStores[index]) {
      dispatch({ type: 'ADD_ENTRY', op: 'text', value: 0, text: textStores[index] });
      setKeypadMode('normal');
    }
  }

  function textStoreAllTapes(index) {
    if (textStores[index] && !input) {
      dispatch({ type: 'ADD_ENTRY_ALL', op: 'text', value: 0, text: textStores[index] });
      setKeypadMode('normal');
    }
  }

  const longPressRef = useRef(null);
  function onPointerDown(index) {
    longPressRef.current = setTimeout(() => {
      longPressRef.current = 'fired';
      textStoreAllTapes(index);
    }, 600);
  }
  function onPointerUp(index) {
    if (longPressRef.current === 'fired') {
      longPressRef.current = null;
      return;
    }
    clearTimeout(longPressRef.current);
    longPressRef.current = null;
    textStoreAction(index);
  }
  function onPointerCancel() {
    clearTimeout(longPressRef.current);
    longPressRef.current = null;
  }

  // Long-press handler for ENTER button (text keypad)
  const enterRef = useRef(null);
  function onEnterDown() {
    enterRef.current = setTimeout(() => {
      enterRef.current = 'fired';
      submitTextAll();
      setKeypadMode('normal');
    }, 600);
  }
  function onEnterUp() {
    if (enterRef.current === 'fired') {
      enterRef.current = null;
      return;
    }
    clearTimeout(enterRef.current);
    enterRef.current = null;
    submitText();
    setKeypadMode('normal');
  }
  function onEnterCancel() {
    clearTimeout(enterRef.current);
    enterRef.current = null;
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

  // Long-press nav button to jump back to normal keypad
  const navRef = useRef(null);
  function navDown(shortPressFn) {
    navRef.current = setTimeout(() => {
      navRef.current = 'fired';
      setInput('');
      setKeypadMode('normal');
    }, 600);
  }
  function navUp(shortPressFn) {
    if (navRef.current === 'fired') {
      navRef.current = null;
      return;
    }
    clearTimeout(navRef.current);
    navRef.current = null;
    shortPressFn();
  }
  function navCancel() {
    clearTimeout(navRef.current);
    navRef.current = null;
  }

  function press(digit) {
    setInput((prev) => prev + digit);
  }

  function backspace() {
    setInput((prev) => prev.slice(0, -1));
  }

  function clear() {
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

  function submitTotal() {
    const value = parseFloat(input);
    if (!isNaN(value) && input.trim() !== '') {
      dispatch({ type: 'ADD_ENTRY_AND_TOTAL', value: value, totalOp: 'T' });
    } else {
      dispatch({ type: 'ADD_ENTRY', op: 'T', value: 0 });
    }
    setInput('');
  }

  function submitTotalStartingValue() {
    const value = parseFloat(input);
    if (!isNaN(value) && input.trim() !== '') {
      dispatch({ type: 'SET_TOTAL_STARTING_VALUE', totalId: activeTotal.id, value });
      setInput('');
    } else {
      const startVal = activeTotal.startingValue || 0;
      setInput(startVal !== 0 ? String(startVal) : '');
    }
  }

  // Long-press handler for = button (T= total, or total starting value)
  const eqRef = useRef(null);
  function onEqDown() {
    if (viewingTotal) return; // no long-press behavior for total
    eqRef.current = setTimeout(() => {
      eqRef.current = 'fired';
      if (isEditing) return;
      submitTotal();
    }, 600);
  }
  function onEqUp() {
    if (viewingTotal) {
      submitTotalStartingValue();
      return;
    }
    if (eqRef.current === 'fired') {
      eqRef.current = null;
      return;
    }
    clearTimeout(eqRef.current);
    eqRef.current = null;
    submit('=');
  }
  function onEqCancel() {
    clearTimeout(eqRef.current);
    eqRef.current = null;
  }

  function toggleSign() {
    setInput((prev) => {
      if (!prev || prev === '0') return prev;
      return prev.startsWith('-') ? prev.slice(1) : '-' + prev;
    });
  }

  // Long-press handler for - button (toggle sign)
  const minusRef = useRef(null);
  function onMinusDown() {
    minusRef.current = setTimeout(() => {
      minusRef.current = 'fired';
      toggleSign();
    }, 600);
  }
  function onMinusUp() {
    if (minusRef.current === 'fired') {
      minusRef.current = null;
      return;
    }
    clearTimeout(minusRef.current);
    minusRef.current = null;
    submit('-');
  }
  function onMinusCancel() {
    clearTimeout(minusRef.current);
    minusRef.current = null;
  }

  function insertBelow() {
    if (!isEditing) return;
    const value = parseFloat(input);
    if (isNaN(value) || value === 0) return;
    dispatch({ type: 'INSERT_ENTRY', afterId: editingEntry.id, op: '+', value: value });
    setInput('');
    onDoneEditing();
  }

  const fmt = appState.settings?.numberFormat;
  function formatValue(n) {
    return formatNumber(n, fmt);
  }

  // Run action then auto-return to normal keypad
  function act(fn) {
    return () => { fn(); setKeypadMode('normal'); };
  }

  function memoryStore() {
    setMemoryValue(storeSubtotal);
  }

  function memoryStoreProduct() {
    if (storeSubProduct !== null) {
      setMemoryValue(storeSubProduct);
    }
  }

  function memoryRecall() {
    if (memoryValue !== null) {
      setInput(String(memoryValue));
    }
  }

  function memoryClear() {
    setMemoryValue(null);
  }

  function exportTheme() {
    const themed = {
      ...appState,
      tapes: appState.tapes.map((a) => ({ ...a, tape: [] })),
    };
    downloadJSON(themed, 'calculator-theme.json');
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

  function leaveTapeConfig() {
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
    setKeypadMode('normal');
  }

  function setTapeColor(color) {
    dispatch({ type: 'SET_TAPE_COLOR', tapeId: activeTapeId, color });
    leaveTapeConfig();
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
      leaveTapeConfig();
    } else {
      setTapeColor(palette[index]);
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

  const empty = <button className={styles.memBtnEmpty} disabled />;

  function renderKeypad() {
    if (keypadMode === 'mem') {
      const hasProduct = storeSubProduct !== null;
      const hasMem = memoryValue !== null;
      return (
        <div className={styles.grid}>
          <button className={`${styles.navBtn} ${styles.longPress}`} onPointerDown={navDown} onPointerUp={() => navUp(() => setKeypadMode('text'))} onPointerCancel={navCancel} onContextMenu={(e) => e.preventDefault()}>mem</button>
          {empty}{empty}{empty}

          <button className={styles.memBtn} onClick={act(memoryStore)}>
            <span className={styles.memLabel}>MS</span>
            <span className={styles.memValue}>{formatValue(storeSubtotal)}</span>
          </button>
          <button className={`${styles.memBtn} ${!hasProduct ? styles.memBtnDisabled : ''}`} onClick={act(memoryStoreProduct)} disabled={!hasProduct}>
            <span className={styles.memLabel}>MP</span>
            <span className={styles.memValue}>{hasProduct ? formatValue(storeSubProduct) : '—'}</span>
          </button>
          <button className={`${styles.memBtn} ${!hasMem ? styles.memBtnDisabled : ''}`} onClick={act(memoryRecall)} disabled={!hasMem}>
            <span className={styles.memLabel}>MR</span>
            <span className={styles.memValue}>{hasMem ? formatValue(memoryValue) : '—'}</span>
          </button>
          <button className={`${styles.memBtn} ${!hasMem ? styles.memBtnDisabled : ''}`} onClick={act(memoryClear)} disabled={!hasMem}>
            <span className={styles.memLabel}>MC</span>
            <span className={styles.memValue}>{hasMem ? formatValue(memoryValue) : '—'}</span>
          </button>

          {empty}{empty}{empty}
          <button
            className={`${styles.clearBtn} ${styles.longPress}`}
            onPointerDown={onClearDown}
            onPointerUp={onClearUp}
            onPointerCancel={onClearCancel}
            onContextMenu={(e) => e.preventDefault()}
          >C</button>

          {empty}{empty}{empty}{empty}
          {empty}{empty}{empty}{empty}
        </div>
      );
    }

    if (keypadMode === 'text' && !window.matchMedia('(orientation: landscape)').matches) {
      return (
        <div className={styles.grid}>
          <button className={`${styles.navBtn} ${styles.longPress}`} onPointerDown={navDown} onPointerUp={() => navUp(() => { setInput(viewingTotal && activeTotal ? activeTotal.name : activeTapeName); setKeypadMode(viewingTotal ? 'total' : 'name'); })} onPointerCancel={navCancel} onContextMenu={(e) => e.preventDefault()}>text</button>
          <button
            className={`${styles.textBtn} ${styles.longPress}`}
            onPointerDown={onEnterDown}
            onPointerUp={onEnterUp}
            onPointerCancel={onEnterCancel}
            onContextMenu={(e) => e.preventDefault()}
          >ENTER</button>
          {textStores.map((stored, i) => (
            <button
              key={i}
              className={`${stored ? styles.textStoreBtn : styles.textStoreEmpty} ${stored ? styles.longPress : ''}`}
              onPointerDown={() => onPointerDown(i)}
              onPointerUp={() => onPointerUp(i)}
              onPointerCancel={onPointerCancel}
              onContextMenu={(e) => e.preventDefault()}
              disabled={!input && !stored}
              title={stored || undefined}
            >
              {stored ? (stored.length > 5 ? stored.slice(0, 5) + '\u2026' : stored) : ''}
            </button>
          ))}
        </div>
      );
    }

    if (keypadMode === 'total' && activeTotal) {
      const totalColor = activeTotal.color;
      return (
        <div className={styles.grid}>
          <button className={`${styles.navBtn} ${styles.longPress}`} onPointerDown={navDown} onPointerUp={() => navUp(() => {
            if (input && input !== activeTotal.name) {
              dispatch({ type: 'RENAME_TOTAL', totalId: activeTotal.id, name: input });
            }
            setInput('');
            setKeypadMode('setup');
          })} onPointerCancel={navCancel} onContextMenu={(e) => e.preventDefault()}>total</button>
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

    if (keypadMode === 'name') {
      return (
        <div className={styles.grid}>
          <button className={`${styles.navBtn} ${styles.longPress}`} onPointerDown={navDown} onPointerUp={() => navUp(() => {
            if (input && input !== activeTapeName) {
              dispatch({ type: 'RENAME_TAPE', tapeId: activeTapeId, name: input });
            }
            setInput('');
            setKeypadMode('setup');
          })} onPointerCancel={navCancel} onContextMenu={(e) => e.preventDefault()}>name</button>
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
          <button className={`${styles.navBtn} ${styles.longPress}`} onPointerDown={navDown} onPointerUp={() => navUp(() => { setInput(''); setKeypadMode('setup'); })} onPointerCancel={navCancel} onContextMenu={(e) => e.preventDefault()}>room</button>
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
      function onSaveItemDown(e, id, isAutosave) {
        e.preventDefault();
        saveLongRef.current = setTimeout(() => {
          saveLongRef.current = 'fired';
          const save = isAutosave ? getAutosave(id) : getSave(id);
          if (save) {
            addAutosave(appState);
            dispatch({ type: 'LOAD_STATE', state: save.state });
            setKeypadMode('normal');
          }
        }, 600);
      }
      function onSaveItemUp() {
        if (saveLongRef.current === 'fired') {
          saveLongRef.current = null;
          return;
        }
        clearTimeout(saveLongRef.current);
        saveLongRef.current = null;
      }
      function onSaveItemCancel() {
        clearTimeout(saveLongRef.current);
        saveLongRef.current = null;
      }
      function doSave() {
        const name = input.trim() || `Save ${saves.length + 1}`;
        addSave(name, appState);
        setInput('');
        setSaves(loadSaves());
      }
      return (
        <div className={styles.savesContainer}>
          <div className={styles.savesHeader}>
            <button className={`${styles.navBtn} ${styles.longPress}`} onPointerDown={navDown} onPointerUp={() => navUp(() => setKeypadMode('setup'))} onPointerCancel={navCancel} onContextMenu={(e) => e.preventDefault()}>saves</button>
            <button className={styles.wideBtn} onClick={doSave}>Save</button>
          </div>
          <div className={styles.savesList}>
            {saves.map((s) => (
              <div
                key={s.id}
                className={`${styles.saveItem} ${styles.longPress}`}
                onPointerDown={(e) => onSaveItemDown(e, s.id, false)}
                onPointerUp={onSaveItemUp}
                onPointerCancel={onSaveItemCancel}
                onContextMenu={(e) => e.preventDefault()}
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
                    className={`${styles.saveItem} ${styles.longPress}`}
                    onPointerDown={(e) => onSaveItemDown(e, s.id, true)}
                    onPointerUp={onSaveItemUp}
                    onPointerCancel={onSaveItemCancel}
                    onContextMenu={(e) => e.preventDefault()}
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
          <button className={`${styles.navBtn} ${styles.longPress}`} onPointerDown={navDown} onPointerUp={() => navUp(() => setKeypadMode('normal'))} onPointerCancel={navCancel} onContextMenu={(e) => e.preventDefault()}>setup</button>
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
            {colorNeg ? 'Color (−): ON' : 'Color (−): OFF'}
          </button>
          <button
            className={`${styles.wideBtn} ${calcMode === 'adding' ? styles.toggleOn : ''}`}
            style={{ gridColumn: 'span 2' }}
            onClick={() => dispatch({ type: 'SET_SETTING', key: 'calculationMode', value: calcMode === 'adding' ? 'arithmetic' : 'adding' })}
          >
            {calcMode === 'adding' ? 'Adding Machine' : 'Arithmetic'}
          </button>
          <button className={styles.wideBtn} style={{ gridColumn: 'span 2' }} onClick={act(exportAll)}>Export</button>
          <button className={styles.wideBtn} style={{ gridColumn: 'span 2' }} onClick={act(importData)}>Import</button>
          <button className={styles.wideBtn} style={{ gridColumn: 'span 2' }} onClick={() => { setSaves(loadSaves()); setAutosaves(loadAutosaves()); setKeypadMode('saves'); }}>Saves</button>
          <button
            className={`${styles.wideBtn} ${sync.roomId ? styles.toggleOn : ''}`}
            style={{ gridColumn: 'span 2' }}
            onClick={() => { setInput(''); setKeypadMode('room'); }}
          >
            {sync.roomId ? `Room: ${sync.roomId}` : 'Room'}
          </button>
        </div>
      );
    }

    // Normal keypad
    const opDisabled = viewingTotal;
    const hasProduct = storeSubProduct !== null;
    const hasMem = memoryValue !== null;
    return (
      <div className={styles.keypadRow}>
        <div className={styles.memColumn}>
          <button className={styles.memBtn} onClick={memoryStore}>
            <span className={styles.memLabel}>MS</span>
            <span className={styles.memValue}>{formatValue(storeSubtotal)}</span>
          </button>
          <button className={`${styles.memBtn} ${!hasProduct ? styles.memBtnDisabled : ''}`} onClick={memoryStoreProduct} disabled={!hasProduct}>
            <span className={styles.memLabel}>MP</span>
            <span className={styles.memValue}>{hasProduct ? formatValue(storeSubProduct) : '—'}</span>
          </button>
          <button className={`${styles.memBtn} ${!hasMem ? styles.memBtnDisabled : ''}`} onClick={memoryRecall} disabled={!hasMem}>
            <span className={styles.memLabel}>MR</span>
            <span className={styles.memValue}>{hasMem ? formatValue(memoryValue) : '—'}</span>
          </button>
          <button className={`${styles.memBtn} ${!hasMem ? styles.memBtnDisabled : ''}`} onClick={memoryClear} disabled={!hasMem}>
            <span className={styles.memLabel}>MC</span>
            <span className={styles.memValue}>{hasMem ? formatValue(memoryValue) : '—'}</span>
          </button>
          <button
            className={`${styles.clearBtn} ${styles.longPress}`}
            onPointerDown={onClearDown}
            onPointerUp={onClearUp}
            onPointerCancel={onClearCancel}
            onContextMenu={(e) => e.preventDefault()}
          >C</button>
        </div>
        <div className={styles.grid}>
        <button className={`${styles.navBtn} ${styles.longPress}`} onPointerDown={navDown} onPointerUp={() => navUp(() => { const landscape = window.matchMedia('(orientation: landscape)').matches; if (landscape) { setInput(viewingTotal ? activeTotal.name : activeTapeName); setKeypadMode(viewingTotal ? 'total' : 'name'); } else { setKeypadMode(viewingTotal ? 'text' : 'mem'); } })} onPointerCancel={navCancel} onContextMenu={(e) => e.preventDefault()}>calc</button>
        <button className={styles.fnBtn} onClick={backspace}>&larr;</button>
        <button className={styles.opBtn} onClick={opDisabled ? undefined : () => submit('/')} disabled={opDisabled}>&divide;</button>
        <button className={styles.opBtn} onClick={opDisabled ? undefined : () => submit('*')} disabled={opDisabled}>&times;</button>

        <button className={styles.numBtn} onClick={() => press('7')}>7</button>
        <button className={styles.numBtn} onClick={() => press('8')}>8</button>
        <button className={styles.numBtn} onClick={() => press('9')}>9</button>
        {opDisabled ? (
          <button className={styles.opBtn} disabled>&minus;</button>
        ) : (
          <button
            className={`${styles.opBtn} ${styles.longPress}`}
            onPointerDown={onMinusDown}
            onPointerUp={onMinusUp}
            onPointerCancel={onMinusCancel}
            onContextMenu={(e) => e.preventDefault()}
          >&minus;</button>
        )}

        <button className={styles.numBtn} onClick={() => press('4')}>4</button>
        <button className={styles.numBtn} onClick={() => press('5')}>5</button>
        <button className={styles.numBtn} onClick={() => press('6')}>6</button>
        <button className={styles.opBtn} onClick={opDisabled ? undefined : () => submit('+')} disabled={opDisabled}>+</button>

        <button className={styles.numBtn} onClick={() => press('1')}>1</button>
        <button className={styles.numBtn} onClick={() => press('2')}>2</button>
        <button className={styles.numBtn} onClick={() => press('3')}>3</button>
        <button
          className={`${styles.eqBtn} ${styles.longPress}`}
          style={isEditing ? undefined : { gridRow: 'span 2' }}
          onPointerDown={onEqDown}
          onPointerUp={onEqUp}
          onPointerCancel={onEqCancel}
          onContextMenu={(e) => e.preventDefault()}
        >=</button>

        <button className={styles.numBtn} style={{ gridColumn: 'span 2' }} onClick={() => press('0')}>0</button>
        <button className={styles.numBtn} onClick={() => press('.')}>.</button>
        {isEditing && <button className={styles.fnBtn} style={{ fontSize: '0.8rem' }} onClick={insertBelow}>INS</button>}
        </div>
      </div>
    );
  }

  const isTextInput = keypadMode === 'text' || keypadMode === 'name' || keypadMode === 'total' || keypadMode === 'saves' || keypadMode === 'room';

  function getDisplayLabel() {
    if (isEditing) return 'EDIT';
    if (keypadMode === 'text') return 'TEXT';
    if (keypadMode === 'total') return '\u03A3 NAME';
    if (keypadMode === 'name') return 'NAME';
    if (keypadMode === 'setup') return 'SETUP';
    if (keypadMode === 'saves') return 'SAVES';
    if (keypadMode === 'room') return 'ROOM';
    if (viewingTotal) return '\u03A3';
    return formatValue(currentSubProduct !== null ? currentSubProduct : subtotal);
  }

  return (
    <>
      <div className={styles.textSidebar}>
        <button
          className={`${styles.textBtn} ${keypadMode === 'text' ? styles.toggleOn : ''}`}
          onClick={() => setKeypadMode(keypadMode === 'text' ? 'normal' : 'text')}
        >TEXT</button>
        <button
          className={`${styles.textBtn} ${styles.longPress}`}
          onPointerDown={onEnterDown}
          onPointerUp={onEnterUp}
          onPointerCancel={onEnterCancel}
          onContextMenu={(e) => e.preventDefault()}
        >ENTER</button>
        {textStores.map((stored, i) => (
          <button
            key={i}
            className={`${stored ? styles.textStoreBtn : styles.textStoreEmpty} ${stored ? styles.longPress : ''}`}
            onPointerDown={() => onPointerDown(i)}
            onPointerUp={() => onPointerUp(i)}
            onPointerCancel={onPointerCancel}
            onContextMenu={(e) => e.preventDefault()}
            disabled={!input && !stored}
            title={stored || undefined}
          >
            {stored ? (stored.length > 5 ? stored.slice(0, 5) + '\u2026' : stored) : ''}
          </button>
        ))}
      </div>
      <div className={`${styles.container} ${isEditing ? styles.editing : ''}`}>
        <input type="file" accept=".json" ref={fileRef} onChange={handleImportFile} style={{ display: 'none' }} />
        <input type="color" ref={colorRef} onChange={onColorChange} style={{ display: 'none' }} />
        <div className={styles.display}>
          <span className={styles.subtotal}>
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
                  if (keypadMode === 'room') {
                    const code = input.trim();
                    if (code.length >= 4) { sync.joinRoom(code); setInput(''); }
                  } else if (keypadMode === 'saves') {
                    const name = input.trim() || `Save ${saves.length + 1}`;
                    addSave(name, appState);
                    setInput('');
                    setSaves(loadSaves());
                  } else if (keypadMode === 'text') { submitText(); setKeypadMode('normal'); }
                  else { leaveTapeConfig(); }
                }
              }}
              style={keypadMode === 'room' ? { textTransform: 'uppercase' } : undefined}
              placeholder={keypadMode === 'room' ? 'Room code…' : keypadMode === 'saves' ? 'Save name…' : keypadMode === 'text' ? 'Type text…' : viewingTotal ? 'Total name…' : 'Tape name…'}
            />
          ) : (
            <span>{input || '0'}</span>
          )}
        </div>
        {renderKeypad()}
      </div>
    </>
  );
}
