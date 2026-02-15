import { Fragment, useRef, useEffect } from 'react';
import TapeEntry from '../TapeEntry/TapeEntry.jsx';
import { formatNumber } from '../../lib/format.js';
import styles from './Tape.module.css';

/**
 * Compute running totals with operator precedence:
 * × and ÷ bind tighter than + and −.
 *
 * The op on each entry means "what comes after this value."
 * Entries connected by × or ÷ form a multiplicative group.
 * Groups are separated by + or −, which determine how the
 * group result applies to the additive total.
 *
 * Each entry's running total = "total if the tape ended here."
 */
export function computeRunningTotals(tape, mode = 'arithmetic') {
  if (mode === 'adding') {
    return computeRunningTotalsAdding(tape);
  }
  const totals = [];
  const subProducts = [];
  let total = 0;
  let addOp = '+';
  let groupProduct = 0;
  let groupLen = 0;
  let prevEntry = null;

  for (let i = 0; i < tape.length; i++) {
    const entry = tape[i];

    if (entry.op === 'text') {
      totals.push(totals.length > 0 ? totals[totals.length - 1] : 0);
      subProducts.push(null);
      continue;
    }

    if (entry.op === '=') {
      // S= is purely a display marker — show subtotal without modifying state
      let displayTotal = total;
      if (groupLen > 0) {
        displayTotal = applyAdd(addOp, total, groupProduct);
      }
      totals.push(displayTotal);
      subProducts.push(null);
      continue;
    }

    if (entry.op === 'T') {
      if (groupLen > 0) {
        total = applyAdd(addOp, total, groupProduct);
        groupLen = 0;
      }
      totals.push(total);
      subProducts.push(null);
      total = 0;
      addOp = '+';
      prevEntry = entry;
      continue;
    }

    if (groupLen === 0) {
      groupProduct = entry.value;
      groupLen = 1;
    } else {
      const prevOp = prevEntry.op;
      if (prevOp === '*') {
        groupProduct *= entry.value;
      } else if (prevOp === '/') {
        groupProduct = entry.value !== 0 ? groupProduct / entry.value : groupProduct;
      }
      groupLen++;
    }

    const currentTotal = applyAdd(addOp, total, groupProduct);
    totals.push(currentTotal);

    // For entries inside a multiplicative group, record the sub-product
    const isMultOp = entry.op === '*' || entry.op === '/';
    const prevIsMultOp = prevEntry !== null && (prevEntry.op === '*' || prevEntry.op === '/');
    if (isMultOp || prevIsMultOp) {
      subProducts.push(groupProduct);
    } else {
      subProducts.push(null);
    }

    if (entry.op === '+' || entry.op === '-') {
      total = currentTotal;
      addOp = entry.op;
      groupLen = 0;
    }

    prevEntry = entry;
  }

  return { totals, subProducts };
}

function computeRunningTotalsAdding(tape) {
  const totals = [];
  const subProducts = [];
  let total = 0;
  let pendingOp = '+';

  for (let i = 0; i < tape.length; i++) {
    const entry = tape[i];

    if (entry.op === 'text') {
      totals.push(totals.length > 0 ? totals[totals.length - 1] : 0);
      subProducts.push(null);
      continue;
    }

    if (entry.op === '=' || entry.op === 'T') {
      totals.push(total);
      subProducts.push(null);
      if (entry.op === 'T') {
        total = 0;
        pendingOp = '+';
      }
      continue;
    }

    total = applyOp(pendingOp, total, entry.value);
    totals.push(total);
    subProducts.push(null);
    pendingOp = entry.op;
  }

  return { totals, subProducts };
}

function applyOp(op, a, b) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b !== 0 ? a / b : a;
    default: return a + b;
  }
}

function applyAdd(op, total, value) {
  return op === '+' ? total + value : total - value;
}

export default function Tape({ tape, dispatch, editingId, onSelect, settings, previewEntry }) {
  const bottomRef = useRef(null);
  const { totals, subProducts } = computeRunningTotals(tape, settings?.calculationMode);

  // Compute # numbering for text entries
  const textCounts = {};
  const resolvedTexts = tape.map((entry) => {
    if (entry.op !== 'text' || !entry.text?.includes('#')) return null;
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
    const { totals: tempTotals } = computeRunningTotals(tempTape, settings?.calculationMode);
    previewTotal = tempTotals[tempTotals.length - 1];
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tape.length]);

  const fmt = settings?.numberFormat;

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
        <span className={styles.previewValue}>{formatNumber(previewEntry.value, fmt)}</span>
        <span />
        <span className={`${styles.previewTotal} ${isNeg ? styles.negative : styles.positive}`}>
          {previewTotal !== null ? formatNumber(previewTotal, fmt) : ''}
        </span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {tape.length === 0 && !previewEntry ? (
        <div className={styles.empty}>
          Enter a number below to start
        </div>
      ) : (
        <div className={styles.entries}>
          {tape.map((entry, i) => (
            <Fragment key={entry.id}>
              <TapeEntry
                entry={entry}
                resolvedText={resolvedTexts[i]}
                runningTotal={totals[i]}
                subProduct={subProducts[i]}
                dispatch={dispatch}
                isSelected={entry.id === editingId}
                onSelect={() => onSelect(entry.id === editingId ? null : entry.id)}
                settings={settings}
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
