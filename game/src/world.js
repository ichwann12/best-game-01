// The game's rules and state, with no drawing and no browser in it: the player, waves of
// enemies (chasers, shooters, splitters, brutes and a boss every 5 waves), bullets,
// collisions, score with a combo multiplier, between-wave upgrades and bombs. step() advances
// one fixed step and returns what happened as bit flags, so the caller can react (sound,
// screens) without the world knowing about screens or sound. The only randomness is the
// seeded generator it is given, so a seed replays the same game.
import {
  COMBO_MAX_MULT,
  COMBO_PER_LEVEL,
  COMBO_WINDOW,
  ENEMY,
  FIELD,
  GEM_VALUE,
  HEALTH_VALUE,
  PLAYER,
  UPGRADES,
  WAVE,
} from './config.js';
import {
  newBullet,
  newEnemy,
  newEnemyBullet,
  newFloater,
  newParticle,
  newPickup,
  newPlayer,
} from './entities.js';
import { pick, range, shuffle } from './random.js';

export const PHASE_ANNOUNCE = 'announce';
export const PHASE_FIGHT = 'fight';
export const PHASE_UPGRADE = 'upgrade';
export const PHASE_OVER = 'over';

export const EVENT_HIT = 1;
export const EVENT_OVER = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_BOSS = 16;
export const EVENT_PICKUP = 32;
export const EVENT_UPGRADE = 64;
export const EVENT_BOMB = 128;

const TWO_PI = Math.PI * 2;

function overlaps(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.r + b.r;
  return dx * dx + dy * dy < r * r;
}

function burst(state, x, y, hue, count, speed) {
  for (let i = 0; i < count; i += 1) {
    if (state.particles.length > 420) return;
    const a = state.random() * TWO_PI;
    const v = speed * (0.3 + state.random() * 0.7);
    state.particles.push(newParticle(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.4 + state.random() * 0.5, 2 + state.random() * 3, hue));
  }
}

export function createWorld(random) {
  const state = {
    random,
    player: newPlayer(),
    bullets: [],
    ebullets: [],
    enemies: [],
    particles: [],
    floaters: [],
    pickups: [],
    stars: [],
    wave: 1,
    phase: PHASE_ANNOUNCE,
    phaseTimer: WAVE.announceSeconds,
    spawnQueue: [],
    spawnTimer: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    shake: 0,
    time: 0,
    boss: null,
    upgradeChoices: [],
    stats: { shots: 0, hits: 0 },
  };

  for (let i = 0; i < 90; i += 1) {
    state.stars.push({ x: random() * FIELD.width, y: random() * FIELD.height, r: 0.5 + random() * 1.4, tw: random() * TWO_PI });
  }

  function multiplier() {
    return Math.min(COMBO_MAX_MULT, 1 + Math.floor(state.combo / COMBO_PER_LEVEL));
  }

  function addShake(amount) {
    state.shake = Math.min(14, state.shake + amount);
  }

  function reset() {
    state.player = newPlayer();
    state.bullets.length = 0;
    state.ebullets.length = 0;
    state.enemies.length = 0;
    state.particles.length = 0;
    state.floaters.length = 0;
    state.pickups.length = 0;
    state.wave = 1;
    state.phase = PHASE_ANNOUNCE;
    state.phaseTimer = WAVE.announceSeconds;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.kills = 0;
    state.shake = 0;
    state.time = 0;
    state.boss = null;
    state.upgradeChoices = [];
    state.stats = { shots: 0, hits: 0 };
  }

  /** The spawn list for wave n: a boss with escorts every 5th wave, else a growing mix. */
  function buildWave(n) {
    const kinds = [];
    for (let i = 0; i < 4 + n; i += 1) kinds.push('chaser');
    if (n >= 2) for (let i = 0; i < 1 + Math.floor(n / 2); i += 1) kinds.push('shooter');
    if (n >= 3) for (let i = 0; i < Math.floor(n / 2); i += 1) kinds.push('splitter');
    if (n >= 4) for (let i = 0; i < Math.floor((n - 1) / 3); i += 1) kinds.push('brute');
    if (n % WAVE.bossEvery === 0) return ['boss', ...shuffle(random, kinds)];
    return shuffle(random, kinds);
  }

  function spawnPoint() {
    for (let tries = 0; tries < 6; tries += 1) {
      const edge = Math.floor(random() * 4);
      let x = 0;
      let y = 0;
      if (edge === 0) { x = random() * FIELD.width; y = -30; }
      else if (edge === 1) { x = FIELD.width + 30; y = random() * FIELD.height; }
      else if (edge === 2) { x = random() * FIELD.width; y = FIELD.height + 30; }
      else { x = -30; y = random() * FIELD.height; }
      const dx = x - state.player.x;
      const dy = y - state.player.y;
      if (dx * dx + dy * dy > 260 * 260) return { x, y };
    }
    return { x: random() * FIELD.width, y: -30 };
  }

  function spawnNext() {
    const kind = state.spawnQueue.shift();
    if (kind === 'boss') {
      const boss = newEnemy('boss', FIELD.width / 2, 130, state.wave);
      boss.fireTimer = 2;
      boss.attackTimer = 1.6;
      boss.pattern = 0;
      boss.volleyLeft = 0;
      boss.volleyTimer = 0;
      boss.spiralTime = 0;
      boss.spiralTimer = 0;
      boss.spiralAngle = 0;
      state.enemies.push(boss);
      state.boss = boss;
      return EVENT_BOSS;
    }
    const p = spawnPoint();
    const enemy = newEnemy(kind, p.x, p.y, state.wave);
    enemy.fireTimer = range(random, 1, 2.4);
    state.enemies.push(enemy);
    return 0;
  }

  function startWave() {
    state.spawnQueue = buildWave(state.wave);
    state.spawnTimer = 0.7;
    state.phase = PHASE_FIGHT;
  }

  /** Three upgrades the player has not maxed out yet, shuffled. */
  function rollUpgrades() {
    const open = UPGRADES.filter((u) => (state.player.upgrades[u.id] || 0) < u.max);
    const picked = shuffle(random, open).slice(0, 3);
    if (picked.length === 0) {
      return [{ id: 'heal', name: 'Field Repair', desc: 'Restore 50 health', max: 99 }];
    }
    return picked;
  }

  function applyUpgrade(id) {
    const p = state.player;
    if (id === 'heal') {
      p.hp = Math.min(p.maxHp, p.hp + 50);
    } else {
      p.upgrades[id] = (p.upgrades[id] || 0) + 1;
      if (id === 'spread') p.spread += 1;
      else if (id === 'rapid') p.fireInterval *= 0.82;
      else if (id === 'pierce') p.pierce += 1;
      else if (id === 'speed') p.speed *= 1.12;
      else if (id === 'maxhp') { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); }
      else if (id === 'shield') { p.shieldMax += 1; p.shield = p.shieldMax; }
      else if (id === 'magnet') p.magnet *= 1.7;
      else if (id === 'bomb') p.bombs += 1;
    }
    p.shield = p.shieldMax;
    state.wave += 1;
    state.phase = PHASE_ANNOUNCE;
    state.phaseTimer = WAVE.announceSeconds;
    state.upgradeChoices = [];
    return EVENT_UPGRADE;
  }

  function triggerBomb() {
    const p = state.player;
    if (state.phase !== PHASE_FIGHT || p.bombs <= 0 || !p.alive) return 0;
    p.bombs -= 1;
    for (const b of state.ebullets) burst(state, b.x, b.y, 322, 2, 60);
    state.ebullets.length = 0;
    // Damage a snapshot: killing a splitter births minis, which the bomb does not also hit.
    for (const e of [...state.enemies]) damageEnemy(e, 15, true);
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      if (state.enemies[i].hp <= 0) state.enemies.splice(i, 1);
    }
    addShake(12);
    burst(state, p.x, p.y, 60, 30, 420);
    return EVENT_BOMB;
  }

  function damagePlayer(amount) {
    const p = state.player;
    if (p.invuln > 0 || !p.alive) return 0;
    if (p.shield > 0) {
      p.shield -= 1;
      p.invuln = 0.8;
      burst(state, p.x, p.y, 200, 14, 220);
      return EVENT_HIT;
    }
    p.hp -= amount;
    p.invuln = PLAYER.invuln;
    state.combo = 0;
    addShake(10);
    burst(state, p.x, p.y, 0, 16, 260);
    if (p.hp <= 0) {
      p.hp = 0;
      p.alive = false;
      burst(state, p.x, p.y, 187, 60, 420);
      burst(state, p.x, p.y, 0, 30, 300);
      addShake(14);
      state.phase = PHASE_OVER;
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function killEnemy(enemy) {
    const gained = enemy.score * multiplier();
    state.score += gained;
    state.combo += 1;
    state.comboTimer = COMBO_WINDOW;
    state.kills += 1;
    state.floaters.push(newFloater(enemy.x, enemy.y, `+${gained}`, enemy.hue, 16));
    burst(state, enemy.x, enemy.y, enemy.hue, enemy.kind === 'boss' ? 60 : 14, enemy.kind === 'boss' ? 420 : 240);
    const roll = random();
    if (enemy.kind === 'boss') {
      state.pickups.push(newPickup('health', enemy.x - 20, enemy.y, random));
      state.pickups.push(newPickup('gem', enemy.x + 20, enemy.y, random));
      state.pickups.push(newPickup('gem', enemy.x, enemy.y + 20, random));
      state.boss = null;
      addShake(14);
    } else if (roll < 0.06) {
      state.pickups.push(newPickup('health', enemy.x, enemy.y, random));
    } else if (roll < 0.4) {
      state.pickups.push(newPickup('gem', enemy.x, enemy.y, random));
    }
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        const mini = newEnemy('mini', enemy.x + (i === 0 ? -14 : 14), enemy.y, state.wave);
        mini.vx = (i === 0 ? -1 : 1) * 120;
        state.enemies.push(mini);
      }
    }
  }

  /** Damage an enemy; returns true when it died. `silent` skips the hit spark. */
  function damageEnemy(enemy, amount, silent) {
    enemy.hp -= amount;
    enemy.flash = 0.08;
    if (!silent) burst(state, enemy.x, enemy.y, enemy.hue, 3, 140);
    if (enemy.hp > 0) return false;
    killEnemy(enemy);
    return true;
  }

  function updatePlayer(dt, input) {
    const p = state.player;
    if (!p.alive) return;
    p.vx = input.mx * p.speed;
    p.vy = input.my * p.speed;
    p.x = Math.min(FIELD.width - p.r, Math.max(p.r, p.x + p.vx * dt));
    p.y = Math.min(FIELD.height - p.r, Math.max(p.r, p.y + p.vy * dt));
    p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    p.fireTimer -= dt;
    if ((input.firing || input.autoFire) && p.fireTimer <= 0) {
      const n = p.spread;
      for (let i = 0; i < n; i += 1) {
        const off = (i - (n - 1) / 2) * 0.13;
        const a = p.angle + off;
        state.bullets.push(newBullet(
          p.x + Math.cos(a) * (p.r + 6),
          p.y + Math.sin(a) * (p.r + 6),
          Math.cos(a) * PLAYER.bulletSpeed,
          Math.sin(a) * PLAYER.bulletSpeed,
          p.pierce,
        ));
      }
      state.stats.shots += n;
      p.fireTimer = p.fireInterval;
    }
  }

  function fireAimed(enemy, count, spreadAngle, speed) {
    const p = state.player;
    const base = Math.atan2(p.y - enemy.y, p.x - enemy.x);
    for (let i = 0; i < count; i += 1) {
      const a = base + (i - (count - 1) / 2) * spreadAngle;
      state.ebullets.push(newEnemyBullet(enemy.x, enemy.y, Math.cos(a) * speed, Math.sin(a) * speed));
    }
  }

  function fireRadial(enemy, count, speed) {
    const offset = state.time * 0.7;
    for (let i = 0; i < count; i += 1) {
      const a = offset + (i / count) * TWO_PI;
      state.ebullets.push(newEnemyBullet(enemy.x, enemy.y, Math.cos(a) * speed, Math.sin(a) * speed));
    }
  }

  function updateBoss(dt, boss) {
    boss.t += dt;
    const hpFrac = boss.hp / boss.maxHp;
    const phase = hpFrac > 0.5 ? 0 : hpFrac > 0.25 ? 1 : 2;
    boss.phase = phase;
    const tx = FIELD.width / 2 + Math.sin(boss.t * 0.45) * 400;
    const ty = 290 + Math.sin(boss.t * 0.8) * 170;
    const dx = tx - boss.x;
    const dy = ty - boss.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = boss.speed * (1 + 0.3 * phase);
    boss.vx = (dx / dist) * speed;
    boss.vy = (dy / dist) * speed;
    boss.x += boss.vx * dt;
    boss.y += boss.vy * dt;

    if (boss.spiralTime > 0) {
      boss.spiralTime -= dt;
      boss.spiralTimer -= dt;
      if (boss.spiralTime > 0 && boss.spiralTimer <= 0) {
        boss.spiralTimer = 0.09;
        boss.spiralAngle += 0.55;
        for (let k = 0; k < 2; k += 1) {
          const a = boss.spiralAngle + (k * Math.PI * 2) / 3;
          state.ebullets.push(newEnemyBullet(boss.x, boss.y, Math.cos(a) * 210, Math.sin(a) * 210));
        }
      }
      return;
    }
    if (boss.volleyLeft > 0) {
      boss.volleyTimer -= dt;
      if (boss.volleyTimer <= 0) {
        fireAimed(boss, 5, 0.16, 250);
        boss.volleyLeft -= 1;
        boss.volleyTimer = 0.28;
      }
      return;
    }
    boss.attackTimer -= dt;
    if (boss.attackTimer > 0) return;
    const pattern = boss.pattern % 3;
    boss.pattern += 1;
    if (pattern === 0) {
      fireRadial(boss, 14 + phase * 4, 200);
      boss.attackTimer = 2.6 - phase * 0.3;
    } else if (pattern === 1) {
      boss.volleyLeft = 3;
      boss.volleyTimer = 0;
      boss.attackTimer = 2.2 - phase * 0.25;
    } else {
      boss.spiralTime = 1.1;
      boss.spiralAngle = random() * TWO_PI;
      boss.attackTimer = 2.4 - phase * 0.3;
    }
  }

  function updateEnemy(dt, enemy) {
    const p = state.player;
    enemy.t += dt;
    if (enemy.flash > 0) enemy.flash = Math.max(0, enemy.flash - dt);
    if (enemy.spawnT < 0.3) enemy.spawnT += dt;
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    if (enemy.kind === 'boss') {
      updateBoss(dt, enemy);
      return;
    }
    if (enemy.kind === 'shooter') {
      const want = dist > 300 ? 1 : dist < 220 ? -1 : 0;
      const strafe = Math.sin(enemy.t * 1.3) * 0.7;
      enemy.vx = (nx * want - ny * strafe) * enemy.speed;
      enemy.vy = (ny * want + nx * strafe) * enemy.speed;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0 && dist < 540 && p.alive) {
        fireAimed(enemy, 1, 0, 230);
        enemy.fireTimer = ENEMY.shooter.fireInterval * range(random, 0.9, 1.1);
      }
      return;
    }
    // chaser, splitter, mini, brute: steer at the player.
    const steer = enemy.kind === 'mini' ? 5 : 3;
    enemy.vx += (nx * enemy.speed - enemy.vx) * Math.min(1, steer * dt);
    enemy.vy += (ny * enemy.speed - enemy.vy) * Math.min(1, steer * dt);
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
  }

  function updateBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20;
      if (!dead) {
        for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
          const e = state.enemies[j];
          if (e.spawnT < 0.15) continue;
          if (overlaps(b, e)) {
            state.stats.hits += 1;
            const died = damageEnemy(e, b.dmg, false);
            if (died) {
              state.enemies.splice(j, 1);
            }
            if (b.pierce > 0) b.pierce -= 1;
            else { dead = true; break; }
          }
        }
      }
      if (dead) {
        state.bullets[i] = state.bullets[state.bullets.length - 1];
        state.bullets.pop();
      }
    }
  }

  function updateEnemyBullets(dt, harmless) {
    const p = state.player;
    for (let i = state.ebullets.length - 1; i >= 0; i -= 1) {
      const b = state.ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20;
      if (!dead && !harmless && p.alive && overlaps(b, p)) {
        damagePlayer(b.dmg);
        dead = true;
      }
      if (dead) {
        state.ebullets[i] = state.ebullets[state.ebullets.length - 1];
        state.ebullets.pop();
      }
    }
  }

  function updateEnemies(dt, harmless) {
    const p = state.player;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      updateEnemy(dt, e);
      if (!harmless && p.alive && e.spawnT >= 0.3 && overlaps(e, p)) {
        damagePlayer(e.contact);
        if (damageEnemy(e, 2, true)) state.enemies.splice(i, 1);
      }
    }
    // Keep enemies from stacking on each other.
    const list = state.enemies;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const r = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < r * r) {
          const d = Math.sqrt(d2);
          const push = (r - d) / 2;
          const ux = dx / d;
          const uy = dy / d;
          if (a.kind !== 'boss') { a.x -= ux * push; a.y -= uy * push; }
          if (b.kind !== 'boss') { b.x += ux * push; b.y += uy * push; }
        }
      }
    }
  }

  function updatePickups(dt, harmless) {
    const p = state.player;
    let events = 0;
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const k = state.pickups[i];
      k.t += dt;
      const dx = p.x - k.x;
      const dy = p.y - k.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (p.alive && dist < p.magnet) {
        const pull = 520 * (1 - dist / (p.magnet + 1));
        k.vx += (dx / dist) * pull * dt * 4;
        k.vy += (dy / dist) * pull * dt * 4;
      } else {
        k.vx *= 0.98;
        k.vy *= 0.98;
      }
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      if (!harmless && p.alive && dist < p.r + k.r + 4) {
        if (k.kind === 'gem') {
          const gained = GEM_VALUE * multiplier();
          state.score += gained;
          state.floaters.push(newFloater(k.x, k.y, `+${gained}`, 90, 13));
        } else {
          p.hp = Math.min(p.maxHp, p.hp + HEALTH_VALUE);
          state.floaters.push(newFloater(k.x, k.y, `+${HEALTH_VALUE} HP`, 140, 14));
        }
        events |= EVENT_PICKUP;
        state.pickups.splice(i, 1);
      }
    }
    return events;
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
      pt.life -= dt;
      if (pt.life <= 0) {
        state.particles[i] = state.particles[state.particles.length - 1];
        state.particles.pop();
      }
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.y -= 42 * dt;
      f.life -= dt;
      if (f.life <= 0) {
        state.floaters[i] = state.floaters[state.floaters.length - 1];
        state.floaters.pop();
      }
    }
  }

  /**
   * One fixed step. `input` is { mx, my, aimX, aimY, firing, bomb, autoFire }.
   * With `harmless` set (the title screen's backdrop) things move but nothing can hurt the
   * player and nothing scores. Returns the events that happened, as bit flags.
   */
  function step(dt, input, harmless) {
    let events = 0;
    state.time += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    updateParticles(dt);

    if (state.phase === PHASE_OVER) return events;

    if (state.phase === PHASE_ANNOUNCE) {
      updatePlayer(dt, { ...input, firing: false });
      updateEnemies(dt, true);
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) startWave();
      return events;
    }

    if (state.phase === PHASE_UPGRADE) {
      updatePlayer(dt, { ...input, firing: false });
      return events;
    }

    // PHASE_FIGHT
    if (input.bomb) events |= triggerBomb();
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        events |= spawnNext();
        state.spawnTimer = Math.max(0.28, WAVE.spawnInterval - state.wave * 0.02);
      }
    }
    updatePlayer(dt, input);
    updateEnemies(dt, harmless);
    updateBullets(dt);
    updateEnemyBullets(dt, harmless);
    events |= updatePickups(dt, harmless);

    if (!harmless && state.phase === PHASE_FIGHT && state.spawnQueue.length === 0 && state.enemies.length === 0) {
      const bonus = 50 * state.wave;
      state.score += bonus;
      state.floaters.push(newFloater(FIELD.width / 2, FIELD.height / 2 - 60, `WAVE ${state.wave} CLEAR  +${bonus}`, 60, 22));
      state.upgradeChoices = rollUpgrades();
      state.phase = PHASE_UPGRADE;
      events |= EVENT_WAVE_CLEAR;
    }
    return events;
  }

  reset();
  return { state, reset, step, applyUpgrade, triggerBomb, multiplier };
}
