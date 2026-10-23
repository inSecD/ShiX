import { RNG } from './rng';
import {
  COMMODITY_SEEDS,
  CURRENCIES,
  CRYPTO_SEEDS,
  INDEX_SEEDS,
  MEME_SEEDS,
  SECTORS,
  makeForexName,
  makeMemeName,
  makeShitName,
  makeStockName
} from './names';
import type { AssetClass, Instrument } from './types';

export const CURRENCY_MAP: Record<string, (typeof CURRENCIES)[number]> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c])
);

function garchFor(vol: number): Instrument['garch'] {
  const v2 = vol * vol;
  return { w: v2 * 0.045, a: 0.085, b: 0.9, s2: v2 };
}

interface Draft {
  id: string;
  name: string;
  cls: AssetClass;
  sector: string;
  tag: string;
  pair: [string, string] | null;
  price: number;
  vol: number;
  liquidity: number;
  beta: number;
  hype: number;
  mcap: number;
  revStrength: number;
  drift: number;
  funding: number;
}

export function buildUniverse(rng: RNG): { instruments: Record<string, Instrument>; order: string[] } {
  const drafts: Draft[] = [];
  const usedIds = new Set<string>();

  const push = (d: Draft) => {
    if (usedIds.has(d.id)) return;
    usedIds.add(d.id);
    drafts.push(d);
  };

  for (const s of CRYPTO_SEEDS) {
    const liq = rng.float(0.55, 0.98);
    push({
      id: s.ticker,
      name: s.fake,
      cls: s.cls,
      sector: 'Crypto',
      tag: s.tag ?? 'Crypto',
      pair: null,
      price: s.price ?? 10,
      vol: (s.vol ?? 0.035) * 0.22,
      liquidity: liq,
      beta: rng.float(0.8, 1.6),
      hype: s.cls === 'meme' ? rng.float(0.4, 0.85) : rng.float(0.08, 0.4),
      mcap: s.cap ?? rng.float(2e8, 6e10),
      revStrength: rng.float(0.6, 1.4),
      drift: rng.float(0.00005, 0.0006),
      funding: 0
    });
  }

  for (const s of MEME_SEEDS) {
    if (usedIds.has(s.ticker)) continue;
    push({
      id: s.ticker,
      name: s.fake,
      cls: 'meme',
      sector: 'Crypto',
      tag: 'Meme',
      pair: null,
      price: s.price ?? 0.001,
      vol: (s.vol ?? 0.09) * 0.22,
      liquidity: rng.float(0.2, 0.55),
      beta: rng.float(1.3, 2.6),
      hype: rng.float(0.45, 0.9),
      mcap: s.cap ?? rng.float(1e8, 5e9),
      revStrength: rng.float(0.6, 1.4),
      drift: rng.float(-0.0006, 0.0018),
      funding: 0
    });
  }

  // generated memecoins
  const memeCount = 34;
  for (let i = 0; i < memeCount; i++) {
    const { name, ticker } = makeMemeName(rng);
    if (usedIds.has(ticker)) continue;
    const tier = rng.float(0, 1);
    const price = Math.exp(rng.float(Math.log(1e-9), Math.log(4)));
    push({
      id: ticker,
      name,
      cls: 'meme',
      sector: 'Crypto',
      tag: 'Meme',
      pair: null,
      price,
      vol: rng.float(0.012, 0.03) * (tier > 0.8 ? 1.3 : 1),
      liquidity: rng.float(0.08, 0.45),
      beta: rng.float(1.4, 3.0),
      hype: rng.float(0.35, 0.95),
      mcap: price * rng.float(5e7, 4e9),
      revStrength: rng.float(0.6, 1.4),
      drift: rng.float(-0.0015, 0.003),
      funding: 0
    });
  }

  // generated shitcoins / micro caps
  const shitCount = 58;
  for (let i = 0; i < shitCount; i++) {
    const { name, ticker } = makeShitName(rng);
    if (usedIds.has(ticker)) continue;
    const price = Math.exp(rng.float(Math.log(2e-11), Math.log(0.4)));
    push({
      id: ticker,
      name,
      cls: 'shitcoin',
      sector: 'Crypto',
      tag: rng.chance(0.5) ? 'Degen' : 'Micro',
      pair: null,
      price,
      vol: rng.float(0.025, 0.07),
      liquidity: rng.float(0.01, 0.12),
      beta: rng.float(1.8, 4.0),
      hype: rng.float(0.2, 0.8),
      mcap: price * rng.float(1e6, 4e8),
      revStrength: rng.float(0.6, 1.4),
      drift: rng.float(-0.004, 0.006),
      funding: 0
    });
  }

  // stocks
  const stockCount = 62;
  for (let i = 0; i < stockCount; i++) {
    const { name, ticker } = makeStockName(rng);
    if (usedIds.has(ticker)) continue;
    const sector = rng.pick(SECTORS);
    const price = Math.exp(rng.float(Math.log(2.5), Math.log(480)));
    const beta = rng.float(0.55, 1.45);
    const vol =
      sector === 'Crypto-adjacent'
        ? rng.float(0.022, 0.042)
        : sector === 'Utilities'
          ? rng.float(0.007, 0.012)
          : rng.float(0.009, 0.024);
    push({
      id: ticker,
      name,
      cls: 'stock',
      sector,
      tag: sector,
      pair: null,
      price,
      vol,
      liquidity: rng.float(0.35, 0.95),
      beta,
      hype: rng.float(0.02, 0.22),
      mcap: price * rng.float(2e7, 2.4e12),
      revStrength: rng.float(0.6, 1.4),
      drift: rng.float(-0.0008, 0.0011),
      funding: 0
    });
  }

  // forex pairs (majors only)
  const majors = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD', 'CNY', 'SGD', 'IDR', 'BRL', 'MXN'];
  const quotes = ['USD', 'EUR', 'JPY', 'GBP'];
  for (const q of quotes) {
    for (const b of majors) {
      if (b === q) continue;
      const base = CURRENCY_MAP[b];
      const quote = CURRENCY_MAP[q];
      const { name, ticker } = makeForexName(base, quote);
      const id = ticker;
      if (usedIds.has(id)) continue;
      const baseRate = quote.rate;
      push({
        id,
        name,
        cls: 'forex',
        sector: 'Forex',
        tag: 'FX',
        pair: [b, q],
        price: base.rate / baseRate,
        vol: rng.float(0.0007, 0.0018),
        liquidity: rng.float(0.85, 1.0),
        beta: 0,
        hype: rng.float(0, 0.08),
        mcap: 1e12,
        revStrength: rng.float(0.6, 1.4),
        drift: 0,
        funding: 0
      });
    }
  }

  for (const s of COMMODITY_SEEDS) {
    push({
      id: s.ticker,
      name: s.fake,
      cls: 'commodity',
      sector: 'Commodity',
      tag: s.tag ?? 'Commodity',
      pair: null,
      price: s.price ?? 100,
      vol: s.vol ?? 0.016,
      liquidity: rng.float(0.45, 0.95),
      beta: rng.float(-0.2, 0.6),
      hype: rng.float(0, 0.12),
      mcap: 1e11,
      revStrength: rng.float(0.6, 1.4),
      drift: rng.float(-0.0004, 0.0006),
      funding: 0
    });
  }

  for (const s of INDEX_SEEDS) {
    push({
      id: s.ticker,
      name: s.fake,
      cls: 'index',
      sector: 'Index',
      tag: s.tag ?? 'Index',
      pair: null,
      price: s.price ?? 100,
      vol: s.vol ?? 0.009,
      liquidity: rng.float(0.85, 1.0),
      beta: 1,
      hype: rng.float(0.02, 0.2),
      mcap: 1e13,
      revStrength: rng.float(0.6, 1.4),
      drift: rng.float(-0.0004, 0.0006),
      funding: 0
    });
  }

  const instruments: Record<string, Instrument> = {};
  const order: string[] = [];

  for (const d of drafts) {
    const supply = d.mcap / d.price;
    const inst: Instrument = {
      id: d.id,
      name: d.name,
      cls: d.cls,
      sector: d.sector,
      tag: d.tag,
      pair: d.pair,
      price: d.price,
      open: d.price,
      anchor: d.price * Math.exp(rng.gauss() * 0.18),
      anchor0: d.price,
      fund: d.price * Math.exp(rng.gauss() * 0.18),
      vol: d.vol,
      garch: garchFor(d.vol),
      liquidity: d.liquidity,
      beta: d.beta,
      drift: d.drift,
      hype: d.hype,
      mcap: d.mcap,
      supply,
      funding: d.funding,
      pressure: 0,
      openInterest: d.mcap * 0.02 * d.liquidity,
      candles: [],
      daily: [],
      lastVol: 0,
      launchId: null,
      listedAt: 0,
      momentum: 0,
      revStrength: d.revStrength,
      hypeBase: d.hype,
      lastReturn: 0
    };
    instruments[d.id] = inst;
    order.push(d.id);
  }

  return { instruments, order };
}

export const CLASS_LABEL: Record<AssetClass, string> = {
  crypto: 'Kripto',
  meme: 'Memecoin',
  shitcoin: 'Shitcoin',
  stock: 'Saham',
  forex: 'Forex',
  commodity: 'Komoditas',
  index: 'Index'
};

export const CLASS_ICON: Record<AssetClass, string> = {
  crypto: '₿',
  meme: '🐸',
  shitcoin: '🔥',
  stock: '📈',
  forex: '💱',
  commodity: '🛢',
  index: '🧮'
};
