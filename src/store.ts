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
  | 'settings'
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

function normalizeSim(sim: SimState, startingCash: number): SimState {
  if (!Array.isArray(sim.bots) || sim.bots.length === 0) sim.bots = createBots(startingCash);
  if (sim.challenge === undefined) sim.challenge = null;
  if (!Array.isArray(sim.notices)) sim.notices = [];
  if (!sim.spotHoldings || typeof sim.spotHoldings !== 'object') sim.spotHoldings = {};
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

  worldBuy: (country: string, commodity: string, qty: number) => void;
  worldSell: (country: string, commodity: string, qty: number) => void;
  worldShip: (from: string, to: string, commodity: string, qty: number) => void;
  worldBuild: (commodity: string) => void;
  worldBlack: (country: string, commodity: string, side: 'buy' | 'sell', qty: number) => void;

  launch: (name: string, ticker: string, kind: 'meme' | 'shitcoin', tags: string[]) => void;
  buyTok: (tokenId: string, usd: number) => void;
  sellTok: (tokenId: string, units: number) => void;

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
      'settings',
      'more'
    ];
    const initialTab = valid.includes(hash) ? hash : 'home';
    const blob = await loadState<SaveBlob>();
    if (blob && blob.sim && blob.sim.instruments) {
      const settings = { ...DEFAULT_SETTINGS, ...blob.settings };
      const sim = normalizeSim(blob.sim, settings.startingCash);
      set({
        sim,
        settings,
        watchlist: blob.watchlist?.length ? blob.watchlist : get().watchlist,
        worldCountry: sim.world.home,
        tab: initialTab,
        booted: true
      });
      set((s) => ({ v: s.v + 1 }));
    } else {
      set({ booted: true, tab: initialTab });
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

    const ch = sim.challenge;
    if (ch && ch.done && !ch.rewarded) {
      ch.rewarded = true;
      const meta = readDailyMeta();
      const pct = ch.finalPct ?? 0;
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
      rewarded: false
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
