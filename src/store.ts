import { create } from 'zustand';
import { createSim, tick } from './sim/engine';
import { cancelOrder, closePositionById, placeOrder } from './sim/trading';
import { buyToken, createToken, launchCost, sellToken } from './sim/launchpad';
import { RNG } from './sim/rng';
import { makeMemeName, makeShitName } from './sim/names';
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

export type Tab = 'market' | 'trade' | 'portfolio' | 'news' | 'launchpad' | 'settings';
export type Timeframe = '1h' | '4h' | '1D' | '1W';

export interface Toast {
  id: number;
  msg: string;
  kind: 'ok' | 'err';
}

interface SaveBlob {
  version: 1;
  settings: Settings;
  sim: SimState;
  watchlist: string[];
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
  booted: boolean;
  saving: boolean;

  boot: () => Promise<void>;
  setTab: (t: Tab) => void;
  select: (id: string) => void;
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
  tab: 'market',
  selectedId: 'BN',
  search: '',
  filter: 'all',
  tf: '1h',
  speed: 1,
  v: 0,
  toast: null,
  watchlist: ['BN', 'EF', 'DGE'],
  booted: false,
  saving: false,

  boot: async () => {
    const hash = (window.location.hash || '').replace('#/', '') as Tab;
    const valid: Tab[] = ['market', 'trade', 'portfolio', 'news', 'launchpad', 'settings'];
    const initialTab = valid.includes(hash) ? hash : 'market';
    const blob = await loadState<SaveBlob>();
    if (blob && blob.version === 1 && blob.sim && blob.sim.instruments) {
      set({
        sim: blob.sim,
        settings: { ...DEFAULT_SETTINGS, ...blob.settings },
        watchlist: blob.watchlist?.length ? blob.watchlist : get().watchlist,
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
    set({ sim, settings: next, watchlist: ['BN', 'EF', 'DGE'], selectedId: 'BN', tab: 'market' });
    set((st) => ({ v: st.v + 1 }));
  },

  save: async () => {
    const { sim, settings, watchlist } = get();
    set({ saving: true });
    const blob: SaveBlob = { version: 1, settings, sim: trimSim(sim), watchlist };
    const ok = await saveState(blob);
    set({ saving: false });
    if (!ok) get().notify('Gagal menyimpan progres', 'err');
  },

  exportSave: () => {
    const { sim, settings, watchlist } = get();
    const blob: SaveBlob = { version: 1, settings, sim: trimSim(sim), watchlist };
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
      set({
        sim: blob.sim,
        settings: { ...DEFAULT_SETTINGS, ...blob.settings },
        watchlist: blob.watchlist ?? []
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
