// Keyboard and mouse, read as one input: held keys and the aim point every frame, and
// one-shot actions (confirm, pause, mute, restart, bomb, auto-fire, upgrade 1-3) that the
// caller drains with takeActions() so a press is answered exactly once.
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;
export const ACTION_BOMB = 16;
export const ACTION_AUTOFIRE = 32;
export const ACTION_UPGRADE_1 = 64;
export const ACTION_UPGRADE_2 = 128;
export const ACTION_UPGRADE_3 = 256;

const PAUSE_CODES = new Set(['KeyP', 'Escape']);
const CONFIRM_CODES = new Set(['Space', 'Enter']);

export function createInput(canvas) {
  const held = new Set();
  let edges = 0;
  const mouse = { x: FIELD.width / 2, y: FIELD.height / 2, down: false, clicked: false };
  let clicked = false;

  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * FIELD.width,
      y: ((clientY - rect.top) / rect.height) * FIELD.height,
    };
  }

  function mark(code) {
    if (PAUSE_CODES.has(code)) edges |= ACTION_PAUSE;
    else if (CONFIRM_CODES.has(code)) edges |= ACTION_CONFIRM;
    else if (code === 'KeyM') edges |= ACTION_MUTE;
    else if (code === 'KeyR') edges |= ACTION_RESTART;
    else if (code === 'KeyB') edges |= ACTION_BOMB;
    else if (code === 'KeyF') edges |= ACTION_AUTOFIRE;
    else if (code === 'Digit1' || code === 'Numpad1') edges |= ACTION_UPGRADE_1;
    else if (code === 'Digit2' || code === 'Numpad2') edges |= ACTION_UPGRADE_2;
    else if (code === 'Digit3' || code === 'Numpad3') edges |= ACTION_UPGRADE_3;
  }

  window.addEventListener('keydown', (event) => {
    if (CONFIRM_CODES.has(event.code) || event.code.startsWith('Arrow')) event.preventDefault();
    if (!event.repeat) {
      held.add(event.code);
      mark(event.code);
    }
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('mousemove', (event) => {
    const p = toLogical(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const p = toLogical(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    if (event.button === 0) {
      mouse.down = true;
      clicked = true;
    } else if (event.button === 2) {
      edges |= ACTION_BOMB;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  /** The movement vector this frame, from WASD or the arrow keys, normalised. */
  function direction() {
    let x = 0;
    let y = 0;
    if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
    if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
    if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
    if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  return {
    direction,
    aim: () => ({ x: mouse.x, y: mouse.y }),
    firing: () => mouse.down || held.has('Space'),
    /** Drain the one-shot actions pressed since the last call. A mouse click counts as confirm. */
    takeActions() {
      let actions = edges;
      edges = 0;
      if (clicked) {
        actions |= ACTION_CONFIRM;
        clicked = false;
      }
      return actions;
    },
  };
}
