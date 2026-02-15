import { generateId } from './ids.js';

const SAVES_KEY = 'many-tapes-calculator-saves';
const AUTOSAVES_KEY = 'many-tapes-calculator-autosaves';
const MAX_AUTOSAVES = 3;

function readAll() {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(saves) {
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
}

export function loadSaves() {
  return readAll().map(({ id, name, timestamp }) => ({ id, name, timestamp }));
}

export function getSave(id) {
  return readAll().find((s) => s.id === id) || null;
}

export function addSave(name, state) {
  const saves = readAll();
  const save = { id: generateId(), name, timestamp: Date.now(), state };
  saves.unshift(save);
  writeAll(saves);
  return { id: save.id, name: save.name, timestamp: save.timestamp };
}

export function deleteSave(id) {
  const saves = readAll().filter((s) => s.id !== id);
  writeAll(saves);
}

export function renameSave(id, name) {
  const saves = readAll();
  const save = saves.find((s) => s.id === id);
  if (save) {
    save.name = name;
    writeAll(saves);
  }
}

function readAllAutosaves() {
  try {
    const raw = localStorage.getItem(AUTOSAVES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAllAutosaves(autosaves) {
  localStorage.setItem(AUTOSAVES_KEY, JSON.stringify(autosaves));
}

export function addAutosave(state) {
  const autosaves = readAllAutosaves();
  const entry = { id: generateId(), name: 'Auto', timestamp: Date.now(), state };
  autosaves.unshift(entry);
  writeAllAutosaves(autosaves.slice(0, MAX_AUTOSAVES));
}

export function loadAutosaves() {
  return readAllAutosaves().map(({ id, name, timestamp }) => ({ id, name, timestamp }));
}

export function getAutosave(id) {
  return readAllAutosaves().find((s) => s.id === id) || null;
}
