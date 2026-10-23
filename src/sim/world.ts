import { RNG } from './rng';
import type { MacroState, SimState } from './types';

export type CommodityId =
  | 'food'
  | 'energy'
  | 'metals'
  | 'tech'
  | 'textiles'
  | 'chem'
  | 'machines'
  | 'luxury';

export type CommodityCategory = 'agri' | 'energy' | 'industrial' | 'tech' | 'consumer' | 'capital';

export interface CommodityDef {
  id: CommodityId;
  name: string;
  icon: string;
  cat: CommodityCategory;
  base: number;
  vol: number;
  freight: number;
}

export interface CountryDef {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  infra: number;
  logistics: number;
  capital: number;
  regulation: number;
  volatility: number;
  climate: number;
  marketSize: number;
  weights: Record<CommodityCategory, number>;
}

export interface MarketState {
  price: number;
  supply: number;
  demand: number;
  prod: number;
  history: number[];
}

export interface Holding {
  country: string;
  commodity: CommodityId;
  qty: number;
  avgCost: number;
}

export interface Factory {
  id: string;
  country: string;
  commodity: CommodityId;
  level: number;
  builtTick: number;
}

export interface Shipment {
  id: string;
  commodity: CommodityId;
  qty: number;
  from: string;
  to: string;
  cost: number;
  avgCost: number;
  departTick: number;
  arriveTick: number;
  status: 'in_transit' | 'arrived';
}

export type FlowKind = 'ai' | 'black' | 'player';

export interface TradeFlow {
  id: string;
  from: string;
  to: string;
  commodity: CommodityId;
  qty: number;
  value: number;
  kind: FlowKind;
  tick: number;
}

export interface WorldEvent {
  id: string;
  tick: number;
  title: string;
  body: string;
  severity: 'low' | 'med' | 'high' | 'extreme';
  tags: string[];
}

export interface WorldLog {
  tick: number;
  kind: 'buy' | 'sell' | 'ship' | 'factory' | 'black';
  text: string;
}

export interface WorldStats {
  trades: number;
  volume: number;
  shipments: number;
  shipVolume: number;
  factories: number;
  blackTrades: number;
  blackSeized: number;
  realized: number;
}

export interface WorldState {
  home: string;
  tick: number;
  rngState: number;
  markets: Record<string, MarketState>;
  holdings: Holding[];
  factories: Factory[];
  shipments: Shipment[];
  flows: TradeFlow[];
  events: WorldEvent[];
  logs: WorldLog[];
  xp: number;
  level: number;
  stats: WorldStats;
}

export interface BlackOffer {
  commodity: CommodityId;
  side: 'buy' | 'sell';
  marketPrice: number;
  price: number;
  coverage: number;
  held: number;
  risk: number;
  edgePct: number;
}

export interface RouteEstimate {
  from: string;
  to: string;
  commodity: CommodityId;
  buyPrice: number;
  sellPrice: number;
  spreadPct: number;
  cost: number;
  ticks: number;
  freight: number;
}

export const COMMODITIES: CommodityDef[] = [
  { id: 'food', name: 'Pangan', icon: '🌾', cat: 'agri', base: 10, vol: 0.15, freight: 1.0 },
  { id: 'energy', name: 'Energi', icon: '⚡', cat: 'energy', base: 50, vol: 0.3, freight: 1.2 },
  { id: 'metals', name: 'Logam', icon: '⛏️', cat: 'industrial', base: 30, vol: 0.25, freight: 1.5 },
  { id: 'tech', name: 'Komponen Tech', icon: '💻', cat: 'tech', base: 120, vol: 0.35, freight: 0.6 },
  { id: 'textiles', name: 'Tekstil', icon: '🧵', cat: 'consumer', base: 15, vol: 0.12, freight: 0.8 },
  { id: 'chem', name: 'Kimia', icon: '🧪', cat: 'industrial', base: 40, vol: 0.2, freight: 1.1 },
  { id: 'machines', name: 'Mesin', icon: '⚙️', cat: 'capital', base: 80, vol: 0.18, freight: 1.4 },
  { id: 'luxury', name: 'Barang Mewah', icon: '💎', cat: 'consumer', base: 200, vol: 0.4, freight: 0.5 }
];

export const COUNTRIES: CountryDef[] = [
  {
    id: 'ID',
    name: 'Indonesia',
    region: 'Asia Tenggara',
    lat: -0.79,
    lon: 113.92,
    infra: 3,
    logistics: 4,
    capital: 3,
    regulation: 3,
    volatility: 2,
    climate: 4,
    marketSize: 5,
    weights: { agri: 1.4, energy: 1.2, industrial: 1.2, tech: 0.5, consumer: 1.3, capital: 0.6 }
  },
  {
    id: 'SG',
    name: 'Singapura',
    region: 'Asia Tenggara',
    lat: 1.35,
    lon: 103.82,
    infra: 1,
    logistics: 1,
    capital: 1,
    regulation: 2,
    volatility: 1,
    climate: 2,
    marketSize: 3,
    weights: { agri: 0.4, energy: 0.6, industrial: 0.5, tech: 1.4, consumer: 1.0, capital: 1.2 }
  },
  {
    id: 'JP',
    name: 'Jepang',
    region: 'Asia Timur',
    lat: 36.2,
    lon: 138.25,
    infra: 1,
    logistics: 1,
    capital: 2,
    regulation: 3,
    volatility: 1,
    climate: 3,
    marketSize: 5,
    weights: { agri: 0.4, energy: 0.5, industrial: 1.0, tech: 1.4, consumer: 0.9, capital: 1.4 }
  },
  {
    id: 'CN',
    name: 'Tiongkok',
    region: 'Asia Timur',
    lat: 35.86,
    lon: 104.2,
    infra: 2,
    logistics: 2,
    capital: 3,
    regulation: 4,
    volatility: 3,
    climate: 3,
    marketSize: 5,
    weights: { agri: 0.7, energy: 0.7, industrial: 1.5, tech: 1.0, consumer: 1.1, capital: 1.0 }
  },
  {
    id: 'US',
    name: 'Amerika Serikat',
    region: 'Amerika Utara',
    lat: 37.09,
    lon: -95.71,
    infra: 2,
    logistics: 2,
    capital: 1,
    regulation: 4,
    volatility: 1,
    climate: 3,
    marketSize: 5,
    weights: { agri: 0.9, energy: 0.8, industrial: 0.7, tech: 1.5, consumer: 1.2, capital: 1.3 }
  },
  {
    id: 'DE',
    name: 'Jerman',
    region: 'Eropa',
    lat: 51.17,
    lon: 10.45,
    infra: 1,
    logistics: 1,
    capital: 2,
    regulation: 4,
    volatility: 1,
    climate: 2,
    marketSize: 4,
    weights: { agri: 0.5, energy: 0.4, industrial: 1.2, tech: 1.0, consumer: 0.8, capital: 1.5 }
  },
  {
    id: 'BR',
    name: 'Brasil',
    region: 'Amerika Selatan',
    lat: -14.24,
    lon: -51.93,
    infra: 3,
    logistics: 4,
    capital: 3,
    regulation: 4,
    volatility: 3,
    climate: 4,
    marketSize: 4,
    weights: { agri: 1.5, energy: 0.8, industrial: 1.0, tech: 0.4, consumer: 0.9, capital: 0.6 }
  },
  {
    id: 'AU',
    name: 'Australia',
    region: 'Oseania',
    lat: -25.27,
    lon: 133.78,
    infra: 2,
    logistics: 3,
    capital: 2,
    regulation: 2,
    volatility: 1,
    climate: 4,
    marketSize: 3,
    weights: { agri: 1.3, energy: 0.9, industrial: 1.2, tech: 0.6, consumer: 0.7, capital: 0.8 }
  },
  {
    id: 'IN',
    name: 'India',
    region: 'Asia Selatan',
    lat: 20.59,
    lon: 78.96,
    infra: 4,
    logistics: 4,
    capital: 3,
    regulation: 4,
    volatility: 3,
    climate: 4,
    marketSize: 5,
    weights: { agri: 1.2, energy: 0.7, industrial: 0.9, tech: 1.0, consumer: 1.1, capital: 0.7 }
  },
  {
    id: 'SA',
    name: 'Arab Saudi',
    region: 'Timur Tengah',
    lat: 23.89,
    lon: 45.08,
    infra: 2,
    logistics: 2,
    capital: 2,
    regulation: 3,
    volatility: 3,
    climate: 5,
    marketSize: 3,
    weights: { agri: 0.4, energy: 1.8, industrial: 1.0, tech: 0.4, consumer: 0.6, capital: 0.7 }
  },
  {
    id: 'ZA',
    name: 'Afrika Selatan',
    region: 'Afrika',
    lat: -30.56,
    lon: 22.94,
    infra: 3,
    logistics: 3,
    capital: 3,
    regulation: 3,
    volatility: 4,
    climate: 3,
    marketSize: 3,
    weights: { agri: 0.9, energy: 0.9, industrial: 1.3, tech: 0.5, consumer: 0.8, capital: 0.6 }
  },
  {
    id: 'MX',
    name: 'Meksiko',
    region: 'Amerika Utara',
    lat: 23.63,
    lon: -102.55,
    infra: 3,
    logistics: 2,
    capital: 2,
    regulation: 3,
    volatility: 3,
    climate: 3,
    marketSize: 4,
    weights: { agri: 0.8, energy: 0.7, industrial: 1.2, tech: 0.6, consumer: 0.9, capital: 0.7 }
  }
];

export const COMMODITY_BY_ID: Record<string, CommodityDef> = Object.fromEntries(
  COMMODITIES.map((c) => [c.id, c])
) as Record<string, CommodityDef>;

export const COUNTRY_BY_ID: Record<string, CountryDef> = Object.fromEntries(
  COUNTRIES.map((c) => [c.id, c])
) as Record<string, CountryDef>;

const PROD_BIAS: Record<CommodityCategory, number> = {
  agri: 1.05,
  energy: 1.14,
  industrial: 1,
  tech: 1,
  consumer: 1,
  capital: 1
};

const XP_LEVELS = [0, 50, 150, 350, 650, 1000, 1500, 2200, 3100, 4300];
const BLACK_LEVEL = 5;
const MAX_FACTORY_LEVEL = 10;

export function levelFromXp(xp: number): number {
  let level = 1;
  for (let i = 1; i < XP_LEVELS.length; i++) {
    if (xp >= XP_LEVELS[i]) level = i + 1;
  }
  return Math.min(10, level);
}

export function nextLevelXp(level: number): number {
  return XP_LEVELS[Math.min(9, Math.max(0, level - 1))] ?? XP_LEVELS[XP_LEVELS.length - 1];
}

export function levelProgress(world: WorldState): number {
  if (world.level >= 10) return 1;
  const start = XP_LEVELS[world.level - 1] ?? 0;
  const end = XP_LEVELS[world.level] ?? start + 1;
  return Math.max(0, Math.min(1, (world.xp - start) / Math.max(1, end - start)));
}

export function countryEfficiency(c: CountryDef): number {
  const avg = (c.infra + c.logistics + c.capital + c.regulation) / 4;
  return Math.max(0.58, Math.min(1.32, 1.4 - avg * 0.12 + (c.climate - 3) * 0.015));
}

export function countryDiffMult(c: CountryDef): number {
  return Math.max(0.88, Math.min(1.12, 1.16 - (countryEfficiency(c) - 1) * 1.1));
}

export function marketKey(country: string, commodity: string): string {
  return `${country}:${commodity}`;
}

export function getMarket(world: WorldState, country: string, commodity: string): MarketState | undefined {
  return world.markets[marketKey(country, commodity)];
}

export function commodityPrice(world: WorldState, country: string, commodity: string): number {
  return getMarket(world, country, commodity)?.price ?? 0;
}

export function marketChange(world: WorldState, country: string, commodity: string, ticks = 24): number {
  const m = getMarket(world, country, commodity);
  if (!m || m.history.length < 2) return 0;
  const idx = Math.max(0, m.history.length - 1 - ticks);
  const old = m.history[idx];
  return old > 0 ? m.price / old - 1 : 0;
}

export function coverage(m: MarketState): number {
  return m.demand > 0 ? m.supply / m.demand : 0;
}

export function getHolding(world: WorldState, country: string, commodity: string): Holding | undefined {
  return world.holdings.find((h) => h.country === country && h.commodity === commodity);
}

export function holdingQty(world: WorldState, country: string, commodity: string): number {
  return getHolding(world, country, commodity)?.qty ?? 0;
}

export function addHolding(world: WorldState, country: string, commodity: CommodityId, qty: number, avgCost: number): void {
  if (qty <= 0) return;
  const existing = getHolding(world, country, commodity);
  if (existing) {
    const total = existing.qty + qty;
    existing.avgCost = total > 0 ? (existing.qty * existing.avgCost + qty * avgCost) / total : avgCost;
    existing.qty = total;
  } else {
    world.holdings.push({ country, commodity, qty, avgCost });
  }
}

export function removeHolding(world: WorldState, country: string, commodity: string, qty: number): boolean {
  const h = getHolding(world, country, commodity);
  if (!h || h.qty < qty - 1e-9) return false;
  h.qty -= qty;
  if (h.qty <= 1e-9) world.holdings = world.holdings.filter((x) => x !== h);
  return true;
}

export function holdingsValue(world: WorldState): number {
  let total = 0;
  for (const h of world.holdings) {
    const m = getMarket(world, h.country, h.commodity);
    total += h.qty * (m?.price ?? h.avgCost);
  }
  return total;
}

export function shipmentsValue(world: WorldState): number {
  let total = 0;
  for (const s of world.shipments) {
    if (s.status !== 'in_transit') continue;
    const m = getMarket(world, s.to, s.commodity);
    total += s.qty * (m?.price ?? s.avgCost);
  }
  return total;
}

export function worldAssetsValue(world: WorldState): number {
  return holdingsValue(world) + shipmentsValue(world);
}

export function holdingsPnl(world: WorldState): number {
  let total = 0;
  for (const h of world.holdings) {
    const m = getMarket(world, h.country, h.commodity);
    total += h.qty * ((m?.price ?? h.avgCost) - h.avgCost);
  }
  return total;
}

export function grantXp(world: WorldState, amount: number): { gained: number; levelUp: boolean } {
  const gained = Math.max(0, Math.round(amount));
  const before = world.level;
  world.xp += gained;
  world.level = levelFromXp(world.xp);
  return { gained, levelUp: world.level > before };
}

function tradeXp(value: number): number {
  return Math.max(1, Math.round(5 + Math.min(85, Math.sqrt(Math.max(0, value)) * 0.6)));
}

function distanceKm(a: CountryDef, b: CountryDef): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function shipQuote(
  from: string,
  to: string,
  commodity: string,
  qty: number
): { cost: number; ticks: number; distance: number; freight: number } {
  const a = COUNTRY_BY_ID[from];
  const b = COUNTRY_BY_ID[to];
  const def = COMMODITY_BY_ID[commodity];
  if (!a || !b || !def || from === to || qty <= 0) {
    return { cost: 0, ticks: 0, distance: 0, freight: 0 };
  }
  const dist = distanceKm(a, b);
  const logistics = (a.logistics + b.logistics) / 2;
  const unit = (0.15 + dist / 20000) * def.freight * (0.9 + logistics * 0.04);
  const cost = Math.max(5, qty * unit);
  const ticks = Math.max(2, Math.ceil(dist / 900 + 1 + logistics * 0.3));
  return { cost, ticks, distance: dist, freight: unit };
}

export function createWorld(seed: number, tick = 0): WorldState {
  const rng = new RNG((seed ^ 0x51ed270b) >>> 0);
  const markets: Record<string, MarketState> = {};
  for (const c of COUNTRIES) {
    const eff = countryEfficiency(c);
    const diff = countryDiffMult(c);
    for (const cm of COMMODITIES) {
      const demand = cm.base * 0.8 * c.marketSize;
      const prod = cm.base * 0.8 * c.marketSize * c.weights[cm.cat] * eff;
      const price = cm.base * diff * rng.float(0.92, 1.08);
      markets[marketKey(c.id, cm.id)] = {
        price,
        supply: demand * rng.float(4, 7),
        demand,
        prod,
        history: [price]
      };
    }
  }
  return {
    home: 'ID',
    tick,
    rngState: rng.state,
    markets,
    holdings: [],
    factories: [],
    shipments: [],
    flows: [],
    events: [],
    logs: [],
    xp: 0,
    level: 1,
    stats: {
      trades: 0,
      volume: 0,
      shipments: 0,
      shipVolume: 0,
      factories: 0,
      blackTrades: 0,
      blackSeized: 0,
      realized: 0
    }
  };
}

function pushEvent(
  world: WorldState,
  events: WorldEvent[],
  tick: number,
  title: string,
  body: string,
  severity: WorldEvent['severity'],
  tags: string[]
): void {
  const ev: WorldEvent = { id: `w${tick}-${world.events.length}-${events.length}`, tick, title, body, severity, tags };
  events.push(ev);
  world.events.unshift(ev);
  if (world.events.length > 40) world.events.length = 40;
}

function macroDemandMultiplier(macro: MacroState, cm: CommodityDef): number {
  let mult = 1 + macro.inflation * 0.02 - macro.risk * 0.008;
  if (cm.cat === 'tech') mult += macro.liquidity * 0.02;
  if (cm.id === 'luxury') mult -= macro.risk * 0.035;
  if (cm.id === 'energy') mult += macro.inflation * 0.015;
  if (cm.id === 'food') mult += macro.risk * 0.012;
  return Math.max(0.62, Math.min(1.45, mult));
}

export function worldTick(world: WorldState, state: SimState): WorldEvent[] {
  const rng = new RNG(world.rngState);
  const events: WorldEvent[] = [];
  const tick = state.ticks;

  for (const c of COUNTRIES) {
    const eff = countryEfficiency(c);
    for (const cm of COMMODITIES) {
      const m = world.markets[marketKey(c.id, cm.id)];
      if (!m) continue;
      const seasonal = cm.cat === 'agri' ? 1 + Math.sin(tick / 90 + c.lon) * 0.07 : 1;
      const pulse = rng.chance(0.002) ? rng.float(0.72, 1.38) : 1;
      m.demand = Math.max(
        0.1,
        cm.base * 0.8 * c.marketSize * macroDemandMultiplier(state.macro, cm) * seasonal * pulse * rng.float(0.94, 1.06)
      );
      m.prod = Math.max(
        0.1,
        cm.base * 0.8 * c.marketSize * c.weights[cm.cat] * eff * PROD_BIAS[cm.cat] * rng.float(0.9, 1.1)
      );
      m.supply = Math.max(0, m.supply + m.prod - m.demand);
      m.supply = Math.min(m.supply, m.demand * 18);
    }
  }

  for (const cm of COMMODITIES) {
    const pairs: {
      from: CountryDef;
      to: CountryDef;
      src: MarketState;
      dst: MarketState;
      spread: number;
    }[] = [];
    for (const c of COUNTRIES) {
      for (const d of COUNTRIES) {
        if (c.id === d.id) continue;
        const src = world.markets[marketKey(c.id, cm.id)];
        const dst = world.markets[marketKey(d.id, cm.id)];
        if (!src || !dst) continue;
        const spread = dst.price / Math.max(0.0001, src.price) - 1;
        if (spread < 0.045) continue;
        pairs.push({ from: c, to: d, src, dst, spread });
      }
    }
    pairs.sort((a, b) => b.spread - a.spread);
    pairs.slice(0, 24).forEach((p, idx) => {
      const surplus = p.src.supply - p.src.demand * 1.2;
      const deficit = p.dst.demand * 2.5 - p.dst.supply;
      const qty = Math.min(surplus, deficit);
      if (qty < 0.5) return;
      p.src.supply -= qty;
      p.dst.supply += qty;
      p.src.price *= 0.9975;
      p.dst.price *= 1.0025;
      world.flows.unshift({
        id: `f${tick}-${cm.id}-${idx}`,
        from: p.from.id,
        to: p.to.id,
        commodity: cm.id,
        qty,
        value: qty * p.dst.price,
        kind: 'ai',
        tick
      });
    });
  }

  const shortages = COUNTRIES.flatMap((c) =>
    COMMODITIES.map((cm) => ({ c, cm, m: world.markets[marketKey(c.id, cm.id)] }))
  )
    .filter((x) => x.m && coverage(x.m) < 3.4)
    .sort((a, b) => coverage(a.m) - coverage(b.m));

  for (const shortage of shortages.slice(0, 4)) {
    if (!rng.chance(0.48)) continue;
    const sources = COUNTRIES.map((c) => ({
      c,
      m: world.markets[marketKey(c.id, shortage.cm.id)]
    }))
      .filter((x) => x.m && coverage(x.m) > 8)
      .sort((a, b) => coverage(b.m) - coverage(a.m));
    const src = sources[0];
    if (!src) continue;
    const qty = Math.min(src.m.supply * 0.04, shortage.m.demand * rng.float(0.5, 1.3));
    if (qty < 0.5) continue;
    src.m.supply -= qty;
    shortage.m.supply += qty;
    src.m.price *= 1.004;
    shortage.m.price *= 1.012;
    world.flows.unshift({
      id: `b${tick}-${shortage.cm.id}`,
      from: src.c.id,
      to: shortage.c.id,
      commodity: shortage.cm.id,
      qty,
      value: qty * shortage.m.price,
      kind: 'black',
      tick
    });
    pushEvent(
      world,
      events,
      tick,
      `Pasar gelap: ${shortage.cm.name} ke ${shortage.c.name}`,
      `${qty.toFixed(0)} unit ${shortage.cm.name} diselundupkan dari ${src.c.name} untuk menutup kelangkaan.`,
      'high',
      ['Dunia', 'Pasar Gelap', shortage.c.name]
    );
  }

  if (rng.chance(0.009)) {
    const c = rng.pick(COUNTRIES);
    const cm = rng.pick(COMMODITIES);
    const m = world.markets[marketKey(c.id, cm.id)];
    if (m) {
      const kind = rng.int(0, 2);
      if (kind === 0) {
        m.supply *= 0.72;
        m.price *= 1.06;
        pushEvent(
          world,
          events,
          tick,
          `Gangguan pasokan ${cm.name} di ${c.name}`,
          `Produksi ${cm.name} terganggu. Harga diperkirakan naik dalam beberapa tick.`,
          'med',
          ['Dunia', 'Pasokan', c.name]
        );
      } else if (kind === 1) {
        m.demand *= 1.25;
        m.price *= 1.03;
        pushEvent(
          world,
          events,
          tick,
          `Permintaan ${cm.name} melonjak di ${c.name}`,
          `Konsumsi ${cm.name} naik tajam. Cari rute impor sebelum harga makin mahal.`,
          'med',
          ['Dunia', 'Permintaan', c.name]
        );
      } else {
        m.supply *= 1.22;
        m.price *= 0.97;
        pushEvent(
          world,
          events,
          tick,
          `Panen ${cm.name} berlimpah di ${c.name}`,
          `Pasokan ${cm.name} melimpah. Harga lokal tertekan, peluang ekspor terbuka.`,
          'low',
          ['Dunia', 'Pasokan', c.name]
        );
      }
    }
  }

  for (const c of COUNTRIES) {
    const diff = countryDiffMult(c);
    for (const cm of COMMODITIES) {
      const m = world.markets[marketKey(c.id, cm.id)];
      if (!m) continue;
      const cov = coverage(m);
      const scarcity = Math.max(0.92, Math.min(1.16, 1 + (3.5 - cov) * 0.04));
      const target = cm.base * diff * scarcity;
      let price = m.price + (target - m.price) * 0.1;
      if (cov < 2) price *= 1 + Math.min(0.06, (2 - cov) * 0.022);
      if (cov > 16) price *= 1 - Math.min(0.05, (cov - 16) * 0.003);
      price *= 1 + rng.float(-1, 1) * cm.vol * 0.025;
      m.price = Math.max(cm.base * 0.35, Math.min(cm.base * 4.5, price));
      m.history.push(m.price);
      if (m.history.length > 72) m.history.shift();
    }
  }

  for (const f of world.factories) {
    const cm = COMMODITY_BY_ID[f.commodity];
    const c = COUNTRY_BY_ID[f.country];
    if (!cm || !c) continue;
    const qty = 1.5 * f.level * countryEfficiency(c);
    addHolding(world, f.country, f.commodity, qty, 0);
  }

  for (const s of world.shipments) {
    if (s.status !== 'in_transit' || s.arriveTick > tick) continue;
    s.status = 'arrived';
    addHolding(world, s.to, s.commodity, s.qty, s.avgCost);
    const cm = COMMODITY_BY_ID[s.commodity];
    world.logs.unshift({
      tick,
      kind: 'ship',
      text: `${s.qty.toFixed(0)} ${cm?.name ?? s.commodity} tiba di ${COUNTRY_BY_ID[s.to]?.name ?? s.to}`
    });
  }
  if (world.logs.length > 40) world.logs.length = 40;

  if (world.flows.length > 80) world.flows.length = 80;
  if (world.events.length > 40) world.events.length = 40;
  world.tick = tick;
  world.rngState = rng.state;
  return events;
}

export function bestRoutes(world: WorldState, limit = 8): RouteEstimate[] {
  const routes: RouteEstimate[] = [];
  for (const cm of COMMODITIES) {
    const sorted = COUNTRIES.map((c) => ({
      c,
      p: commodityPrice(world, c.id, cm.id)
    }))
      .filter((x) => x.p > 0)
      .sort((a, b) => a.p - b.p);
    if (sorted.length < 2) continue;
    const from = sorted[0];
    const to = sorted[sorted.length - 1];
    if (from.c.id === to.c.id) continue;
    const q = shipQuote(from.c.id, to.c.id, cm.id, 100);
    routes.push({
      from: from.c.id,
      to: to.c.id,
      commodity: cm.id,
      buyPrice: from.p,
      sellPrice: to.p,
      spreadPct: (to.p / from.p - 1) * 100,
      cost: q.cost,
      ticks: q.ticks,
      freight: q.freight
    });
  }
  return routes.sort((a, b) => b.spreadPct - a.spreadPct).slice(0, limit);
}

export function blackOffers(world: WorldState, country: string): BlackOffer[] {
  const c = COUNTRY_BY_ID[country];
  if (!c) return [];
  const offers: BlackOffer[] = [];
  for (const cm of COMMODITIES) {
    const m = world.markets[marketKey(country, cm.id)];
    if (!m) continue;
    const cov = coverage(m);
    const held = holdingQty(world, country, cm.id);
    const baseRisk = Math.min(42, 5 + c.regulation * 3.2);
    if (cov < 6.5) {
      const edge = Math.min(13, (6.5 - cov) * 1.6);
      const price = m.price * (0.8 - edge / 100);
      offers.push({
        commodity: cm.id,
        side: 'buy',
        marketPrice: m.price,
        price,
        coverage: cov,
        held,
        risk: Math.min(48, baseRisk + (6.5 - cov) * 1.1),
        edgePct: (m.price / price - 1) * 100
      });
    } else if (cov > 7.5 && held > 0) {
      const edge = Math.min(12, (cov - 7.5) * 1.2);
      const price = m.price * (1.33 + edge / 100);
      offers.push({
        commodity: cm.id,
        side: 'sell',
        marketPrice: m.price,
        price,
        coverage: cov,
        held,
        risk: Math.min(48, baseRisk + 2),
        edgePct: (price / m.price - 1) * 100
      });
    }
  }
  return offers
    .sort((a, b) => b.edgePct - a.edgePct)
    .slice(0, 5);
}

export interface ActionResult {
  ok: boolean;
  msg: string;
}

function pushLog(world: WorldState, kind: WorldLog['kind'], text: string): void {
  world.logs.unshift({ tick: world.tick, kind, text });
  if (world.logs.length > 40) world.logs.length = 40;
}

function validPair(country: string, commodity: string): boolean {
  return Boolean(COUNTRY_BY_ID[country] && COMMODITY_BY_ID[commodity]);
}

export function buyCommodity(state: SimState, country: string, commodity: string, rawQty: number): ActionResult {
  if (!validPair(country, commodity)) return { ok: false, msg: 'Negara/komoditas tidak valid' };
  const qty = Math.floor(rawQty * 100) / 100;
  if (!Number.isFinite(qty) || qty < 0.01) return { ok: false, msg: 'Jumlah tidak valid' };
  const m = getMarket(state.world, country, commodity);
  if (!m) return { ok: false, msg: 'Pasar tidak tersedia' };
  const def = COMMODITY_BY_ID[commodity];
  const gross = m.price * qty;
  const fee = gross * 0.01;
  const total = gross + fee;
  if (state.cash < total) return { ok: false, msg: 'Cash tidak cukup' };
  state.cash -= total;
  m.supply = Math.max(0, m.supply - qty);
  addHolding(state.world, country, commodity as CommodityId, qty, m.price);
  const xp = grantXp(state.world, tradeXp(total));
  state.world.stats.trades += 1;
  state.world.stats.volume += total;
  pushLog(
    state.world,
    'buy',
    `Beli ${qty.toFixed(0)} ${def.name} @ $${m.price.toFixed(2)} di ${COUNTRY_BY_ID[country].name}`
  );
  return {
    ok: true,
    msg: `Beli ${qty.toFixed(0)} ${def.name} · $${total.toFixed(0)}${xp.levelUp ? ` · Level ${state.world.level}!` : ''}`
  };
}

export function sellCommodity(state: SimState, country: string, commodity: string, rawQty: number): ActionResult {
  if (!validPair(country, commodity)) return { ok: false, msg: 'Negara/komoditas tidak valid' };
  const qty = Math.floor(rawQty * 100) / 100;
  if (!Number.isFinite(qty) || qty < 0.01) return { ok: false, msg: 'Jumlah tidak valid' };
  const m = getMarket(state.world, country, commodity);
  if (!m) return { ok: false, msg: 'Pasar tidak tersedia' };
  const h = getHolding(state.world, country, commodity);
  if (!h || h.qty < qty) return { ok: false, msg: 'Stok tidak cukup' };
  const def = COMMODITY_BY_ID[commodity];
  const gross = m.price * qty;
  const fee = gross * 0.01;
  const net = gross - fee;
  const pnl = (m.price * (1 - 0.01) - h.avgCost) * qty;
  state.cash += net;
  state.world.stats.realized += pnl;
  m.supply += qty;
  removeHolding(state.world, country, commodity, qty);
  const xp = grantXp(state.world, tradeXp(net));
  state.world.stats.trades += 1;
  state.world.stats.volume += net;
  pushLog(
    state.world,
    'sell',
    `Jual ${qty.toFixed(0)} ${def.name} @ $${m.price.toFixed(2)} · ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(0)}`
  );
  return {
    ok: true,
    msg: `Jual ${qty.toFixed(0)} ${def.name} · $${net.toFixed(0)}${xp.levelUp ? ` · Level ${state.world.level}!` : ''}`
  };
}

export function shipCommodity(
  state: SimState,
  from: string,
  to: string,
  commodity: string,
  rawQty: number
): ActionResult {
  if (!validPair(from, commodity) || !COUNTRY_BY_ID[to]) return { ok: false, msg: 'Rute tidak valid' };
  if (from === to) return { ok: false, msg: 'Pilih negara tujuan lain' };
  const qty = Math.floor(rawQty * 100) / 100;
  if (!Number.isFinite(qty) || qty < 0.01) return { ok: false, msg: 'Jumlah tidak valid' };
  const h = getHolding(state.world, from, commodity);
  if (!h || h.qty < qty) return { ok: false, msg: 'Stok di negara asal tidak cukup' };
  const def = COMMODITY_BY_ID[commodity];
  const quote = shipQuote(from, to, commodity, qty);
  if (state.cash < quote.cost) return { ok: false, msg: `Butuh $${quote.cost.toFixed(0)} untuk ongkos kirim` };
  state.cash -= quote.cost;
  removeHolding(state.world, from, commodity, qty);
  const id = `s${state.ticks}-${state.world.shipments.length}`;
  state.world.shipments.unshift({
    id,
    commodity: commodity as CommodityId,
    qty,
    from,
    to,
    cost: quote.cost,
    avgCost: h.avgCost,
    departTick: state.ticks,
    arriveTick: state.ticks + quote.ticks,
    status: 'in_transit'
  });
  if (state.world.shipments.length > 40) state.world.shipments.length = 40;
  state.world.stats.shipments += 1;
  state.world.stats.shipVolume += qty;
  state.world.flows.unshift({
    id: `p${id}`,
    from,
    to,
    commodity: commodity as CommodityId,
    qty,
    value: qty * (getMarket(state.world, to, commodity)?.price ?? h.avgCost),
    kind: 'player',
    tick: state.ticks
  });
  grantXp(state.world, 8 + Math.min(50, Math.sqrt(qty) * 2));
  pushLog(
    state.world,
    'ship',
    `Kirim ${qty.toFixed(0)} ${def.name} ${COUNTRY_BY_ID[from].name} → ${COUNTRY_BY_ID[to].name} · $${quote.cost.toFixed(0)}`
  );
  return {
    ok: true,
    msg: `Dikirim dalam ${quote.ticks} tick · ongkos $${quote.cost.toFixed(0)}`
  };
}

export function buildFactory(state: SimState, commodity: string): ActionResult {
  const cm = COMMODITY_BY_ID[commodity];
  const country = COUNTRY_BY_ID[state.world.home];
  if (!cm || !country) return { ok: false, msg: 'Komoditas tidak valid' };
  const existing = state.world.factories.find((f) => f.commodity === commodity);
  const nextLevel = (existing?.level ?? 0) + 1;
  if (nextLevel > MAX_FACTORY_LEVEL) return { ok: false, msg: 'Pabrik sudah level maksimum' };
  const cost = cm.base * 70 * nextLevel;
  if (state.cash < cost) return { ok: false, msg: `Butuh $${cost.toFixed(0)} untuk membangun` };
  state.cash -= cost;
  if (existing) existing.level = nextLevel;
  else
    state.world.factories.push({
      id: `f${state.world.factories.length}`,
      country: state.world.home,
      commodity: commodity as CommodityId,
      level: 1,
      builtTick: state.ticks
    });
  state.world.stats.factories = state.world.factories.length;
  grantXp(state.world, 35 + nextLevel * 8);
  pushLog(
    state.world,
    'factory',
    `${existing ? 'Upgrade' : 'Bangun'} pabrik ${cm.name} L${nextLevel} di ${country.name} · $${cost.toFixed(0)}`
  );
  return { ok: true, msg: `Pabrik ${cm.name} L${nextLevel} aktif · $${cost.toFixed(0)}` };
}

export function blackTrade(
  state: SimState,
  country: string,
  commodity: string,
  side: 'buy' | 'sell',
  rawQty: number
): ActionResult {
  if (state.world.level < BLACK_LEVEL) return { ok: false, msg: `Butuh intel level ${BLACK_LEVEL}` };
  const qty = Math.floor(rawQty * 100) / 100;
  if (!Number.isFinite(qty) || qty < 0.01) return { ok: false, msg: 'Jumlah tidak valid' };
  const offer = blackOffers(state.world, country).find((o) => o.commodity === commodity && o.side === side);
  if (!offer) return { ok: false, msg: 'Tawaran pasar gelap sudah tidak berlaku' };
  const cm = COMMODITY_BY_ID[commodity];
  const c = COUNTRY_BY_ID[country];
  if (!cm || !c) return { ok: false, msg: 'Tawaran tidak valid' };
  if (side === 'buy' && state.cash < offer.price * qty) return { ok: false, msg: 'Cash tidak cukup' };
  if (side === 'sell' && holdingQty(state.world, country, commodity) < qty) return { ok: false, msg: 'Stok tidak cukup' };
  const rng = new RNG((state.world.rngState ^ (state.ticks * 2654435761)) >>> 0);
  const seized = rng.chance(Math.min(0.48, offer.risk / 100));
  state.world.rngState = rng.state;
  state.world.stats.blackTrades += 1;
  const value = offer.price * qty;
  if (seized) {
    state.world.stats.blackSeized += 1;
    if (side === 'buy') state.cash -= value;
    else removeHolding(state.world, country, commodity, qty);
    const ev: WorldEvent = {
      id: `bh${state.ticks}-${state.world.stats.blackTrades}`,
      tick: state.ticks,
      title: `Pasar gelap digerebek di ${c.name}`,
      body: `${qty.toFixed(0)} ${cm.name} disita. Intel lokal sedang panas.`,
      severity: 'high',
      tags: ['Dunia', 'Pasar Gelap', c.name]
    };
    state.events.unshift({
      id: ev.id,
      t: state.simTime,
      title: ev.title,
      body: ev.body,
      severity: 'high',
      tags: ev.tags,
      impact: 0,
      instId: null,
      sector: null,
      cls: null
    });
    state.world.events.unshift(ev);
    pushLog(state.world, 'black', `Gagal: ${qty.toFixed(0)} ${cm.name} disita di ${c.name}`);
    return { ok: false, msg: `Digerebek! ${qty.toFixed(0)} ${cm.name} disita` };
  }
  if (side === 'buy') {
    state.cash -= value;
    const m = getMarket(state.world, country, commodity);
    if (m) m.supply = Math.max(0, m.supply - qty);
    addHolding(state.world, country, commodity as CommodityId, qty, offer.price);
  } else {
    state.cash += value;
    const m = getMarket(state.world, country, commodity);
    if (m) m.supply += qty;
    const h = getHolding(state.world, country, commodity);
    const pnl = h ? (offer.price - h.avgCost) * qty : 0;
    removeHolding(state.world, country, commodity, qty);
    state.world.stats.realized += pnl;
  }
  grantXp(state.world, 30 + Math.min(40, qty * 0.02));
  pushLog(
    state.world,
    'black',
    `${side === 'buy' ? 'Beli' : 'Jual'} ${qty.toFixed(0)} ${cm.name} hitam @ $${offer.price.toFixed(2)} di ${c.name}`
  );
  return {
    ok: true,
    msg: `${side === 'buy' ? 'Beli' : 'Jual'} ${qty.toFixed(0)} ${cm.name} · $${value.toFixed(0)}`
  };
}

export function normalizeWorld(raw: WorldState | undefined, seed: number, tick: number): WorldState {
  const fresh = createWorld(seed, tick);
  if (!raw || typeof raw !== 'object' || !raw.markets) return fresh;
  const world = raw;
  world.home = COUNTRY_BY_ID[world.home] ? world.home : 'ID';
  world.tick = Number.isFinite(world.tick) ? world.tick : tick;
  world.rngState = Number.isFinite(world.rngState) ? world.rngState : fresh.rngState;
  world.markets = world.markets ?? {};
  for (const c of COUNTRIES) {
    for (const cm of COMMODITIES) {
      const key = marketKey(c.id, cm.id);
      const m = world.markets[key] ?? fresh.markets[key];
      if (!m || !Number.isFinite(m.price) || m.price <= 0) {
        world.markets[key] = fresh.markets[key];
        continue;
      }
      m.supply = Number.isFinite(m.supply) ? Math.max(0, m.supply) : fresh.markets[key].supply;
      m.demand = Number.isFinite(m.demand) ? Math.max(0.01, m.demand) : fresh.markets[key].demand;
      m.prod = Number.isFinite(m.prod) ? Math.max(0, m.prod) : fresh.markets[key].prod;
      m.history = Array.isArray(m.history) && m.history.length ? m.history.filter((x) => Number.isFinite(x)) : [m.price];
      if (!m.history.length) m.history = [m.price];
      world.markets[key] = m;
    }
  }
  world.holdings = Array.isArray(world.holdings)
    ? world.holdings.filter(
        (h) =>
          COUNTRY_BY_ID[h.country] &&
          COMMODITY_BY_ID[h.commodity] &&
          Number.isFinite(h.qty) &&
          h.qty > 0 &&
          Number.isFinite(h.avgCost)
      )
    : [];
  world.factories = Array.isArray(world.factories)
    ? world.factories.filter((f) => COUNTRY_BY_ID[f.country] && COMMODITY_BY_ID[f.commodity])
    : [];
  world.shipments = Array.isArray(world.shipments)
    ? world.shipments.filter(
        (s) => COUNTRY_BY_ID[s.from] && COUNTRY_BY_ID[s.to] && COMMODITY_BY_ID[s.commodity] && s.qty > 0
      )
    : [];
  world.flows = Array.isArray(world.flows) ? world.flows : [];
  world.events = Array.isArray(world.events) ? world.events : [];
  world.logs = Array.isArray(world.logs) ? world.logs : [];
  world.xp = Number.isFinite(world.xp) ? Math.max(0, world.xp) : 0;
  world.level = levelFromXp(world.xp);
  world.stats = {
    trades: Number(world.stats?.trades) || 0,
    volume: Number(world.stats?.volume) || 0,
    shipments: Number(world.stats?.shipments) || 0,
    shipVolume: Number(world.stats?.shipVolume) || 0,
    factories: world.factories.length,
    blackTrades: Number(world.stats?.blackTrades) || 0,
    blackSeized: Number(world.stats?.blackSeized) || 0,
    realized: Number(world.stats?.realized) || 0
  };
  return world;
}

export function trimWorld(world: WorldState): void {
  for (const m of Object.values(world.markets)) {
    if (m.history.length > 72) m.history = m.history.slice(-72);
  }
  if (world.flows.length > 60) world.flows = world.flows.slice(0, 60);
  if (world.events.length > 30) world.events = world.events.slice(0, 30);
  if (world.logs.length > 30) world.logs = world.logs.slice(0, 30);
  const transit = world.shipments.filter((s) => s.status === 'in_transit');
  const arrived = world.shipments.filter((s) => s.status === 'arrived').slice(0, 12);
  world.shipments = [...transit, ...arrived];
}

export function homeCountry(world: WorldState): CountryDef {
  return COUNTRY_BY_ID[world.home] ?? COUNTRIES[0];
}

export const BLACK_MARKET_LEVEL = BLACK_LEVEL;
export const FACTORY_MAX_LEVEL = MAX_FACTORY_LEVEL;
