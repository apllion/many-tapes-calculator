import { formatNumber } from '../../lib/format.js';
import styles from './TapeEntry.module.css';

const OP_SYMBOLS = { '+': '+', '-': '\u2212', '*': '\u00d7', '/': '\u00f7' };

export default function TapeEntry({ entry, runningTotal, subProduct, isSelected, editingMode, onSelect, settings, editingInput, clearMode, clearHighlight, onClearText, onClearNumber, isPrefix }) {
  const fmt = settings?.numberFormat;
  const displayValue = subProduct !== null ? subProduct : runningTotal;
  const isNegative = displayValue < 0;
  const totalClass = `${styles.total} ${isNegative ? styles.negative : styles.positive}`;
  const isNegativeValue = entry.value !== null && entry.value < 0;
  const colorNeg = settings?.colorNegatives && isNegativeValue;

  if (entry.op === 'text') {
    return (
      <div
        className={`${styles.row} ${styles.textRow} ${isSelected ? styles.selected : ''} ${clearMode ? styles.clearTarget : ''}`}
        onClick={() => onSelect(entry.id, 'text')}
      >
        <span className={styles.textContent}>
          {entry.text}
        </span>
      </div>
    );
  }

  if (entry.op === '=' || entry.op === 'T') {
    const isTotal = entry.op === 'T';
    return (
      <div
        className={`${styles.row} ${isTotal ? styles.totalRow : styles.subtotalRow} ${isSelected ? styles.selected : ''} ${clearMode ? styles.clearTarget : ''}`}
        onClick={() => onSelect(entry.id, 'number')}
      >
        <span className={styles.eqLabel}>{isTotal ? 'T' : 'S'}</span>
        <span className={styles.eqOp}>=</span>
        <span className={`${styles.total} ${styles.subtotalValue} ${isNegative ? styles.negative : styles.positive}`}>
          {formatNumber(runningTotal, fmt)}
        </span>
      </div>
    );
  }

  // Live editing preview: override displayed text/value while typing
  const liveText = editingMode === 'text' && editingInput != null ? editingInput : null;
  const liveValue = editingMode === 'number' && editingInput != null ? parseFloat(editingInput) : null;
  const displayText = liveText != null ? liveText : entry.text;
  const shownValue = liveValue != null && !isNaN(liveValue) ? liveValue : entry.value;

  return (
    <div
      className={`${styles.row} ${colorNeg ? styles.negRow : ''} ${isSelected ? styles.selected : ''} ${clearMode ? styles.clearTarget : ''}`}
    >
      <div
        className={`${styles.textZone} ${isSelected && editingMode === 'text' ? styles.activeZone : ''} ${clearHighlight === 'text' || clearHighlight === 'both' ? styles.clearZone : ''}`}
        onClick={() => {
          if (clearHighlight === 'both' && onClearText) {
            onClearText(entry.id);
          } else {
            onSelect(entry.id, 'text');
          }
        }}
      >
        {displayText ? (
          <span className={styles.textZoneLabel}>{displayText}</span>
        ) : isSelected && editingMode === 'text' ? (
          <span className={styles.textZonePlaceholder}>text…</span>
        ) : null}
      </div>

      <div
        className={`${styles.numberZone} ${isSelected && editingMode === 'number' ? styles.activeZone : ''} ${clearHighlight === 'number' || clearHighlight === 'both' ? styles.clearZone : ''}`}
        onClick={() => {
          if (clearHighlight === 'both' && onClearNumber) {
            onClearNumber(entry.id);
          } else {
            onSelect(entry.id, 'number');
          }
        }}
      >
        {shownValue !== null ? (
          <>
            {isPrefix && (
              <span className={styles.op}>
                {OP_SYMBOLS[entry.op]}
              </span>
            )}
            <span className={styles.value}>
              {formatNumber(shownValue, fmt)}
            </span>
            {!isPrefix && (
              <span className={styles.op}>
                {OP_SYMBOLS[entry.op]}
              </span>
            )}
            <span className={`${totalClass} ${subProduct !== null ? styles.hasSubProduct : ''}`}>
              {formatNumber(runningTotal, fmt)}
              {subProduct !== null && (
                <span className={styles.subProductHint}>{formatNumber(subProduct, fmt)}</span>
              )}
            </span>
          </>
        ) : (
          <span className={styles.emptyValue}>&hellip;</span>
        )}
      </div>
    </div>
  );
}
