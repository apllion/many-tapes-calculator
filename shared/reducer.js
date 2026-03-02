import { generateId } from './ids.js';

export function mapTape(state, tapeId, fn) {
  return {
    ...state,
    tapes: state.tapes.map((a) =>
      a.id === tapeId ? fn(a) : a
    ),
  };
}

// Actions that affect shared state (tapes, totals, settings)
export function sharedReducer(state, action) {
  switch (action.type) {
    case 'ADD_ENTRY':
      return mapTape(state, action.tapeId, (a) => ({
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
      return mapTape(state, action.tapeId, (a) => ({
        ...a,
        tape: [
          ...a.tape,
          { id: action.entryId, op: '+', value: action.value, ...(action.text !== undefined && { text: action.text }), timestamp: Date.now() },
          { id: action.totalEntryId, op: action.totalOp || '=', value: 0, timestamp: Date.now() },
        ],
      }));

    case 'INSERT_ENTRY':
      return mapTape(state, action.tapeId, (a) => {
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

    case 'MOVE_TAPE_LEFT': {
      const idx = state.tapes.findIndex((a) => a.id === action.tapeId);
      if (idx <= 0) return state;
      const tapes = [...state.tapes];
      [tapes[idx - 1], tapes[idx]] = [tapes[idx], tapes[idx - 1]];
      return { ...state, tapes };
    }

    case 'MOVE_TAPE_RIGHT': {
      const idx = state.tapes.findIndex((a) => a.id === action.tapeId);
      if (idx < 0 || idx >= state.tapes.length - 1) return state;
      const tapes = [...state.tapes];
      [tapes[idx], tapes[idx + 1]] = [tapes[idx + 1], tapes[idx]];
      return { ...state, tapes };
    }

    case 'UPDATE_ENTRY':
      return mapTape(state, action.tapeId, (a) => ({
        ...a,
        tape: a.tape.map((e) => {
          if (e.id !== action.entryId) return e;
          const updated = { ...e, ...action.updates };
          // Remove keys explicitly set to undefined (e.g. clearing text label)
          for (const k of Object.keys(action.updates)) {
            if (action.updates[k] === undefined) delete updated[k];
          }
          return updated;
        }),
      }));

    case 'DELETE_ENTRY':
      return mapTape(state, action.tapeId, (a) => ({
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
        tapes: state.tapes.map((a, i) => ({
          ...a,
          tape: [...a.tape, { ...entry, id: action.entryIds[i], timestamp: Date.now() }],
        })),
      };
    }

    case 'CLEAR_TAPE':
      return mapTape(state, action.tapeId, (a) => ({ ...a, tape: [] }));

    case 'ADD_TAPE': {
      const name = `Tape ${state.tapes.length + 1}`;
      return {
        ...state,
        tapes: [
          ...state.tapes,
          { id: action.id, name, tape: [], createdAt: Date.now() },
        ],
      };
    }

    case 'DELETE_TAPE': {
      if (state.tapes.length <= 1) return state;
      const remaining = state.tapes.filter((a) => a.id !== action.tapeId);
      return {
        ...state,
        tapes: remaining,
        totals: (state.totals || []).map((s) => ({
          ...s,
          members: s.members.filter((m) => m.accountId !== action.tapeId),
        })),
      };
    }

    case 'RENAME_TAPE':
      return {
        ...state,
        tapes: state.tapes.map((a) =>
          a.id === action.tapeId ? { ...a, name: action.name } : a
        ),
      };

    case 'SET_TAPE_COLOR':
      return {
        ...state,
        tapes: state.tapes.map((a) =>
          a.id === action.tapeId ? { ...a, color: action.color } : a
        ),
      };

    case 'SET_SETTING':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } };

    case 'SET_TEXT_STORE': {
      const stores = [...(state.settings?.textStores || [])];
      while (stores.length <= action.index) stores.push(null);
      stores[action.index] = action.text;
      return { ...state, settings: { ...state.settings, textStores: stores } };
    }

    case 'SET_SHORTCUT_STORE': {
      const stores = [...(state.settings?.shortcutStores || [])];
      while (stores.length <= action.index) stores.push(null);
      stores[action.index] = action.data;
      return { ...state, settings: { ...state.settings, shortcutStores: stores } };
    }

    case 'CLEAR_SHORTCUT_STORE': {
      const stores = [...(state.settings?.shortcutStores || [])];
      if (action.index < stores.length) stores[action.index] = null;
      return { ...state, settings: { ...state.settings, shortcutStores: stores } };
    }

    case 'ADD_TOTAL': {
      const name = action.name || `Total ${(state.totals || []).length + 1}`;
      return {
        ...state,
        totals: [...(state.totals || []), { id: action.id, name, startingValue: 0, members: [] }],
      };
    }

    case 'DELETE_TOTAL': {
      const totals = (state.totals || []).filter((s) => s.id !== action.totalId);
      return { ...state, totals };
    }

    case 'RENAME_TOTAL':
      return {
        ...state,
        totals: (state.totals || []).map((s) =>
          s.id === action.totalId ? { ...s, name: action.name } : s
        ),
      };

    case 'SET_TOTAL_STARTING_VALUE':
      return {
        ...state,
        totals: (state.totals || []).map((s) =>
          s.id === action.totalId ? { ...s, startingValue: action.value } : s
        ),
      };

    case 'TOGGLE_TOTAL_MEMBER': {
      return {
        ...state,
        totals: (state.totals || []).map((s) => {
          if (s.id !== action.totalId) return s;
          const existing = s.members.find((m) => m.accountId === action.tapeId);
          if (!existing) {
            return { ...s, members: [...s.members, { accountId: action.tapeId, sign: '+' }] };
          }
          if (existing.sign === '+') {
            return { ...s, members: s.members.map((m) => m.accountId === action.tapeId ? { ...m, sign: '-' } : m) };
          }
          return { ...s, members: s.members.filter((m) => m.accountId !== action.tapeId) };
        }),
      };
    }

    case 'MOVE_TOTAL_LEFT': {
      const totals = [...(state.totals || [])];
      const idx = totals.findIndex((s) => s.id === action.totalId);
      if (idx <= 0) return state;
      [totals[idx - 1], totals[idx]] = [totals[idx], totals[idx - 1]];
      return { ...state, totals };
    }

    case 'MOVE_TOTAL_RIGHT': {
      const totals = [...(state.totals || [])];
      const idx = totals.findIndex((s) => s.id === action.totalId);
      if (idx < 0 || idx >= totals.length - 1) return state;
      [totals[idx], totals[idx + 1]] = [totals[idx + 1], totals[idx]];
      return { ...state, totals };
    }

    case 'SET_TOTAL_COLOR':
      return {
        ...state,
        totals: (state.totals || []).map((s) =>
          s.id === action.totalId ? { ...s, color: action.color } : s
        ),
      };

    case 'SYNC_STATE':
      return {
        ...state,
        tapes: action.tapes,
        totals: action.totals,
        settings: action.settings,
      };

    case 'LOAD_STATE':
      return action.state;

    default:
      return state;
  }
}

// Actions that affect local view state (which tape/total the user is looking at)
export function localReducer(state, action) {
  switch (action.type) {
    case 'SET_ACTIVE':
      return { ...state, activeTapeId: action.tapeId, activeTotalId: null };

    case 'SET_ACTIVE_TOTAL':
      return { ...state, activeTotalId: action.totalId };

    case 'ADD_TAPE':
      return { ...state, activeTapeId: action.id };

    case 'ADD_TOTAL':
      return { ...state, activeTotalId: action.id };

    case 'DELETE_TAPE': {
      if (state.activeTapeId === action.tapeId) {
        const remaining = state.tapes.filter((a) => a.id !== action.tapeId);
        return { ...state, activeTapeId: remaining.length > 0 ? remaining[0].id : state.activeTapeId };
      }
      return state;
    }

    case 'DELETE_TOTAL':
      if (state.activeTotalId === action.totalId) {
        return { ...state, activeTotalId: null };
      }
      return state;

    case 'LOAD_STATE':
      return state; // LOAD_STATE fully replaces via sharedReducer, including activeTapeId

    default:
      return state;
  }
}

export function fixDanglingPointers(state) {
  let next = state;
  const tapeIds = new Set(state.tapes.map((a) => a.id));
  const totalIds = new Set((state.totals || []).map((s) => s.id));
  if (!tapeIds.has(next.activeTapeId)) {
    next = { ...next, activeTapeId: state.tapes[0].id };
  }
  if (next.activeTotalId && !totalIds.has(next.activeTotalId)) {
    next = { ...next, activeTotalId: null };
  }
  return next;
}

export function reducer(state, action) {
  let next = sharedReducer(state, action);
  // Remote actions skip local view changes (each peer controls their own view)
  if (!action._remote) {
    next = localReducer(next, action);
  }
  // Always fix dangling pointers after any state change
  next = fixDanglingPointers(next);
  return next;
}

// Enrich an action with tapeId and pre-generated IDs before dispatch
export function enrichAction(action, state) {
  const enriched = { ...action };

  // Auto-populate tapeId for actions that target the active tape
  const needsTapeId = [
    'ADD_ENTRY', 'ADD_ENTRY_AND_TOTAL', 'INSERT_ENTRY',
    'UPDATE_ENTRY', 'DELETE_ENTRY', 'CLEAR_TAPE',
  ];
  if (needsTapeId.includes(action.type) && !action.tapeId) {
    enriched.tapeId = state.activeTapeId;
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
        enriched.entryIds = state.tapes.map(() => generateId());
      }
      break;
    case 'ADD_TAPE':
      if (!enriched.id) enriched.id = generateId();
      break;
    case 'ADD_TOTAL':
      if (!enriched.id) enriched.id = generateId();
      break;
  }

  return enriched;
}
