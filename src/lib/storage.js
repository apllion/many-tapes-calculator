import * as v from 'valibot';
import { AppStateSchema } from '../schemas/account.js';
import { generateId } from './ids.js';

const STORAGE_KEY = 'many-tapes-calculator';

function createDefaultState() {
  const accountId = generateId();
  return {
    accounts: [
      {
        id: accountId,
        name: 'Account 1',
        tape: [],
        createdAt: Date.now(),
      },
    ],
    activeAccountId: accountId,
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    return v.parse(AppStateSchema, parsed);
  } catch {
    return createDefaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
