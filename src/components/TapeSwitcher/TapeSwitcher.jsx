import { computeRunningTotals } from '../../../shared/calculate.js';
import { formatNumber } from '../../lib/format.js';
import styles from './TapeSwitcher.module.css';

export default function TapeSwitcher({ tapes, activeTapeId, dispatch, settings, onAddTape, onAddTotal, clearMode, onClearTape }) {
  const fmt = settings?.numberFormat;
  const calcMode = settings?.calculationMode;
  const opPosition = settings?.operatorPosition;

  function computeTotalValue(tape) {
    if (!tape.totalConfig) return null;
    const memberMap = {};
    (tape.totalConfig.members || []).forEach((m) => { memberMap[m.accountId] = m.sign; });
    let grandTotal = tape.totalConfig.startingValue || 0;
    tapes.forEach((t) => {
      if (t.id === tape.id) return; // exclude self
      const sign = memberMap[t.id];
      if (sign) {
        const { totals: rt } = computeRunningTotals(t.tape, calcMode, opPosition);
        const sub = rt.length > 0 ? rt[rt.length - 1] : 0;
        grandTotal += sign === '-' ? -sub : sub;
      }
    });
    return grandTotal;
  }

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        {tapes.map((tape) => {
          const isTotal = !!tape.totalConfig;
          const displayValue = isTotal
            ? computeTotalValue(tape)
            : (() => { const { totals: rt } = computeRunningTotals(tape.tape, calcMode, opPosition); return rt.length > 0 ? rt[rt.length - 1] : 0; })();
          return (
          <button
            key={tape.id}
            className={`${styles.tab} ${isTotal ? styles.totalTab : ''} ${tape.id === activeTapeId ? styles.active : ''} ${clearMode ? styles.clearModeTab : ''}`}
            style={tape.color ? ((tape.id === activeTapeId) ? { background: tape.color } : { background: tape.color + '30', color: tape.color, borderBottom: `3px solid ${tape.color}` }) : undefined}
            onClick={() => {
              if (clearMode) {
                onClearTape(tape.id);
              } else {
                dispatch({ type: 'SET_ACTIVE', tapeId: tape.id });
              }
            }}
          >
            <span className={styles.tabName}>{isTotal ? '\u03A3 ' : ''}{tape.name}</span>
            <span className={styles.tabTotal}>{formatNumber(displayValue, fmt)}</span>
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
          +{'\u03A3'}
        </button>
      </div>
    </div>
  );
}
