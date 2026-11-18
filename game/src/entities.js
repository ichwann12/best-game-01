// The things that live in the world, as plain objects: the player, each enemy kind, the
// two kinds of bullet, particles, floating score text and pickups. Nothing here knows about
// the loop or the screen — world.js moves them, render.js draws them.
import { ENEMY, FIELD, PLAYER } from './config.js';
import { range } from './random.js';

/** The player ship, fresh at the start of a run. `upgrades` counts the levels taken. */
export function newPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    r: PLAYER.r,
    hp: PLAYER.hp,
    maxHp: PLAYER.hp,
    speed: PLAYER.speed,
    fireTimer: 0,
    invuln: 0,
    spread: 1,
    fireInterval: PLAYER.fireInterval,
    pierce: 0,
    magnet: PLAYER.magnet,
    bombs: PLAYER.bombs,
    shield: 0,
    shieldMax: 0,
    upgrades: {},
    alive: true,
  };
}

/** An enemy of `kind` at (x, y); `wave` scales the boss. Mini-splitters come from `mini`. */
export function newEnemy(kind, x, y, wave) {
  const def = ENEMY[kind];
  const hp = kind === 'boss' ? def.hp + 45 * Math.max(0, wave / 5 - 1) : def.hp;
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    r: def.r,
    hp,
    maxHp: hp,
    speed: def.speed,
    score: def.score,
    contact: def.contact,
    hue: def.hue,
    fireTimer: 0, // world.js sets it from the seeded RNG on spawn
    t: 0,
    phase: 0,
    flash: 0,
    spawnT: 0,
  };
}

/** A player bullet flying at (vx, vy); `pierce` is how many more enemies it may pass through. */
export function newBullet(x, y, vx, vy, pierce) {
  return { x, y, vx, vy, r: 5, dmg: 1, pierce, life: 1.2, friendly: true, hue: 187 };
}

/** An enemy bullet flying at (vx, vy). */
export function newEnemyBullet(x, y, vx, vy) {
  return { x, y, vx, vy, r: 6, dmg: 10, life: 6, friendly: false, hue: 322 };
}

/** One spark of an explosion or a hit: fades and shrinks over `life` seconds. */
export function newParticle(x, y, vx, vy, life, size, hue) {
  return { x, y, vx, vy, life, maxLife: life, size, hue };
}

/** Floating score text that rises and fades. */
export function newFloater(x, y, text, hue, size) {
  return { x, y, text, hue, size: size || 16, life: 0.9, maxLife: 0.9 };
}

/** A pickup: 'gem' is score, 'health' restores hull. */
export function newPickup(kind, x, y, random) {
  return {
    kind,
    x,
    y,
    vx: range(random, -30, 30),
    vy: range(random, -30, 30),
    r: kind === 'health' ? 12 : 8,
    t: random() * Math.PI * 2,
  };
}
