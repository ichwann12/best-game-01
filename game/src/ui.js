// The screens and the HUD, drawn on the canvas: the title, the between-wave upgrade
// choice, pause and game over, the wave banner and the in-play HUD. Nothing here moves the
// game — render.js calls these over the world it already drew.
import { COLORS, FIELD } from './config.js';

const TITLE_FONT = '"Arial Black", "Segoe UI", sans-serif';
const BODY_FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

function text(ctx, str, x, y, font, color, align = 'center', glow = 0, glowColor = color) {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (glow > 0) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glow;
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.shadowBlur = 0;
}

function panel(ctx, x, y, w, h, border, fill = 'rgba(6, 10, 28, 0.88)') {
  ctx.fillStyle = fill;
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();
}

/** The three upgrade cards, laid out from the field size alone — main.js uses the same
 * rects to answer clicks, so the picture and the hit areas can never drift apart. */
export function getUpgradeCardRects() {
  const w = 340;
  const h = 240;
  const gap = 30;
  const total = w * 3 + gap * 2;
  const x0 = (FIELD.width - total) / 2;
  const y = 250;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

export function drawHud(ctx, state, best) {
  const p = state.player;
  const cx = FIELD.width / 2;
  // Score, top left.
  text(ctx, `SCORE ${String(state.score).padStart(6, '0')}`, 24, 30, `700 26px ${BODY_FONT}`, COLORS.text, 'left', 8, COLORS.player);
  text(ctx, `BEST ${Math.max(best, state.score)}`, 24, 58, `600 15px ${BODY_FONT}`, COLORS.dim, 'left');
  // Wave, top centre.
  text(ctx, `WAVE ${state.wave}`, cx, 30, `700 26px ${BODY_FONT}`, COLORS.text, 'center', 8, COLORS.player);
  // Combo, top right.
  if (state.combo >= 2) {
    const mult = Math.min(5, 1 + Math.floor(state.combo / 8));
    text(ctx, `COMBO x${mult}  (${state.combo})`, FIELD.width - 24, 30, `700 24px ${BODY_FONT}`, '#ffe600', 'right', 10, '#ffe600');
  }
  text(ctx, `KILLS ${state.kills}`, FIELD.width - 24, 58, `600 15px ${BODY_FONT}`, COLORS.dim, 'right');
  // Boss bar.
  if (state.boss) {
    const bw = 440;
    const bx = cx - bw / 2;
    const by = 62;
    text(ctx, 'VOID WARDEN', cx, by - 4, `700 15px ${BODY_FONT}`, '#ff5c8a', 'center', 8, '#ff2d78');
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(bx, by + 8, bw, 12);
    ctx.fillStyle = '#ff2d78';
    ctx.fillRect(bx, by + 8, bw * Math.max(0, state.boss.hp / state.boss.maxHp), 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by + 8, bw, 12);
  }
  // Hull bar, bottom left.
  const hw = 260;
  const hx = 24;
  const hy = FIELD.height - 44;
  text(ctx, 'HULL', hx, hy - 14, `700 13px ${BODY_FONT}`, COLORS.dim, 'left');
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(hx, hy, hw, 16);
  const frac = Math.max(0, p.hp / p.maxHp);
  ctx.fillStyle = frac > 0.5 ? '#3dff7a' : frac > 0.25 ? '#ffb347' : '#ff3b30';
  ctx.fillRect(hx, hy, hw * frac, 16);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(hx, hy, hw, 16);
  // Shield pips and bombs, under the hull bar.
  let sx = hx;
  for (let i = 0; i < p.shieldMax; i += 1) {
    ctx.beginPath();
    ctx.arc(sx + 8, hy + 34, 7, 0, Math.PI * 2);
    ctx.fillStyle = i < p.shield ? COLORS.shield : 'rgba(255,255,255,0.15)';
    ctx.fill();
    sx += 20;
  }
  if (p.bombs > 0) text(ctx, `BOMBS ${p.bombs}  [B]`, hx + 8, hy + 34, `700 14px ${BODY_FONT}`, COLORS.bomb, 'left', 6, COLORS.bomb);
  // Upgrade icons, bottom right.
  const owned = Object.entries(p.upgrades);
  let ux = FIELD.width - 24;
  for (let i = owned.length - 1; i >= 0; i -= 1) {
    const [id, level] = owned[i];
    const label = id.slice(0, 2).toUpperCase();
    ctx.fillStyle = 'rgba(0, 240, 255, 0.16)';
    ctx.strokeStyle = COLORS.player;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(ux - 34, FIELD.height - 52, 34, 34, 6);
    ctx.fill();
    ctx.stroke();
    text(ctx, label, ux - 17, FIELD.height - 40, `700 13px ${BODY_FONT}`, COLORS.text, 'center');
    text(ctx, `${level}`, ux - 17, FIELD.height - 22, `600 11px ${BODY_FONT}`, COLORS.dim, 'center');
    ux -= 42;
  }
  if (owned.length > 0) text(ctx, 'UPGRADES', FIELD.width - 24, FIELD.height - 62, `600 11px ${BODY_FONT}`, COLORS.dim, 'right');
}

export function drawWaveBanner(ctx, state) {
  const total = 2.2;
  const t = 1 - state.phaseTimer / total;
  const alpha = t < 0.15 ? t / 0.15 : t > 0.75 ? Math.max(0, 1 - (t - 0.75) / 0.25) : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  text(ctx, `WAVE ${state.wave}`, FIELD.width / 2, FIELD.height / 2 - 40, `900 84px ${TITLE_FONT}`, COLORS.text, 'center', 30, COLORS.player);
  if (state.wave % 5 === 0) {
    text(ctx, 'WARNING — VOID WARDEN APPROACHES', FIELD.width / 2, FIELD.height / 2 + 30, `700 24px ${BODY_FONT}`, '#ff5c8a', 'center', 14, '#ff2d78');
  } else {
    text(ctx, 'SURVIVE THE VOID', FIELD.width / 2, FIELD.height / 2 + 30, `700 22px ${BODY_FONT}`, COLORS.dim, 'center');
  }
  ctx.restore();
}

export function drawTitle(ctx, state, best) {
  ctx.fillStyle = 'rgba(4, 5, 13, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const cx = FIELD.width / 2;
  const pulse = 0.65 + 0.35 * Math.sin(state.time * 4);
  text(ctx, 'NEON VOID', cx, 168, `900 96px ${TITLE_FONT}`, '#e8ffff', 'center', 36, COLORS.player);
  text(ctx, 'T W I N - S T I C K   A R E N A   S H O O T E R', cx, 232, `700 20px ${BODY_FONT}`, COLORS.player, 'center', 10, COLORS.player);
  if (best > 0) text(ctx, `BEST SCORE  ${best}`, cx, 278, `700 20px ${BODY_FONT}`, '#ffe600', 'center', 8, '#ffe600');
  // Controls.
  panel(ctx, cx - 300, 320, 600, 208, 'rgba(0, 240, 255, 0.5)');
  text(ctx, 'HOW TO PLAY', cx, 348, `700 17px ${BODY_FONT}`, COLORS.text, 'center');
  const lines = [
    'WASD / ARROWS — MOVE      MOUSE — AIM',
    'HOLD CLICK / SPACE — FIRE      F — AUTO-FIRE',
    'B — NOVA BOMB      P — PAUSE      M — MUTE',
    'Clear each wave, pick an upgrade, beat the boss',
    'every 5 waves. One hull, no second chances.',
  ];
  lines.forEach((line, i) => {
    text(ctx, line, cx, 382 + i * 28, `600 16px ${BODY_FONT}`, COLORS.dim, 'center');
  });
  ctx.save();
  ctx.globalAlpha = pulse;
  text(ctx, 'CLICK OR PRESS SPACE TO START', cx, 580, `700 26px ${BODY_FONT}`, COLORS.text, 'center', 12, COLORS.player);
  ctx.restore();
}

export function drawUpgrade(ctx, state, mouse) {
  ctx.fillStyle = 'rgba(4, 5, 13, 0.74)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const cx = FIELD.width / 2;
  text(ctx, `WAVE ${state.wave} CLEARED`, cx, 150, `900 52px ${TITLE_FONT}`, '#e8ffff', 'center', 24, COLORS.player);
  text(ctx, 'CHOOSE AN UPGRADE  —  CLICK A CARD OR PRESS 1 / 2 / 3', cx, 205, `700 18px ${BODY_FONT}`, COLORS.dim, 'center');
  const rects = getUpgradeCardRects();
  const hues = [187, 90, 36];
  state.upgradeChoices.forEach((u, i) => {
    const r = rects[i];
    const level = (state.player.upgrades[u.id] || 0) + 1;
    const hover = mouse && mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h;
    panel(ctx, r.x, r.y, r.w, r.h, hover ? '#ffffff' : `hsl(${hues[i]}, 100%, 60%)`, hover ? 'rgba(20, 34, 70, 0.95)' : 'rgba(6, 10, 28, 0.88)');
    text(ctx, `${i + 1}`, r.x + r.w / 2, r.y + 34, `900 26px ${TITLE_FONT}`, `hsl(${hues[i]}, 100%, 65%)`, 'center', 10, `hsl(${hues[i]}, 100%, 60%)`);
    text(ctx, u.name.toUpperCase(), r.x + r.w / 2, r.y + 78, `700 21px ${BODY_FONT}`, COLORS.text, 'center');
    // Word-wrap the description.
    const words = u.desc.split(' ');
    const lines = [''];
    for (const w of words) {
      const last = lines[lines.length - 1];
      if ((last + ' ' + w).trim().length > 26) lines.push(w);
      else lines[lines.length - 1] = (last + ' ' + w).trim();
    }
    lines.forEach((line, li) => {
      text(ctx, line, r.x + r.w / 2, r.y + 122 + li * 24, `600 16px ${BODY_FONT}`, COLORS.dim, 'center');
    });
    // Level pips.
    const max = u.max;
    const pw = 16;
    const total = max * (pw + 6) - 6;
    let px = r.x + r.w / 2 - total / 2;
    for (let k = 0; k < max; k += 1) {
      ctx.fillStyle = k < level ? `hsl(${hues[i]}, 100%, 60%)` : 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.roundRect(px, r.y + r.h - 42, pw, pw, 4);
      ctx.fill();
      px += pw + 6;
    }
    text(ctx, `LEVEL ${level}`, r.x + r.w / 2, r.y + r.h - 16, `600 13px ${BODY_FONT}`, COLORS.dim, 'center');
  });
}

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(4, 5, 13, 0.66)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  text(ctx, 'PAUSED', FIELD.width / 2, FIELD.height / 2 - 20, `900 72px ${TITLE_FONT}`, COLORS.text, 'center', 24, COLORS.player);
  text(ctx, 'P / ESC TO RESUME      M TO MUTE', FIELD.width / 2, FIELD.height / 2 + 50, `700 20px ${BODY_FONT}`, COLORS.dim, 'center');
}

export function drawGameOver(ctx, state, best) {
  ctx.fillStyle = 'rgba(10, 3, 8, 0.72)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const cx = FIELD.width / 2;
  const isBest = state.score > 0 && state.score >= best;
  text(ctx, 'GAME OVER', cx, 190, `900 88px ${TITLE_FONT}`, '#ff5c7a', 'center', 30, '#ff2d78');
  if (isBest) text(ctx, '★ NEW BEST SCORE ★', cx, 252, `700 22px ${BODY_FONT}`, '#ffe600', 'center', 12, '#ffe600');
  panel(ctx, cx - 240, 300, 480, 190, 'rgba(255, 45, 120, 0.5)');
  const rows = [
    ['SCORE', `${state.score}`],
    ['WAVE REACHED', `${state.wave}`],
    ['KILLS', `${state.kills}`],
    ['BEST', `${Math.max(best, state.score)}`],
  ];
  rows.forEach(([label, value], i) => {
    text(ctx, label, cx - 210, 332 + i * 40, `700 18px ${BODY_FONT}`, COLORS.dim, 'left');
    text(ctx, value, cx + 210, 332 + i * 40, `700 20px ${BODY_FONT}`, COLORS.text, 'right');
  });
  const pulse = 0.65 + 0.35 * Math.sin(state.time * 4);
  ctx.save();
  ctx.globalAlpha = pulse;
  text(ctx, 'PRESS R TO PLAY AGAIN', cx, 560, `700 26px ${BODY_FONT}`, COLORS.text, 'center', 12, COLORS.player);
  ctx.restore();
}
