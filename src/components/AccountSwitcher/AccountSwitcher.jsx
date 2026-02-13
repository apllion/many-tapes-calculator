import styles from './AccountSwitcher.module.css';

export default function AccountSwitcher({ accounts, activeAccountId, summaries, activeSummaryId, dispatch }) {
  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        {accounts.map((account) => (
          <button
            key={account.id}
            className={`${styles.tab} ${!activeSummaryId && account.id === activeAccountId ? styles.active : ''}`}
            style={account.color ? ((!activeSummaryId && account.id === activeAccountId) ? { background: account.color } : { background: account.color + '30', color: account.color, borderBottom: `3px solid ${account.color}` }) : undefined}
            onClick={() => dispatch({ type: 'SET_ACTIVE', accountId: account.id })}
          >
            {account.name}
            {accounts.length > 1 && (
              <span
                className={styles.close}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'DELETE_ACCOUNT', accountId: account.id });
                }}
              >
                &times;
              </span>
            )}
          </button>
        ))}
        <button
          className={styles.addBtn}
          onClick={() => dispatch({ type: 'ADD_ACCOUNT' })}
          aria-label="Add account"
        >
          +
        </button>
        {summaries.map((summary) => (
          <button
            key={summary.id}
            className={`${styles.tab} ${styles.summaryTab} ${activeSummaryId === summary.id ? styles.active : ''}`}
            style={summary.color ? ((activeSummaryId === summary.id) ? { background: summary.color } : { background: summary.color + '30', color: summary.color, borderBottom: `3px solid ${summary.color}` }) : undefined}
            onClick={() => dispatch({ type: 'SET_ACTIVE_SUMMARY', summaryId: summary.id })}
          >
            &Sigma; {summary.name}
            <span
              className={styles.close}
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'DELETE_SUMMARY', summaryId: summary.id });
              }}
            >
              &times;
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
