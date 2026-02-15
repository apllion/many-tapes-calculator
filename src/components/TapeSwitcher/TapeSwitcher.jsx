import { useRef } from 'react';
import styles from './TapeSwitcher.module.css';

export default function TapeSwitcher({ tapes, activeTapeId, totals, activeTotalId, dispatch }) {
  const longRef = useRef(null);

  function onCloseDown(action) {
    longRef.current = setTimeout(() => {
      longRef.current = 'fired';
      dispatch(action);
    }, 600);
  }
  function onCloseUp() {
    if (longRef.current === 'fired') {
      longRef.current = null;
      return;
    }
    clearTimeout(longRef.current);
    longRef.current = null;
  }
  function onCloseCancel() {
    clearTimeout(longRef.current);
    longRef.current = null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        {tapes.map((tape) => (
          <button
            key={tape.id}
            className={`${styles.tab} ${!activeTotalId && tape.id === activeTapeId ? styles.active : ''}`}
            style={tape.color ? ((!activeTotalId && tape.id === activeTapeId) ? { background: tape.color } : { background: tape.color + '30', color: tape.color, borderBottom: `3px solid ${tape.color}` }) : undefined}
            onClick={() => dispatch({ type: 'SET_ACTIVE', tapeId: tape.id })}
          >
            {tape.name}
            {tapes.length > 1 && (
              <span
                className={styles.close}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onCloseDown({ type: 'DELETE_TAPE', tapeId: tape.id });
                }}
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
        ))}
        <button
          className={styles.addBtn}
          onClick={() => dispatch({ type: 'ADD_TAPE' })}
          aria-label="Add tape"
        >
          +
        </button>
        {totals.map((total) => (
          <button
            key={total.id}
            className={`${styles.tab} ${styles.totalTab} ${activeTotalId === total.id ? styles.active : ''}`}
            style={total.color ? ((activeTotalId === total.id) ? { background: total.color } : { background: total.color + '30', color: total.color, borderBottom: `3px solid ${total.color}` }) : undefined}
            onClick={() => dispatch({ type: 'SET_ACTIVE_TOTAL', totalId: total.id })}
          >
            &Sigma; {total.name}
            <span
              className={styles.close}
              onPointerDown={(e) => {
                e.stopPropagation();
                onCloseDown({ type: 'DELETE_TOTAL', totalId: total.id });
              }}
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
        ))}
      </div>
    </div>
  );
}
