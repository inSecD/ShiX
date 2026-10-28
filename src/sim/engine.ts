import { RNG } from './rng';
import { buildUniverse, CURRENCY_MAP } from './universe';
import { clamp, rollEvent } from './events';
import {
  applyFill,
  closePosition,
  estimateFillPrice,
  findPosition,
  fillMarketOrder
} from './trading';
import { spawnAiToken, tickTokens } from './launchpad';
import { createBots, tickBots } from './bots';
import { createWorld, worldAssetsValue, worldTick } from './world';
import { createLifestyle, lifestyleAssetsValue, lifestyleTick } from './lifestyle';
import { createHub } from './hub';
import type { AssetClass, Candle, Fill, Instrument, Position, Settings, SimState } from './types';

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

const RISK_COEF: Record<AssetClass, number> = {
  crypto: 0.0005,
  meme: 0.0009,
  shitcoin: 0.0012,
  stock: 0.0003,
  forex: 0,
  commodity: 0.00012,
  index: 0.0003
};
const USD_COEF: Record<AssetClass, number> = {
  crypto: 0.0003,
  meme: 0.00035,
  shitcoin: 0.00045,
  stock: 0.00012,
  forex: 0,
  commodity: 0.00045,
  index: 0.0002
};
const RATE_COEF: Record<AssetClass, number> = {
  crypto: 0.0003,
  meme: 0.0004,
  shitcoin: 0.0005,
  stock: 0.0009,
  forex: 0,
  commodity: 0.0002,
  index: 0.0007
};
const INFL_COEF: Record<AssetClass, number> = {
  crypto: -0.00008,
  meme: -0.00008,
  shitcoin: -0.0001,
  stock: 0.0002,
  forex: 0,
  commodity: 0.0004,
  index: 0.00012
};
const LIQ_COEF: Record<AssetClass, number> = {
  crypto: 0.0007,
  meme: 0.001,
  shitcoin: 0.0012,
  stock: 0.00025,
  forex: 0.00006,
  commodity: 0.0001,
  index: 0.0003
};
const MOM_COEF: Record<AssetClass, number> = {
  crypto: 0.0012,
  meme: 0.0025,
  shitcoin: 0.003,
  stock: 0.002,
  forex: 0.0005,
  commodity: 0.0012,
  index: 0.0012
};
const HYPE_COEF: Record<AssetClass, number> = {
  crypto: 0.0004,
  meme: 0.0013,
  shitcoin: 0.0016,
  stock: 0.0002,
  forex: 0,
  commodity: 0.00015,
  index: 0.0002
};
const REV_COEF: Record<AssetClass, number> = {
  crypto: 0.006,
  meme: 0.004,
  shitcoin: 0.003,
  stock: 0.008,
  forex: 0.015,
  commodity: 0.008,
  index: 0.008
};

interface Regime {
  name: string;
  risk: number;
  infl: number;
  liq: number;
  prob: number;
}

const REGIMES: Regime[] = [
  { name: 'Chop', risk: 0, infl: 0, liq: 0, prob: 0.38 },
  { name: 'Risk-On', risk: 0.55, infl: 0.05, liq: 0.45, prob: 0.16 },
  { name: 'Risk-Off', risk: -0.6, infl: -0.1, liq: -0.5, prob: 0.16 },
  { name: 'Stagflation', risk: -0.4, infl: 0.75, liq: -0.3, prob: 0.08 },
  { name: 'Recovery', risk: 0.7, infl: -0.15, liq: 0.55, prob: 0.1 },
  { name: 'Melt-Up', risk: 0.95, infl: 0.3, liq: 0.8, prob: 0.07 },
  { name: 'Izzat', risk: -0.9, infl: 0.2, liq: -0.8, prob: 0.05 }
];

export const REGIME_LIST = REGIMES.map((r) => r.name);

export function regimeInfo(name: string): Regime {
  return REGIMES.find((r) => r.name === name) ?? REGIMES[0];
}

export function marketOpen(inst: Instrument, t: number): boolean {
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

export function policyRate(code: string, macro: SimState['macro']): number {
  if (code === 'USD') return macro.rate;
  return CURRENCY_MAP[code]?.baseRate ?? 4;
}

export function createSim(settings: Settings): SimState {
  const rng = new RNG(settings.seed);
  const { instruments, order } = buildUniverse(rng);

  const state: SimState = {
    seed: settings.seed,
    rngState: rng.state,
    simTime: Date.UTC(2026, 0, 5, 13, 30),
    ticks: 0,
    macro: {
      risk: 0.05,
      inflation: 0.1,
      rate: 4.85,
      usd: 0,
      liquidity: 0.15,
      regime: 'Chop'
    },
    sectorHeat: {},
    instruments,
    order,
    positions: {},
    spotHoldings: {},
    orders: {},
    events: [],
    fills: [],
    tokens: {},
    tokenOrder: [],
    tokenHoldings: {},
    tokenCost: {},
    cash: settings.startingCash,
    locked: 0,
    realized: 0,
    equityCurve: [],
    hypeIndex: 0,
    nextTokenAt: Date.UTC(2026, 0, 5, 13, 30) + 6 * HOUR,
    nextEventAt: Date.UTC(2026, 0, 5, 13, 30) + 2 * HOUR,
    bots: createBots(settings.startingCash),
    challenge: null,
    notices: [],
    progress: {},
    world: createWorld(settings.seed),
    lifestyle: createLifestyle(),
    hub: createHub()
  };

  for (let i = 0; i < 72; i++) tick(state, settings, true);

  state.nextTokenAt = state.simTime + 6 * HOUR;
  state.nextEventAt = state.simTime + rng.int(1, 6) * HOUR;
  state.equityCurve = [];
  state.events = state.events.slice(0, 14);
  state.fills = [];
  return state;
}

export function tick(state: SimState, settings: Settings, warmup = false): void {
  const rng = new RNG(state.rngState);

  state.simTime += HOUR;
  state.ticks += 1;

  updateMacro(state, rng);

  if (state.simTime >= state.nextEventAt) {
    rollEvent(state, rng);
    const evMult = settings.difficulty === 'easy' ? 1.7 : settings.difficulty === 'brutal' ? 0.55 : 1;
    state.nextEventAt = state.simTime + rng.int(1, 12) * HOUR * evMult;
  }

  for (const id of state.order) {
    const inst = state.instruments[id];
    if (!inst) continue;
    updateInstrument(inst, state, rng);
  }

  const worldNews = worldTick(state.world, state);
  lifestyleTick(state);
  if (!warmup) {
    for (const ev of worldNews.slice(0, 2)) {
      state.events.unshift({
        id: ev.id,
        t: state.simTime,
        title: ev.title,
        body: ev.body,
        severity: ev.severity,
        tags: ev.tags,
        impact: 0,
        instId: null,
        sector: null,
        cls: null
      });
    }
  }

  if (!warmup) {
    processOrders(state, settings, rng);
    applyFunding(state);
    checkBrackets(state, settings);
    checkLiquidations(state, settings);
    tickBots(state, rng);
    tickTokens(state, rng);
    if (state.simTime >= state.nextTokenAt) {
      const tok = spawnAiToken(state, rng);
      state.events.unshift({
        id: `tg${state.ticks}`,
        t: state.simTime,
        title: `Launchpad: ${tok.name} (${tok.ticker}) resmi luncur`,
        body: `Token baru masuk bonding curve.${tok.honeypot ? ' PERINGATAN: kontrak ini terdeteksi honeypot.' : ''}`,
        severity: tok.honeypot ? 'high' : 'low',
        tags: ['Launchpad', 'Baru'],
        impact: 0,
        instId: null,
        sector: null,
        cls: null
      });
      state.nextTokenAt = state.simTime + rng.int(60, 180) * HOUR;
    }
    updateHypeIndex(state);
    state.equityCurve.push(equity(state));
    if (state.equityCurve.length > 2000) state.equityCurve.splice(0, 200);
    checkChallenge(state);
  }

  state.rngState = rng.state;
}

function updateMacro(state: SimState, rng: RNG): void {
  const m = state.macro;

  if (rng.chance(0.0035)) {
    const next = REGIMES[rng.weightedIndex(REGIMES.map((r) => r.prob))];
    if (next.name !== m.regime) {
      m.regime = next.name;
      state.events.unshift({
        id: `rg${state.ticks}`,
        t: state.simTime,
        title: `Regime pasar berubah: ${next.name}`,
        body: `Macro berputar ke ${next.name}. Korelasi antar aset dan volatilitas ikut berubah.`,
        severity: Math.abs(next.risk) > 0.6 ? 'high' : 'med',
        tags: ['Macro', 'Regime'],
        impact: 0,
        instId: null,
        sector: null,
        cls: null
      });
    }
  }

  const target = regimeInfo(m.regime);
  m.risk = clamp(m.risk + (target.risk - m.risk) * 0.022 + rng.gauss() * 0.028, -1.6, 1.6);
  m.inflation = clamp(m.inflation + (target.infl - m.inflation) * 0.014 + rng.gauss() * 0.018, -1.2, 1.6);
  m.liquidity = clamp(m.liquidity + (target.liq - m.liquidity) * 0.02 + rng.gauss() * 0.03, -1.6, 1.6);
  m.usd = clamp(m.usd + (-m.risk * 0.35 - m.usd) * 0.02 + rng.gauss() * 0.024, -1.6, 1.6);
  m.rate = clamp(m.rate + rng.gauss() * 0.0013, 0.25, 12);

  for (const key of Object.keys(state.sectorHeat)) {
    state.sectorHeat[key] *= 0.975;
  }
  const sectors = Object.keys(state.instruments).map((id) => state.instruments[id].sector);
  const uniq = Array.from(new Set(sectors));
  for (const s of uniq) {
    if (!state.sectorHeat[s]) state.sectorHeat[s] = 0;
    state.sectorHeat[s] += rng.gauss() * 0.004;
    state.sectorHeat[s] = clamp(state.sectorHeat[s], -1, 1);
  }
}

function updateInstrument(inst: Instrument, state: SimState, rng: RNG): void {
  const c = inst.cls;

  if (!marketOpen(inst, state.simTime)) {
    inst.pressure *= 0.9;
    return;
  }

  const cs = inst.candles;
  let mom = 0;
  if (cs.length >= 7) mom = cs[cs.length - 1].c / cs[cs.length - 7].c - 1;
  inst.momentum = clamp(inst.momentum * 0.85 + mom * 0.1, -0.6, 0.6);

  const m = state.macro;
  const rateDev = (m.rate - 4.5) / 1.5;
  const macroFactor =
    inst.beta * m.risk * RISK_COEF[c] +
    -m.usd * USD_COEF[c] +
    -rateDev * RATE_COEF[c] +
    m.inflation * INFL_COEF[c] +
    m.liquidity * LIQ_COEF[c];

  if (c === 'forex' && inst.pair) {
    const b = policyRate(inst.pair[0], m);
    const q = policyRate(inst.pair[1], m);
    inst.fund *= Math.exp((b - q) * 0.000004 + macroFactor * 0.25);
  } else {
    inst.fund *= Math.exp(inst.drift * 0.15 + macroFactor * 0.25 + rng.gauss() * 0.0002);
  }
  const fLo = inst.anchor0 * (c === 'shitcoin' || c === 'meme' ? 0.15 : 0.3);
  const fHi = inst.anchor0 * (c === 'shitcoin' || c === 'meme' ? 20 : 8);
  if (inst.fund < fLo) inst.fund = fLo;
  else if (inst.fund > fHi) inst.fund = fHi;

  inst.anchor *= Math.exp(Math.log(inst.fund / inst.anchor) * 0.01 + rng.gauss() * 0.0004);

  let f = macroFactor;
  f += (state.sectorHeat[inst.sector] ?? 0) * 0.0015;
  f += REV_COEF[c] * inst.revStrength * Math.log(inst.anchor / inst.price);
  f += MOM_COEF[c] * Math.tanh(inst.momentum * 4);
  f += HYPE_COEF[c] * (inst.hype - inst.hypeBase);
  f += inst.pressure;

  const rn = clamp(inst.lastReturn / Math.max(inst.vol, 1e-7), -4, 4);
  inst.garch.s2 = inst.garch.w + inst.garch.a * rn * rn + inst.garch.b * inst.garch.s2;
  const sigma = inst.vol * Math.sqrt(clamp(inst.garch.s2, 0.1, 14));

  const illiq = (1 - inst.liquidity) * 0.45;
  const z = rng.fatTail();
  let ret = f + sigma * z * (1 + illiq);

  if (c === 'shitcoin' && rng.chance(0.0032)) ret -= rng.float(0.25, 0.85);
  if (c === 'meme' && rng.chance(0.0022)) ret -= rng.float(0.12, 0.4);

  inst.lastReturn = ret;
  const prev = inst.price;
  inst.price = Math.max(prev * Math.exp(ret), 1e-16);

  const maxGap = c === 'shitcoin' ? Math.log(80) : Math.log(15);
  const gap = Math.log(inst.price / inst.anchor);
  if (gap > maxGap) inst.price = inst.anchor * Math.exp(maxGap);
  else if (gap < -maxGap) inst.price = inst.anchor * Math.exp(-maxGap);

  inst.pressure *= 0.55;

  inst.hype = clamp(
    inst.hype + (inst.hypeBase - inst.hype) * 0.005 + inst.momentum * 0.02 + rng.gauss() * 0.008,
    0,
    2
  );

  const baseVol = inst.mcap * 0.0012 * inst.liquidity * (1 + Math.abs(ret) * 40);
  inst.lastVol = baseVol * rng.float(0.4, 1.9);

  inst.funding = clamp(
    (inst.hype - inst.hypeBase) * 0.00022 + inst.momentum * 0.06 - Math.log(inst.anchor / inst.price) * 0.0001,
    -0.0009,
    0.0009
  );

  const o = cs.length ? cs[cs.length - 1].c : inst.price;
  const wick = Math.abs(ret) * 0.35 + sigma * 0.12;
  const candle: Candle = {
    t: state.simTime,
    o,
    h: Math.max(o, inst.price) * (1 + rng.float(0, wick)),
    l: Math.min(o, inst.price) * (1 - rng.float(0, wick)),
    c: inst.price,
    v: inst.lastVol
  };
  cs.push(candle);
  if (cs.length > 240) cs.splice(0, cs.length - 240);

  const dayKey = Math.floor(state.simTime / DAY);
  const lastDaily = inst.daily[inst.daily.length - 1];
  if (!lastDaily || Math.floor(lastDaily.t / DAY) !== dayKey) {
    inst.daily.push({ t: dayKey * DAY, o: inst.price, h: inst.price, l: inst.price, c: inst.price, v: inst.lastVol });
    inst.open = inst.price;
    if (inst.daily.length > 200) inst.daily.splice(0, inst.daily.length - 200);
  } else {
    lastDaily.h = Math.max(lastDaily.h, inst.price);
    lastDaily.l = Math.min(lastDaily.l, inst.price);
    lastDaily.c = inst.price;
    lastDaily.v += inst.lastVol;
  }
}

function processOrders(state: SimState, settings: Settings, rng: RNG): void {
  for (const oid of Object.keys(state.orders)) {
    const o = state.orders[oid];
    if (o.status !== 'open' && o.status !== 'triggered') continue;
    const inst = state.instruments[o.instId];
    if (!inst) {
      o.status = 'rejected';
      continue;
    }
    if (!marketOpen(inst, state.simTime)) continue;

    if (o.type === 'stop' || o.type === 'stop-limit') {
      const stop = o.stopPrice ?? 0;
      const trig = o.side === 'buy' ? inst.price >= stop : inst.price <= stop;
      if (!trig) continue;
      o.status = 'triggered';
      o.note = `Trigger di ${inst.price}`;
      if (o.type === 'stop') {
        fillMarketOrder(state, settings, o, inst);
        continue;
      }
      o.type = 'limit';
    }

    if (o.type === 'market') {
      fillMarketOrder(state, settings, o, inst);
      continue;
    }

    const limit = o.price ?? inst.price;
    const crossed = o.side === 'buy' ? inst.price <= limit : inst.price >= limit;
    if (!crossed) continue;

    const remaining = o.qty - o.filledQty;
    if (remaining <= 1e-9) {
      o.status = 'filled';
      continue;
    }

    const fillFrac = clamp(0.3 + inst.liquidity * 0.85, 0.15, 1) * rng.float(0.55, 1);
    let qty = remaining * fillFrac;
    const feeRate = settings.feeMaker;
    const price = o.side === 'buy' ? Math.min(limit, inst.price) : Math.max(limit, inst.price);
    const affordable = Math.max(0, ((state.cash - qty * price * feeRate) * o.lev) / price);
    if (affordable < qty) qty = affordable;
    if (qty <= 1e-9) {
      o.status = 'cancelled';
      o.note = 'Margin tidak cukup saat fill';
      continue;
    }

    const filled = applyFill(state, o, qty, price, qty * price * feeRate);
    if (filled <= 0) {
      o.status = 'cancelled';
      o.note = 'Margin tidak cukup saat fill';
      continue;
    }
    if (o.filledQty >= o.qty - 1e-9) {
      o.status = 'filled';
    } else if (o.tif === 'IOC') {
      o.status = 'cancelled';
    }
  }
}

function applyFunding(state: SimState): void {
  if (state.ticks % 8 !== 0) return;
  for (const pos of Object.values(state.positions)) {
    const inst = state.instruments[pos.instId];
    if (!inst) continue;
    const notional = pos.qty * inst.price;
    const dir = pos.side === 'long' ? 1 : -1;
    const payment = notional * inst.funding * dir;
    state.cash -= payment;
    pos.fundingPaid += payment;
  }
}

function checkLiquidations(state: SimState, settings: Settings): void {
  if (state.cash < 0) {
    for (const pos of Object.values(state.positions)) {
      const inst = state.instruments[pos.instId];
      if (!inst) continue;
      closePosition(state, pos.id, pos.qty, inst.price, pos.qty * inst.price * 0.01, 'liquidate');
    }
    state.events.unshift({
      id: `mc${state.ticks}`,
      t: state.simTime,
      title: 'MARGIN CALL: seluruh posisi dilikuidasi',
      body: 'Saldo akun negatif. Semua posisi ditutup paksa dan likuiditas ditahan.',
      severity: 'extreme',
      tags: ['Margin', 'Likuidasi'],
      impact: 0,
      instId: null,
      sector: null,
      cls: null
    });
  }
  for (const pos of Object.values(state.positions)) {
    const inst = state.instruments[pos.instId];
    if (!inst) continue;
    const hit =
      (pos.side === 'long' && inst.price <= pos.liqPrice) ||
      (pos.side === 'short' && inst.price >= pos.liqPrice);
    if (!hit) continue;
    const penalty = pos.qty * inst.price * 0.02;
    closePosition(state, pos.id, pos.qty, inst.price, penalty, 'liquidate');
  }
  void settings;
}

export function pushNotice(state: SimState, msg: string): void {
  state.notices.push(msg);
  if (state.notices.length > 20) state.notices.splice(0, state.notices.length - 20);
}

function closeBracket(
  state: SimState,
  settings: Settings,
  pos: Position,
  kind: 'tp' | 'sl' | 'trail',
  label: string
): void {
  const inst = state.instruments[pos.instId];
  if (!inst) return;
  const side = pos.side === 'long' ? 'sell' : 'buy';
  const est = estimateFillPrice(inst, side, pos.qty, settings);
  const dir = pos.side === 'long' ? 1 : -1;
  const movePct = pos.entry > 0 ? ((est.price - pos.entry) / pos.entry) * 100 * dir : 0;
  const res = closePosition(state, pos.id, pos.qty, est.price, est.fee, kind as Fill['kind'], label);
  pushNotice(
    state,
    `${label} ${inst.id}: ${res.pnl >= 0 ? '+' : ''}$${res.pnl.toFixed(0)} (${movePct >= 0 ? '+' : ''}${movePct.toFixed(1)}%)`
  );
}

function checkBrackets(state: SimState, settings: Settings): void {
  for (const pos of Object.values(state.positions)) {
    const inst = state.instruments[pos.instId];
    if (!inst || !marketOpen(inst, state.simTime)) continue;
    const px = inst.price;
    const long = pos.side === 'long';

    if (pos.sl != null) {
      const hit = long ? px <= pos.sl : px >= pos.sl;
      if (hit) {
        closeBracket(state, settings, pos, 'sl', 'Stop loss');
        continue;
      }
    }

    if (pos.trail != null && pos.trail > 0) {
      if (long) {
        if (px > pos.trailPeak) pos.trailPeak = px;
        if (px <= pos.trailPeak * (1 - pos.trail)) {
          closeBracket(state, settings, pos, 'trail', 'Trailing stop');
          continue;
        }
      } else {
        if (pos.trailPeak <= 0 || px < pos.trailPeak) pos.trailPeak = px;
        if (px >= pos.trailPeak * (1 + pos.trail)) {
          closeBracket(state, settings, pos, 'trail', 'Trailing stop');
          continue;
        }
      }
    }

    if (pos.tp != null) {
      const hit = long ? px >= pos.tp : px <= pos.tp;
      if (hit) closeBracket(state, settings, pos, 'tp', 'Take profit');
    }
  }
}

export function checkChallenge(state: SimState): void {
  const ch = state.challenge;
  if (!ch || ch.done) return;
  const eq = equity(state);
  const pct = ch.startEquity > 0 ? (eq / ch.startEquity - 1) * 100 : 0;
  if (pct > ch.bestPct) ch.bestPct = pct;
  const won = eq >= ch.startEquity * (1 + ch.targetPct);
  if (!won && state.ticks < ch.deadlineTick) return;

  ch.done = true;
  ch.finalPct = pct;
  ch.won = won;
  pushNotice(
    state,
    ch.won
      ? `TANTANGAN HARIAN LOLOS: ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
      : `Tantangan harian gagal: ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
  );
  state.events.unshift({
    id: `ch${state.ticks}`,
    t: state.simTime,
    title: ch.won ? 'Tantangan harian lolos' : 'Tantangan harian berakhir',
    body: `Target +${(ch.targetPct * 100).toFixed(0)}%, hasil ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%.`,
    severity: ch.won ? 'med' : 'low',
    tags: ['Harian', 'Tantangan'],
    impact: 0,
    instId: null,
    sector: null,
    cls: null
  });
}

export function unrealizedPnl(state: SimState): number {
  let total = 0;
  for (const pos of Object.values(state.positions)) {
    const inst = state.instruments[pos.instId];
    if (!inst) continue;
    const dir = pos.side === 'long' ? 1 : -1;
    total += (inst.price - pos.entry) * pos.qty * dir;
  }
  return total;
}

export function spotValue(state: SimState): number {
  let total = 0;
  for (const holding of Object.values(state.spotHoldings)) {
    const inst = state.instruments[holding.instId];
    if (inst) total += inst.price * holding.qty;
  }
  return total;
}

export function spotUnrealizedPnl(state: SimState): number {
  let total = 0;
  for (const holding of Object.values(state.spotHoldings)) {
    const inst = state.instruments[holding.instId];
    if (inst) total += (inst.price - holding.avgCost) * holding.qty;
  }
  return total;
}

export function equity(state: SimState): number {
  return (
    state.cash +
    state.locked +
    unrealizedPnl(state) +
    spotValue(state) +
    worldAssetsValue(state.world) +
    lifestyleAssetsValue(state.lifestyle)
  );
}

export function updateHypeIndex(state: SimState): void {
  let sum = 0;
  let n = 0;
  for (const id of state.order) {
    const inst = state.instruments[id];
    if (!inst) continue;
    if (inst.cls === 'meme' || inst.cls === 'shitcoin') {
      sum += inst.hype;
      n++;
    }
  }
  state.hypeIndex = n ? sum / n : 0;
}

export function positionOf(state: SimState, instId: string) {
  return findPosition(state, instId);
}

export function priceOf(state: SimState, instId: string): number {
  return state.instruments[instId]?.price ?? 0;
}

export function estimateOrderFill(
  state: SimState,
  settings: Settings,
  instId: string,
  side: 'buy' | 'sell',
  qty: number
): { price: number; fee: number; slippage: number } {
  const inst = state.instruments[instId];
  if (!inst) return { price: 0, fee: 0, slippage: 0 };
  const est = estimateFillPrice(inst, side, qty, settings);
  return { price: est.price, fee: est.fee, slippage: est.slippage };
}
