import { useState } from 'react';
import { useStore } from '../store';
import { equity } from '../sim/engine';
import { STRATEGY_LABEL } from '../sim/bots';
import { fmtPct, fmtPrice, fmtQty, fmtUsd } from '../lib/format';
import type { Bot } from '../sim/types';

interface Row {
  key: string;
  name: string;
  emoji: string;
  strategy: string;
  equity: number;
  pnlPct: number;
  me: boolean;
  bot: Bot | null;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function RankView() {
  const sim = useStore((s) => s.sim);
  const settings = useStore((s) => s.settings);
  const v = useStore((s) => s.v);
  const setTab = useStore((s) => s.setTab);
  const [openId, setOpenId] = useState<string | null>(null);
  void v;

  const eq = equity(sim);
  const base = sim.challenge?.startEquity ?? settings.startingCash;
  const mePnl = base > 0 ? (eq / base - 1) * 100 : 0;

  const rows: Row[] = [
    ...sim.bots.map((b) => ({
      key: b.id,
      name: b.name,
      emoji: b.emoji,
      strategy: STRATEGY_LABEL[b.strategy],
      equity: b.equity,
      pnlPct: b.pnlPct,
      me: false,
      bot: b
    })),
    { key: 'me', name: 'Kamu', emoji: '🧑‍💻', strategy: 'Kamu', equity: eq, pnlPct: mePnl, me: true, bot: null }
  ].sort((a, b) => b.equity - a.equity);

  const myRank = rows.findIndex((r) => r.me) + 1;
  const best = rows[0];
  const ch = sim.challenge;
  const chPct = ch && ch.startEquity > 0 ? (eq / ch.startEquity - 1) * 100 : 0;
  const chProg = ch ? Math.min(1, Math.max(0, chPct / (ch.targetPct * 100))) : 0;

  return (
    <div>
      <div className="panel">
        <div className="panel-head">
          <span>Papan Peringkat</span>
          <span className="badge accent">AI + Kamu</span>
        </div>
        <div className="panel-body">
          <div className="grid3">
            <div>
              <div className="tiny muted">Peringkat</div>
              <div className="mono" style={{ fontSize: 19, fontWeight: 800 }}>
                #{myRank}
                <span className="tiny muted"> / {rows.length}</span>
              </div>
            </div>
            <div>
              <div className="tiny muted">Equity</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>
                {fmtUsd(eq, true)}
              </div>
            </div>
            <div>
              <div className="tiny muted">Return</div>
              <div className={`mono ${mePnl >= 0 ? 'up' : 'down'}`} style={{ fontSize: 15, fontWeight: 700 }}>
                {fmtPct(mePnl)}
              </div>
            </div>
          </div>
          <div className="hint" style={{ marginTop: 8 }}>
            Bot AI ambil posisi otomatis tiap beberapa jam dengan strategi masing-masing. Klik bot buat lihat
            holding-nya. Peringkat dihitung dari equity.
          </div>
          {best && !best.me && (
            <div className="tiny muted" style={{ marginTop: 6 }}>
              Pemimpin: {best.emoji} {best.name} ({fmtUsd(best.equity, true)}, {fmtPct(best.pnlPct)})
            </div>
          )}
        </div>
      </div>

      {ch && (
        <div className="panel">
          <div className="panel-head">
            <span>Tantangan Harian</span>
            <span className={`badge ${ch.done ? (ch.won ? 'accent' : 'danger') : 'warn'}`}>
              {ch.done ? (ch.won ? 'LOLOS' : 'GAGAL') : 'BERJALAN'}
            </span>
          </div>
          <div className="panel-body">
            <div className="row between tiny">
              <span className="muted">Target +{(ch.targetPct * 100).toFixed(0)}%</span>
              <span className={`mono ${chPct >= 0 ? 'up' : 'down'}`}>{fmtPct(chPct)}</span>
            </div>
            <div className="curve" style={{ marginTop: 6 }}>
              <i style={{ width: `${chProg * 100}%` }} />
            </div>
            <div className="row between tiny muted" style={{ marginTop: 4 }}>
              <span>terbaik {fmtPct(ch.bestPct)}</span>
              <span>
                {ch.done
                  ? `hasil ${fmtPct(ch.finalPct ?? chPct)}`
                  : `sisa ${Math.max(0, Math.ceil((ch.deadlineTick - sim.ticks) / 24))} hari`}
              </span>
            </div>
            <button className="ghost tiny" style={{ width: '100%', marginTop: 8 }} onClick={() => setTab('settings')}>
              Atur tantangan harian
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <span>Klasemen</span>
          <span className="badge">{rows.length} trader</span>
        </div>
        <div style={{ padding: 0 }}>
          {rows.map((r, i) => {
            const open = openId === r.key;
            const pos = i + 1;
            return (
              <div key={r.key} className={`rank-wrap ${r.me ? 'me' : ''}`}>
                <button className="rank-row" onClick={() => setOpenId(open ? null : r.key)}>
                  <span className={`rank-no ${pos <= 3 ? 'top' : ''}`}>{MEDALS[i] ?? pos}</span>
                  <span className="rank-who">
                    <span style={{ fontWeight: 700, fontSize: 12.5 }}>
                      {r.emoji} {r.name}
                      {r.me ? ' · LU' : ''}
                    </span>
                    <span className="tiny muted">
                      {r.strategy}
                      {r.bot ? ` · ${r.bot.trades} trade` : ''}
                    </span>
                  </span>
                  <span className="rank-val">
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
                      {fmtUsd(r.equity, true)}
                    </span>
                    <span className={`tiny mono ${r.pnlPct >= 0 ? 'up' : 'down'}`}>{fmtPct(r.pnlPct)}</span>
                  </span>
                </button>

                {open && r.me && (
                  <div className="rank-detail">
                    <div className="tiny muted" style={{ marginBottom: 6 }}>
                      Ini akun kamu. Lihat detail posisi dan bracket di tab Porto / Trade.
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="tiny" onClick={() => setTab('portfolio')}>
                        Buka Portfolio
                      </button>
                      <button className="tiny" onClick={() => setTab('trade')}>
                        Buka Trade
                      </button>
                    </div>
                  </div>
                )}

                {open && r.bot && (
                  <div className="rank-detail">
                    <div className="row between tiny muted" style={{ marginBottom: 6 }}>
                      <span>Cash {fmtUsd(r.bot.cash)}</span>
                      <span>Start {fmtUsd(r.bot.startEquity, true)}</span>
                    </div>
                    {r.bot.holdings.length === 0 ? (
                      <div className="tiny muted">Bot lagi full cash / menunggu sinyal.</div>
                    ) : (
                      r.bot.holdings.map((h) => {
                        const inst = sim.instruments[h.instId];
                        if (!inst) return null;
                        const pnl = (inst.price / h.entry - 1) * 100;
                        const value = h.qty * inst.price;
                        return (
                          <div key={h.instId} className="row between" style={{ padding: '3px 0' }}>
                            <div>
                              <span className="mono" style={{ fontSize: 11.5, fontWeight: 700 }}>
                                {inst.id}
                              </span>
                              <span className="tiny muted"> · {fmtQty(h.qty)} @ {fmtPrice(h.entry)}</span>
                            </div>
                            <div className="tiny mono" style={{ textAlign: 'right' }}>
                              {fmtUsd(value, true)}{' '}
                              <span className={pnl >= 0 ? 'up' : 'down'}>{fmtPct(pnl)}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
