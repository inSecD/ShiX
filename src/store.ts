import { create } from 'zustand';
import { createSim, equity, tick } from './sim/engine';
import {
  buySpot,
  cancelOrder,
  closePositionById,
  placeOrder,
  sellSpot,
  setBracket
} from './sim/trading';
import { buyToken, createToken, launchCost, sellToken } from './sim/launchpad';
import { applyScenario, scenarioById } from './sim/scenarios';
import { claimMissionRewards } from './sim/missions';
import { RNG, hashString, randomSeed } from './sim/rng';
import { makeMemeName, makeShitName } from './sim/names';
import { createBots } from './sim/bots';
import {
  blackTrade,
  buildFactory,
  buyCommodity,
  normalizeWorld,
  sellCommodity,
  shipCommodity,
  trimWorld
} from './sim/world';
import { buyAsset, normalizeLifestyle, sellAsset } from './sim/lifestyle';
import { buyBusiness, normalizeBusiness, upgradeBusiness } from './sim/business';
import { feedFromYou, normalizeFeed } from './sim/feed';
import { LOCATION_BY_ID, isLocationUnlocked, locationHint, normalizeHub } from './sim/hub';
import { chatWith, normalizeSocial } from './sim/social';
import { clearState, loadState, saveState } from './lib/persist';
import type {
  AssetClass,
  LaunchToken,
  Order,
  OrderSide,
  OrderType,
  Settings,
  SimState
} from './sim/types';

export type Tab =
  | 'home'
  | 'market'
  | 'world'
  | 'trade'
  | 'portfolio'
  | 'news'
  | 'launchpad'
  | 'rank'
  | 'lifestyle'
  | 'hub'
  | 'settings'
  | 'modes'
  | 'more';
export type Timeframe = '1h' | '4h' | '1D' | '1W';

export interface Toast {
  id: number;
  msg: string;
  kind: 'ok' | 'err';
}

interface SaveBlob {
  version: 4;
  settings: Settings;
  sim: SimState;
  watchlist: string[];
}

const DAILY_META_KEY = 'shix.daily.meta.v1';
const DAILY_TARGET = 0.1;
const DAILY_TICKS = 7 * 24;

export interface DailyMeta {
  streak: number;
  lastDay: string;
  best: number;
}

export function dayKeyOf(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKeyOf(d);
}

export function readDailyMeta(): DailyMeta {
  try {
    const raw = localStorage.getItem(DAILY_META_KEY);
    if (!raw) return { streak: 0, lastDay: '', best: 0 };
    const parsed = JSON.parse(raw) as Partial<DailyMeta>;
    return {
      streak: Number(parsed.streak) || 0,
      lastDay: typeof parsed.lastDay === 'string' ? parsed.lastDay : '',
      best: Number(parsed.best) || 0
    };
  } catch {
    return { streak: 0, lastDay: '', best: 0 };
  }
}

function writeDailyMeta(meta: DailyMeta): void {
  try {
    localStorage.setItem(DAILY_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

const TUT_KEY = 'shix.tutorial.v1';

export interface TutState {
  step: number;
  done: boolean;
}

export function readTut(): TutState | null {
  try {
    const raw = localStorage.getItem(TUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TutState>;
    return { step: Number(parsed.step) || 0, done: !!parsed.done };
  } catch {
    return null;
  }
}

export function writeTut(state: TutState): void {
  try {
    localStorage.setItem(TUT_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function normalizeSim(sim: SimState, startingCash: number): SimState {
  if (!Array.isArray(sim.bots) || sim.bots.length === 0) sim.bots = createBots(startingCash);
  if (sim.challenge === undefined) sim.challenge = null;
  if (sim.challenge) {
    if (sim.challenge.scenarioId === undefined) sim.challenge.scenarioId = null;
    if (!sim.challenge.label) sim.challenge.label = 'Tantangan Harian';
  }
  if (!Array.isArray(sim.notices)) sim.notices = [];
  if (!sim.progress || typeof sim.progress !== 'object') sim.progress = {};
  if (!sim.tokenCost || typeof sim.tokenCost !== 'object') sim.tokenCost = {};
  if (!sim.tokenHoldings || typeof sim.tokenHoldings !== 'object') sim.tokenHoldings = {};
  if (sim.tokens && typeof sim.tokens === 'object') {
    for (const tk of Object.values(sim.tokens)) {
      if (!tk) continue;
      if (!Array.isArray(tk.history) || tk.history.length === 0) tk.history = [tk.price];
    }
  }
  if (!sim.spotHoldings || typeof sim.spotHoldings !== 'object') sim.spotHoldings = {};
  sim.lifestyle = normalizeLifestyle(sim.lifestyle, sim.ticks);
  sim.hub = normalizeHub(sim.hub);
  sim.business = normalizeBusiness(sim.business, sim.ticks);
  sim.social = normalizeSocial(sim.social);
  sim.feed = normalizeFeed(sim.feed);
  sim.pendingEvent = null;
  for (const [id, holding] of Object.entries(sim.spotHoldings)) {
    if (
      !sim.instruments[id] ||
      !holding ||
      !Number.isFinite(holding.qty) ||
      holding.qty <= 0 ||
      !Number.isFinite(holding.avgCost) ||
      holding.avgCost <= 0
    ) {
      delete sim.spotHoldings[id];
      continue;
    }
    holding.instId = id;
    if (!Number.isFinite(holding.openedAt)) holding.openedAt = sim.simTime;
  }
  // heal older saves where a token graduated but its presale holdings were never
  // migrated to spot (they were stuck and unsellable). carry them over now.
  for (const tokenId of Object.keys(sim.tokenHoldings)) {
    const held = sim.tokenHoldings[tokenId] ?? 0;
    if (!(held > 0)) continue;
    const token = sim.tokens[tokenId];
    if (!token || !token.graduated || !token.instId) continue;
    const inst = sim.instruments[token.instId];
    if (!inst) continue;
    const paid = sim.tokenCost[tokenId] ?? 0;
    const avgCost = paid > 0 ? paid / held : inst.price;
    const existing = sim.spotHoldings[inst.id];
    if (existing) {
      const nextQty = existing.qty + held;
      existing.avgCost = (existing.avgCost * existing.qty + avgCost * held) / nextQty;
      existing.qty = nextQty;
    } else {
      sim.spotHoldings[inst.id] = { instId: inst.id, qty: held, avgCost, openedAt: sim.simTime };
    }
    sim.tokenHoldings[tokenId] = 0;
    sim.tokenCost[tokenId] = 0;
  }
  for (const pos of Object.values(sim.positions)) {
    if (pos.tp === undefined) pos.tp = null;
    if (pos.sl === undefined) pos.sl = null;
    if (pos.trail === undefined) pos.trail = null;
    if (typeof pos.trailPeak !== 'number') pos.trailPeak = 0;
  }
  sim.world = normalizeWorld(sim.world, sim.seed, sim.ticks);
  for (const bot of sim.bots) {
    if (!Array.isArray(bot.holdings)) bot.holdings = [];
    if (!Number.isFinite(bot.startEquity) || bot.startEquity <= 0) bot.startEquity = startingCash;
    if (!Number.isFinite(bot.cash)) bot.cash = 0;
    if (!Number.isFinite(bot.equity)) bot.equity = bot.startEquity;
    if (!Number.isFinite(bot.pnlPct)) bot.pnlPct = 0;
    if (!Number.isFinite(bot.trades)) bot.trades = 0;
    if (!Number.isFinite(bot.lastTrade)) bot.lastTrade = 0;
  }
  return sim;
}

const DEFAULT_SETTINGS: Settings = {
  seed: 20260105,
  startingCash: 100000,
  difficulty: 'normal',
  maxLeverage: 10,
  feeTaker: 0.0004,
  feeMaker: 0.0002,
  slippageEnabled: true,
  sound: false
};

function trimSim(sim: SimState): SimState {
  const out: SimState = JSON.parse(JSON.stringify(sim));
  for (const id of Object.keys(out.instruments)) {
    const inst = out.instruments[id];
    if (inst.candles.length > 48) inst.candles = inst.candles.slice(-48);
    if (inst.daily.length > 60) inst.daily = inst.daily.slice(-60);
  }
  if (out.events.length > 120) out.events = out.events.slice(0, 120);
  if (out.fills.length > 120) out.fills = out.fills.slice(0, 120);
  if (out.equityCurve.length > 600) out.equityCurve = out.equityCurve.slice(-600);
  if (out.notices.length > 20) out.notices = out.notices.slice(-20);
  trimWorld(out.world);
  return out;
}

let toastId = 0;

interface Store {
  sim: SimState;
  settings: Settings;
  tab: Tab;
  selectedId: string;
  search: string;
  filter: AssetClass | 'all' | 'watch';
  tf: Timeframe;
  speed: number;
  v: number;
  toast: Toast | null;
  watchlist: string[];
  worldCountry: string;
  booted: boolean;
  saving: boolean;

  boot: () => Promise<void>;
  setTab: (t: Tab) => void;
  select: (id: string) => void;
  setWorldCountry: (id: string) => void;
  setSearch: (s: string) => void;
  setFilter: (f: AssetClass | 'all' | 'watch') => void;
  setTf: (t: Timeframe) => void;
  setSpeed: (s: number) => void;
  toggleWatch: (id: string) => void;
  notify: (msg: string, kind?: 'ok' | 'err') => void;
  dismissToast: () => void;

  doTick: (n: number) => void;
  order: (p: {
    instId: string;
    side: OrderSide;
    type: OrderType;
    qty: number;
    price?: number | null;
    stopPrice?: number | null;
    lev: number;
    tif?: 'GTC' | 'IOC';
  }) => void;
  cancel: (orderId: string) => void;
  closePos: (posId: string, fraction: number) => void;
  closeAll: () => void;
  spotBuy: (instId: string, usd: number) => void;
  spotSell: (instId: string, qty: number) => void;
  setRisk: (posId: string, tp: number | null, sl: number | null, trail: number | null) => void;
  startDaily: () => void;
  exitDaily: () => void;
  startScenario: (id: string) => void;
  exitScenario: () => void;

  tutActive: boolean;
  tutStep: number;
  tutDone: boolean;
  startTut: (from?: number) => void;
  tutNext: () => void;
  tutPrev: () => void;
  tutEnd: (completed?: boolean) => void;

  worldBuy: (country: string, commodity: string, qty: number) => void;
  worldSell: (country: string, commodity: string, qty: number) => void;
  worldShip: (from: string, to: string, commodity: string, qty: number) => void;
  worldBuild: (commodity: string) => void;
  worldBlack: (country: string, commodity: string, side: 'buy' | 'sell', qty: number) => void;

  launch: (name: string, ticker: string, kind: 'meme' | 'shitcoin', tags: string[]) => void;
  buyTok: (tokenId: string, usd: number) => void;
  sellTok: (tokenId: string, units: number) => void;

  lifestyleBuy: (assetId: string) => void;
  lifestyleSell: (assetId: string) => void;

  businessBuy: (businessId: string) => void;
  businessUpgrade: (businessId: string) => void;

  hubGoto: (locId: string) => void;

  npcChat: (botId: string) => void;

  reset: (seed?: number, cash?: number) => void;
  save: () => Promise<void>;
  exportSave: () => void;
  importSave: (text: string) => Promise<void>;
  setSettings: (patch: Partial<Settings>) => void;
}

export const useStore = create<Store>((set, get) => ({
  sim: createSim(DEFAULT_SETTINGS),
  settings: DEFAULT_SETTINGS,
  tab: 'home',
  selectedId: 'BN',
  search: '',
  filter: 'all',
  tf: '1h',
  speed: 1,
  v: 0,
  toast: null,
  watchlist: ['BN', 'EF', 'DGE'],
  worldCountry: 'ID',
  booted: false,
  saving: false,
  tutActive: false,
  tutStep: 0,
  tutDone: false,

  boot: async () => {
    const hash = (window.location.hash || '').replace('#/', '') as Tab;
    const valid: Tab[] = [
      'home',
      'market',
      'world',
      'trade',
      'portfolio',
      'news',
      'launchpad',
      'rank',
      'lifestyle',
      'hub',
      'settings',
      'modes',
      'more'
    ];
    const initialTab = valid.includes(hash) ? hash : 'home';
    const blob = await loadState<SaveBlob>();
    const tut = readTut();
    // brand new player: auto-launch the guided tutorial overlay
    const firstRun = tut === null;
    const tutState: TutState = tut ?? { step: 0, done: false };
    if (firstRun) writeTut(tutState);
    if (blob && blob.sim && blob.sim.instruments) {
      const settings = { ...DEFAULT_SETTINGS, ...blob.settings };
      const sim = normalizeSim(blob.sim, settings.startingCash);
      set({
        sim,
        settings,
        watchlist: blob.watchlist?.length ? blob.watchlist : get().watchlist,
        worldCountry: sim.world.home,
        tab: initialTab,
        booted: true,
        tutStep: tutState.step,
        tutDone: tutState.done,
        tutActive: firstRun && !tutState.done
      });
      set((s) => ({ v: s.v + 1 }));
    } else {
      set({
        booted: true,
        tab: initialTab,
        tutStep: tutState.step,
        tutDone: tutState.done,
        tutActive: firstRun && !tutState.done
      });
    }
  },

  setTab: (t) => {
    set({ tab: t });
    try {
      if (window.location.hash !== '#/' + t) window.history.replaceState(null, '', '#/' + t);
    } catch {
      /* ignore */
    }
  },
  select: (id) => set({ selectedId: id }),
  setWorldCountry: (id) => set({ worldCountry: id }),
  setSearch: (s) => set({ search: s }),
  setFilter: (f) => set({ filter: f }),
  setTf: (t) => set({ tf: t }),
  setSpeed: (s) => set({ speed: s }),
  toggleWatch: (id) =>
    set((s) => ({
      watchlist: s.watchlist.includes(id)
        ? s.watchlist.filter((w) => w !== id)
        : [...s.watchlist, id]
    })),

  notify: (msg, kind = 'ok') => {
    toastId += 1;
    set({ toast: { id: toastId, msg, kind } });
  },
  dismissToast: () => set({ toast: null }),

  doTick: (n) => {
    const { sim, settings } = get();
    for (let i = 0; i < n; i++) tick(sim, settings);

    claimMissionRewards(sim, settings.startingCash);

    const ch = sim.challenge;
    if (ch && ch.done && !ch.rewarded) {
      ch.rewarded = true;
      const pct = ch.finalPct ?? 0;
      // daily streak bookkeeping only applies to the real daily challenge,
      // not to scenario runs (they use their own ids as dayKey).
      if (!ch.scenarioId) {
        const meta = readDailyMeta();
        if (ch.won) {
          meta.streak =
            meta.lastDay === ch.dayKey ? Math.max(1, meta.streak) : meta.lastDay === yesterdayKey() ? meta.streak + 1 : 1;
          meta.lastDay = ch.dayKey;
        } else {
          meta.streak = 0;
          meta.lastDay = ch.dayKey;
        }
        meta.best = Math.max(meta.best, pct);
        writeDailyMeta(meta);
      }
    }

    if (sim.notices.length) {
      const notes = sim.notices.splice(0, sim.notices.length);
      const last = notes[notes.length - 1];
      toastId += 1;
      set({
        toast: {
          id: toastId,
          msg: notes.length > 1 ? `${last} (+${notes.length - 1})` : last,
          kind: /gagal/i.test(last) ? 'err' : 'ok'
        }
      });
    }
    set((s) => ({ v: s.v + 1 }));
  },

  order: (p) => {
    const { sim, settings, notify } = get();
    const res = placeOrder(sim, settings, p);
    if (res.ok) sim.progress.bought = true;
    notify(res.msg, res.ok ? 'ok' : 'err');
    set((s) => ({ v: s.v + 1 }));
  },

  cancel: (orderId) => {
    cancelOrder(get().sim, orderId);
    set((s) => ({ v: s.v + 1 }));
  },

  closePos: (posId, fraction) => {
    const { sim, settings, notify } = get();
    const res = closePositionById(sim, posId, settings, fraction);
    notify(res.msg, res.ok ? 'ok' : 'err');
    set((s) => ({ v: s.v + 1 }));
  },

  closeAll: () => {
    const { sim, settings, notify } = get();
    const ids = Object.keys(sim.positions);
    for (const id of ids) closePositionById(sim, id, settings, 1);
    notify(`${ids.length} posisi ditutup`, 'ok');
    set((s) => ({ v: s.v + 1 }));
  },

  spotBuy: (instId, usd) => {
    const { sim, settings, notify } = get();
    const res = buySpot(sim, settings, instId, usd);
    if (res.ok) sim.progress.bought = true;
    notify(res.msg, res.ok ? 'ok' : 'err');
    set((s) => ({ v: s.v + 1 }));
  },

  spotSell: (instId, qty) => {
    const { sim, settings, notify } = get();
    const res = sellSpot(sim, settings, instId, qty);
    notify(res.msg, res.ok ? 'ok' : 'err');
    set((s) => ({ v: s.v + 1 }));
  },

  worldBuy: (country, commodity, qty) => {
    const { sim, notify } = get();
    const res = buyCommodity(sim, country, commodity, qty);
    notify(res.msg, res.ok ? 'ok' : 'err');
    set((s) => ({ v: s.v + 1 }));
  },

  worldSell: (country, commodity, qty) => {
    const { sim, notify } = get();
    const res = sellCommodity(sim, country, commodity, qty);
    notify(res.msg, res.ok ? 'ok' : 'err');
    set((s) => ({ v: s.v + 1 }));
  },

  worldShip: (from, to, commodity, qty) => {
    const { sim, notify } = get();
    const res = shipCommodity(sim, from, to, commodity, qty);
    notify(res.msg, res.ok ? 'ok' : 'err');
    set((s) => ({ v: s.v + 1 }));
  },

  worldBuild: (commodity) => {
    const { sim, notify } = get();
    const res = buildFactory(sim, commodity);
    if (res.ok) sim.progress.factory = true;
    notify(res.msg, res.ok ? 'ok' : 'err');
    set((s) => ({ v: s.v + 1 }));
  },

  worldBlack: (country, commodity, side, qty) => {
    const { sim, notify } = get();
    const res = blackTrade(sim, country, commodity, side, qty);
    notify(res.msg, res.ok ? 'ok' : 'err');
    set((s) => ({ v: s.v + 1 }));
  },

  setRisk: (posId, tp, sl, trail) => {
    const { sim, notify } = get();
    const res = setBracket(sim, posId, tp, sl, trail);
    if (res.ok && (tp != null || sl != null || trail != null)) sim.progress.bracket = true;
    notify(res.msg, res.ok ? 'ok' : 'err');
    set((s) => ({ v: s.v + 1 }));
  },

  startDaily: () => {
    const s = get().settings;
    const prev = get().sim.challenge;
    const dayKey = dayKeyOf();
    const seed = hashString(`shix-daily:${dayKey}`);
    const next: Settings = { ...s, seed, startingCash: 100000 };
    const sim = createSim(next);
    const meta = readDailyMeta();
    sim.challenge = {
      dayKey,
      seed,
      startEquity: equity(sim),
      targetPct: DAILY_TARGET,
      startTick: sim.ticks,
      deadlineTick: sim.ticks + DAILY_TICKS,
      done: false,
      won: false,
      bestPct: 0,
      finalPct: null,
      attempts: prev && prev.dayKey === dayKey ? prev.attempts + 1 : 1,
      streak: meta.streak,
      rewarded: false,
      scenarioId: null,
      label: 'Tantangan Harian'
    };
    set({
      sim,
      settings: next,
      watchlist: ['BN', 'EF', 'DGE'],
      selectedId: 'BN',
      worldCountry: sim.world.home,
      tab: 'market'
    });
    set((st) => ({ v: st.v + 1 }));
    get().notify(`Tantangan ${dayKey} dimulai: target +${(DAILY_TARGET * 100).toFixed(0)}% dalam 7 hari`, 'ok');
  },

  exitDaily: () => {
    const s = get().settings;
    const next: Settings = { ...s, seed: randomSeed() };
    const sim = createSim(next);
    set({ sim, settings: next, selectedId: 'BN', watchlist: ['BN', 'EF', 'DGE'], worldCountry: sim.world.home, tab: 'market' });
    set((st) => ({ v: st.v + 1 }));
    get().notify('Mode harian selesai. Dunia normal baru dibuat.', 'ok');
  },

  startScenario: (id) => {
    const sc = scenarioById(id);
    if (!sc) return;
    const base = get().settings;
    const next: Settings = {
      ...base,
      seed: hashString(`shix-scenario:${id}:${dayKeyOf()}`),
      startingCash: sc.startingCash,
      difficulty: sc.difficulty,
      maxLeverage: sc.maxLeverage
    };
    const sim = createSim(next);
    applyScenario(sim, sc);
    sim.challenge = {
      dayKey: `${id}:${dayKeyOf()}`,
      seed: next.seed,
      startEquity: equity(sim),
      targetPct: sc.targetPct,
      startTick: sim.ticks,
      deadlineTick: sim.ticks + sc.days * 24,
      done: false,
      won: false,
      bestPct: 0,
      finalPct: null,
      attempts: 1,
      streak: 0,
      rewarded: false,
      scenarioId: sc.id,
      label: sc.name
    };
    set({
      sim,
      settings: next,
      selectedId: 'BN',
      watchlist: ['BN', 'EF', 'DGE'],
      worldCountry: sim.world.home,
      tab: 'market'
    });
    set((st) => ({ v: st.v + 1 }));
    get().notify(`Skenario "${sc.name}" dimulai — ${sc.tagline}`, 'ok');
  },

  exitScenario: () => {
    const s = get().settings;
    const next: Settings = { ...s, seed: randomSeed(), startingCash: 100000, difficulty: 'normal', maxLeverage: 10 };
    const sim = createSim(next);
    set({
      sim,
      settings: next,
      selectedId: 'BN',
      watchlist: ['BN', 'EF', 'DGE'],
      worldCountry: sim.world.home,
      tab: 'market'
    });
    set((st) => ({ v: st.v + 1 }));
    get().notify('Skenario selesai. Dunia normal baru dibuat.', 'ok');
  },

  startTut: (from) => {
    const saved = readTut();
    const step = from ?? (saved && !saved.done ? saved.step : 0);
    writeTut({ step, done: false });
    set({ tutActive: true, tutStep: step, tutDone: false });
  },
  tutNext: () => {
    set((s) => ({ tutStep: s.tutStep + 1 }));
    const st = get();
    writeTut({ step: st.tutStep, done: false });
  },
  tutPrev: () => {
    set((s) => ({ tutStep: Math.max(0, s.tutStep - 1) }));
    const st = get();
    writeTut({ step: st.tutStep, done: false });
  },
  tutEnd: (completed = false) => {
    const st = get();
    const done = completed ? true : st.tutDone;
    writeTut({ step: st.tutStep, done });
    set({ tutActive: false, tutDone: done });
  },

  launch: (name, ticker, kind, tags) => {
    const { sim, settings, notify } = get();
    const cost = launchCost(settings);
    if (sim.cash < cost) {
      notify('Dana tidak cukup untuk biaya launch', 'err');
      return;
    }
    sim.cash -= cost;
    const rng = new RNG((sim.rngState ^ Date.now()) >>> 0);
    const token = createToken(sim, rng, {
      name,
      ticker,
      kind,
      tags,
      owner: 'player',
      marketing: 0.8
    });
    sim.progress.launched = true;
    notify(`Token ${token.ticker} live di launchpad`, 'ok');
    set((s) => ({ v: s.v + 1 }));
  },

  buyTok: (tokenId, usd) => {
    const { sim, notify } = get();
    const res = buyToken(sim, tokenId, usd);
    notify(res.ok ? `Beli ${res.tokens.toPrecision(4)} token @ ${res.price.toPrecision(6)}` : res.msg, res.ok ? 'ok' : 'err');
    set((s) => ({ v: s.v + 1 }));
  },

  sellTok: (tokenId, units) => {
    const { sim, notify } = get();
    const res = sellToken(sim, tokenId, units);
    notify(res.ok ? `Jual seharga $${res.proceeds.toFixed(2)}` : res.msg, res.ok ? 'ok' : 'err');
    set((s) => ({ v: s.v + 1 }));
  },

  lifestyleBuy: (assetId) => {
    const { sim, notify } = get();
    const res = buyAsset(sim, assetId);
    notify(res.msg, res.ok ? 'ok' : 'err');
    if (res.ok) feedFromYou(sim, `${res.msg} Flex sekali, terus gas trading lagi.`, 'Lifestyle');
    set((s) => ({ v: s.v + 1 }));
  },

  lifestyleSell: (assetId) => {
    const { sim, notify } = get();
    const res = sellAsset(sim, assetId);
    notify(res.msg, res.ok ? 'ok' : 'err');
    set((s) => ({ v: s.v + 1 }));
  },

  businessBuy: (businessId) => {
    const { sim, notify } = get();
    const res = buyBusiness(sim, businessId);
    notify(res.msg, res.ok ? 'ok' : 'err');
    if (res.ok) feedFromYou(sim, `${res.msg}. Cashflow jalan tiap jam sekarang.`, 'Bisnis');
    set((s) => ({ v: s.v + 1 }));
  },

  businessUpgrade: (businessId) => {
    const { sim, notify } = get();
    const res = upgradeBusiness(sim, businessId);
    notify(res.msg, res.ok ? 'ok' : 'err');
    if (res.ok) feedFromYou(sim, `${res.msg}. Expand terus.`, 'Bisnis');
    set((s) => ({ v: s.v + 1 }));
  },

  hubGoto: (locId) => {
    const { sim, notify } = get();
    const def = LOCATION_BY_ID[locId];
    if (!def) return;
    if (!isLocationUnlocked(def, sim.lifestyle.owned)) {
      notify(`Lokasi terkunci · ${locationHint(def)}`, 'err');
      return;
    }
    const hub = sim.hub;
    if (hub.locId === locId) return;
    hub.locId = locId;
    if (!hub.visited.includes(locId)) hub.visited.push(locId);
    notify(`${def.icon} ${def.name} · ${def.mood}`, 'ok');
    set((s) => ({ v: s.v + 1 }));
  },

  npcChat: (botId) => {
    const { sim, notify } = get();
    const res = chatWith(sim, botId);
    notify(res.msg, res.ok ? 'ok' : 'err');
    set((s) => ({ v: s.v + 1 }));
  },

  reset: (seed, cash) => {
    const s = get().settings;
    const next: Settings = {
      ...s,
      seed: seed ?? Math.floor(Math.random() * 0xffffffff),
      startingCash: cash ?? s.startingCash
    };
    const sim = createSim(next);
    set({ sim, settings: next, watchlist: ['BN', 'EF', 'DGE'], selectedId: 'BN', worldCountry: sim.world.home, tab: 'market' });
    set((st) => ({ v: st.v + 1 }));
  },

  save: async () => {
    const { sim, settings, watchlist } = get();
    set({ saving: true });
    const blob: SaveBlob = { version: 4, settings, sim: trimSim(sim), watchlist };
    const ok = await saveState(blob);
    set({ saving: false });
    if (!ok) get().notify('Gagal menyimpan progres', 'err');
  },

  exportSave: () => {
    const { sim, settings, watchlist } = get();
    const blob: SaveBlob = { version: 4, settings, sim: trimSim(sim), watchlist };
    const text = JSON.stringify(blob);
    const blobUrl = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `shix-save-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  },

  importSave: async (text) => {
    try {
      const blob = JSON.parse(text) as SaveBlob;
      if (!blob.sim?.instruments) throw new Error('format salah');
      const settings = { ...DEFAULT_SETTINGS, ...blob.settings };
      const sim = normalizeSim(blob.sim, settings.startingCash);
      set({
        sim,
        settings,
        watchlist: blob.watchlist ?? [],
        worldCountry: sim.world.home
      });
      set((s) => ({ v: s.v + 1 }));
      get().notify('Save berhasil diimport', 'ok');
    } catch {
      get().notify('File save tidak valid', 'err');
    }
  },

  setSettings: (patch) => {
    set((s) => {
      const next = { ...s.settings, ...patch };
      if (patch.difficulty) {
        if (patch.difficulty === 'easy') {
          next.feeTaker = 0.0002;
          next.feeMaker = 0.0001;
        } else if (patch.difficulty === 'brutal') {
          next.feeTaker = 0.0008;
          next.feeMaker = 0.0004;
        } else {
          next.feeTaker = 0.0004;
          next.feeMaker = 0.0002;
        }
      }
      return { settings: next };
    });
    set((s) => ({ v: s.v + 1 }));
  }
}));

export function suggestName(kind: 'meme' | 'shitcoin'): { name: string; ticker: string } {
  const rng = new RNG((Math.random() * 0xffffffff) >>> 0);
  return kind === 'meme' ? makeMemeName(rng) : makeShitName(rng);
}

export function openOrders(sim: SimState): Order[] {
  return Object.values(sim.orders)
    .filter((o) => o.status === 'open' || o.status === 'triggered')
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function tokenList(sim: SimState): LaunchToken[] {
  return sim.tokenOrder.map((id) => sim.tokens[id]).filter(Boolean);
}

export { clearState };
