import { useRef } from 'react';
import { computeRunningTotals } from '../Tape/Tape.jsx';
import { formatNumber } from '../../lib/format.js';
import styles from './TapeSwitcher.module.css';

export default function TapeSwitcher({ tapes, activeTapeId, totals, activeTotalId, dispatch, settings, onAddTape, onAddTotal }) {
  const fmt = settings?.numberFormat;
  const calcMode = settings?.calculationMode;
  const longRef = useRef(null);
  const startPos = useRef(null);

  function onCloseDown(e, action) {
    startPos.current = { x: e.clientX, y: e.clientY };
    longRef.current = setTimeout(() => {
      longRef.current = 'fired';
      dispatch(action);
    }, 600);
  }
  function onCloseMove(e) {
    if (!startPos.current || !longRef.current || longRef.current === 'fired') return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    if (dx * dx + dy * dy > 100) {
      clearTimeout(longRef.current);
      longRef.current = null;
      startPos.current = null;
    }
  }
  function onCloseUp() {
    if (longRef.current === 'fired') {
      longRef.current = null;
      startPos.current = null;
      return;
    }
    clearTimeout(longRef.current);
    longRef.current = null;
    startPos.current = null;
  }
  function onCloseCancel() {
    clearTimeout(longRef.current);
    longRef.current = null;
    startPos.current = null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        {tapes.map((tape) => {
          const { totals: runTotals } = computeRunningTotals(tape.tape, calcMode);
          const tapeSubtotal = runTotals.length > 0 ? runTotals[runTotals.length - 1] : 0;
          return (
          <button
            key={tape.id}
            className={`${styles.tab} ${!activeTotalId && tape.id === activeTapeId ? styles.active : ''}`}
            style={tape.color ? ((!activeTotalId && tape.id === activeTapeId) ? { background: tape.color } : { background: tape.color + '30', color: tape.color, borderBottom: `3px solid ${tape.color}` }) : undefined}
            onClick={() => dispatch({ type: 'SET_ACTIVE', tapeId: tape.id })}
          >
            <span className={styles.tabName}>{tape.name}</span>
            <span className={styles.tabTotal}>{formatNumber(tapeSubtotal, fmt)}</span>
            {tapes.length > 1 && (
              <span
                className={styles.close}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onCloseDown(e, { type: 'DELETE_TAPE', tapeId: tape.id });
                }}
                onPointerMove={onCloseMove}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  onCloseUp();
                }}
                onPointerCancel={(e) => {
                  e.stopPropagation();
                  onCloseCancel();
                }}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.preventDefault()}
              >
                &times;
              </span>
            )}
          </button>
          );
        })}
        <button
          className={styles.addBtn}
          onClick={onAddTape}
          aria-label="Add tape"
        >
          +
        </button>
        <button
          className={`${styles.addBtn} ${styles.addTotalBtn}`}
          onClick={onAddTotal}
          aria-label="Add total"
        >
          +&Sigma;
        </button>
        {totals.map((total) => {
          const memberMap = {};
          (total.members || []).forEach((m) => { memberMap[m.accountId] = m.sign; });
          let grandTotal = total.startingValue || 0;
          tapes.forEach((tape) => {
            const sign = memberMap[tape.id];
            if (sign) {
              const { totals: rt } = computeRunningTotals(tape.tape, calcMode);
              const sub = rt.length > 0 ? rt[rt.length - 1] : 0;
              grandTotal += sign === '-' ? -sub : sub;
            }
          });
          return (
          <button
            key={total.id}
            className={`${styles.tab} ${styles.totalTab} ${activeTotalId === total.id ? styles.active : ''}`}
            style={total.color ? ((activeTotalId === total.id) ? { background: total.color } : { background: total.color + '30', color: total.color, borderBottom: `3px solid ${total.color}` }) : undefined}
            onClick={() => dispatch({ type: 'SET_ACTIVE_TOTAL', totalId: total.id })}
          >
            <span className={styles.tabName}>&Sigma; {total.name}</span>
            <span className={styles.tabTotal}>{formatNumber(grandTotal, fmt)}</span>
            <span
              className={styles.close}
              onPointerDown={(e) => {
                e.stopPropagation();
                onCloseDown(e, { type: 'DELETE_TOTAL', totalId: total.id });
              }}
              onPointerMove={onCloseMove}
              onPointerUp={(e) => {
                e.stopPropagation();
                onCloseUp();
              }}
              onPointerCancel={(e) => {
                e.stopPropagation();
                onCloseCancel();
              }}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
            >
              &times;
            </span>
          </button>
          );
        })}
      </div>
    </div>
  );
}
