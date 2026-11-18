// The screenshot scenes behind ?shot=start|play|upgrade|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (flee bullets, chase the nearest enemy, shoot it), so the frame is what a real game
// looks like and the same seed always gives the same frame. The play pilot dodges and
// survives; the end pilot charges in and never dodges, so it is caught out as a hurried
// player is.
import { STEP } from './config.js';
import { PHASE_OVER, PHASE_UPGRADE } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 58;
const UPGRADE_LIMIT_SECONDS = 150;
const END_LIMIT_SECONDS = 600;

/**
 * The autopilot's input for one step. `skill` 1 dodges bullets and keeps its distance;
 * 0.3 charges the nearest enemy and ignores bullets. `firing` false only steers (the
 * title backdrop never shoots).
 */
export function autopilot(state, skill, firing) {
  const p = state.player;
  let mx = 0;
  let my = 0;
  let aimX = p.x;
  let aimY = p.y - 100;
  let shoot = false;

  let ne = null;
  let nd = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < nd) {
      nd = d;
      ne = e;
    }
  }

  if (skill >= 1) {
    for (const b of state.ebullets) {
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 150) {
        const w = ((150 - d) / 150) * 2;
        mx += (dx / d) * w;
        my += (dy / d) * w;
      }
    }
    for (const e of state.enemies) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 90) {
        const w = ((90 - d) / 90) * 1.5;
        mx += (dx / d) * w;
        my += (dy / d) * w;
      }
    }
  }

  if (ne) {
    aimX = ne.x;
    aimY = ne.y;
    shoot = firing;
    const dx = ne.x - p.x;
    const dy = ne.y - p.y;
    const d = nd || 1;
    const want = skill >= 1 ? (d > 300 ? 0.8 : d < 160 ? -0.6 : 0) : 0.5;
    mx += (dx / d) * want;
    my += (dy / d) * want;
    if (skill >= 1) {
      mx += (-dy / d) * 0.4;
      my += (dx / d) * 0.4;
    }
  } else {
    mx += ((640 - p.x) / 640) * 0.3;
    my += ((360 - p.y) / 360) * 0.3;
  }
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  return { mx, my, aimX, aimY, firing: shoot, bomb: false, autoFire: false };
}

/** The title backdrop: the ship drifts in a slow loop while enemies wander in. */
export function demoInput(state) {
  const t = state.time;
  return {
    mx: Math.sin(t * 0.5) * 0.7,
    my: Math.cos(t * 0.37) * 0.7,
    aimX: state.player.x + Math.cos(t * 0.6) * 200,
    aimY: state.player.y + Math.sin(t * 0.6) * 200,
    firing: false,
    bomb: false,
    autoFire: false,
  };
}

/**
 * Set `world` to the named scene (start, play, upgrade or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'upgrade' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, demoInput(world.state), true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'upgrade') {
    for (let i = 0; i < UPGRADE_LIMIT_SECONDS / STEP; i += 1) {
      if (world.state.phase === PHASE_UPGRADE) break;
      if (world.state.phase === PHASE_OVER) break;
      world.step(STEP, autopilot(world.state, 1, true), false);
      if (world.state.phase === PHASE_UPGRADE) break;
    }
    return { screen: world.state.phase === PHASE_UPGRADE ? SCREEN_UPGRADE : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
      if (world.step(STEP, autopilot(world.state, 0.3, true), false) & 4) break;
      if (world.state.phase === PHASE_OVER) break;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  // play: 26 seconds of real play; take the first upgrade when a wave clears.
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
    if (world.state.phase === PHASE_UPGRADE && world.state.upgradeChoices.length > 0) {
      world.applyUpgrade(world.state.upgradeChoices[0].id);
    }
    if (world.state.phase === PHASE_OVER) break;
    world.step(STEP, autopilot(world.state, 1, true), false);
  }
  const over = world.state.phase === PHASE_OVER;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
