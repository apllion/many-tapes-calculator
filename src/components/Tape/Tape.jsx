import { Fragment, useRef, useEffect } from 'react';
import TapeEntry from '../TapeEntry/TapeEntry.jsx';
import { formatNumber } from '../../lib/format.js';
import { computeRunningTotals } from '../../../shared/calculate.js';
import styles from './Tape.module.css';

export { computeRunningTotals };

export default function Tape({ tape, editingId, editingMode, onSelect, settings, previewEntry, editingInput, clearMode, clearHighlight, onClearEntry }) {
  const bottomRef = useRef(null);
  const opPosition = settings?.operatorPosition;
  const { totals, subProducts } = computeRunningTotals(tape, settings?.calculationMode, opPosition);

  // Compute # numbering for entries with text (text-only and labeled numeric)
  const textCounts = {};
  const resolvedTexts = tape.map((entry) => {
    if (!entry.text?.includes('#')) return null;
    const key = entry.text;
    textCounts[key] = (textCounts[key] || 0) + 1;
    return entry.text.replace('#', String(textCounts[key]));
  });

  // Determine where the preview goes: after editingId, or at end
  const insertAfterIndex = editingId
    ? tape.findIndex((e) => e.id === editingId)
    : tape.length - 1;

  // Compute preview running total by inserting preview into a temporary tape
  let previewTotal = null;
  if (previewEntry && previewEntry.op !== 'text') {
    const tempTape = [...tape.slice(0, insertAfterIndex + 1), previewEntry];
    const { totals: tempTotals } = computeRunningTotals(tempTape, settings?.calculationMode, opPosition);
    previewTotal = tempTotals[tempTotals.length - 1];
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tape.length]);

  const fmt = settings?.numberFormat;

  function handleEntryTap(id, mode) {
    if (clearMode) {
      onClearEntry(id);
      return;
    }
    onSelect(id, mode);
  }

  function renderPreview() {
    if (!previewEntry) return null;
    if (previewEntry.op === 'text') {
      return (
        <div className={`${styles.previewRow} ${styles.previewText}`}>
          {previewEntry.text}
        </div>
      );
    }
    const isNeg = previewTotal !== null && previewTotal < 0;
    return (
      <div className={styles.previewRow}>
        <span />
        <span className={styles.previewTextZone}>
          {previewEntry.text && (
            <span className={styles.previewLabel}>{previewEntry.text}</span>
          )}
        </span>
        <span className={styles.previewNumberZone}>
          <span className={styles.previewValue}>
            {formatNumber(previewEntry.value, fmt)}
          </span>
          <span className={`${styles.previewTotal} ${isNeg ? styles.negative : styles.positive}`}>
            {previewTotal !== null ? formatNumber(previewTotal, fmt) : ''}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className={styles.container} onClick={(e) => { if (e.target === e.currentTarget && editingId) onSelect(editingId, editingMode); }}>
      {tape.length === 0 && !previewEntry ? (
        <div className={styles.empty}>
          Enter a number below to start
        </div>
      ) : (
        <div className={styles.entries} onClick={(e) => { if (e.target === e.currentTarget && editingId) onSelect(editingId, editingMode); }}>
          {tape.map((entry, i) => (
            <Fragment key={entry.id}>
              <TapeEntry
                entry={entry}
                resolvedText={resolvedTexts[i]}
                runningTotal={totals[i]}
                subProduct={subProducts[i]}
                isSelected={entry.id === editingId}
                editingMode={entry.id === editingId ? editingMode : null}
                onSelect={handleEntryTap}
                settings={settings}
                editingInput={entry.id === editingId ? editingInput : null}
                clearMode={clearMode}
                clearHighlight={entry.id === editingId ? clearHighlight : null}
                isPrefix={opPosition === 'prefix'}
              />
              {i === insertAfterIndex && renderPreview()}
            </Fragment>
          ))}
          {tape.length === 0 && renderPreview()}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
