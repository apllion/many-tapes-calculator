import { computeRunningTotals } from '../Tape/Tape.jsx';
import { formatNumber } from '../../lib/format.js';
import tapeStyles from '../Tape/Tape.module.css';
import entryStyles from '../TapeEntry/TapeEntry.module.css';

export default function SummaryTape({ summary, accounts, settings, dispatch }) {
  const fmt = settings?.numberFormat;
  const memberMap = {};
  (summary.members || []).forEach((m) => { memberMap[m.accountId] = m.sign; });

  let grandTotal = summary.startingValue || 0;

  const accountRows = accounts.map((account) => {
    const sign = memberMap[account.id] || null;
    const isMember = sign !== null;
    const { totals } = computeRunningTotals(account.tape);
    const subtotal = totals.length > 0 ? totals[totals.length - 1] : 0;
    const signedValue = sign === '-' ? -subtotal : subtotal;
    if (isMember) grandTotal += signedValue;
    const isNegative = signedValue < 0;

    return (
      <div
        key={account.id}
        className={`${entryStyles.row} ${entryStyles.subtotalRow}`}
        style={{
          cursor: 'pointer',
          borderTopWidth: 0,
          borderBottomWidth: 1,
          borderBottomStyle: 'solid',
          borderBottomColor: 'var(--color-border)',
          opacity: isMember ? 1 : 0.4,
        }}
        onClick={() => dispatch({ type: 'TOGGLE_SUMMARY_MEMBER', summaryId: summary.id, accountId: account.id })}
      >
        <span
          className={entryStyles.value}
          style={isMember && account.color ? { color: account.color, fontWeight: 700 } : { fontWeight: 700 }}
        >
          {isMember ? (sign === '-' ? '\u2212' : '+') + ' ' : ''}{account.name}
        </span>
        <span />
        <span className={`${entryStyles.total} ${entryStyles.subtotalValue} ${isNegative ? entryStyles.negative : entryStyles.positive}`}>
          {isMember ? formatNumber(signedValue, fmt) : formatNumber(subtotal, fmt)}
        </span>
      </div>
    );
  });

  const startingValue = summary.startingValue || 0;
  const totalNegative = grandTotal < 0;

  return (
    <div className={tapeStyles.container}>
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
        {accountRows}
        <div
          className={`${entryStyles.row} ${entryStyles.subtotalRow}`}
          style={{ cursor: 'default' }}
        >
          <span className={entryStyles.value} style={{ fontWeight: 700 }}>
            Total
          </span>
          <span className={entryStyles.eqOp}>=</span>
          <span className={`${entryStyles.total} ${entryStyles.subtotalValue} ${totalNegative ? entryStyles.negative : entryStyles.positive}`}>
            {formatNumber(grandTotal, fmt)}
          </span>
        </div>
      </div>
      {summary.members.length === 0 && (
        <div style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
          tap accounts to include
        </div>
      )}
    </div>
  );
}
