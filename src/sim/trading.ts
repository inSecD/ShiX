import type { Fill, Instrument, Order, OrderSide, OrderType, Position, Settings, SimState } from './types';

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function depthUsd(inst: Instrument): number {
  return Math.max(300, inst.mcap * inst.liquidity * 0.0006);
}

export function spreadOf(inst: Instrument): number {
  return 0.0004 + (1 - inst.liquidity) * 0.006;
}

export function estimateFillPrice(
  inst: Instrument,
  side: OrderSide,
  qty: number,
  settings: Settings
): { price: number; slippage: number; notional: number; fee: number } {
  const notional = Math.abs(qty) * inst.price;
  const ratio = notional / depthUsd(inst);
  const slip = settings.slippageEnabled
    ? Math.min(0.4, 0.012 * Math.pow(Math.max(ratio, 1e-5), 0.62))
    : 0;
  const total = spreadOf(inst) / 2 + slip;
  const dir = side === 'buy' ? 1 : -1;
  const price = inst.price * (1 + dir * total);
  const rate = side === 'buy' ? settings.feeTaker : settings.feeMaker;
  return { price, slippage: total, notional: price * Math.abs(qty), fee: price * Math.abs(qty) * rate };
}

export function positionPnl(pos: Position, mark: number): number {
  const dir = pos.side === 'long' ? 1 : -1;
  return (mark - pos.entry) * pos.qty * dir;
}

export function positionNotional(pos: Position, mark: number): number {
  return Math.abs(pos.qty) * mark;
}

export function liquidationPrice(entry: number, lev: number, side: 'long' | 'short'): number {
  const maint = 0.005;
  const dist = Math.max(1 / lev - maint, 0.001);
  return side === 'long' ? entry * (1 - dist) : entry * (1 + dist);
}

export function findPosition(state: SimState, instId: string): Position | undefined {
  return Object.values(state.positions).find((p) => p.instId === instId);
}

export function pushFill(state: SimState, fill: Fill): void {
  state.fills.unshift(fill);
  if (state.fills.length > 400) state.fills.length = 400;
}

export function openPosition(
  state: SimState,
  instId: string,
  side: 'long' | 'short',
  qty: number,
  price: number,
  fee: number,
  lev: number
): { ok: boolean; msg: string } {
  const notional = qty * price;
  const margin = notional / lev;
  if (margin + fee > state.cash) return { ok: false, msg: 'Margin tidak cukup' };

  const pos: Position = {
    id: uid('pos'),
    instId,
    side,
    qty,
    entry: price,
    lev,
    margin,
    openedAt: state.simTime,
    liqPrice: liquidationPrice(price, lev, side),
    fees: fee,
    fundingPaid: 0,
    tp: null,
    sl: null
  };
  state.positions[pos.id] = pos;
  state.cash -= margin + fee;
  state.locked += margin;
  pushFill(state, {
    id: uid('f'),
    t: state.simTime,
    instId,
    side: side === 'long' ? 'buy' : 'sell',
    qty,
    price,
    fee,
    pnl: 0,
    kind: 'open',
    note: `Buka ${side} ${lev}x @ ${price}`
  });
  return { ok: true, msg: 'Posisi dibuka' };
}

export function closePosition(
  state: SimState,
  posId: string,
  qty: number,
  price: number,
  fee: number,
  kind: Fill['kind'] = 'close'
): { pnl: number } {
  const pos = state.positions[posId];
  if (!pos) return { pnl: 0 };
  const dir = pos.side === 'long' ? 1 : -1;
  let pnl = (price - pos.entry) * qty * dir;
  if (kind === 'liquidate') {
    const maxLoss = pos.margin * 1.05;
    if (pnl < -maxLoss) pnl = -maxLoss;
  }
  const releasedMargin = (pos.margin * qty) / pos.qty;

  pos.qty -= qty;
  pos.margin -= releasedMargin;
  pos.fees += fee;
  state.cash += pnl - fee + releasedMargin;
  state.locked -= releasedMargin;
  state.realized += pnl - fee;

  if (pos.qty <= 1e-12) delete state.positions[posId];

  pushFill(state, {
    id: uid('f'),
    t: state.simTime,
    instId: pos.instId,
    side: pos.side === 'long' ? 'sell' : 'buy',
    qty,
    price,
    fee,
    pnl: pnl - fee,
    kind,
    note: kind === 'liquidate' ? 'LIKUIDASI PAKSA' : `Tutup ${pos.side}`
  });
  return { pnl };
}

export interface OrderRequest {
  instId: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  price?: number | null;
  stopPrice?: number | null;
  lev: number;
  tif?: 'GTC' | 'IOC';
  note?: string;
}

export function placeOrder(state: SimState, settings: Settings, req: OrderRequest): { ok: boolean; msg: string; order?: Order } {
  const inst = state.instruments[req.instId];
  if (!inst) return { ok: false, msg: 'Instrumen tidak ditemukan' };
  if (!(req.qty > 0)) return { ok: false, msg: 'Jumlah tidak valid' };

  const lev = Math.max(1, Math.min(req.lev, settings.maxLeverage));
  const refPrice = req.type === 'limit' && req.price ? req.price : inst.price;
  const notional = req.qty * refPrice;
  const margin = notional / lev;
  const feeRate = req.type === 'limit' || req.type === 'stop-limit' ? settings.feeMaker : settings.feeTaker;
  const estFee = notional * feeRate;

  const existing = findPosition(state, req.instId);
  const closing = existing && (existing.side === 'long' ? 'sell' : 'buy') === req.side;
  const needed = closing ? estFee : margin + estFee;

  if (needed > state.cash) return { ok: false, msg: 'Margin tidak cukup untuk order ini' };

  const order: Order = {
    id: uid('ord'),
    instId: req.instId,
    side: req.side,
    type: req.type,
    qty: req.qty,
    price: req.price ?? null,
    stopPrice: req.stopPrice ?? null,
    lev,
    tif: req.tif ?? 'GTC',
    status: 'open',
    createdAt: state.simTime,
    filledQty: 0,
    avgFill: 0,
    note: req.note ?? ''
  };

  if (req.type === 'market') {
    fillMarketOrder(state, settings, order, inst);
    return { ok: true, msg: 'Order market dieksekusi', order };
  }

  state.orders[order.id] = order;
  return { ok: true, msg: 'Order resting di order book', order };
}

export function applyFill(
  state: SimState,
  order: Order,
  qty: number,
  price: number,
  fee: number
): number {
  const ordSide: 'long' | 'short' = order.side === 'buy' ? 'long' : 'short';
  const pos = findPosition(state, order.instId);

  if (pos && pos.side === ordSide) {
    const addMargin = (qty * price) / pos.lev;
    if (state.cash < addMargin + fee) {
      const affordable = Math.max(0, ((state.cash - fee) * pos.lev) / price);
      if (affordable < 1e-9) return 0;
      const useQty = Math.min(qty, affordable);
      const useMargin = (useQty * price) / pos.lev;
      const newQty = pos.qty + useQty;
      pos.entry = (pos.entry * pos.qty + price * useQty) / newQty;
      pos.qty = newQty;
      pos.margin += useMargin;
      pos.fees += fee;
      pos.liqPrice = liquidationPrice(pos.entry, pos.lev, pos.side);
      state.cash -= useMargin + fee;
      state.locked += useMargin;
      pushFill(state, {
        id: uid('f'),
        t: state.simTime,
        instId: order.instId,
        side: order.side,
        qty: useQty,
        price,
        fee,
        pnl: 0,
        kind: 'open',
        note: `Tambah posisi ${ordSide} ${pos.lev}x`
      });
      return useQty;
    }
    const newQty = pos.qty + qty;
    pos.entry = (pos.entry * pos.qty + price * qty) / newQty;
    pos.qty = newQty;
    pos.margin += addMargin;
    pos.fees += fee;
    pos.liqPrice = liquidationPrice(pos.entry, pos.lev, pos.side);
    state.cash -= addMargin + fee;
    state.locked += addMargin;
    pushFill(state, {
      id: uid('f'),
      t: state.simTime,
      instId: order.instId,
      side: order.side,
      qty,
      price,
      fee,
      pnl: 0,
      kind: 'open',
      note: `Tambah posisi ${ordSide} ${pos.lev}x`
    });
    return qty;
  }

  if (pos) {
    const closeQty = Math.min(qty, pos.qty);
    closePosition(state, pos.id, closeQty, price, fee);
    const remainder = qty - closeQty;
    if (remainder > 1e-9) openPosition(state, order.instId, ordSide, remainder, price, 0, order.lev);
  } else {
    openPosition(state, order.instId, ordSide, qty, price, fee, order.lev);
  }
  return qty;
}

export function fillMarketOrder(state: SimState, settings: Settings, order: Order, inst: Instrument): void {
  const est = estimateFillPrice(inst, order.side, order.qty, settings);
  applyFill(state, order, order.qty, est.price, est.fee);
  order.status = 'filled';
}

export function cancelOrder(state: SimState, orderId: string): void {
  const o = state.orders[orderId];
  if (o && (o.status === 'open' || o.status === 'triggered')) o.status = 'cancelled';
}

export function closePositionById(
  state: SimState,
  posId: string,
  settings: Settings,
  fraction = 1
): { ok: boolean; msg: string } {
  const pos = state.positions[posId];
  if (!pos) return { ok: false, msg: 'Posisi tidak ditemukan' };
  const inst = state.instruments[pos.instId];
  if (!inst) return { ok: false, msg: 'Instrumen tidak ditemukan' };
  const qty = pos.qty * Math.max(0, Math.min(1, fraction));
  if (qty <= 0) return { ok: false, msg: 'Ukuran tidak valid' };
  const est = estimateFillPrice(inst, pos.side === 'long' ? 'sell' : 'buy', qty, settings);
  closePosition(state, pos.id, qty, est.price, est.fee);
  return { ok: true, msg: 'Posisi ditutup' };
}
