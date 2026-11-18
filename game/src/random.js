// A small seeded generator (mulberry32) so a ?seed=N run is the same game every time:
// the same seed always deals the same waves, the same drops and the same screenshots.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number in [min, max). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** One element of `items`, uniformly. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

/** A shuffled copy of `items` (Fisher-Yates, in place on the copy). */
export function shuffle(random, items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}
