import { safeSave } from './simulation.js';

const KEY = 'one-more-in-save-v1';

export function loadSave() {
  try {
    return safeSave(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return safeSave(null);
  }
}

export function storeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(safeSave(save)));
  } catch {
    // Private browsing may deny storage. The session remains fully playable.
  }
}
