import { useReducer, useEffect } from 'react';
import { loadState, saveState } from '../lib/storage.js';
import { generateId } from '../lib/ids.js';

function mapActive(state, fn) {
  return {
    ...state,
    accounts: state.accounts.map((a) =>
      a.id === state.activeAccountId ? fn(a) : a
    ),
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_ENTRY':
      return mapActive(state, (a) => ({
        ...a,
        tape: [
          ...a.tape,
          {
            id: generateId(),
            op: action.op,
            value: action.value,
            ...(action.text !== undefined && { text: action.text }),
            timestamp: Date.now(),
          },
        ],
      }));

    case 'ADD_ENTRY_AND_TOTAL':
      return mapActive(state, (a) => ({
        ...a,
        tape: [
          ...a.tape,
          { id: generateId(), op: '+', value: action.value, timestamp: Date.now() },
          { id: generateId(), op: action.totalOp || '=', value: 0, timestamp: Date.now() },
        ],
      }));

    case 'INSERT_ENTRY':
      return mapActive(state, (a) => {
        const idx = a.tape.findIndex((e) => e.id === action.afterId);
        const newEntry = {
          id: generateId(),
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
      return mapActive(state, (a) => ({
        ...a,
        tape: a.tape.map((e) =>
          e.id === action.entryId ? { ...e, ...action.updates } : e
        ),
      }));

    case 'DELETE_ENTRY':
      return mapActive(state, (a) => ({
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
        accounts: state.accounts.map((a) => ({
          ...a,
          tape: [...a.tape, { ...entry, id: generateId(), timestamp: Date.now() }],
        })),
      };
    }

    case 'CLEAR_TAPE':
      return mapActive(state, (a) => ({ ...a, tape: [] }));

    case 'ADD_ACCOUNT': {
      const id = generateId();
      const name = `Account ${state.accounts.length + 1}`;
      return {
        ...state,
        accounts: [
          ...state.accounts,
          { id, name, tape: [], createdAt: Date.now() },
        ],
        activeAccountId: id,
      };
    }

    case 'DELETE_ACCOUNT': {
      if (state.accounts.length <= 1) return state;
      const remaining = state.accounts.filter((a) => a.id !== action.accountId);
      const needsSwitch = state.activeAccountId === action.accountId;
      return {
        ...state,
        accounts: remaining,
        activeAccountId: needsSwitch ? remaining[0].id : state.activeAccountId,
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

    case 'SET_ACTIVE':
      return { ...state, activeAccountId: action.accountId, activeSummaryId: null };

    case 'SET_SETTING':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } };

    case 'ADD_SUMMARY': {
      const id = generateId();
      const name = action.name || `Summary ${(state.summaries || []).length + 1}`;
      return {
        ...state,
        summaries: [...(state.summaries || []), { id, name, startingValue: 0, members: [] }],
        activeSummaryId: id,
      };
    }

    case 'DELETE_SUMMARY': {
      const summaries = (state.summaries || []).filter((s) => s.id !== action.summaryId);
      return {
        ...state,
        summaries,
        activeSummaryId: state.activeSummaryId === action.summaryId ? null : state.activeSummaryId,
      };
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

    case 'SET_ACTIVE_SUMMARY':
      return { ...state, activeSummaryId: action.summaryId };

    case 'LOAD_STATE':
      return action.state;

    default:
      return state;
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, null, loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const activeAccount = state.accounts.find(
    (a) => a.id === state.activeAccountId
  );

  const activeSummary = state.activeSummaryId
    ? (state.summaries || []).find((s) => s.id === state.activeSummaryId) || null
    : null;

  return { state, dispatch, activeAccount, activeSummary };
}
