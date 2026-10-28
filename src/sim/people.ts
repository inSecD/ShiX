import type { Bot, BotStrategy } from './types';
import { RNG } from './rng';

/**
 * Populasi kota — 10 NPC kenalan (ROSTER di bots.ts) + kerumun akun yang
 * juga trading & ngepost. Total 300 orang biar dunia berasa rame.
 */
export const TOTAL_BOTS = 300;
export const NPC_COUNT = 10;

const CROWD_SEED = 0xc0ffee;

const FIRST_NAMES = [
  'Budi', 'Sari', 'Andi', 'Rina', 'Dika', 'Maya', 'Joko', 'Sinta', 'Rizky', 'Putri',
  'Adam', 'Elena', 'Marco', 'Yuki', 'Leo', 'Nadia', 'Omar', 'Clara', 'Felix', 'Iris',
  'Hana', 'Kevin', 'Luna', 'Nino', 'Vera', 'Zack', 'Ayu', 'Bela', 'Citra', 'Damar',
  'Eko', 'Farah', 'Gilang', 'Hendra', 'Indah', 'Jihan', 'Kenta', 'Laras', 'Miko', 'Nanda'
];

const HANDLE_WORDS = [
  'trader', 'degencuy', 'chart', 'moon', 'hodl', 'pump', 'dip', 'whale', 'gem', 'alpha',
  'sats', 'ngl', 'ser', 'boss', 'cuan', 'saham', 'kripto', 'ape', 'bag', 'bull',
  'bear', 'fomo', 'nganggur', 'nyangkut', 'kayak', 'sultan', 'anak', 'muda', 'sore', 'pagi',
  'malam', 'jajan', 'kopi', 'sate', 'goreng', 'laut', 'gunung', 'kota', 'desa', 'senja'
];

const AVATARS = [
  '🧢', '😎', '🤠', '👻', '🎃', '🤖', '🦾', '🐱', '🐶', '🦊', '🐻', '🐼', '🐸', '🐵', '🦁',
  '🐯', '🦄', '🐙', '🦜', '🐧', '🦉', '🐺', '🐗', '🦐', '🍄', '🌵', '🌻', '⚽', '🎮', '🎸',
  '🚀', '⚡', '🔥', '💧', '🌙', '⭐', '🎯', '💰', '📈', '🧧'
];

const STRATEGY_POOL: BotStrategy[] = [
  'degen', 'degen', 'degen', 'degen',
  'momentum', 'momentum', 'momentum',
  'panic', 'panic', 'panic',
  'contrarian', 'contrarian',
  'quant',
  'whale'
];

/** handle dari nama (untuk NPC lama yang belum punya handle) */
export function handleOfName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 16);
  return slug || 'anon';
}

interface PersonSeed {
  name: string;
  emoji: string;
  handle: string;
  strategy: BotStrategy;
  followers: number;
}

function makePerson(rng: RNG, usedHandles: Set<string>): PersonSeed {
  const name = `${rng.pick(FIRST_NAMES)}${rng.int(10, 99)}`;
  const emoji = rng.pick(AVATARS);
  const strategy = rng.pick(STRATEGY_POOL);

  let handle = `${rng.pick(HANDLE_WORDS)}_${rng.pick(HANDLE_WORDS)}`;
  if (usedHandles.has(handle)) handle = `${handle}${rng.int(2, 99)}`;
  let n = 100;
  while (usedHandles.has(handle)) handle = `${handle}${n++}`;
  usedHandles.add(handle);

  // sebaran follower ala kota: mayoritas kecil, sesekali yang rame
  let followers = rng.int(15, 4000);
  if (rng.chance(0.05)) followers = rng.int(4000, 60000);
  if (rng.chance(0.01)) followers = rng.int(60000, 250000);

  return { name, emoji, handle, strategy, followers };
}

/**
 * Tambah akun baru sampe `target` total. NPC lama (index < NPC_COUNT) dipertahankan,
 * termasuk equity/holding yang udah jalan — cuma di-append yang kurang.
 */
export function growBots(existing: Bot[], startEquity: number, target: number = TOTAL_BOTS): Bot[] {
  const bots = Array.isArray(existing) ? existing.slice() : [];
  const usedHandles = new Set<string>();
  for (const b of bots) if (b.handle) usedHandles.add(b.handle);

  // heal NPC/akun lama yang belum punya handle/followers
  for (let i = 0; i < bots.length; i++) {
    const b = bots[i];
    if (!b.handle) {
      let h = i < NPC_COUNT ? handleOfName(b.name) : handleOfName(b.name);
      while (usedHandles.has(h)) h = `${h}${i}`;
      usedHandles.add(h);
      b.handle = h;
    }
    if (!Number.isFinite(b.followers) || b.followers <= 0) {
      const rng = new RNG(CROWD_SEED + i * 7919);
      b.followers = i < NPC_COUNT ? rng.int(3000, 40000) : rng.int(15, 4000);
    }
  }

  if (bots.length >= target) return bots;

  const rng = new RNG(CROWD_SEED + bots.length * 131);
  for (let i = bots.length; i < target; i++) {
    const p = makePerson(rng, usedHandles);
    bots.push({
      id: `bot_${i}`,
      name: p.name,
      emoji: p.emoji,
      handle: p.handle,
      strategy: p.strategy,
      followers: p.followers,
      startEquity,
      cash: startEquity,
      holdings: [],
      equity: startEquity,
      pnlPct: 0,
      lastTrade: 0,
      trades: 0
    });
  }
  return bots;
}
