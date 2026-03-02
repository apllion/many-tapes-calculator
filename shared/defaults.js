import { generateId } from './ids.js';

export function createDefaultState() {
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

export function migrateKeys(obj) {
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
