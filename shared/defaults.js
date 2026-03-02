import { generateId } from './ids.js';

export const CURRENT_VERSION = 2;

export function createDefaultState() {
  const tapeId = generateId();
  return {
    version: CURRENT_VERSION,
    tapes: [
      {
        id: tapeId,
        name: 'Tape 1',
        tape: [],
        createdAt: Date.now(),
      },
    ],
    activeTapeId: tapeId,
  };
}

function migrateKeys(obj) {
  if (obj.accounts && !obj.tapes) {
    obj.tapes = obj.accounts;
    delete obj.accounts;
  }
  if ('activeAccountId' in obj && !('activeTapeId' in obj)) {
    obj.activeTapeId = obj.activeAccountId;
    delete obj.activeAccountId;
  }
  if (obj.summaries && !obj.totals) {
    obj.totals = obj.summaries;
    delete obj.summaries;
  }
  if ('activeSummaryId' in obj && !('activeTotalId' in obj)) {
    obj.activeTotalId = obj.activeSummaryId;
    delete obj.activeSummaryId;
  }
  return obj;
}

function migrate_0_to_1(state) {
  migrateKeys(state);
  state.version = 1;
}

function migrate_1_to_2(state) {
  const totals = state.totals || [];
  for (const total of totals) {
    state.tapes.push({
      id: total.id,
      name: total.name,
      tape: [],
      createdAt: Date.now(),
      color: total.color || null,
      totalConfig: {
        startingValue: total.startingValue || 0,
        members: total.members || [],
      },
    });
  }
  if (state.activeTotalId) {
    state.activeTapeId = state.activeTotalId;
  }
  delete state.totals;
  delete state.activeTotalId;
  state.version = 2;
}

export function migrateState(state) {
  if (!state.version) migrate_0_to_1(state);
  if (state.version === 1) migrate_1_to_2(state);
  return state;
}
