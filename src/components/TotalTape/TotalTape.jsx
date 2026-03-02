import { useEffect, useRef } from 'react';
import { computeRunningTotals } from '../../../shared/calculate.js';
import { formatNumber } from '../../lib/format.js';
import tapeStyles from '../Tape/Tape.module.css';
import entryStyles from '../TapeEntry/TapeEntry.module.css';

export default function TotalTape({ total, tapes, settings, dispatch, showDeselected }) {
  const containerRef = useRef(null);
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [total.id]);
  const fmt = settings?.numberFormat;
  const memberMap = {};
  (total.members || []).forEach((m) => { memberMap[m.accountId] = m.sign; });

  let grandTotal = total.startingValue || 0;

  const tapeRows = tapes.map((tape) => {
    const sign = memberMap[tape.id] || null;
    const isMember = sign !== null;
    if (!isMember && !showDeselected) return null;
    const { totals } = computeRunningTotals(tape.tape, settings?.calculationMode);
    const subtotal = totals.length > 0 ? totals[totals.length - 1] : 0;
    const signedValue = sign === '-' ? -subtotal : subtotal;
    if (isMember) grandTotal += signedValue;
    const isNegative = signedValue < 0;

    return (
      <div
        key={tape.id}
        className={`${entryStyles.row} ${entryStyles.subtotalRow}`}
        style={{
          cursor: 'pointer',
          borderTopWidth: 0,
          borderBottomWidth: 1,
          borderBottomStyle: 'solid',
          borderBottomColor: 'var(--color-border)',
          opacity: isMember ? 1 : 0.4,
        }}
        onClick={() => dispatch({ type: 'TOGGLE_TOTAL_MEMBER', totalId: total.id, tapeId: tape.id })}
      >
        <span
          className={entryStyles.value}
          style={isMember && tape.color ? { color: tape.color, fontWeight: 700 } : { fontWeight: 700 }}
        >
          {isMember ? (sign === '-' ? '\u2212' : '+') + ' ' : ''}{tape.name}
        </span>
        <span />
        <span className={`${entryStyles.total} ${entryStyles.subtotalValue} ${isNegative ? entryStyles.negative : entryStyles.positive}`}>
          {isMember ? formatNumber(signedValue, fmt) : formatNumber(subtotal, fmt)}
        </span>
      </div>
    );
  });

  const startingValue = total.startingValue || 0;
  const totalNegative = grandTotal < 0;

  return (
    <div className={tapeStyles.container} ref={containerRef}>
      <div className={tapeStyles.entries}>
        {startingValue !== 0 && (
          <div
            className={`${entryStyles.row} ${entryStyles.subtotalRow}`}
            style={{ cursor: 'default', borderTopWidth: 0, borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: 'var(--color-border)' }}
          >
            <span className={entryStyles.value} style={{ fontWeight: 700 }}>
              Start
            </span>
            <span />
            <span className={`${entryStyles.total} ${entryStyles.subtotalValue} ${startingValue < 0 ? entryStyles.negative : entryStyles.positive}`}>
              {formatNumber(startingValue, fmt)}
            </span>
          </div>
        )}
        {tapeRows}
        <div
          className={`${entryStyles.row} ${entryStyles.subtotalRow}`}
          style={{ cursor: 'default' }}
        >
          <span className={entryStyles.value} style={{ fontWeight: 700 }}>
            Total
          </span>
          <span />
          <span className={`${entryStyles.total} ${entryStyles.subtotalValue} ${totalNegative ? entryStyles.negative : entryStyles.positive}`}>
            {formatNumber(grandTotal, fmt)}
          </span>
        </div>
      </div>
      {total.members.length === 0 && (
        <div style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
          tap tapes to include
        </div>
      )}
    </div>
  );
}
