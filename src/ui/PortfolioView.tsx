import { useMemo } from 'react';
import { useStore } from '../store';
import { equity, spotUnrealizedPnl, spotValue, unrealizedPnl } from '../sim/engine';
import { positionPnl } from '../sim/trading';
import { holdingsPnl, traderTier, worldAssetsValue } from '../sim/world';
import { fmtPct, fmtPrice, fmtQty, fmtUsd, fmtTime } from '../lib/format';

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  const d = useMemo(() => {
    if (data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const rng = max - min || 1;
    return data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 26 - ((v - min) / rng) * 24;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }, [data]);

  if (!d) return <div className="empty tiny">Belum ada history</div>;
  return (
    <svg className="spark" viewBox="0 0 100 28" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function PortfolioView() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  const closeAll = useStore((s) => s.closeAll);
  const cancel = useStore((s) => s.cancel);
  const select = useStore((s) => s.select);
  const setTab = useStore((s) => s.setTab);
  void v;

  const positions = Object.values(sim.positions);
  const orders = Object.values(sim.orders)
    .filter((o) => o.status === 'open' || o.status === 'triggered')
    .sort((a, b) => b.createdAt - a.createdAt);
  const eq = equity(sim);
  const tier = traderTier(sim.world.level, eq);
  const upnl = unrealizedPnl(sim);
  const spotList = Object.values(sim.spotHoldings);
  const spotVal = spotValue(sim);
  const spotPnl = spotUnrealizedPnl(sim);
  const curve = sim.equityCurve;
  const worldValue = worldAssetsValue(sim.world);
  const worldPnl = holdingsPnl(sim.world);
  const worldHoldings = sim.world.holdings.length;
  const transit = sim.world.shipments.filter((s) => s.status === 'in_transit').length;

  return (
    <div>
      <div className="panel">
        <div className="panel-head">
          <span>Portfolio</span>
          <button className="ghost tiny" onClick={closeAll} disabled={!positions.length}>
            Tutup Futures
          </button>
        </div>
        <div className="panel-body">
          <div className="grid5">
            <div>
              <div className="tiny muted">Equity</div>
              <div className="mono" style={{ fontSize: 17, fontWeight: 800 }}>{fmtUsd(eq)}</div>
            </div>
            <div>
              <div className="tiny muted">Cash</div>
              <div className="mono" style={{ fontSize: 15 }}>{fmtUsd(sim.cash)}</div>
            </div>
            <div>
              <div className="tiny muted">Unrealized</div>
              <div className={`mono ${upnl >= 0 ? 'up' : 'down'}`} style={{ fontSize: 15, fontWeight: 700 }}>
                {fmtUsd(upnl)}
              </div>
            </div>
            <div>
              <div className="tiny muted">Spot</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{fmtUsd(spotVal)}</div>
              <div className={`tiny mono ${spotPnl >= 0 ? 'up' : 'down'}`}>{fmtUsd(spotPnl)}</div>
            </div>
            <div>
              <div className="tiny muted">Komoditas</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{fmtUsd(worldValue)}</div>
              <div className={`tiny mono ${worldPnl >= 0 ? 'up' : 'down'}`}>{fmtUsd(worldPnl)}</div>
            </div>
          </div>
          <Sparkline data={curve} up={upnl >= 0} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Spot Crypto ({spotList.length})</span>
          <span className="badge">NO LEVERAGE</span>
        </div>
        {spotList.length === 0 ? (
          <div className="empty">Belum ada holding spot</div>
        ) : (
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Pair</th>
                  <th>Qty</th>
                  <th>Avg</th>
                  <th>Mark</th>
                  <th>PnL</th>
                  <th>Nilai</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {spotList.map((h) => {
                  const inst = sim.instruments[h.instId];
                  if (!inst) return null;
                  const pnl = (inst.price - h.avgCost) * h.qty;
                  const roe = h.avgCost > 0 ? (inst.price / h.avgCost - 1) * 100 : 0;
                  return (
                    <tr key={h.instId}>
                      <td className="lbl">
                        <div style={{ fontWeight: 700 }}>{inst.id}</div>
                        <div className="tiny muted">{inst.name}</div>
                      </td>
                      <td>{fmtQty(h.qty)}</td>
                      <td>{fmtPrice(h.avgCost)}</td>
                      <td>{fmtPrice(inst.price)}</td>
                      <td className={pnl >= 0 ? 'up' : 'down'}>
                        {fmtUsd(pnl)}
                        <div className="tiny">{fmtPct(roe)}</div>
                      </td>
                      <td>{fmtUsd(inst.price * h.qty)}</td>
                      <td>
                        <button
                          className="tiny"
                          onClick={() => {
                            select(h.instId);
                            setTab('market');
                          }}
                        >
                          Kelola
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Aset Dunia</span>
          <button className="ghost tiny" onClick={() => setTab('world')}>Buka</button>
        </div>
        <div className="panel-body">
          <div className="row between tiny">
            <span className="muted">Tier trader {tier.next ? `· next ${tier.next.name}` : '· max'}</span>
            <span className={`tier-badge tier-${tier.tier.id}`} title={tier.tier.tagline}>
              {tier.tier.name}
            </span>
          </div>
          <div className="row between tiny" style={{ marginTop: 6 }}>
            <span className="muted">Komoditas · {worldHoldings} stok</span>
            <b className="mono">{fmtUsd(worldValue)}</b>
          </div>
          <div className="row between tiny" style={{ marginTop: 6 }}>
            <span className="muted">Pengiriman aktif</span>
            <b className="mono">{transit}</b>
          </div>
          <div className="row between tiny" style={{ marginTop: 6 }}>
            <span className="muted">Pabrik · level intel</span>
            <b className="mono">{sim.world.factories.length} · L{sim.world.level}</b>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Posisi Futures ({positions.length})</span>
          <span className="badge">Realized {fmtUsd(sim.realized)}</span>
        </div>
        {positions.length === 0 ? (
          <div className="empty">Belum ada posisi terbuka</div>
        ) : (
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Pair</th>
                  <th>Sisi</th>
                  <th>Qty</th>
                  <th>Entry</th>
                  <th>Mark</th>
                  <th>PnL</th>
                  <th>Liq</th>
                  <th>Bracket</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const inst = sim.instruments[p.instId];
                  if (!inst) return null;
                  const pnl = positionPnl(p, inst.price);
                  const roe = p.margin > 0 ? (pnl / p.margin) * 100 : 0;
                  return (
                    <tr key={p.id}>
                      <td className="lbl">
                        <div style={{ fontWeight: 700 }}>{inst.id}</div>
                        <div className="tiny muted">{inst.name}</div>
                      </td>
                      <td>
                        <span className={`badge ${p.side === 'long' ? 'accent' : 'danger'}`}>
                          {p.side.toUpperCase()} {p.lev}x
                        </span>
                      </td>
                      <td>{fmtQty(p.qty)}</td>
                      <td>{fmtPrice(p.entry)}</td>
                      <td>{fmtPrice(inst.price)}</td>
                      <td className={pnl >= 0 ? 'up' : 'down'}>
                        {fmtUsd(pnl)}
                        <div className="tiny">{fmtPct(roe)}</div>
                      </td>
                      <td className="down">{fmtPrice(p.liqPrice)}</td>
                      <td>
                        {p.tp != null && <div className="tiny up">TP {fmtPrice(p.tp)}</div>}
                        {p.sl != null && <div className="tiny down">SL {fmtPrice(p.sl)}</div>}
                        {p.trail != null && <div className="tiny muted">Trail {(p.trail * 100).toFixed(1)}%</div>}
                        {p.tp == null && p.sl == null && p.trail == null && <span className="muted tiny">-</span>}
                      </td>
                      <td>
                        <button
                          className="tiny"
                          onClick={() => {
                            select(p.instId);
                            setTab('trade');
                          }}
                        >
                          Kelola
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Open Orders ({orders.length})</span>
        </div>
        {orders.length === 0 ? (
          <div className="empty">Tidak ada order resting</div>
        ) : (
          <div className="panel-body" style={{ padding: 0 }}>
            {orders.map((o) => {
              return (
                <div
                  key={o.id}
                  className="row between"
                  style={{ padding: '9px 12px', borderBottom: '1px solid var(--line)' }}
                >
                  <div>
                    <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
                      <span className={o.side === 'buy' ? 'up' : 'down'}>
                        {o.side === 'buy' ? 'BUY' : 'SELL'}
                      </span>{' '}
                      {o.instId} {fmtQty(o.qty - o.filledQty)}
                    </div>
                    <div className="tiny muted">
                      {o.type} @ {o.type === 'market' ? 'MKT' : fmtPrice(o.price ?? 0)}
                      {o.stopPrice ? ` · stop ${fmtPrice(o.stopPrice)}` : ''} · {o.lev}x
                    </div>
                  </div>
                  <button className="tiny" onClick={() => cancel(o.id)}>
                    Batal
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Riwayat Transaksi</span>
        </div>
        {sim.fills.length === 0 ? (
          <div className="empty">Belum ada transaksi</div>
        ) : (
          <div className="panel-body" style={{ padding: 0 }}>
            {sim.fills.slice(0, 60).map((f) => (
              <div
                key={f.id}
                className="row between"
                style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}
              >
                <div>
                  <div className="mono" style={{ fontSize: 11.5, fontWeight: 700 }}>
                    {f.kind === 'liquidate' ? (
                      <span className="down">LIKUIDASI</span>
                    ) : (
                      <span className={f.side === 'buy' ? 'up' : 'down'}>
                        {f.side === 'buy' ? 'BUY' : 'SELL'}
                      </span>
                    )}{' '}
                    {f.instId} {fmtQty(f.qty)}
                  </div>
                  <div className="tiny muted">
                    {fmtTime(f.t)} · @ {fmtPrice(f.price)} · fee {fmtUsd(f.fee)} · {f.note}
                  </div>
                </div>
                {f.pnl !== 0 && (
                  <div className={`mono ${f.pnl >= 0 ? 'up' : 'down'}`} style={{ fontWeight: 700 }}>
                    {fmtUsd(f.pnl)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
