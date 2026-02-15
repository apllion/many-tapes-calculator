import * as v from 'valibot';
import { AppStateSchema } from '../schemas/tape.js';
import { generateId } from './ids.js';

const STORAGE_KEY = 'many-tapes-calculator';

function createDefaultState() {
  const tapeId = generateId();
  return {
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

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    const migrated = migrateKeys(parsed);
    return v.parse(AppStateSchema, migrated);
  } catch {
    return createDefaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
