// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, upgrade, paused and game over.
//
// ?seed=N fixes the waves. ?shot=start|play|upgrade|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { readBest, saveBest } from './storage.js';
import {
  ACTION_AUTOFIRE,
  ACTION_BOMB,
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  ACTION_UPGRADE_1,
  ACTION_UPGRADE_2,
  ACTION_UPGRADE_3,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  createWorld,
  EVENT_BOMB,
  EVENT_BOSS,
  EVENT_HIT,
  EVENT_OVER,
  EVENT_PICKUP,
  EVENT_UPGRADE,
  EVENT_WAVE_CLEAR,
  PHASE_FIGHT,
  PHASE_UPGRADE,
} from './world.js';
import {
  createRenderer,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_UPGRADE,
} from './render.js';
import { getUpgradeCardRects } from './ui.js';
import { autopilot, demoInput, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, { x: -1, y: -1 });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let autoFire = false;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.wave();
    announce('Playing. Survive the waves.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    audio.gameOver();
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function pickUpgrade(index) {
    const choices = world.state.upgradeChoices;
    if (index < 0 || index >= choices.length) return;
    audio.click();
    world.applyUpgrade(choices[index].id);
    audio.upgrade();
    screen = SCREEN_PLAY;
    announce(`Upgrade taken: ${choices[index].name}. Wave ${world.state.wave}.`);
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      audio.unlock();
      announce(audio.toggleMute() ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_AUTOFIRE) {
      autoFire = !autoFire;
      announce(autoFire ? 'Auto-fire on.' : 'Auto-fire off.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_UPGRADE_1) pickUpgrade(0);
      else if (actions & ACTION_UPGRADE_2) pickUpgrade(1);
      else if (actions & ACTION_UPGRADE_3) pickUpgrade(2);
      else if (actions & ACTION_CONFIRM) {
        const aim = input.aim();
        const rects = getUpgradeCardRects();
        for (let i = 0; i < rects.length; i += 1) {
          const r = rects[i];
          if (aim.x >= r.x && aim.x <= r.x + r.w && aim.y >= r.y && aim.y <= r.y + r.h) {
            pickUpgrade(i);
            break;
          }
        }
      }
    } else if (screen === SCREEN_OVER) {
      if (actions & (ACTION_RESTART | ACTION_CONFIRM)) startGame();
    }
  }

  function react(events) {
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_BOSS) audio.boss();
    if (events & EVENT_BOMB) audio.explosion(true);
    if (events & EVENT_WAVE_CLEAR) audio.wave();
    if (events & EVENT_UPGRADE) audio.upgrade();
    if (events & EVENT_OVER) endGame();
  }

  function step(actions) {
    const dir = input.direction();
    const aim = input.aim();
    if (screen === SCREEN_TITLE) {
      world.step(STEP, demoInput(world.state), true);
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      world.step(STEP, { mx: dir.x, my: dir.y, aimX: aim.x, aimY: aim.y, firing: false, bomb: false, autoFire: false }, false);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(
      STEP,
      {
        mx: dir.x,
        my: dir.y,
        aimX: aim.x,
        aimY: aim.y,
        firing: input.firing(),
        bomb: (actions & ACTION_BOMB) !== 0,
        autoFire,
      },
      false,
    );
    react(events);
    if (world.state.phase === PHASE_UPGRADE && screen === SCREEN_PLAY) {
      screen = SCREEN_UPGRADE;
      announce('Wave cleared. Choose an upgrade.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_UPGRADE) {
      // One-shot actions (bomb, pause) belong to the first step only: a slow frame that
      // catches up on several steps must not spend two bombs on one key press.
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_UPGRADE)) {
        step(firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
        if (screen === SCREEN_UPGRADE) break;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, input.aim());
  }

  // Leaving the tab pauses a running game rather than letting enemies close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('NEON VOID. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
