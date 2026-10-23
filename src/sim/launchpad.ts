import type { RNG } from './rng';
import { makeMemeName, makeShitName, MEME_TAG_POOL } from './names';
import type { Instrument, LaunchToken, Settings, SimState } from './types';
import { uid } from './trading';

export const CURVE_FEE = 0.01;
export const GRAD_MULTIPLE = 10;

export function createToken(
  state: SimState,
  rng: RNG,
  opts: {
    name: string;
    ticker: string;
    kind: 'meme' | 'shitcoin';
    tags: string[];
    owner: 'player' | 'ai';
    marketing: number;
  }
): LaunchToken {
  const price0 = Math.exp(rng.float(Math.log(1e-9), Math.log(0.0025)));
  const reserve0 = rng.float(1800, 26000);
  const supply = reserve0 / price0;
  const k = reserve0 * supply;
  const devShare = rng.float(0.12, 0.35);
  const token: LaunchToken = {
    id: uid('tok'),
    name: opts.name,
    ticker: opts.ticker,
    kind: opts.kind,
    tags: opts.tags,
    createdAt: state.simTime,
    price: price0,
    reserve: reserve0,
    supply,
    k,
    price0,
    progress: 0,
    lpLocked: rng.float(0.25, 0.95),
    devTokens: supply * devShare,
    devSold: 0,
    honeypot: rng.chance(opts.kind === 'shitcoin' ? 0.12 : 0.05),
    rug: false,
    hype: opts.owner === 'player' ? rng.float(0.25, 0.6) : rng.float(0.1, 0.55),
    owner: opts.owner,
    marketing: opts.marketing,
    graduated: false,
    instId: null,
    inflow: 0,
    distribute: 0
  };
  state.tokens[token.id] = token;
  state.tokenOrder.unshift(token.id);
  if (state.tokenOrder.length > 60) state.tokenOrder.length = 60;
  state.tokenHoldings[token.id] = state.tokenHoldings[token.id] ?? 0;
  return token;
}

export function spawnAiToken(state: SimState, rng: RNG): LaunchToken {
  const kind: 'meme' | 'shitcoin' = rng.chance(0.45) ? 'meme' : 'shitcoin';
  const named = kind === 'meme' ? makeMemeName(rng) : makeShitName(rng);
  const tags = [rng.pick(MEME_TAG_POOL)];
  if (rng.chance(0.4)) tags.push(rng.pick(MEME_TAG_POOL));
  return createToken(state, rng, {
    name: named.name,
    ticker: named.ticker,
    kind,
    tags,
    owner: 'ai',
    marketing: rng.float(0.1, 1)
  });
}

export function tokenPrice(token: LaunchToken): number {
  return token.reserve / token.supply;
}

export function buyToken(
  state: SimState,
  tokenId: string,
  usd: number
): { ok: boolean; msg: string; tokens: number; price: number } {
  const token = state.tokens[tokenId];
  if (!token) return { ok: false, msg: 'Token tidak ada', tokens: 0, price: 0 };
  if (token.graduated)
    return { ok: false, msg: 'Token sudah listing, trades di market utama', tokens: 0, price: token.price };
  if (usd <= 0) return { ok: false, msg: 'Nominal tidak valid', tokens: 0, price: token.price };
  if (usd > state.cash) return { ok: false, msg: 'Dana tidak cukup', tokens: 0, price: token.price };

  const priceBefore = tokenPrice(token);
  const newReserve = token.reserve + usd;
  const newSupply = token.k / newReserve;
  const received = token.supply - newSupply;
  if (received <= 0) return { ok: false, msg: 'Order terlalu kecil', tokens: 0, price: priceBefore };

  token.reserve = newReserve;
  token.supply = newSupply;
  token.price = tokenPrice(token);
  token.hype = Math.min(1.9, token.hype + 0.02 + received / token.k * 40);
  token.inflow += usd;

  state.cash -= usd;
  state.tokenHoldings[tokenId] = (state.tokenHoldings[tokenId] ?? 0) + received;

  return { ok: true, msg: 'Beli berhasil', tokens: received, price: token.price };
}

export function sellToken(
  state: SimState,
  tokenId: string,
  units: number
): { ok: boolean; msg: string; proceeds: number; price: number } {
  const token = state.tokens[tokenId];
  if (!token) return { ok: false, msg: 'Token tidak ada', proceeds: 0, price: 0 };
  if (token.honeypot && !token.graduated)
    return { ok: false, msg: 'HONEYPOT: penjualan diblokir kontrak', proceeds: 0, price: token.price };
  if (token.graduated)
    return { ok: false, msg: 'Token sudah listing, tutup lewat market utama', proceeds: 0, price: token.price };

  const held = state.tokenHoldings[tokenId] ?? 0;
  if (units <= 0 || units > held)
    return { ok: false, msg: 'Jumlah tidak valid', proceeds: 0, price: token.price };

  const newSupply = token.supply + units;
  const newReserve = token.k / newSupply;
  const gross = token.reserve - newReserve;
  const proceeds = gross * (1 - CURVE_FEE);

  token.reserve = newReserve;
  token.supply = newSupply;
  token.price = tokenPrice(token);
  token.hype = Math.max(0, token.hype - 0.03);
  state.cash += proceeds;
  state.tokenHoldings[tokenId] = held - units;

  return { ok: true, msg: 'Jual berhasil', proceeds, price: token.price };
}

export function tokenProgress(token: LaunchToken): number {
  if (token.price <= 0) return 0;
  return Math.max(0, Math.min(1, Math.log(token.price / token.price0) / Math.log(GRAD_MULTIPLE)));
}

function dumpDev(token: LaunchToken, rng: RNG): void {
  if (token.devTokens <= 0) return;
  const units = token.devTokens;
  const newSupply = token.supply + units;
  const newReserve = token.k / newSupply;
  token.reserve = newReserve;
  token.supply = newSupply;
  token.devTokens = 0;
  token.devSold = 1;
  token.price = tokenPrice(token);
  token.hype = Math.max(0, token.hype - rng.float(0.2, 0.5));
}

export function tickTokens(state: SimState, rng: RNG): void {
  for (const id of state.tokenOrder) {
    const token = state.tokens[id];
    if (!token) continue;
    if (token.graduated) {
      distributeToMarket(state, token);
      continue;
    }

    // organic inflow from hype/marketing
    const rate = (0.0015 + token.hype * 0.005) * token.marketing * rng.float(0.2, 1.6);
    const inflow = token.reserve * rate * (state.macro.risk > -0.4 ? 1 : 0.25);
    if (inflow > 0 && token.reserve + inflow > token.k / token.supply) {
      const newReserve = token.reserve + inflow;
      const newSupply = token.k / newReserve;
      if (newSupply < token.supply) {
        token.reserve = newReserve;
        token.supply = newSupply;
        token.price = tokenPrice(token);
        token.inflow += inflow;
      }
    }

    // hype feedback
    token.hype = Math.max(
      0,
      Math.min(2,
        token.hype + (0.5 - token.hype) * 0.02 + (inflow / 26000) * 0.05 + rng.gauss() * 0.012
      )
    );

    // dev slowly sells into the curve
    if (token.devTokens > 0 && token.progress > rng.float(0.1, 0.5)) {
      const sellFrac = rng.float(0.02, 0.12);
      const units = token.devTokens * sellFrac;
      const newSupply = token.supply + units;
      const newReserve = token.k / newSupply;
      token.reserve = newReserve;
      token.supply = newSupply;
      token.devTokens -= units;
      token.devSold += sellFrac;
      token.price = tokenPrice(token);
      token.hype = Math.max(0, token.hype - 0.05);
    }

    // rug event
    const rugChance = token.honeypot ? 0.004 : 0.0018 * (1 + token.devSold);
    if (!token.rug && rng.chance(rugChance)) {
      token.rug = true;
      dumpDev(token, rng);
      state.events.unshift({
        id: uid('ev'),
        t: state.simTime,
        title: `RUG PULL: ${token.name} (${token.ticker})`,
        body: `Developer ${token.ticker} menarik likuiditas dan menjual seluruh holdings. Harga anjlok.`,
        severity: 'extreme',
        tags: ['Launchpad', 'Rug', 'Scam'],
        impact: -0.9,
        instId: null,
        sector: null,
        cls: null
      });
    }

    // graduation to spot market
    const prog = tokenProgress(token);
    token.progress = prog;
    if (prog >= 1 && !token.graduated) {
      graduateToken(state, token, rng);
    }
  }
}

function distributeToMarket(state: SimState, token: LaunchToken): void {
  if (!token.instId || token.distribute <= 0) return;
  const inst = state.instruments[token.instId];
  if (!inst) return;
  const amt = Math.min(token.distribute, 0.02);
  token.distribute -= amt;
  inst.pressure -= amt * 0.22;
  inst.hype = Math.max(0, inst.hype - amt * 0.12);
  inst.anchor *= 1 - amt * 0.02;
}

function graduateToken(state: SimState, token: LaunchToken, rng: RNG): void {
  token.graduated = true;
  token.distribute = rng.float(0.4, 1.0);
  const price = token.price;
  const inst: Instrument = {
    id: token.ticker,
    name: token.name,
    cls: token.kind === 'meme' ? 'meme' : 'shitcoin',
    sector: 'Crypto',
    tag: token.tags[0] ?? 'Degen',
    pair: null,
    price,
    open: price,
    anchor: price * rng.float(0.55, 1.2),
    anchor0: price,
    fund: price,
    vol: rng.float(0.03, 0.08),
    garch: { w: 0.015, a: 0.09, b: 0.89, s2: 1 },
    liquidity: Math.min(0.35, 0.05 + token.lpLocked * 0.25),
    beta: rng.float(2, 4),
    drift: 0,
    hype: token.hype,
    mcap: token.reserve * rng.float(20, 120),
    supply: token.supply,
    funding: 0,
    pressure: 0,
    openInterest: 0,
    candles: [],
    daily: [],
    lastVol: 0,
    launchId: token.id,
    listedAt: state.simTime,
    momentum: 0,
    revStrength: 0.004,
    hypeBase: 0.5,
    lastReturn: 0
  };
  if (!state.instruments[inst.id]) {
    state.instruments[inst.id] = inst;
    state.order.unshift(inst.id);
  }
  token.instId = inst.id;

  // graduation pump then distribution
  inst.pressure += rng.float(0.4, 1.2);
  inst.hype = Math.min(2, token.hype + 0.6);

  state.events.unshift({
    id: uid('ev'),
    t: state.simTime,
    title: `GRADUASI: ${token.name} (${token.ticker}) listing di spot`,
    body: `Bonding curve penuh, ${token.ticker} resmi listing di bursa utama. Volume meledak, dev mulai distribusi.`,
    severity: 'high',
    tags: ['Launchpad', 'Listing', 'Graduasi'],
    impact: 0.8,
    instId: inst.id,
    sector: null,
    cls: inst.cls
  });
}

export function playerTokenValue(state: SimState, tokenId: string): number {
  const token = state.tokens[tokenId];
  if (!token) return 0;
  const held = state.tokenHoldings[tokenId] ?? 0;
  if (token.graduated && token.instId) {
    const inst = state.instruments[token.instId];
    if (inst) return held * inst.price;
  }
  return held * token.price;
}

export function launchCost(settings: Settings): number {
  return Math.max(250, settings.startingCash * 0.005);
}
