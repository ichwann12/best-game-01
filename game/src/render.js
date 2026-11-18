// Drawing: the neon arena, the ship and its enemies, bullets, particles and pickups,
// then the HUD and whichever screen sits on top. Glow comes from cached radial-gradient
// sprites (fast), not shadowBlur on every shape. The shake offset is a deterministic
// function of world time, so the same seed paints the same frame.
import { COLORS, FIELD } from './config.js';
import {
  drawGameOver,
  drawHud,
  drawPause,
  drawTitle,
  drawUpgrade,
  drawWaveBanner,
} from './ui.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_OVER = 'over';

export function createRenderer(canvas) {
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  const ctx = canvas.getContext('2d');
  const glowCache = new Map();

  /** A cached radial glow sprite for a hue: white core fading to the hue, then clear. */
  function glowSprite(hue) {
    let sprite = glowCache.get(hue);
    if (sprite) return sprite;
    sprite = document.createElement('canvas');
    sprite.width = 128;
    sprite.height = 128;
    const g = sprite.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.25, `hsla(${hue}, 100%, 60%, 0.55)`);
    grad.addColorStop(1, `hsla(${hue}, 100%, 55%, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    glowCache.set(hue, sprite);
    return sprite;
  }

  function glow(x, y, radius, hue, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(glowSprite(hue), x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  function drawBackground(state) {
    const grad = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, '#04050d');
    grad.addColorStop(0.55, '#070a1c');
    grad.addColorStop(1, '#0a0d26');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Nebulae: three fixed soft blooms.
    glow(240, 150, 320, 265, 0.10);
    glow(1050, 560, 340, 190, 0.09);
    glow(700, 90, 260, 320, 0.07);
    // Stars, twinkling on world time.
    for (const s of state.stars) {
      const a = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(state.time * 1.7 + s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = COLORS.star;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
    // Grid.
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 80; x < FIELD.width; x += 80) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
    }
    for (let y = 80; y < FIELD.height; y += 80) {
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
    }
    ctx.stroke();
  }

  function drawPickups(state) {
    for (const k of state.pickups) {
      const bob = Math.sin(state.time * 3 + k.t) * 3;
      const y = k.y + bob;
      if (k.kind === 'gem') {
        glow(k.x, y, 26, 90, 0.7);
        ctx.save();
        ctx.translate(k.x, y);
        ctx.rotate(state.time * 2 + k.t);
        ctx.fillStyle = COLORS.gem;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(7, 0);
        ctx.lineTo(0, 9);
        ctx.lineTo(-7, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        glow(k.x, y, 30, 140, 0.7);
        ctx.fillStyle = COLORS.health;
        ctx.beginPath();
        ctx.arc(k.x, y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#04120a';
        ctx.fillRect(k.x - 2, y - 6, 4, 12);
        ctx.fillRect(k.x - 6, y - 2, 12, 4);
      }
    }
  }

  function shapeFor(kind, x, y, r, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    if (kind === 'chaser') {
      ctx.moveTo(r, 0);
      ctx.lineTo(0, r * 0.8);
      ctx.lineTo(-r, 0);
      ctx.lineTo(0, -r * 0.8);
    } else if (kind === 'shooter') {
      ctx.rect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
    } else if (kind === 'splitter') {
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
    } else if (kind === 'mini') {
      ctx.moveTo(r, 0);
      ctx.lineTo(-r * 0.8, r * 0.75);
      ctx.lineTo(-r * 0.8, -r * 0.75);
    } else if (kind === 'brute') {
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
    }
    ctx.closePath();
    ctx.restore();
  }

  function drawEnemies(state) {
    for (const e of state.enemies) {
      const scale = Math.min(1, e.spawnT / 0.3);
      const r = e.r * scale;
      if (r <= 0) continue;
      glow(e.x, e.y, r * 2.6, e.hue, 0.55);
      if (e.kind === 'boss') {
        // Spiked ring, slowly turning, with a pulsing core.
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.t * 0.3);
        ctx.strokeStyle = `hsl(${e.hue}, 100%, 60%)`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        for (let i = 0; i < 12; i += 1) {
          const a = (i / 12) * Math.PI * 2;
          const rr = i % 2 === 0 ? r + 16 : r - 6;
          if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
        const pulse = 0.75 + 0.25 * Math.sin(e.t * 5);
        ctx.fillStyle = `hsla(${e.hue}, 100%, 55%, ${pulse})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(e.x, e.y, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const angle = e.kind === 'shooter' ? Math.atan2(state.player.y - e.y, state.player.x - e.x) : e.t * 0.8;
        shapeFor(e.kind, e.x, e.y, r, angle);
        ctx.fillStyle = `hsla(${e.hue}, 95%, 55%, 0.9)`;
        ctx.fill();
        ctx.strokeStyle = `hsla(${e.hue}, 100%, 75%, 0.9)`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(e.x, e.y, Math.max(2, r * 0.22), 0, Math.PI * 2);
        ctx.fill();
        if (e.kind === 'shooter') {
          ctx.strokeStyle = `hsla(${e.hue}, 100%, 70%, 0.9)`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x + Math.cos(angle) * (r + 8), e.y + Math.sin(angle) * (r + 8));
          ctx.stroke();
        }
        if (e.kind === 'brute' && e.hp < e.maxHp) {
          const bw = r * 1.8;
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(e.x - bw / 2, e.y - r - 12, bw, 5);
          ctx.fillStyle = '#ff3b30';
          ctx.fillRect(e.x - bw / 2, e.y - r - 12, bw * (e.hp / e.maxHp), 5);
        }
      }
      if (e.flash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, e.flash / 0.08) * 0.7;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawBullets(state) {
    for (const b of state.bullets) {
      glow(b.x, b.y, 16, b.hue, 0.6);
      ctx.strokeStyle = '#aefcff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const b of state.ebullets) {
      glow(b.x, b.y, 20, b.hue, 0.75);
      ctx.fillStyle = '#ff2d78';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (!p.alive) return;
    if (p.invuln > 0 && Math.floor(state.time * 12) % 2 === 0) {
      // Blink while invulnerable.
      ctx.save();
      ctx.globalAlpha = 0.45;
    }
    glow(p.x, p.y, 52, 187, 0.8);
    // Engine flame, flickering on world time.
    const flame = 14 + 6 * Math.sin(state.time * 40);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ff9f1c';
    ctx.beginPath();
    ctx.moveTo(-p.r - 2, -5);
    ctx.lineTo(-p.r - flame, 0);
    ctx.lineTo(-p.r - 2, 5);
    ctx.closePath();
    ctx.fill();
    // Hull: a swept dart.
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.moveTo(p.r + 6, 0);
    ctx.lineTo(-p.r, p.r * 0.75);
    ctx.lineTo(-p.r * 0.45, 0);
    ctx.lineTo(-p.r, -p.r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e8ffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = COLORS.playerCore;
    ctx.beginPath();
    ctx.arc(p.r * 0.25, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (p.invuln > 0 && Math.floor(state.time * 12) % 2 === 0) ctx.restore();
    if (p.shield > 0) {
      ctx.strokeStyle = 'rgba(77, 195, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 12 + 2 * Math.sin(state.time * 3), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      const a = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = `hsl(${pt.hue}, 100%, 60%)`;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size * a + 1, pt.size * a + 1);
      ctx.restore();
    }
    for (const f of state.floaters) {
      const a = Math.max(0, f.life / f.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `700 ${f.size}px "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = `hsl(${f.hue}, 100%, 60%)`;
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  function drawWorld(state) {
    drawBackground(state);
    drawPickups(state);
    drawEnemies(state);
    drawBullets(state);
    drawPlayer(state);
    drawParticles(state);
  }

  function draw(state, screen, best, mouse) {
    ctx.clearRect(0, 0, FIELD.width, FIELD.height);
    // Screen shake, deterministic in world time.
    const sh = state.shake;
    const ox = sh * (Math.sin(state.time * 127.1) * 0.6 + Math.sin(state.time * 311.7) * 0.4);
    const oy = sh * (Math.cos(state.time * 141.3) * 0.6 + Math.sin(state.time * 271.9) * 0.4);
    ctx.save();
    ctx.translate(ox, oy);
    drawWorld(state);
    ctx.restore();
    if (screen === SCREEN_PLAY || screen === SCREEN_UPGRADE || screen === SCREEN_PAUSED) {
      if (state.phase === 'announce' && screen === SCREEN_PLAY) drawWaveBanner(ctx, state);
      drawHud(ctx, state, best);
    }
    if (screen === SCREEN_TITLE) drawTitle(ctx, state, best);
    else if (screen === SCREEN_UPGRADE) drawUpgrade(ctx, state, mouse);
    else if (screen === SCREEN_PAUSED) drawPause(ctx);
    else if (screen === SCREEN_OVER) drawGameOver(ctx, state, best);
    // Low-hull danger vignette.
    const p = state.player;
    if (p.alive && p.hp > 0 && p.hp / p.maxHp < 0.3 && (screen === SCREEN_PLAY || screen === SCREEN_UPGRADE)) {
      const pulse = 0.1 + 0.08 * Math.sin(state.time * 5);
      const grad = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.35, FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.75);
      grad.addColorStop(0, 'rgba(255,0,0,0)');
      grad.addColorStop(1, `rgba(255,30,30,${pulse})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  return { draw };
}
