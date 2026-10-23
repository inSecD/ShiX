import type { Bot, BotStrategy, Instrument, SimState } from './types';
import { RNG } from './rng';

const PERIOD: Record<BotStrategy, number> = {
  momentum: 18,
  contrarian: 36,
  degen: 12,
  quant: 48,
  whale: 72,
  panic: 24
};

const EXPOSURE: Record<BotStrategy, number> = {
  momentum: 0.6,
  contrarian: 0.5,
  degen: 0.25,
  quant: 0.6,
  whale: 0.7,
  panic: 0.35
};

export const STRATEGY_LABEL: Record<BotStrategy, string> = {
  momentum: 'Momentum',
  contrarian: 'Kontrarian',
  degen: 'Degen',
  quant: 'Kuant',
  whale: 'Paus',
  panic: 'Panik'
};

const ROSTER: { name: string; emoji: string; strategy: BotStrategy }[] = [
  { name: 'Aria', emoji: '🤖', strategy: 'momentum' },
  { name: 'Kai', emoji: '🦊', strategy: 'contrarian' },
  { name: 'DegenBoy', emoji: '🎲', strategy: 'degen' },
  { name: 'Quant-9', emoji: '📐', strategy: 'quant' },
  { name: 'Whale 0x7f', emoji: '🐋', strategy: 'whale' },
  { name: 'Panik Pete', emoji: '😱', strategy: 'panic' },
  { name: 'Nala', emoji: '🚀', strategy: 'momentum' },
  { name: 'Viktor', emoji: '🧠', strategy: 'quant' },
  { name: 'Moonkid', emoji: '🌙', strategy: 'degen' },
  { name: 'Sinta', emoji: '🐢', strategy: 'contrarian' }
];

function costsFor(inst: Instrument): { fee: number; slip: number } {
  const degen = inst.cls === 'meme' || inst.cls === 'shitcoin';
  return degen ? { fee: 0.02, slip: 0.012 } : { fee: 0.0015, slip: 0.001 };
}

function impactOf(inst: Instrument, notional: number): number {
  const depth = Math.max(300, inst.mcap * inst.liquidity * 0.0006);
  return Math.min(0.35, 0.012 * Math.pow(Math.max(notional / depth, 1e-5), 0.62));
}

export function createBots(startEquity: number): Bot[] {
  return ROSTER.map((r, i) => ({
    id: `bot_${i}`,
    name: r.name,
    emoji: r.emoji,
    strategy: r.strategy,
    startEquity,
    cash: startEquity,
    holdings: [],
    equity: startEquity,
    pnlPct: 0,
    lastTrade: 0,
    trades: 0
  }));
}

function marketOpen(inst: Instrument, t: number): boolean {
  const d = new Date(t);
  const day = d.getUTCDay();
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60;
  switch (inst.cls) {
    case 'crypto':
    case 'meme':
    case 'shitcoin':
      return true;
    case 'stock':
    case 'index':
      return day >= 1 && day <= 5 && hour >= 13.5 && hour < 20;
    case 'forex':
      if (day === 6) return false;
      if (day === 0 && hour < 22) return false;
      if (day === 5 && hour >= 22) return false;
      return true;
    case 'commodity':
      return day >= 1 && day <= 5;
  }
}

function change24(inst: Instrument): number {
  const cs = inst.candles;
  if (cs.length < 25) return 0;
  const a = cs[cs.length - 25].c;
  return a > 0 ? cs[cs.length - 1].c / a - 1 : 0;
}

function botValue(bot: Bot, state: SimState): number {
  let v = bot.cash;
  for (const h of bot.holdings) {
    const inst = state.instruments[h.instId];
    if (inst) v += h.qty * inst.price;
  }
  return v;
}

function buy(bot: Bot, state: SimState, inst: Instrument, usd: number): void {
  if (!(usd > 25)) return;
  const { fee, slip: base } = costsFor(inst);
  const spend = Math.min(usd, (bot.cash - 5) / (1 + fee));
  if (!(spend > 25)) return;
  const px = inst.price * (1 + base + impactOf(inst, spend));
  const qty = spend / px;
  if (!Number.isFinite(qty) || qty <= 0) return;
  bot.cash -= qty * px * (1 + fee);
  const h = bot.holdings.find((x) => x.instId === inst.id);
  if (h) {
    const total = h.qty + qty;
    h.entry = (h.entry * h.qty + px * qty) / total;
    h.qty = total;
  } else {
    bot.holdings.push({ instId: inst.id, qty, entry: px });
  }
  bot.trades += 1;
  bot.lastTrade = state.ticks;
}

function sell(bot: Bot, state: SimState, instId: string, fraction: number): void {
  const h = bot.holdings.find((x) => x.instId === instId);
  const inst = state.instruments[instId];
  if (!h || !inst) return;
  const qty = h.qty * Math.max(0, Math.min(1, fraction));
  if (!(qty > 0)) return;
  const { fee, slip: base } = costsFor(inst);
  const px = inst.price * (1 - base - impactOf(inst, qty * inst.price));
  bot.cash += qty * px * (1 - fee);
  h.qty -= qty;
  if (h.qty <= 1e-12) bot.holdings = bot.holdings.filter((x) => x !== h);
  bot.trades += 1;
  bot.lastTrade = state.ticks;
}

function pickInstruments(bot: Bot, state: SimState, rng: RNG): Instrument[] {
  const open = state.order
    .map((id) => state.instruments[id])
    .filter((i) => i && marketOpen(i, state.simTime));

  switch (bot.strategy) {
    case 'momentum': {
      const picks = open
        .filter((i) => (i.cls === 'crypto' || i.cls === 'meme' || i.cls === 'stock') && i.mcap > 1e7)
        .map((i) => ({ i, s: i.momentum * 1.5 + i.lastReturn * 4 + (state.sectorHeat[i.sector] ?? 0) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 3)
        .map((x) => x.i);
      if (picks.length && rng.chance(0.3)) {
        const pool = open.filter((i) => i.cls === 'crypto' || i.cls === 'meme' || i.cls === 'stock');
        if (pool.length) picks[picks.length - 1] = rng.pick(pool);
      }
      return picks;
    }
    case 'contrarian': {
      return open
        .filter((i) => (i.cls === 'stock' || i.cls === 'crypto' || i.cls === 'commodity') && i.mcap > 1e8)
        .map((i) => ({ i, s: change24(i) }))
        .filter((x) => x.s < -0.01)
        .sort((a, b) => a.s - b.s)
        .slice(0, 2)
        .map((x) => x.i);
    }
    case 'degen': {
      const picks = open
        .filter((i) => i.cls === 'meme' || i.cls === 'shitcoin')
        .map((i) => ({ i, s: i.hype * 2 + Math.max(0, i.lastReturn) * 3 }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 2)
        .map((x) => x.i);
      if (picks.length && rng.chance(0.4)) {
        const pool = open.filter((i) => i.cls === 'meme' || i.cls === 'shitcoin');
        if (pool.length) picks[picks.length - 1] = rng.pick(pool);
      }
      return picks;
    }
    case 'quant': {
      return open
        .filter((i) => i.cls === 'stock' || i.cls === 'commodity' || i.cls === 'index')
        .sort((a, b) => a.vol - b.vol)
        .slice(0, 4);
    }
    case 'whale': {
      return open
        .filter((i) => (i.cls === 'crypto' || i.cls === 'stock' || i.cls === 'index') && i.mcap > 2e9)
        .sort((a, b) => b.momentum - a.momentum)
        .slice(0, 2);
    }
    case 'panic': {
      if (rng.chance(0.35)) return [];
      const pool = open.filter((i) => i.cls === 'crypto' || i.cls === 'meme' || i.cls === 'stock');
      if (!pool.length) return [];
      return [rng.pick(pool)];
    }
  }
}

function rebalance(bot: Bot, state: SimState, picks: Instrument[]): void {
  const desired = new Set(picks.map((i) => i.id));

  for (const h of [...bot.holdings]) {
    if (!desired.has(h.instId)) sell(bot, state, h.instId, 1);
  }
  if (!picks.length) return;

  const eq = botValue(bot, state);
  const target = (eq * EXPOSURE[bot.strategy]) / picks.length;

  for (const inst of picks) {
    const h = bot.holdings.find((x) => x.instId === inst.id);
    const cur = h ? h.qty * inst.price : 0;
    const gap = target - cur;
    const tol = Math.max(40, target * 0.25);
    if (gap > tol) {
      buy(bot, state, inst, gap);
    } else if (gap < -tol && h && cur > 0) {
      sell(bot, state, inst.id, Math.min(1, -gap / cur));
    }
  }
}

export function tickBots(state: SimState, rng: RNG): void {
  for (let i = 0; i < state.bots.length; i++) {
    const bot = state.bots[i];
    const period = PERIOD[bot.strategy];
    if ((state.ticks + i * 2) % period === 0) {
      const picks = pickInstruments(bot, state, rng);
      rebalance(bot, state, picks);
    }
    bot.equity = botValue(bot, state);
    bot.pnlPct = bot.startEquity > 0 ? (bot.equity / bot.startEquity - 1) * 100 : 0;
  }
}
