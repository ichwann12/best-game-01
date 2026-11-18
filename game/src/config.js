// Tuning for NEON VOID: every number the game balances on lives here, so a tweak is one
// edit and the rest of the code only reads it. Colours are the neon palette; enemy kinds are
// data, not code, so a new kind is one more row in ENEMY.
export const STEP = 1 / 60;
export const BEST_KEY = 'neon-void-best';

export const FIELD = { width: 1280, height: 720 };

export const COLORS = {
  bg: '#04050d',
  grid: 'rgba(70, 130, 255, 0.08)',
  star: '#cfe6ff',
  player: '#00f0ff',
  playerCore: '#e8ffff',
  bullet: '#7df9ff',
  ebullet: '#ff2d78',
  gem: '#a6ff00',
  health: '#3dff7a',
  text: '#dfe9ff',
  dim: '#8fa3c8',
  shield: '#4dc3ff',
  bomb: '#ffe600',
  danger: '#ff3b30',
};

export const PLAYER = {
  r: 14,
  speed: 330,
  hp: 100,
  fireInterval: 0.16,
  bulletSpeed: 660,
  bulletDamage: 1,
  invuln: 1.0,
  magnet: 100,
  bombs: 1,
};

export const BULLET = { r: 5, life: 1.2 };
export const EBULLET = { r: 6, speed: 230 };

/** Enemy kinds: radius, hits to kill, speed, score, contact damage, glow hue, fire rate. */
export const ENEMY = {
  chaser: { r: 16, hp: 3, speed: 108, score: 50, contact: 10, hue: 322 },
  shooter: { r: 15, hp: 4, speed: 82, score: 80, contact: 10, hue: 275, fireInterval: 2.4 },
  splitter: { r: 22, hp: 6, speed: 72, score: 100, contact: 12, hue: 36 },
  mini: { r: 10, hp: 1, speed: 175, score: 25, contact: 6, hue: 36 },
  brute: { r: 30, hp: 20, speed: 50, score: 150, contact: 20, hue: 0 },
  boss: { r: 72, hp: 150, speed: 58, score: 1000, contact: 25, hue: 190 },
};

export const WAVE = {
  spawnInterval: 0.55,
  announceSeconds: 2.2,
  bossEvery: 5,
};

/** Between-wave upgrades: id, name, what it does, and how many times it can stack. */
export const UPGRADES = [
  { id: 'spread', name: 'Spread Shot', desc: '+1 projectile per shot', max: 3 },
  { id: 'rapid', name: 'Rapid Fire', desc: 'Shoot 18% faster', max: 4 },
  { id: 'pierce', name: 'Piercing Rounds', desc: 'Bullets pass through +1 enemy', max: 3 },
  { id: 'speed', name: 'Ion Thrusters', desc: 'Move 12% faster', max: 4 },
  { id: 'maxhp', name: 'Hull Plating', desc: '+25 max health and heal 25', max: 4 },
  { id: 'shield', name: 'Aegis Shield', desc: '+1 shield charge — blocks a hit, recharges each wave', max: 3 },
  { id: 'magnet', name: 'Tractor Magnet', desc: 'Pickups fly to you from 70% farther', max: 3 },
  { id: 'bomb', name: 'Nova Bomb', desc: '+1 bomb — B key clears bullets and blasts all enemies', max: 3 },
];

export const GEM_VALUE = 10;
export const HEALTH_VALUE = 20;
export const COMBO_WINDOW = 3;
export const COMBO_PER_LEVEL = 8;
export const COMBO_MAX_MULT = 5;
