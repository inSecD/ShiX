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
import * as lifestyleMod from '../src/sim/lifestyle';
import * as hubMod from '../src/sim/hub';
import * as socialMod from '../src/sim/social';
import * as businessMod from '../src/sim/business';
import * as feedMod from '../src/sim/feed';
import { applyEvent, generateEvent } from '../src/sim/events';
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

// ---------- Phase 1: lifestyle assets (beli, upkeep harian, jual 70%, net worth) ----------
{
  const sim = freshSim();
  const { buyAsset, sellAsset, lifestyleAssetsValue, dailyUpkeep, SELL_RATE } = lifestyleMod;

  // beli dua aset muat di modal $100k: motor ($9k) + jam ($65k)
  const b1 = buyAsset(sim, 'motor');
  if (!b1.ok) throw new Error('buy motor failed: ' + b1.msg);
  const b2 = buyAsset(sim, 'watch');
  if (!b2.ok) throw new Error('buy watch failed: ' + b2.msg);

  // dobel beli harus ditolak
  if (buyAsset(sim, 'motor').ok) throw new Error('duplicate buy should fail');

  // beli aset kemahalan harus ditolak (island $160k > cash sisa)
  if (buyAsset(sim, 'island').ok) throw new Error('over-budget buy should fail');

  const cashAfterBuy = sim.cash;
  const ownedValue = lifestyleAssetsValue(sim.lifestyle);
  if (Math.abs(ownedValue - (9000 + 65000)) > 1e-6) throw new Error('asset value mismatch: ' + ownedValue);
  // net worth harus ikut naik sebesar nilai aset
  if (Math.abs(equity(sim) - (cashAfterBuy + ownedValue)) > ownedValue * 1e-6 + 1)
    throw new Error('equity should include lifestyle asset value');

  // upkeep harian = motor(8) + jam(12) = $20
  const upkeep = dailyUpkeep(sim.lifestyle);
  if (Math.abs(upkeep - 20) > 1e-6) throw new Error('daily upkeep mismatch: ' + upkeep);

  // tick 24x (1 hari) → upkeep didebet sekali
  for (let i = 0; i < 24; i++) tick(sim, settings);
  const cashAfterDay = sim.cash;
  if (Math.abs(cashAfterDay - (cashAfterBuy - upkeep)) > 1e-6)
    throw new Error(`upkeep not debited after a day: ${cashAfterBuy} -> ${cashAfterDay} (want -${upkeep})`);
  if (sim.lifestyle.stats.upkeepPaid < upkeep) throw new Error('upkeepPaid stat not tracked');

  // tick 5x lagi (belum 24 penuh) → TIDAK boleh didebet lagi
  for (let i = 0; i < 5; i++) tick(sim, settings);
  if (Math.abs(sim.cash - cashAfterDay) > 1e-6) throw new Error('upkeep debited more than once per day');

  // jual jam → dapat 70%
  const watchProceeds = Math.round(65000 * SELL_RATE);
  const cashBeforeSell = sim.cash;
  const s1 = sellAsset(sim, 'watch');
  if (!s1.ok) throw new Error('sell watch failed: ' + s1.msg);
  if (sim.cash - cashBeforeSell !== watchProceeds) throw new Error('sell proceeds mismatch');
  if (sim.lifestyle.owned.includes('watch')) throw new Error('watch should be sold');
  if (sellAsset(sim, 'watch').ok) throw new Error('double sell should fail');

  console.log(
    'lifestyle buy: ok | owned value:',
    ownedValue.toFixed(0),
    '| upkeep/day:',
    upkeep.toFixed(0),
    '| upkeep debited: ok | sell@' + Math.round(SELL_RATE * 100) + '%:',
    watchProceeds,
    '| cash:',
    sim.cash.toFixed(0)
  );
}

// ---------- Phase 2: open-world hub (init, unlock gating, normalize) ----------
{
  const { LOCATIONS, LOCATION_BY_ID, normalizeHub, isLocationUnlocked, locationHint, HOME_LOC } = hubMod;

  // sim baru mulai di lokasi rumah & visited-nya berisi itu
  const sim = freshSim();
  if (sim.hub.locId !== HOME_LOC) throw new Error('hub should start at ' + HOME_LOC);
  if (!sim.hub.visited.includes(HOME_LOC)) throw new Error('hub visited should include start loc');

  // tiap locId di ASSET_DEFS harus nunjuk ke lokasi yang valid
  for (const a of lifestyleMod.ASSET_DEFS) {
    if (!LOCATION_BY_ID[a.locId]) throw new Error(`asset ${a.id} points to unknown loc ${a.locId}`);
  }

  // lokasi gratis kebuka tanpa aset; lokasi berbayar terkunci
  const freeOpen = ['street', 'park', 'cafe', 'bursa'].every((id) =>
    isLocationUnlocked(LOCATION_BY_ID[id], [])
  );
  if (!freeOpen) throw new Error('base locations should be free');
  if (isLocationUnlocked(LOCATION_BY_ID['villa'], [])) throw new Error('villa should be locked w/o asset');
  if (!isLocationUnlocked(LOCATION_BY_ID['villa'], ['villa'])) throw new Error('villa unlocks with villa asset');
  if (isLocationUnlocked(LOCATION_BY_ID['garage'], [])) throw new Error('garage locked w/o vehicle');
  if (!isLocationUnlocked(LOCATION_BY_ID['garage'], ['motor'])) throw new Error('garage unlocks with motor');
  if (!isLocationUnlocked(LOCATION_BY_ID['home'], ['watch'])) throw new Error('home unlocks with watch');

  // hint kunci ada isinya
  const hint = locationHint(LOCATION_BY_ID['island']);
  if (!hint || !hint.includes('Pulau')) throw new Error('island hint should mention the asset');

  // normalize memperbaiki data rusak & lokasi nggak dikenal
  const bad = normalizeHub({ locId: 'nope', visited: ['nope', 'park', 42] });
  if (bad.locId !== HOME_LOC) throw new Error('normalize should reset unknown locId');
  if (!bad.visited.every((id) => !!LOCATION_BY_ID[id])) throw new Error('normalize should keep only valid visited');
  if (!bad.visited.includes('park')) throw new Error('normalize should keep valid visited');

  // jumlah lokasi > jumlah gratis (ada progresi buat dibuka)
  const unlockedNow = LOCATIONS.filter((l) => isLocationUnlocked(l, [])).length;
  if (!(unlockedNow < LOCATIONS.length)) throw new Error('some locations should start locked');

  console.log(
    'hub init: ok | start:',
    sim.hub.locId,
    '| free open:',
    unlockedNow + '/' + LOCATIONS.length,
    '| normalize fixes: ok | hint:',
    hint
  );
}

// ---------- Phase 3: NPC, friendship, rumor (event split generate/apply) ----------
{
  const sim = freshSim();
  const rng = new RNG(7);
  const { chatWith, friendshipOf, rumorTier, npcsAtLocation } = socialMod;

  // createSim nyisain minimal satu pending event buat dibocorkan
  if (!sim.pendingEvent) throw new Error('createSim should queue a pending event');

  // generateEvent: murni, nggak push event & nggak ubah macro
  const evBefore = sim.events.length;
  const riskBefore = sim.macro.risk;
  const pend = generateEvent(sim, rng);
  if (!pend) throw new Error('generateEvent returned null');
  if (sim.events.length !== evBefore) throw new Error('generateEvent must not push events');
  if (sim.macro.risk !== riskBefore) throw new Error('generateEvent must not change macro');

  // applyEvent: efek samping + masuk feed, objek event sama
  const evMid = sim.events.length;
  applyEvent(sim, pend);
  if (sim.events.length !== evMid + 1) throw new Error('applyEvent should push one event');
  if (sim.events[0].id !== pend.ev.id) throw new Error('applied event should be the same event');

  // Aria ada di Jalan Kota (lokasi gratis)
  if (!npcsAtLocation(sim, 'street').some((b) => b.id === 'bot_0')) throw new Error('Aria should be at street');

  // ngobrol: friendship naik, lalu kena cooldown
  const before = friendshipOf(sim.social, 'bot_0');
  const r1 = chatWith(sim, 'bot_0');
  if (!r1.ok) throw new Error('chat should succeed: ' + r1.msg);
  if (friendshipOf(sim.social, 'bot_0') <= before) throw new Error('friendship should increase');
  if (chatWith(sim, 'bot_0').ok) throw new Error('immediate re-chat should be on cooldown');

  // paksa rumor: friendship tier-3 + Math.random deterministik
  sim.social.friendship['bot_0'] = 90;
  sim.social.lastChat['bot_0'] = sim.ticks - 999;
  const origRandom = Math.random;
  Math.random = () => 0;
  const r3 = chatWith(sim, 'bot_0');
  Math.random = origRandom;
  if (!r3.rumor) throw new Error('tier-3 chat should leak a rumor');
  if (!sim.social.rumor || sim.social.rumor.tier !== 3) throw new Error('rumor stored with wrong tier');

  // ambang tier rumor
  if (rumorTier(0) !== 0 || rumorTier(25) !== 1 || rumorTier(55) !== 2 || rumorTier(85) !== 3)
    throw new Error('rumorTier thresholds wrong');

  console.log(
    'event split: ok | apply pushes:', pend.ev.id,
    '| npc chat: friendship + cooldown ok | rumor tier3:', (r3.rumor ?? '').slice(0, 48)
  );
}

// ---------- Phase 4: bisnis pasif (income/upkeep/upgrade/net-worth-neutral) ----------
{
  const sim = freshSim();
  const { buyBusiness, upgradeBusiness, businessIncomePerTick, businessValueOf, getBusiness, upgradeCost, businessDef } = businessMod;

  sim.cash = 1_000_000;

  // beli Kedai Kopi ($5k) → cash turun, net worth TETAP (value = modal)
  const eqBefore = equity(sim);
  const cashBefore = sim.cash;
  const buy = buyBusiness(sim, 'coffee');
  if (!buy.ok) throw new Error('buyBusiness failed: ' + buy.msg);
  if (sim.cash !== cashBefore - 5000) throw new Error('cash should drop by price');
  const eqAfter = equity(sim);
  if (Math.abs(eqAfter - eqBefore) > 1) throw new Error('purchase must be net-worth-neutral, delta=' + (eqAfter - eqBefore));

  // dobel beli → tolak
  if (buyBusiness(sim, 'coffee').ok) throw new Error('duplicate buy should fail');

  // income per tick masuk pas businessTick
  const inc = businessIncomePerTick(sim.business);
  if (inc <= 0) throw new Error('income should be positive');
  const cashPreTick = sim.cash;
  businessMod.businessTick(sim);
  if (Math.abs(sim.cash - (cashPreTick + inc)) > 1e-6) throw new Error('businessTick should add income per tick');

  // upkeep: setelah 24 tick, ke-debet sekali
  sim.ticks = sim.business.lastUpkeepTick + 24;
  const cashPreUp = sim.cash;
  businessMod.businessTick(sim);
  const upkeep = businessMod.businessDailyUpkeep(sim.business);
  if (upkeep <= 0) throw new Error('upkeep should be positive');
  if (!(sim.cash < cashPreUp)) throw new Error('daily upkeep should debit cash');

  // upgrade: level naik, income naik, value = modal (beli + upgrade), net-worth-neutral juga
  const inst = getBusiness(sim.business, 'coffee');
  if (!inst) throw new Error('should own coffee');
  const def = businessDef('coffee')!;
  const upCost = upgradeCost(def, inst.level);
  sim.cash = 100_000;
  const eqPreUp = equity(sim);
  const cashPreUpg = sim.cash;
  const up = upgradeBusiness(sim, 'coffee');
  if (!up.ok) throw new Error('upgrade failed: ' + up.msg);
  if (inst.level !== 2) throw new Error('level should be 2');
  if (sim.cash !== cashPreUpg - upCost) throw new Error('cash should drop by upgrade cost');
  const eqPostUp = equity(sim);
  if (Math.abs(eqPostUp - eqPreUp) > 1) throw new Error('upgrade must be net-worth-neutral');
  if (businessIncomePerTick(sim.business) <= inc) throw new Error('upgrade should raise income');
  if (businessValueOf(def, 2) <= businessValueOf(def, 1)) throw new Error('value should rise with level');

  // max level cap
  inst.level = def.maxLevel;
  if (upgradeBusiness(sim, 'coffee').ok) throw new Error('max-level upgrade should fail');

  // normalize: buang id asing, clamp level
  const norm = businessMod.normalizeBusiness({ owned: [{ id: 'ghost', level: 9 }, { id: 'foodtruck', level: 99 }], lastUpkeepTick: 5 }, 100);
  if (norm.owned.length !== 1 || norm.owned[0].id !== 'foodtruck' || norm.owned[0].level !== 3)
    throw new Error('normalizeBusiness should drop unknown ids and clamp level');

  console.log(
    'business buy net-neutral: ok | income/tick:', inc.toFixed(2),
    '| upkeep/day:', upkeep.toFixed(0),
    '| upgrade L2 cost:', upCost,
    '| value L2:', businessValueOf(def, 2)
  );
}

// ---------- Phase 3b: CT Feed (prosedural dari state sim beneran) ----------
{
  const sim = freshSim();
  const feed = feedMod.createFeed();
  sim.feed = feed;

  // paksa ada event di feed supaya kandidat 'event' tersedia
  const rng = new RNG(42);
  const pend = generateEvent(sim, rng);
  if (pend) applyEvent(sim, pend);

  // jalanin banyak tick feed → harus ada post yang ke-generate
  for (let i = 0; i < 400 && feed.posts.length < 3; i++) feedMod.feedTick(sim, rng);

  if (feed.posts.length === 0) throw new Error('feed should generate posts over time');

  // setiap post harus refer state nyata: teks non-kosong, penulis bot beneran atau 'you'
  for (const p of feed.posts) {
    if (!p.text || !p.text.trim()) throw new Error('post text must not be empty');
    if (p.authorId !== 'you' && !sim.bots.some((b) => b.id === p.authorId))
      throw new Error('post author must be a real bot: ' + p.authorId);
  }

  // post event harus nyangkut ke event beneran (lastEventId ke-set & unik per event)
  if (feed.lastEventId && !sim.events.some((e) => e.id === feed.lastEventId))
    throw new Error('lastEventId must reference a real event');

  // post 'Kamu' dari aksi pemain
  const before = feed.posts.length;
  feedMod.feedFromYou(sim, 'Beli Kedai Kopi. Cashflow jalan.', 'Bisnis');
  if (feed.posts.length !== before + 1) throw new Error('feedFromYou should push a post');
  if (feed.posts[0].authorId !== 'you' || feed.posts[0].kind !== 'you') throw new Error('player post mis-tagged');

  // cooldown: jenis yang sama nggak boleh ngepost beruntun
  const evPosts = feed.posts.filter((p) => p.kind === 'event');
  if (evPosts.length > 1) {
    for (let i = 1; i < evPosts.length; i++) {
      if (evPosts[i].t === evPosts[i - 1].t) throw new Error('same-kind posts must respect cooldown');
    }
  }

  // normalize: buang post rusak, jaga struktur
  const norm = feedMod.normalizeFeed({
    posts: [{ id: 'a', t: 1, kind: 'event', authorId: 'bot_0', name: 'Aria', emoji: '🤖', text: 'ok', tag: null }, { id: '', text: '' }],
    seq: 'x',
    lastByKind: { event: '3' },
    lastEventId: 7
  });
  if (norm.posts.length !== 1 || norm.seq !== 1 || norm.lastByKind['event'] !== 3 || norm.lastEventId !== null)
    throw new Error('normalizeFeed should drop invalid posts/scalars');

  console.log(
    'feed posts:', feed.posts.length,
    '| kinds:', [...new Set(feed.posts.map((p) => p.kind))].join(','),
    '| example:', feed.posts.find((p) => p.kind !== 'you')?.text.slice(0, 52),
    '| player post: ok | normalize: ok'
  );
}
