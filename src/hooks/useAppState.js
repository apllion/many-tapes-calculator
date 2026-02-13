import { useReducer, useEffect } from 'react';
import { loadState, saveState } from '../lib/storage.js';
import { generateId } from '../lib/ids.js';

function mapAccount(state, accountId, fn) {
  return {
    ...state,
    accounts: state.accounts.map((a) =>
      a.id === accountId ? fn(a) : a
    ),
  };
}

// Actions that affect shared state (accounts, summaries, settings)
function sharedReducer(state, action) {
  switch (action.type) {
    case 'ADD_ENTRY':
      return mapAccount(state, action.accountId, (a) => ({
        ...a,
        tape: [
          ...a.tape,
          {
            id: action.entryId,
            op: action.op,
            value: action.value,
            ...(action.text !== undefined && { text: action.text }),
            timestamp: Date.now(),
          },
        ],
      }));

    case 'ADD_ENTRY_AND_TOTAL':
      return mapAccount(state, action.accountId, (a) => ({
        ...a,
        tape: [
          ...a.tape,
          { id: action.entryId, op: '+', value: action.value, timestamp: Date.now() },
          { id: action.totalEntryId, op: action.totalOp || '=', value: 0, timestamp: Date.now() },
        ],
      }));

    case 'INSERT_ENTRY':
      return mapAccount(state, action.accountId, (a) => {
        const idx = a.tape.findIndex((e) => e.id === action.afterId);
        const newEntry = {
          id: action.entryId,
          op: action.op,
          value: action.value,
          ...(action.text !== undefined && { text: action.text }),
          timestamp: Date.now(),
        };
        const tape = [...a.tape];
        tape.splice(idx + 1, 0, newEntry);
        return { ...a, tape };
      });

    case 'MOVE_ACCOUNT_LEFT': {
      const idx = state.accounts.findIndex((a) => a.id === action.accountId);
      if (idx <= 0) return state;
      const accounts = [...state.accounts];
      [accounts[idx - 1], accounts[idx]] = [accounts[idx], accounts[idx - 1]];
      return { ...state, accounts };
    }

    case 'MOVE_ACCOUNT_RIGHT': {
      const idx = state.accounts.findIndex((a) => a.id === action.accountId);
      if (idx < 0 || idx >= state.accounts.length - 1) return state;
      const accounts = [...state.accounts];
      [accounts[idx], accounts[idx + 1]] = [accounts[idx + 1], accounts[idx]];
      return { ...state, accounts };
    }

    case 'UPDATE_ENTRY':
      return mapAccount(state, action.accountId, (a) => ({
        ...a,
        tape: a.tape.map((e) =>
          e.id === action.entryId ? { ...e, ...action.updates } : e
        ),
      }));

    case 'DELETE_ENTRY':
      return mapAccount(state, action.accountId, (a) => ({
        ...a,
        tape: a.tape.filter((e) => e.id !== action.entryId),
      }));

    case 'ADD_ENTRY_ALL': {
      const entry = {
        op: action.op,
        value: action.value,
        ...(action.text !== undefined && { text: action.text }),
      };
      return {
        ...state,
        accounts: state.accounts.map((a, i) => ({
          ...a,
          tape: [...a.tape, { ...entry, id: action.entryIds[i], timestamp: Date.now() }],
        })),
      };
    }

    case 'CLEAR_TAPE':
      return mapAccount(state, action.accountId, (a) => ({ ...a, tape: [] }));

    case 'ADD_ACCOUNT': {
      const name = `Account ${state.accounts.length + 1}`;
      return {
        ...state,
        accounts: [
          ...state.accounts,
          { id: action.id, name, tape: [], createdAt: Date.now() },
        ],
      };
    }

    case 'DELETE_ACCOUNT': {
      if (state.accounts.length <= 1) return state;
      const remaining = state.accounts.filter((a) => a.id !== action.accountId);
      return {
        ...state,
        accounts: remaining,
        summaries: (state.summaries || []).map((s) => ({
          ...s,
          members: s.members.filter((m) => m.accountId !== action.accountId),
        })),
      };
    }

    case 'RENAME_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.accountId ? { ...a, name: action.name } : a
        ),
      };

    case 'SET_ACCOUNT_COLOR':
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.accountId ? { ...a, color: action.color } : a
        ),
      };

    case 'SET_SETTING':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } };

    case 'ADD_SUMMARY': {
      const name = action.name || `Summary ${(state.summaries || []).length + 1}`;
      return {
        ...state,
        summaries: [...(state.summaries || []), { id: action.id, name, startingValue: 0, members: [] }],
      };
    }

    case 'DELETE_SUMMARY': {
      const summaries = (state.summaries || []).filter((s) => s.id !== action.summaryId);
      return { ...state, summaries };
    }

    case 'RENAME_SUMMARY':
      return {
        ...state,
        summaries: (state.summaries || []).map((s) =>
          s.id === action.summaryId ? { ...s, name: action.name } : s
        ),
      };

    case 'SET_SUMMARY_STARTING_VALUE':
      return {
        ...state,
        summaries: (state.summaries || []).map((s) =>
          s.id === action.summaryId ? { ...s, startingValue: action.value } : s
        ),
      };

    case 'TOGGLE_SUMMARY_MEMBER': {
      return {
        ...state,
        summaries: (state.summaries || []).map((s) => {
          if (s.id !== action.summaryId) return s;
          const existing = s.members.find((m) => m.accountId === action.accountId);
          if (!existing) {
            return { ...s, members: [...s.members, { accountId: action.accountId, sign: '+' }] };
          }
          if (existing.sign === '+') {
            return { ...s, members: s.members.map((m) => m.accountId === action.accountId ? { ...m, sign: '-' } : m) };
          }
          return { ...s, members: s.members.filter((m) => m.accountId !== action.accountId) };
        }),
      };
    }

    case 'MOVE_SUMMARY_LEFT': {
      const summaries = [...(state.summaries || [])];
      const idx = summaries.findIndex((s) => s.id === action.summaryId);
      if (idx <= 0) return state;
      [summaries[idx - 1], summaries[idx]] = [summaries[idx], summaries[idx - 1]];
      return { ...state, summaries };
    }

    case 'MOVE_SUMMARY_RIGHT': {
      const summaries = [...(state.summaries || [])];
      const idx = summaries.findIndex((s) => s.id === action.summaryId);
      if (idx < 0 || idx >= summaries.length - 1) return state;
      [summaries[idx], summaries[idx + 1]] = [summaries[idx + 1], summaries[idx]];
      return { ...state, summaries };
    }

    case 'SET_SUMMARY_COLOR':
      return {
        ...state,
        summaries: (state.summaries || []).map((s) =>
          s.id === action.summaryId ? { ...s, color: action.color } : s
        ),
      };

    case 'SYNC_STATE':
      return {
        ...state,
        accounts: action.accounts,
        summaries: action.summaries,
        settings: action.settings,
      };

    case 'LOAD_STATE':
      return action.state;

    default:
      return state;
  }
}

// Actions that affect local view state (which account/summary the user is looking at)
function localReducer(state, action) {
  switch (action.type) {
    case 'SET_ACTIVE':
      return { ...state, activeAccountId: action.accountId, activeSummaryId: null };

    case 'SET_ACTIVE_SUMMARY':
      return { ...state, activeSummaryId: action.summaryId };

    case 'ADD_ACCOUNT':
      return { ...state, activeAccountId: action.id };

    case 'ADD_SUMMARY':
      return { ...state, activeSummaryId: action.id };

    case 'DELETE_ACCOUNT': {
      if (state.activeAccountId === action.accountId) {
        const remaining = state.accounts.filter((a) => a.id !== action.accountId);
        return { ...state, activeAccountId: remaining.length > 0 ? remaining[0].id : state.activeAccountId };
      }
      return state;
    }

    case 'DELETE_SUMMARY':
      if (state.activeSummaryId === action.summaryId) {
        return { ...state, activeSummaryId: null };
      }
      return state;

    case 'SYNC_STATE': {
      // Fix dangling pointers after receiving remote state
      const accountIds = new Set(state.accounts.map((a) => a.id));
      const summaryIds = new Set((state.summaries || []).map((s) => s.id));
      let next = state;
      if (!accountIds.has(next.activeAccountId)) {
        next = { ...next, activeAccountId: state.accounts[0].id };
      }
      if (next.activeSummaryId && !summaryIds.has(next.activeSummaryId)) {
        next = { ...next, activeSummaryId: null };
      }
      return next;
    }

    case 'LOAD_STATE':
      return state; // LOAD_STATE fully replaces via sharedReducer, including activeAccountId

    default:
      return state;
  }
}

function reducer(state, action) {
  let next = sharedReducer(state, action);
  // Remote actions skip local view changes (each peer controls their own view)
  if (!action._remote) {
    next = localReducer(next, action);
  } else if (action.type === 'SYNC_STATE') {
    // SYNC_STATE always fixes dangling pointers, even from remote
    next = localReducer(next, action);
  }
  return next;
}

// Enrich an action with accountId and pre-generated IDs before dispatch
export function enrichAction(action, state) {
  const enriched = { ...action };

  // Auto-populate accountId for actions that target the active account
  const needsAccountId = [
    'ADD_ENTRY', 'ADD_ENTRY_AND_TOTAL', 'INSERT_ENTRY',
    'UPDATE_ENTRY', 'DELETE_ENTRY', 'CLEAR_TAPE',
  ];
  if (needsAccountId.includes(action.type) && !action.accountId) {
    enriched.accountId = state.activeAccountId;
  }

  // Pre-generate IDs for actions that create entities
  switch (action.type) {
    case 'ADD_ENTRY':
    case 'INSERT_ENTRY':
      if (!enriched.entryId) enriched.entryId = generateId();
      break;
    case 'ADD_ENTRY_AND_TOTAL':
      if (!enriched.entryId) enriched.entryId = generateId();
      if (!enriched.totalEntryId) enriched.totalEntryId = generateId();
      break;
    case 'ADD_ENTRY_ALL':
      if (!enriched.entryIds) {
        enriched.entryIds = state.accounts.map(() => generateId());
      }
      break;
    case 'ADD_ACCOUNT':
      if (!enriched.id) enriched.id = generateId();
      break;
    case 'ADD_SUMMARY':
      if (!enriched.id) enriched.id = generateId();
      break;
  }

  return enriched;
}

export function useAppState() {
  const [state, rawDispatch] = useReducer(reducer, null, loadState);

  // Enriching dispatch: auto-populates accountId and pre-generates IDs
  function dispatch(action) {
    rawDispatch(enrichAction(action, state));
  }

  useEffect(() => {
    saveState(state);
  }, [state]);

  const activeAccount = state.accounts.find(
    (a) => a.id === state.activeAccountId
  );

  const activeSummary = state.activeSummaryId
    ? (state.summaries || []).find((s) => s.id === state.activeSummaryId) || null
    : null;

  return { state, dispatch, rawDispatch, activeAccount, activeSummary };
}
