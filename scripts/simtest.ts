import { createSim, tick, equity, unrealizedPnl } from '../src/sim/engine';
import { placeOrder, closePositionById } from '../src/sim/trading';
import type { Settings } from '../src/sim/types';

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
for (let i = 0; i < 4000; i++) {
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
