import { generateId } from './ids.js';

export function mapTape(state, tapeId, fn) {
  return {
    ...state,
    tapes: state.tapes.map((a) =>
      a.id === tapeId ? fn(a) : a
    ),
  };
}

// Actions that affect shared state (tapes, settings)
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

    case 'MOVE_ENTRY_UP':
      return mapTape(state, action.tapeId, (a) => {
        const idx = a.tape.findIndex((e) => e.id === action.entryId);
        if (idx <= 0) return a;
        const tape = [...a.tape];
        [tape[idx - 1], tape[idx]] = [tape[idx], tape[idx - 1]];
        return { ...a, tape };
      });

    case 'MOVE_ENTRY_DOWN':
      return mapTape(state, action.tapeId, (a) => {
        const idx = a.tape.findIndex((e) => e.id === action.entryId);
        if (idx < 0 || idx >= a.tape.length - 1) return a;
        const tape = [...a.tape];
        [tape[idx], tape[idx + 1]] = [tape[idx + 1], tape[idx]];
        return { ...a, tape };
      });

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

    case 'SET_TAPE_ENTRIES':
      return mapTape(state, action.tapeId, (a) => ({ ...a, tape: action.entries }));

    case 'ADD_TAPE': {
      const isTotal = !!action.totalConfig;
      const plainCount = state.tapes.filter((t) => !t.totalConfig).length;
      const totalCount = state.tapes.filter((t) => !!t.totalConfig).length;
      const name = isTotal ? `Total ${totalCount + 1}` : `Tape ${plainCount + 1}`;
      return {
        ...state,
        tapes: [
          ...state.tapes,
          {
            id: action.id,
            name,
            tape: [],
            createdAt: Date.now(),
            ...(action.totalConfig ? { totalConfig: action.totalConfig } : {}),
          },
        ],
      };
    }

    case 'DELETE_TAPE': {
      if (state.tapes.length <= 1) return state;
      const remaining = state.tapes.filter((a) => a.id !== action.tapeId);
      // Clean up totalConfig members referencing deleted tape
      return {
        ...state,
        tapes: remaining.map((t) =>
          t.totalConfig
            ? { ...t, totalConfig: { ...t.totalConfig, members: t.totalConfig.members.filter((m) => m.accountId !== action.tapeId) } }
            : t
        ),
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

    case 'SET_TOTAL_STARTING_VALUE':
      return mapTape(state, action.tapeId, (t) => ({
        ...t,
        totalConfig: { ...t.totalConfig, startingValue: action.value },
      }));

    case 'TOGGLE_TOTAL_MEMBER': {
      return mapTape(state, action.totalTapeId, (t) => {
        const members = t.totalConfig?.members || [];
        const existing = members.find((m) => m.accountId === action.tapeId);
        let newMembers;
        if (!existing) {
          newMembers = [...members, { accountId: action.tapeId, sign: '+' }];
        } else if (existing.sign === '+') {
          newMembers = members.map((m) => m.accountId === action.tapeId ? { ...m, sign: '-' } : m);
        } else {
          newMembers = members.filter((m) => m.accountId !== action.tapeId);
        }
        return { ...t, totalConfig: { ...t.totalConfig, members: newMembers } };
      });
    }

    case 'SYNC_STATE':
      return {
        ...state,
        tapes: action.tapes,
        settings: action.settings,
        lastModified: action.lastModified || state.lastModified,
      };

    case 'LOAD_STATE':
      return action.state;

    default:
      return state;
  }
}

// Actions that affect local view state (which tape the user is looking at)
export function localReducer(state, action) {
  switch (action.type) {
    case 'SET_ACTIVE':
      return { ...state, activeTapeId: action.tapeId };

    case 'ADD_TAPE':
      return { ...state, activeTapeId: action.id };

    case 'DELETE_TAPE': {
      if (state.activeTapeId === action.tapeId) {
        const remaining = state.tapes.filter((a) => a.id !== action.tapeId);
        return { ...state, activeTapeId: remaining.length > 0 ? remaining[0].id : state.activeTapeId };
      }
      return state;
    }

    case 'LOAD_STATE':
      return state; // LOAD_STATE fully replaces via sharedReducer, including activeTapeId

    default:
      return state;
  }
}

export function fixDanglingPointers(state) {
  let next = state;
  const tapeIds = new Set(state.tapes.map((a) => a.id));
  if (!tapeIds.has(next.activeTapeId)) {
    next = { ...next, activeTapeId: state.tapes[0].id };
  }
  return next;
}

export function reducer(state, action) {
  const shared = sharedReducer(state, action);
  let next = shared;
  // Remote actions skip local view changes (each peer controls their own view)
  if (!action._remote) {
    next = localReducer(next, action);
  }
  // Always fix dangling pointers after any state change
  next = fixDanglingPointers(next);
  // Stamp lastModified when shared state changed from a local action
  if (!action._remote && shared !== state) {
    next = { ...next, lastModified: Date.now() };
  }
  return next;
}

// Enrich an action with tapeId and pre-generated IDs before dispatch
export function enrichAction(action, state) {
  const enriched = { ...action };

  // Auto-populate tapeId for actions that target the active tape
  const needsTapeId = [
    'ADD_ENTRY', 'ADD_ENTRY_AND_TOTAL', 'INSERT_ENTRY',
    'UPDATE_ENTRY', 'DELETE_ENTRY', 'MOVE_ENTRY_UP', 'MOVE_ENTRY_DOWN',
    'CLEAR_TAPE', 'SET_TAPE_ENTRIES', 'SET_TOTAL_STARTING_VALUE',
  ];
  if (needsTapeId.includes(action.type) && !action.tapeId) {
    enriched.tapeId = state.activeTapeId;
  }
  // TOGGLE_TOTAL_MEMBER uses totalTapeId (the total-type tape being modified)
  if (action.type === 'TOGGLE_TOTAL_MEMBER' && !action.totalTapeId) {
    enriched.totalTapeId = state.activeTapeId;
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
  }

  return enriched;
}
