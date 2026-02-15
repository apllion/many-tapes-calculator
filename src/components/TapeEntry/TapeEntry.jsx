import { formatNumber } from '../../lib/format.js';
import styles from './TapeEntry.module.css';

const OP_SYMBOLS = { '+': '+', '-': '\u2212', '*': '\u00d7', '/': '\u00f7' };

export default function TapeEntry({ entry, resolvedText, runningTotal, subProduct, dispatch, isSelected, onSelect, settings }) {
  const fmt = settings?.numberFormat;
  const displayValue = subProduct !== null ? subProduct : runningTotal;
  const isNegative = displayValue < 0;
  const totalClass = `${styles.total} ${isNegative ? styles.negative : styles.positive}`;
  const isNegativeValue = entry.value < 0;
  const colorNeg = settings?.colorNegatives && isNegativeValue;

  if (entry.op === 'text') {
    return (
      <div
        className={`${styles.row} ${styles.textRow} ${isSelected ? styles.selected : ''}`}
        onClick={onSelect}
      >
        <button
          className={styles.deleteBtn}
          onClick={(e) => {
            e.stopPropagation();
            dispatch({ type: 'DELETE_ENTRY', entryId: entry.id });
          }}
          aria-label="Delete entry"
        >
          &times;
        </button>
        <span className={styles.textContent}>
          {resolvedText || entry.text}
        </span>

      </div>
    );
  }

  if (entry.op === '=' || entry.op === 'T') {
    const isTotal = entry.op === 'T';
    return (
      <div
        className={`${styles.row} ${isTotal ? styles.totalRow : styles.subtotalRow} ${isSelected ? styles.selected : ''}`}
        onClick={onSelect}
      >
        <button
          className={styles.deleteBtn}
          onClick={(e) => {
            e.stopPropagation();
            dispatch({ type: 'DELETE_ENTRY', entryId: entry.id });
          }}
          aria-label="Delete entry"
        >
          &times;
        </button>
        <span className={styles.eqLabel}>{isTotal ? 'T' : 'S'}</span>
        <span className={styles.eqOp}>=</span>
        <span className={`${styles.total} ${styles.subtotalValue} ${isNegative ? styles.negative : styles.positive}`}>
          {formatNumber(runningTotal, fmt)}
        </span>

      </div>
    );
  }

  return (
    <div
      className={`${styles.row} ${colorNeg ? styles.negRow : ''} ${isSelected ? styles.selected : ''}`}
      onClick={onSelect}
    >
      <button
        className={styles.deleteBtn}
        onClick={(e) => {
          e.stopPropagation();
          dispatch({ type: 'DELETE_ENTRY', entryId: entry.id });
        }}
        aria-label="Delete entry"
      >
        &times;
      </button>

      <span className={styles.value}>
        {formatNumber(entry.value, fmt)}
      </span>

      <span className={styles.op}>
        {OP_SYMBOLS[entry.op]}
      </span>

      <span className={`${totalClass} ${subProduct !== null ? styles.hasSubProduct : ''}`}>
        {formatNumber(runningTotal, fmt)}
        {subProduct !== null && (
          <span className={styles.subProductHint}>{formatNumber(subProduct, fmt)}</span>
        )}
      </span>
    </div>
  );
}
