import * as v from 'valibot';
import { AppStateSchema } from '../schemas/tape.js';
import { createDefaultState, migrateState } from '../../shared/defaults.js';

const STORAGE_KEY = 'many-tapes-calculator';

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    const migrated = migrateState(parsed);
    return v.parse(AppStateSchema, migrated);
  } catch {
    return createDefaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
