import { createSim, tick, equity, spotUnrealizedPnl, spotValue, unrealizedPnl } from '../src/sim/engine';
import {
  buySpot,
  closePositionById,
  isSpotable,
  placeOrder,
  sellSpot,
  setBracket
} from '../src/sim/trading';
import {
  blackOffers,
  blackTrade,
  buildFactory,
  buyCommodity,
  grantXp,
  holdingQty,
  holdingsValue,
  shipCommodity,
  traderTier
} from '../src/sim/world';
import type { Settings, SimState } from '../src/sim/types';
import { GRAD_MULTIPLE, buyToken, createToken } from '../src/sim/launchpad';
import { RNG } from '../src/sim/rng';

const settings: Settings = {
  seed: 12345,
  startingCash: 100000,
  difficulty: 'normal',
  maxLeverage: 10,
  feeTaker: 0.0004,
  feeMaker: 0.0002,
  slippageEnabled: true,
  sound: false
};

const state = createSim(settings);
console.log('instruments:', state.order.length);
console.log('tokens after warmup:', state.tokenOrder.length);

const samples = ['BN', 'EF', 'DGE', 'SPX', 'XAU', 'EURUSD', 'TSLA'];
const before: Record<string, number> = {};
for (const id of samples) before[id] = state.instruments[id]?.price ?? 0;

let nan = 0;
let huge = 0;
const runTicks = Number(process.env.TICKS ?? 4000);
for (let i = 0; i < runTicks; i++) {
  tick(state, settings);
  for (const id of state.order) {
    const p = state.instruments[id].price;
    if (!Number.isFinite(p) || p <= 0) nan++;
    if (p > 1e30 || p < 1e-14) huge++;
  }
}

console.log('sim time:', new Date(state.simTime).toISOString());
console.log('NaN prices:', nan, '| extreme prices:', huge);
for (const id of samples) {
  const inst = state.instruments[id];
  if (!inst) {
    console.log(id, 'MISSING');
    continue;
  }
  const chg = (inst.price / before[id] - 1) * 100;
  console.log(
    `${id.padEnd(8)} ${inst.name.padEnd(18)} ${before[id].toPrecision(5)} -> ${inst.price.toPrecision(5)} (${chg.toFixed(1)}%) candles=${inst.candles.length} daily=${inst.daily.length} hype=${inst.hype.toFixed(2)} vol=${inst.vol}`
  );
}

console.log('events:', state.events.length, '| tokens:', state.tokenOrder.length, '| graduated:', state.tokenOrder.filter(t => state.tokens[t].graduated).length);
console.log('macro:', JSON.stringify(state.macro, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));

// random trading
const rngIds = state.order.filter(id => state.instruments[id].cls !== 'forex').slice(0, 12);
for (let i = 0; i < 60; i++) {
  const id = rngIds[i % rngIds.length];
  const inst = state.instruments[id];
  const usd = 500 + Math.random() * 4000;
  const qty = usd / inst.price;
  const res = placeOrder(state, settings, {
    instId: id,
    side: Math.random() > 0.5 ? 'buy' : 'sell',
    type: Math.random() > 0.6 ? 'limit' : 'market',
    qty,
    price: Math.random() > 0.6 ? inst.price * (1 + (Math.random() - 0.5) * 0.02) : null,
    lev: Math.random() > 0.7 ? 3 : 1
  });
  if (!res.ok) console.log('order rejected:', res.msg);
}
for (let i = 0; i < 300; i++) tick(state, settings);

const posIds = Object.keys(state.positions);
for (const pid of posIds) closePositionById(state, pid, settings, 1);

console.log('---');
console.log('cash:', state.cash.toFixed(2), '| locked:', state.locked.toFixed(2), '| realized:', state.realized.toFixed(2));
console.log('equity:', equity(state).toFixed(2), '| unrealized:', unrealizedPnl(state).toFixed(2));
console.log('open orders:', Object.values(state.orders).filter(o => o.status === 'open').length);
console.log('fills:', state.fills.length);
console.log('equity curve points:', state.equityCurve.length);
console.log('sample events:', state.events.slice(0, 3).map(e => e.title));

// ---------- bots ----------
console.log('---');
let botBad = 0;
for (const b of state.bots) {
  if (!Number.isFinite(b.equity) || b.equity <= 0) botBad++;
  if (!Number.isFinite(b.cash) || b.cash < -0.01) botBad++;
  for (const h of b.holdings) {
    const p = state.instruments[h.instId]?.price ?? 0;
    if (!Number.isFinite(h.qty) || h.qty <= 0 || !Number.isFinite(p) || p <= 0) botBad++;
  }
}
const board = [...state.bots.map(b => ({ name: b.name, eq: b.equity, pnl: b.pnlPct })), { name: 'Kamu', eq: equity(state), pnl: (equity(state) / settings.startingCash - 1) * 100 }]
  .sort((a, b) => b.eq - a.eq);
console.log('bots:', state.bots.length, '| bad:', botBad);
console.log('leaderboard:', board.slice(0, 4).map(r => `${r.name} ${r.eq.toFixed(0)} (${r.pnl.toFixed(1)}%)`).join(' | '));
const big = [...state.bots].sort((a, b) => b.equity - a.equity)[0];
console.log('top bot holdings:', big.holdings.map(h => {
  const i = state.instruments[h.instId];
  return `${h.instId} qty=${h.qty.toExponential(3)} entry=${h.entry.toExponential(3)} px=${i.price.toExponential(3)} anchor0=${i.anchor0.toExponential(3)} val=${(h.qty * i.price).toExponential(3)}`;
}).join(' | '));

// ---------- bracket orders ----------
function freshSim(): SimState {
  return createSim(settings);
}
function openLong(sim: SimState) {
  const inst = sim.instruments['BN'];
  const res = placeOrder(sim, settings, { instId: 'BN', side: 'buy', type: 'market', qty: 2000 / inst.price, lev: 1 });
  if (!res.ok) throw new Error('open failed: ' + res.msg);
  return Object.values(sim.positions)[0];
}

{
  const sim = freshSim();
  const pos = openLong(sim);
  const inst = sim.instruments[pos.instId];
  const bad = setBracket(sim, pos.id, inst.price * 0.9, null, null);
  console.log('bracket reject below mark:', !bad.ok);
  const good = setBracket(sim, pos.id, inst.price * 1.05, inst.price * 0.97, 0.02);
  console.log('bracket set:', good.ok, '| tp', pos.tp != null, '| sl', pos.sl != null, '| trail', pos.trail);
  pos.tp = inst.price * 0.5;
  tick(sim, settings);
  console.log('TP trigger:', Object.keys(sim.positions).length === 0, '| kind:', sim.fills[0]?.kind, '| notice:', sim.notices[0]);
}

{
  const sim = freshSim();
  const pos = openLong(sim);
  const inst = sim.instruments[pos.instId];
  pos.sl = inst.price * 1.5;
  tick(sim, settings);
  console.log('SL trigger:', Object.keys(sim.positions).length === 0, '| kind:', sim.fills[0]?.kind, '| notice:', sim.notices[0]);
}

{
  const sim = freshSim();
  const pos = openLong(sim);
  const inst = sim.instruments[pos.instId];
  pos.trail = 0.02;
  pos.trailPeak = inst.price * 100;
  tick(sim, settings);
  console.log('Trail trigger:', Object.keys(sim.positions).length === 0, '| kind:', sim.fills[0]?.kind, '| notice:', sim.notices[0]);
}

// ---------- daily challenge ----------
{
  const sim = freshSim();
  sim.challenge = {
    dayKey: 'test-early',
    seed: settings.seed,
    startEquity: equity(sim) * 0.5,
    targetPct: 0.1,
    startTick: sim.ticks,
    deadlineTick: sim.ticks + 1000,
    done: false,
    won: false,
    bestPct: 0,
    finalPct: null,
    attempts: 1,
    streak: 0,
    rewarded: false,
    scenarioId: null,
    label: 'Tantangan Harian'
  };
  tick(sim, settings);
  console.log('challenge early win:', sim.challenge!.done, '| won:', sim.challenge!.won);
}

{
  const sim = freshSim();
  sim.challenge = {
    dayKey: 'test-day',
    seed: settings.seed,
    startEquity: equity(sim),
    targetPct: 0.1,
    startTick: sim.ticks,
    deadlineTick: sim.ticks + 1,
    done: false,
    won: false,
    bestPct: 0,
    finalPct: null,
    attempts: 1,
    streak: 0,
    rewarded: false,
    scenarioId: null,
    label: 'Tantangan Harian'
  };
  tick(sim, settings);
  console.log(
    'challenge eval:',
    sim.challenge!.done,
    '| won:',
    sim.challenge!.won,
    '| final:',
    sim.challenge!.finalPct?.toFixed(2),
    '| notice:',
    sim.notices.find(n => n.includes('TANTANGAN')) ?? sim.notices[0]
  );
}

// ---------- world economy ----------
{
  const sim = freshSim();
  const world = sim.world;
  const marketCount = Object.keys(world.markets).length;
  let badMarket = 0;
  for (const m of Object.values(world.markets)) {
    if (!Number.isFinite(m.price) || m.price <= 0 || !Number.isFinite(m.supply) || !Number.isFinite(m.demand)) badMarket++;
  }
  const startEq = equity(sim);
  const buy = buyCommodity(sim, 'ID', 'food', 100);
  const afterBuyEq = equity(sim);
  const buyHolding = holdingQty(world, 'ID', 'food');
  console.log('world markets:', marketCount, '| bad:', badMarket, '| buy:', buy.ok, '| holding:', buyHolding.toFixed(2));
  console.log('equity marks commodity:', (afterBuyEq - startEq).toFixed(2), '| world value:', holdingsValue(world).toFixed(2));

  const ship = shipCommodity(sim, 'ID', 'SG', 'food', 50);
  for (let i = 0; i < 30; i++) tick(sim, settings);
  const arrived = world.shipments.find((s) => s.from === 'ID' && s.to === 'SG' && s.status === 'arrived');
  console.log('world ship:', ship.ok, '| arrived:', Boolean(arrived), '| SG holding:', holdingQty(world, 'SG', 'food').toFixed(2));

  const factory = buildFactory(sim, 'food');
  for (let i = 0; i < 5; i++) tick(sim, settings);
  console.log('factory build:', factory.ok, '| level:', world.factories.find((f) => f.commodity === 'food')?.level, '| produced:', holdingQty(world, world.home, 'food').toFixed(2));

  const locked = blackTrade(sim, 'ID', 'food', 'buy', 10);
  grantXp(world, 1000);
  const m = world.markets['ID:food'];
  m.supply = m.demand * 1.2;
  const offers = blackOffers(world, 'ID');
  const offer = offers.find((o) => o.side === 'buy');
  const black = offer ? blackTrade(sim, 'ID', offer.commodity, 'buy', 10) : { ok: false, msg: 'no offer' };
  console.log('black locked:', !locked.ok, '| level:', world.level, '| offers:', offers.length, '| trade:', black.ok, '| seized:', world.stats.blackSeized);
}

// ---------- trader tiers ----------
{
  const cases: [number, number, string][] = [
    [1, 100000, 'Retail'],
    [3, 125000, 'Trader'],
    [5, 250000, 'Pro'],
    [7, 600000, 'Whale'],
    [9, 1200000, 'Elite'],
    [10, 2500000, 'Global'],
    [10, 100000, 'Retail']
  ];
  const results = cases.map(([level, netWorth, expected]) => {
    const status = traderTier(level, netWorth);
    return { level, netWorth, expected, actual: status.tier.name };
  });
  const failed = results.filter((r) => r.actual !== r.expected);
  console.log('trader tiers:', failed.length === 0 ? 'ok' : 'FAIL', results.map((r) => `${r.actual}@${r.level}/${r.netWorth}`).join(' | '));
  if (failed.length) throw new Error(`tier mismatch: ${JSON.stringify(failed)}`);
}

// ---------- spot crypto ----------
{
  const sim = freshSim();
  const startEq = equity(sim);
  const buy = buySpot(sim, settings, 'BN', 1000);
  const holding = sim.spotHoldings['BN'];
  const afterBuyEq = equity(sim);
  console.log(
    'spot buy:',
    buy.ok,
    '| qty:',
    buy.qty?.toPrecision(6),
    '| value:',
    spotValue(sim).toFixed(2),
    '| pnl:',
    spotUnrealizedPnl(sim).toFixed(2),
    '| equity delta:',
    (afterBuyEq - startEq).toFixed(2)
  );
  if (!buy.ok || !holding || holding.qty <= 0) throw new Error('spot buy failed');
  if (Math.abs(afterBuyEq - startEq) > 25) throw new Error('spot equity mark mismatch');

  // spot is enabled for every asset class now, not just crypto
  const stock = buySpot(sim, settings, 'SPX', 1000);
  const stockHolding = sim.spotHoldings['SPX'];
  console.log('spot non-crypto allowed:', stock.ok, '|', stock.msg);
  if (!stock.ok || !stockHolding || stockHolding.qty <= 0) throw new Error('non-crypto spot should be allowed');
  if (!isSpotable(sim.instruments['SPX'])) throw new Error('isSpotable should cover non-crypto assets');

  const partialQty = holding.qty / 2;
  const partial = sellSpot(sim, settings, 'BN', partialQty);
  console.log('spot partial sell:', partial.ok, '| qty:', partial.qty?.toPrecision(6), '| pnl:', partial.pnl?.toFixed(2));
  if (!partial.ok || !sim.spotHoldings['BN']) throw new Error('spot partial sell failed');

  const over = sellSpot(sim, settings, 'BN', sim.spotHoldings['BN'].qty * 10);
  const empty = sellSpot(sim, settings, 'BN', 1);
  console.log('spot oversell clamps:', over.ok, '| cleaned:', !sim.spotHoldings['BN'], '| empty reject:', !empty.ok);
  if (!over.ok || sim.spotHoldings['BN'] || empty.ok) throw new Error('spot oversell cleanup failed');
}

// ---------- launchpad graduation migrates presale holdings to spot ----------
{
  const sim = freshSim();
  const rng = new RNG(99);
  const token = createToken(sim, rng, {
    name: 'Testcoin',
    ticker: 'TSTX',
    kind: 'meme',
    tags: ['Meme'],
    owner: 'player',
    marketing: 1
  });
  token.honeypot = false;
  token.devTokens = 0;
  token.rug = false;

  const cost = 400;
  const buy = buyToken(sim, token.id, cost);
  if (!buy.ok) throw new Error('token buy failed: ' + buy.msg);
  const heldBefore = sim.tokenHoldings[token.id];
  if (!(heldBefore > 0)) throw new Error('curve holdings not recorded');

  // force the curve to its graduation threshold (price = price0 * GRAD_MULTIPLE)
  const targetPrice = token.price0 * GRAD_MULTIPLE;
  token.supply = Math.sqrt(token.k / targetPrice);
  token.reserve = token.k / token.supply;
  token.price = token.reserve / token.supply;

  tick(sim, settings); // tickTokens should graduate the token this hour

  if (!token.graduated) throw new Error('token did not graduate');
  if ((sim.tokenHoldings[token.id] ?? 0) !== 0) throw new Error('curve holdings should clear on graduation');
  const spot = sim.spotHoldings[token.ticker];
  if (!spot || spot.qty <= 0) throw new Error('presale holdings were not migrated to spot');
  if (Math.abs(spot.qty - heldBefore) > heldBefore * 1e-6) throw new Error('migrated qty mismatch');
  if (!(spot.avgCost > 0)) throw new Error('migrated cost basis missing');
  if (spotValue(sim) <= 0) throw new Error('graduated spot not counted in equity');

  console.log(
    'graduation migrate: ok | curve held:',
    heldBefore.toPrecision(6),
    '| spot qty:',
    spot.qty.toPrecision(6),
    '| avg:',
    spot.avgCost.toPrecision(6),
    '| inst:',
    token.instId
  );
}
