// The best score, kept in localStorage so it survives a reload. Nothing else is stored:
// a run is a fresh start every time, and storage being off only loses the best score.
import { BEST_KEY } from './config.js';

export function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}
