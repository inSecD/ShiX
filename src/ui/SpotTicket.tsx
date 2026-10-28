import { useState } from 'react';
import { useStore } from '../store';
import { estimateFillPrice } from '../sim/trading';
import { feeMultOf } from '../sim/perks';
import { fmtPct, fmtPrice, fmtQty, fmtUsd } from '../lib/format';
import type { Instrument } from '../sim/types';

export function SpotTicket({ inst }: { inst: Instrument }) {
  const sim = useStore((s) => s.sim);
  const settings = useStore((s) => s.settings);
  const spotBuy = useStore((s) => s.spotBuy);
  const spotSell = useStore((s) => s.spotSell);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('500');

  const holding = sim.spotHoldings[inst.id];
  const maxUsd = side === 'buy' ? Math.max(0, sim.cash) : (holding?.qty ?? 0) * inst.price;
  const usd = Math.max(0, parseFloat(amount) || 0);
  const qty = side === 'buy'
    ? usd / inst.price
    : Math.min(usd / inst.price, holding?.qty ?? 0);
  const est = estimateFillPrice(inst, side, qty, settings, feeMultOf(sim));
  const total = side === 'buy' ? est.notional + est.fee : est.notional - est.fee;
  const holdingPnl = holding ? (inst.price - holding.avgCost) * holding.qty : 0;
  const holdingRoe = holding && holding.avgCost > 0 ? (inst.price / holding.avgCost - 1) * 100 : 0;

  const submit = () => {
    if (side === 'buy') spotBuy(inst.id, usd);
    else if (qty > 0) spotSell(inst.id, qty);
  };

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <span>Spot Ticket</span>
          <span className="badge accent">NO LEVERAGE</span>
        </div>
        <div className="panel-body">
          <div className="side-tabs">
            <button className={`long ${side === 'buy' ? 'on' : ''}`} onClick={() => setSide('buy')}>
              BUY
            </button>
            <button className={`short ${side === 'sell' ? 'on' : ''}`} onClick={() => setSide('sell')}>
              SELL
            </button>
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
              {[25, 50, 75, 100].map((p) => (
                <button key={p} onClick={() => setAmount(String(Math.max(0, Math.round((maxUsd * p) / 100))))}>
                  {p}%
                </button>
              ))}
              <button onClick={() => setAmount(String(Math.max(0, Math.floor(maxUsd))))}>MAX</button>
            </div>
          </div>

          <div className="divider" />

          <div className="kv">
            <span className="k">Harga spot</span>
            <span className="v">{fmtPrice(inst.price)}</span>
          </div>
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
            <span className="k">Nilai</span>
            <span className="v">{fmtUsd(est.notional)}</span>
          </div>
          <div className="kv">
            <span className="k">Fee</span>
            <span className="v">{fmtUsd(est.fee)}</span>
          </div>
          <div className="kv">
            <span className="k">{side === 'buy' ? 'Total bayar' : 'Hasil bersih'}</span>
            <span className="v">{fmtUsd(total)}</span>
          </div>
          <div className="kv">
            <span className="k">{side === 'buy' ? 'Cash tersedia' : 'Holding'}</span>
            <span className="v">
              {side === 'buy' ? fmtUsd(sim.cash) : `${fmtQty(holding?.qty ?? 0)} ${inst.id}`}
            </span>
          </div>

          <button
            className={side === 'buy' ? 'long' : 'short'}
            style={{ width: '100%', padding: '13px 0', fontSize: 14, marginTop: 12 }}
            onClick={submit}
            disabled={!qty || qty <= 0 || (side === 'sell' && !holding)}
          >
            {side === 'buy' ? 'BELI SPOT' : 'JUAL SPOT'}
          </button>
          <div className="hint" style={{ marginTop: 8 }}>
            Market order. Tanpa leverage, margin, atau likuidasi. Fee dan slippage masuk ke harga eksekusi.
          </div>
        </div>
      </div>

      {holding && (
        <div className="panel">
          <div className="panel-head">
            <span>Holding Spot</span>
            <span className={`badge ${holdingPnl >= 0 ? 'accent' : 'danger'}`}>
              {holdingPnl >= 0 ? 'PROFIT' : 'LOSS'}
            </span>
          </div>
          <div className="panel-body">
            <div className="kv">
              <span className="k">Qty</span>
              <span className="v">{fmtQty(holding.qty)} {inst.id}</span>
            </div>
            <div className="kv">
              <span className="k">Avg entry</span>
              <span className="v">{fmtPrice(holding.avgCost)}</span>
            </div>
            <div className="kv">
              <span className="k">Mark</span>
              <span className="v">{fmtPrice(inst.price)}</span>
            </div>
            <div className="kv">
              <span className="k">Nilai</span>
              <span className="v">{fmtUsd(inst.price * holding.qty)}</span>
            </div>
            <div className="kv">
              <span className="k">PnL</span>
              <span className={`v ${holdingPnl >= 0 ? 'up' : 'down'}`}>
                {fmtUsd(holdingPnl)} ({fmtPct(holdingRoe)})
              </span>
            </div>
            <button
              className="ghost"
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => spotSell(inst.id, holding.qty)}
            >
              Jual Semua
            </button>
          </div>
        </div>
      )}
    </>
  );
}
