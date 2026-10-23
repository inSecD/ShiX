import { useMemo } from 'react';
import { useStore } from '../store';
import { equity, spotValue, unrealizedPnl } from '../sim/engine';
import { positionPnl } from '../sim/trading';
import { bestRoutes, holdingsPnl, traderTier, worldAssetsValue } from '../sim/world';
import { fmtPct, fmtPrice, fmtUsd } from '../lib/format';

const MEDALS = ['🥇', '🥈', '🥉'];

export function HomeView() {
  const sim = useStore((s) => s.sim);
  const settings = useStore((s) => s.settings);
  const v = useStore((s) => s.v);
  const select = useStore((s) => s.select);
  const setTab = useStore((s) => s.setTab);
  void v;

  const eq = equity(sim);
  const tier = traderTier(sim.world.level, eq);
  const upnl = unrealizedPnl(sim);
  const spotVal = spotValue(sim);
  const base = sim.challenge?.startEquity ?? settings.startingCash;
  const ret = base > 0 ? ((eq - base) / base) * 100 : 0;
  const worldValue = worldAssetsValue(sim.world);
  const worldPnl = holdingsPnl(sim.world);
  const topRoute = bestRoutes(sim.world, 1)[0];

  const movers = useMemo(() => {
    const list = sim.order
      .map((id) => sim.instruments[id])
      .filter((i) => !!i && i.price >= 0.01)
      .map((inst) => {
        const c = inst.candles;
        const prev = c.length > 24 ? c[c.length - 25].c : c[0]?.c ?? inst.price;
        const ch = prev > 0 ? ((inst.price - prev) / prev) * 100 : 0;
        return { inst, ch };
      });
    return {
      gainers: [...list].sort((a, b) => b.ch - a.ch).slice(0, 4),
      losers: [...list].sort((a, b) => a.ch - b.ch).slice(0, 4)
    };
  }, [sim, v]);

  const positions = Object.values(sim.positions).flatMap((p) => {
    const inst = sim.instruments[p.instId];
    if (!inst) return [];
    const pnl = positionPnl(p, inst.price);
    return [{ p, inst, pnl, roe: p.margin > 0 ? (pnl / p.margin) * 100 : 0 }];
  });

  const board = useMemo(() => {
    const rows = [
      ...sim.bots.map((b) => ({
        key: b.id,
        name: b.name,
        emoji: b.emoji,
        eq: b.equity,
        pnl: b.pnlPct,
        me: false
      })),
      { key: 'me', name: 'Kamu', emoji: '🧑‍💻', eq, pnl: ret, me: true }
    ].sort((a, b) => b.eq - a.eq);
    return { rows, rank: rows.findIndex((r) => r.me) + 1 };
  }, [sim.bots, eq, ret]);

  const ch = sim.challenge;
  const chPct = ch && ch.startEquity > 0 ? (eq / ch.startEquity - 1) * 100 : 0;
  const chProg = ch ? Math.min(1, Math.max(0, chPct / (ch.targetPct * 100))) : 0;
  const chLeft = ch ? Math.max(0, Math.ceil((ch.deadlineTick - sim.ticks) / 24)) : 0;

  const openMarket = (id: string) => {
    select(id);
    setTab('market');
  };

  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hero-row">
          <div>
            <div className="home-eyebrow">Net worth · akun simulasi</div>
            <div className="home-networth">{fmtUsd(eq)}</div>
            <div className={`home-return ${ret >= 0 ? 'up' : 'down'}`}>
              {fmtPct(ret)} <span className="muted">sejak awal</span>
            </div>
          </div>
          <div className="home-hero-actions">
            <button className="primary" onClick={() => setTab('market')}>
              📊 Market
            </button>
            <button className="ghost" onClick={() => setTab('portfolio')}>
              💼 Portfolio
            </button>
          </div>
        </div>
        <div className="home-stats">
          <div className="home-stat">
            <span>Cash</span>
            <b>{fmtUsd(sim.cash, true)}</b>
          </div>
          <div className="home-stat">
            <span>Margin</span>
            <b>{fmtUsd(sim.locked, true)}</b>
          </div>
          <div className="home-stat">
            <span>Unrealized</span>
            <b className={upnl >= 0 ? 'up' : 'down'}>{fmtUsd(upnl, true)}</b>
          </div>
          <div className="home-stat">
            <span>Spot</span>
            <b>{fmtUsd(spotVal, true)}</b>
          </div>
          <div className="home-stat">
            <span>Komoditas</span>
            <b>{fmtUsd(worldValue, true)}</b>
          </div>
          <div className="home-stat">
            <span>Realized</span>
            <b className={sim.realized >= 0 ? 'up' : 'down'}>{fmtUsd(sim.realized, true)}</b>
          </div>
        </div>
      </section>

      <section className="home-world">
        <div className="home-world-copy">
          <span className="home-eyebrow">
            Dunia · Level {sim.world.level}{' '}
            <span className={`tier-badge tier-${tier.tier.id}`} title={tier.tier.tagline}>
              {tier.tier.name}
            </span>
          </span>
          <b>{fmtUsd(worldValue)}</b>
          <span className={`tiny ${worldPnl >= 0 ? 'up' : 'down'}`}>{fmtUsd(worldPnl)} komoditas</span>
        </div>
        <div className="home-world-route">
          <span className="tiny muted">Rute terbaik</span>
          {topRoute ? (
            <b>
              {topRoute.from} → {topRoute.to}{' '}
              <span className="up">{fmtPct(topRoute.spreadPct, 1)}</span>
            </b>
          ) : (
            <b className="muted">Belum ada rute</b>
          )}
        </div>
        <div className="home-world-meta">
          <span>{sim.world.factories.length} pabrik</span>
          <span>{sim.world.shipments.filter((s) => s.status === 'in_transit').length} kiriman</span>
          <span>{tier.next ? `next ${tier.next.name}` : 'tier max'}</span>
        </div>
        <button className="ghost" onClick={() => setTab('world')}>
          🌍 Buka Dunia
        </button>
      </section>

      <div className="home-grid">
        <div className="panel">
          <div className="panel-head">
            <span>Tantangan Harian</span>
            <span className={`badge ${ch ? (ch.done ? (ch.won ? 'accent' : 'danger') : 'warn') : ''}`}>
              {ch ? (ch.done ? (ch.won ? 'LOLOS' : 'GAGAL') : 'BERJALAN') : 'OFF'}
            </span>
          </div>
          <div className="panel-body">
            {ch ? (
              <>
                <div className="row between tiny">
                  <span className="muted">Target +{(ch.targetPct * 100).toFixed(0)}%</span>
                  <span className={`mono ${chPct >= 0 ? 'up' : 'down'}`}>{fmtPct(chPct)}</span>
                </div>
                <div className="curve" style={{ marginTop: 6 }}>
                  <i style={{ width: `${chProg * 100}%` }} />
                </div>
                <div className="row between tiny muted" style={{ marginTop: 5 }}>
                  <span>{ch.done ? `hasil ${fmtPct(ch.finalPct ?? chPct)}` : `sisa ${chLeft} hari`}</span>
                  <span>streak {ch.streak}</span>
                </div>
                <button className="ghost tiny" style={{ width: '100%', marginTop: 10 }} onClick={() => setTab('settings')}>
                  Atur tantangan
                </button>
              </>
            ) : (
              <>
                <p className="tiny muted" style={{ margin: 0 }}>
                  Modal {fmtUsd(settings.startingCash, true)}, target +10% dalam 7 hari simulasi. Seed sama untuk
                  semua percobaan hari ini.
                </p>
                <button className="primary" style={{ width: '100%', marginTop: 10 }} onClick={() => setTab('settings')}>
                  Mulai tantangan
                </button>
              </>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span>Pasar Hari Ini</span>
            <button className="ghost tiny" onClick={() => setTab('market')}>
              Semua
            </button>
          </div>
          <div className="panel-body home-movers">
            <div>
              <div className="home-movers-title up">▲ Naik</div>
              {movers.gainers.map(({ inst, ch: c }) => (
                <button key={inst.id} className="home-mover" onClick={() => openMarket(inst.id)}>
                  <span className="sym">{inst.id}</span>
                  <span className="px">{fmtPrice(inst.price)}</span>
                  <span className="up">{fmtPct(c)}</span>
                </button>
              ))}
            </div>
            <div>
              <div className="home-movers-title down">▼ Turun</div>
              {movers.losers.map(({ inst, ch: c }) => (
                <button key={inst.id} className="home-mover" onClick={() => openMarket(inst.id)}>
                  <span className="sym">{inst.id}</span>
                  <span className="px">{fmtPrice(inst.price)}</span>
                  <span className="down">{fmtPct(c)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span>Posisi Futures ({positions.length})</span>
            <button className="ghost tiny" onClick={() => setTab('portfolio')}>
              Detail
            </button>
          </div>
          <div className="panel-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {positions.length === 0 ? (
              <div className="home-empty">
                Belum ada posisi. <button className="ghost tiny" onClick={() => setTab('market')}>Buka market</button>
              </div>
            ) : (
              positions.slice(0, 5).map(({ p, inst, pnl, roe }) => (
                <button key={p.id} className="home-pos" onClick={() => openMarket(inst.id)}>
                  <span>
                    <b>{inst.id}</b>{' '}
                    <span className={p.side === 'long' ? 'up' : 'down'}>
                      {p.side.toUpperCase()} {p.lev}x
                    </span>
                  </span>
                  <span className={pnl >= 0 ? 'up' : 'down'}>
                    {fmtUsd(pnl)} <span className="tiny muted">({fmtPct(roe)})</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span>Papan Peringkat</span>
            <span className="badge">
              #{board.rank} / {board.rows.length}
            </span>
          </div>
          <div className="panel-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {board.rows.slice(0, 3).map((r, i) => (
              <div key={r.key} className={`home-rank-row ${r.me ? 'me' : ''}`}>
                <span className="home-rank-no">{MEDALS[i]}</span>
                <span className="home-rank-who">
                  {r.emoji} {r.name}
                </span>
                <span className="mono">{fmtUsd(r.eq, true)}</span>
              </div>
            ))}
            {board.rank > 3 && (
              <div className="home-rank-row me">
                <span className="home-rank-no">#{board.rank}</span>
                <span className="home-rank-who">🧑‍💻 Kamu</span>
                <span className="mono">{fmtUsd(eq, true)}</span>
              </div>
            )}
            <button className="ghost tiny" style={{ width: '100%', marginTop: 8 }} onClick={() => setTab('rank')}>
              Lihat klasemen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
