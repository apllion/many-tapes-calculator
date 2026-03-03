import { useEffect, useRef } from 'react';
import { computeRunningTotals } from '../../../shared/calculate.js';
import { formatNumber } from '../../lib/format.js';
import tapeStyles from '../Tape/Tape.module.css';
import entryStyles from '../TapeEntry/TapeEntry.module.css';

export default function TotalTape({ tape, tapes, settings, dispatch, showDeselected }) {
  const containerRef = useRef(null);
  const config = tape.totalConfig;
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [tape.id]);
  const fmt = settings?.numberFormat;
  const memberMap = {};
  (config.members || []).forEach((m) => { memberMap[m.accountId] = m.sign; });

  let grandTotal = config.startingValue || 0;

  // Filter out self from the member list
  const otherTapes = tapes.filter((t) => t.id !== tape.id);

  const tapeRows = otherTapes.map((t) => {
    const sign = memberMap[t.id] || null;
    const isMember = sign !== null;
    if (!isMember && !showDeselected) return null;
    const { totals } = computeRunningTotals(t.tape, settings?.calculationMode, settings?.operatorPosition);
    const subtotal = totals.length > 0 ? totals[totals.length - 1] : 0;
    const signedValue = sign === '-' ? -subtotal : subtotal;
    if (isMember) grandTotal += signedValue;
    const isNegative = signedValue < 0;

    return (
      <div
        key={t.id}
        className={`${entryStyles.row} ${entryStyles.subtotalRow}`}
        style={{
          cursor: 'pointer',
          borderTopWidth: 0,
          borderBottomWidth: 1,
          borderBottomStyle: 'solid',
          borderBottomColor: 'var(--color-border)',
          opacity: isMember ? 1 : 0.4,
        }}
        onClick={() => dispatch({ type: 'TOGGLE_TOTAL_MEMBER', totalTapeId: tape.id, tapeId: t.id })}
      >
        <span
          className={entryStyles.value}
          style={isMember && t.color ? { color: t.color, fontWeight: 700 } : { fontWeight: 700 }}
        >
          {isMember ? (sign === '-' ? '\u2212' : '+') + ' ' : ''}{t.name}
        </span>
        <span />
        <span className={`${entryStyles.total} ${entryStyles.subtotalValue} ${isNegative ? entryStyles.negative : entryStyles.positive}`}>
          {isMember ? formatNumber(signedValue, fmt) : formatNumber(subtotal, fmt)}
        </span>
      </div>
    );
  });

  const startingValue = config.startingValue || 0;
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
      {config.members.length === 0 && (
        <div style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
          tap tapes to include
        </div>
      )}
    </div>
  );
}
