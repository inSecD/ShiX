import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { ChartView } from './ChartView';
import { marketOpen } from '../sim/engine';
import { depthUsd, estimateFillPrice, isSpotable, liquidationPrice } from '../sim/trading';
import { fmtPct, fmtPrice, fmtQty, fmtUsd } from '../lib/format';
import { SpotTicket } from './SpotTicket';
import type { OrderType } from '../sim/types';

const TYPES: { id: OrderType; label: string }[] = [
  { id: 'market', label: 'Market' },
  { id: 'limit', label: 'Limit' },
  { id: 'stop', label: 'Stop' },
  { id: 'stop-limit', label: 'Stop-Limit' }
];

const pxText = (v: number) => String(+v.toPrecision(6));

export function TradePanel({ embedded = false }: { embedded?: boolean }) {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  const selectedId = useStore((s) => s.selectedId);
  const tf = useStore((s) => s.tf);
  const settings = useStore((s) => s.settings);
  const order = useStore((s) => s.order);
  const cancel = useStore((s) => s.cancel);
  const closePos = useStore((s) => s.closePos);
  const setRisk = useStore((s) => s.setRisk);
  void v;

  const inst = sim.instruments[selectedId];
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [type, setType] = useState<OrderType>('market');
  const [amount, setAmount] = useState('500');
  const [limitPx, setLimitPx] = useState('');
  const [stopPx, setStopPx] = useState('');
  const [lev, setLev] = useState(1);
  const [tpText, setTpText] = useState('');
  const [slText, setSlText] = useState('');
  const [trailText, setTrailText] = useState('');
  const [marketMode, setMarketMode] = useState<'futures' | 'spot'>(() =>
    sim.spotHoldings[selectedId] ? 'spot' : 'futures'
  );

  const pos = useMemo(
    () => Object.values(sim.positions).find((p) => p.instId === selectedId),
    [sim.positions, selectedId]
  );

  useEffect(() => {
    setTpText(pos?.tp != null ? pxText(pos.tp) : '');
    setSlText(pos?.sl != null ? pxText(pos.sl) : '');
    setTrailText(pos?.trail != null ? String(+(pos.trail * 100).toFixed(2)) : '');
  }, [pos?.id, pos?.tp, pos?.sl, pos?.trail]);

  const numOrNull = (text: string): number | null => {
    const n = parseFloat(text);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const saveRisk = (posId: string) => {
    const t = parseFloat(trailText);
    const trail = Number.isFinite(t) && t > 0 ? Math.min(t, 50) / 100 : null;
    setRisk(posId, numOrNull(tpText), numOrNull(slText), trail);
  };
  const orders = useMemo(
    () => Object.values(sim.orders).filter((o) => o.instId === selectedId && (o.status === 'open' || o.status === 'triggered')),
    [sim.orders, selectedId]
  );

  if (!inst) return <div className="empty">Pilih instrumen di tab Market</div>;

  const usd = Math.max(0, parseFloat(amount) || 0);
  const refPx = type === 'limit' && limitPx ? parseFloat(limitPx) : inst.price;
  const qty = refPx > 0 ? usd / refPx : 0;
  const est = estimateFillPrice(inst, side === 'long' ? 'buy' : 'sell', qty, settings);
  const notional = qty * est.price;
  const margin = notional / lev;
  const liq = liquidationPrice(est.price, lev, side);
  const open = marketOpen(inst, sim.simTime);
  const depth = depthUsd(inst);

  const change24 = useMemo(() => {
    const cs = inst.candles;
    if (cs.length < 2) return 0;
    const a = cs[Math.max(0, cs.length - 25)]?.c ?? 0;
    return a ? ((cs[cs.length - 1].c - a) / a) * 100 : 0;
  }, [inst]);

  const submit = () => {
    if (!qty || qty <= 0) return;
    order({
      instId: inst.id,
      side: side === 'long' ? 'buy' : 'sell',
      type,
      qty,
      price: type === 'limit' || type === 'stop-limit' ? refPx : null,
      stopPrice: type === 'stop' || type === 'stop-limit' ? parseFloat(stopPx) || 0 : null,
      lev
    });
  };

  const spotable = isSpotable(inst);
  const modeTabs = spotable ? (
    <div className="trade-mode">
      <button className={marketMode === 'futures' ? 'on' : ''} onClick={() => setMarketMode('futures')}>
        FUTURES
      </button>
      <button className={marketMode === 'spot' ? 'on' : ''} onClick={() => setMarketMode('spot')}>
        SPOT
      </button>
    </div>
  ) : null;

  if (spotable && marketMode === 'spot') {
    return (
      <div className={`trade-panel ${embedded ? 'embedded' : ''}`}>
        {!embedded && <ChartView inst={inst} tf={tf} />}
        {modeTabs}
        <SpotTicket inst={inst} />
      </div>
    );
  }

  return (
    <div className={`trade-panel ${embedded ? 'embedded' : ''}`}>
      {!embedded && <ChartView inst={inst} tf={tf} />}
      {modeTabs}

      <div className="panel" data-tut="order-ticket">
        <div className="panel-head">
          <span>Order Ticket</span>
          <span className={open ? 'badge accent' : 'badge warn'}>{open ? 'MARKET OPEN' : 'CLOSED'}</span>
        </div>
        <div className="panel-body">
          <div className="grid3" style={{ marginBottom: 10 }}>
            <div>
              <div className="tiny muted">Perubahan 24J</div>
              <div className={`mono ${change24 >= 0 ? 'up' : 'down'}`} style={{ fontWeight: 700 }}>
                {fmtPct(change24)}
              </div>
            </div>
            <div>
              <div className="tiny muted">Market Cap</div>
              <div className="mono">{fmtUsd(inst.mcap, true)}</div>
            </div>
            <div>
              <div className="tiny muted">Likuiditas</div>
              <div className="mono">{(inst.liquidity * 100).toFixed(0)}%</div>
            </div>
          </div>

          <div className="side-tabs">
            <button className={`long ${side === 'long' ? 'on' : ''}`} onClick={() => setSide('long')}>
              LONG
            </button>
            <button className={`short ${side === 'short' ? 'on' : ''}`} onClick={() => setSide('short')}>
              SHORT
            </button>
          </div>

          <div className="seg" style={{ marginBottom: 10 }}>
            {TYPES.map((t) => (
              <button key={t.id} className={type === t.id ? 'on' : ''} onClick={() => setType(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="field">
            <label>Order value (USD)</label>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
            />
            <div className="pct-row">
              {[25, 50, 75, 100, 200].map((p) => (
                <button key={p} onClick={() => setAmount(String(Math.round((sim.cash * p) / 100)))}>
                  {p}%
                </button>
              ))}
            </div>
          </div>

          {(type === 'limit' || type === 'stop-limit') && (
            <div className="field">
              <label>Limit price</label>
              <input
                inputMode="decimal"
                value={limitPx}
                placeholder={fmtPrice(inst.price)}
                onChange={(e) => setLimitPx(e.target.value)}
              />
              <div className="pct-row">
                <button onClick={() => setLimitPx((inst.price * 0.99).toPrecision(6))}>-1%</button>
                <button onClick={() => setLimitPx((inst.price * 0.995).toPrecision(6))}>-0.5%</button>
                <button onClick={() => setLimitPx(inst.price.toPrecision(6))}>MARKET</button>
                <button onClick={() => setLimitPx((inst.price * 1.005).toPrecision(6))}>+0.5%</button>
                <button onClick={() => setLimitPx((inst.price * 1.01).toPrecision(6))}>+1%</button>
              </div>
            </div>
          )}

          {(type === 'stop' || type === 'stop-limit') && (
            <div className="field">
              <label>Stop price</label>
              <input
                inputMode="decimal"
                value={stopPx}
                placeholder={fmtPrice(side === 'long' ? inst.price * 0.97 : inst.price * 1.03)}
                onChange={(e) => setStopPx(e.target.value)}
              />
            </div>
          )}

          <div className="field">
            <label>Leverage: {lev}x</label>
            <input
              type="range"
              min={1}
              max={settings.maxLeverage}
              step={1}
              value={lev}
              onChange={(e) => setLev(parseInt(e.target.value, 10))}
            />
            <div className="row between tiny muted">
              <span>1x</span>
              <span>maks {settings.maxLeverage}x</span>
            </div>
          </div>

          <div className="divider" />

          <div className="kv">
            <span className="k">Estimasi fill</span>
            <span className="v">{fmtPrice(est.price)}</span>
          </div>
          <div className="kv">
            <span className="k">Slippage</span>
            <span className={`v ${est.slippage > 0.02 ? 'down' : ''}`}>{(est.slippage * 100).toFixed(2)}%</span>
          </div>
          <div className="kv">
            <span className="k">Qty</span>
            <span className="v">{fmtQty(qty)}</span>
          </div>
          <div className="kv">
            <span className="k">Notional</span>
            <span className="v">{fmtUsd(notional)}</span>
          </div>
          <div className="kv">
            <span className="k">Margin dibutuhkan</span>
            <span className="v">{fmtUsd(margin)}</span>
          </div>
          <div className="kv">
            <span className="k">Fee</span>
            <span className="v">{fmtUsd(est.fee)}</span>
          </div>
          <div className="kv">
            <span className="k">Harga likuidasi</span>
            <span className="v down">{fmtPrice(liq)}</span>
          </div>
          <div className="kv">
            <span className="k">Kedalaman book</span>
            <span className="v">{fmtUsd(depth, true)}</span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              className={side === 'long' ? 'long' : 'short'}
              style={{ flex: 1, padding: '13px 0', fontSize: 14 }}
              onClick={submit}
              disabled={!open || !qty}
            >
              {side === 'long' ? 'BUKA LONG' : 'BUKA SHORT'} {lev}x
            </button>
          </div>
          {!open && <div className="hint" style={{ marginTop: 8 }}>Pasar sedang tutup untuk aset ini.</div>}
        </div>
      </div>

      {pos && (
        <div className="panel">
          <div className="panel-head">
            <span>Posisi Berjalan</span>
            <span className={pos.side === 'long' ? 'badge accent' : 'badge danger'}>
              {pos.side.toUpperCase()} {pos.lev}x
            </span>
          </div>
          <div className="panel-body">
            <div className="kv">
              <span className="k">Qty</span>
              <span className="v">{fmtQty(pos.qty)}</span>
            </div>
            <div className="kv">
              <span className="k">Entry</span>
              <span className="v">{fmtPrice(pos.entry)}</span>
            </div>
            <div className="kv">
              <span className="k">Mark</span>
              <span className="v">{fmtPrice(inst.price)}</span>
            </div>
            <div className="kv">
              <span className="k">Margin</span>
              <span className="v">{fmtUsd(pos.margin)}</span>
            </div>
            <div className="kv">
              <span className="k">Likuidasi</span>
              <span className="v down">{fmtPrice(pos.liqPrice)}</span>
            </div>

            <div className="divider" />
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="bracket-title">TP / SL / Trailing</span>
              <span className="badge">OCO</span>
            </div>
            <div className="bracket-grid">
              <div>
                <label>Take profit</label>
                <input
                  inputMode="decimal"
                  value={tpText}
                  placeholder={fmtPrice(inst.price * (pos.side === 'long' ? 1.05 : 0.95))}
                  onChange={(e) => setTpText(e.target.value)}
                />
              </div>
              <div>
                <label>Stop loss</label>
                <input
                  inputMode="decimal"
                  value={slText}
                  placeholder={fmtPrice(inst.price * (pos.side === 'long' ? 0.97 : 1.03))}
                  onChange={(e) => setSlText(e.target.value)}
                />
              </div>
              <div>
                <label>Trail %</label>
                <input
                  inputMode="decimal"
                  value={trailText}
                  placeholder="2"
                  onChange={(e) => setTrailText(e.target.value)}
                />
              </div>
            </div>
            <div className="quick-row">
              <button
                className="tiny"
                onClick={() => setTpText(pxText(inst.price * (pos.side === 'long' ? 1.05 : 0.95)))}
              >
                TP 5%
              </button>
              <button
                className="tiny"
                onClick={() => setSlText(pxText(inst.price * (pos.side === 'long' ? 0.97 : 1.03)))}
              >
                SL 3%
              </button>
              <button className="tiny" onClick={() => setTrailText('2')}>
                Trail 2%
              </button>
              <button
                className="tiny"
                onClick={() => {
                  setTpText('');
                  setSlText('');
                  setTrailText('');
                }}
              >
                Reset
              </button>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              <button style={{ flex: 1 }} onClick={() => saveRisk(pos.id)}>
                Simpan Bracket
              </button>
              <button className="ghost" onClick={() => setRisk(pos.id, null, null, null)}>
                Hapus
              </button>
            </div>
            <div className="hint" style={{ marginTop: 6 }}>
              TP + SL aktif bersamaan (kena salah satu, posisi ditutup). Trailing mengikuti harga terbaik
              sejak dipasang.
            </div>

            <div className="row" style={{ marginTop: 10, gap: 6 }}>
              <button style={{ flex: 1 }} onClick={() => closePos(pos.id, 0.5)}>
                Tutup 50%
              </button>
              <button style={{ flex: 1 }} onClick={() => closePos(pos.id, 1)}>
                Tutup Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span>Open Orders</span>
            <span className="badge">{orders.length}</span>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            {orders.map((o) => (
              <div key={o.id} className="row between" style={{ padding: '9px 12px', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
                    {o.side === 'buy' ? 'BUY' : 'SELL'} {fmtQty(o.qty - o.filledQty)} @{' '}
                    {o.type === 'market' ? 'MKT' : fmtPrice(o.price ?? 0)}
                  </div>
                  <div className="tiny muted">
                    {o.type} · {o.lev}x · filled {((o.filledQty / (o.qty || 1)) * 100).toFixed(0)}%
                  </div>
                </div>
                <button onClick={() => cancel(o.id)}>Batal</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
