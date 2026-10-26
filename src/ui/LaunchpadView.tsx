import { useMemo, useState } from 'react';
import { useStore, suggestName, tokenList } from '../store';
import { launchCost, tokenProgress } from '../sim/launchpad';
import { fmtPct, fmtPrice, fmtQty, fmtUsd } from '../lib/format';
import type { LaunchToken } from '../sim/types';

/** Small area chart of a bonding-curve token's price history. */
function CurveChart({ series }: { series: number[] }) {
  const path = useMemo(() => {
    if (series.length < 2) return { line: '', area: '' };
    let min = Infinity;
    let max = -Infinity;
    for (const v of series) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const span = max - min;
    const pad = span > 0 ? span * 0.08 : Math.abs(max) * 0.02 || 1;
    const lo = min - pad;
    const hi = max + pad;
    const rng = hi - lo || 1;
    const pts = series.map((v, i) => {
      const x = (i / (series.length - 1)) * 100;
      const y = 40 - ((v - lo) / rng) * 40;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    });
    const line = pts.join(' ');
    const area = `${line} L100,40 L0,40 Z`;
    return { line, area };
  }, [series]);

  if (!path.line) return <div className="curve-chart empty tiny">Belum ada data curve</div>;

  const up = series[series.length - 1] >= series[0];
  const stroke = up ? 'var(--up)' : 'var(--down)';
  const fill = up ? 'rgba(22,208,154,0.16)' : 'rgba(255,77,106,0.16)';
  const gid = `cc-${up ? 'u' : 'd'}`;

  return (
    <svg className="curve-chart" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
      <path d={path.area} fill={`url(#${gid})`} stroke="none" />
      <path
        d={path.line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TokenCard({ token }: { token: LaunchToken }) {
  const sim = useStore((s) => s.sim);
  const buyTok = useStore((s) => s.buyTok);
  const sellTok = useStore((s) => s.sellTok);
  const select = useStore((s) => s.select);
  const setTab = useStore((s) => s.setTab);
  const [amt, setAmt] = useState('100');

  const spot = token.graduated && token.instId ? sim.instruments[token.instId] : null;
  const spotHold = token.graduated && token.instId ? sim.spotHoldings[token.instId] : undefined;
  // after graduation the curve units move into spot holdings, so read from there
  const held = token.graduated ? (spotHold?.qty ?? 0) : (sim.tokenHoldings[token.id] ?? 0);
  const prog = token.graduated ? 1 : tokenProgress(token);
  const launchPct = token.price0 > 0 ? ((token.price / token.price0 - 1) * 100) : 0;
  const curPrice = spot ? spot.price : token.price;
  const curPct = token.price0 > 0 ? ((curPrice / token.price0 - 1) * 100) : 0;

  // curve history, continued by recent spot closes once listed
  const series = useMemo(() => {
    const curve = token.history?.length ? token.history : [token.price0];
    if (spot && spot.candles.length) {
      const closes = spot.candles.slice(-60).map((c) => c.c);
      return [...curve, ...closes];
    }
    return curve;
  }, [token, spot]);

  return (
    <div className="tok">
      <div className="row between">
        <div style={{ minWidth: 0 }}>
          <div className="tok-name">
            {token.name} <span style={{ color: 'var(--dim)' }}>{token.ticker}</span>
          </div>
          <div className="tiny muted">
            {token.kind === 'meme' ? 'Memecoin' : 'Shitcoin'} · {token.tags.join(', ')} ·{' '}
            {token.owner === 'player' ? 'DITEMPATKAN MU' : 'Rival'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{fmtPrice(curPrice)}</div>
          <div className={`mono ${curPct >= 0 ? 'up' : 'down'}`} style={{ fontSize: 11, fontWeight: 700 }}>
            {fmtPct(curPct)}
          </div>
        </div>
      </div>

      <CurveChart series={series} />

      <div className="curve">
        <i style={{ width: `${Math.min(100, prog * 100)}%` }} />
        <u style={{ left: `${Math.min(99, prog * 100)}%` }} />
      </div>

      <div className="row between tiny muted" style={{ marginBottom: 6 }}>
        <span>
          {token.graduated ? (
            <span className="badge accent">LISTED</span>
          ) : (
            <>Bonding curve {fmtPct(prog * 100, 0)}</>
          )}
        </span>
        <span>
          Hype{' '}
          <b style={{ color: token.hype > 1 ? 'var(--up)' : token.hype < 0.3 ? 'var(--down)' : 'var(--txt)' }}>
            {(token.hype * 100).toFixed(0)}
          </b>
        </span>
        <span>LP {fmtPct(token.lpLocked * 100, 0)}</span>
        <span>Dev {(100 - token.devSold * 100).toFixed(0)}%</span>
      </div>

      {token.honeypot && (
        <div className="badge danger" style={{ marginBottom: 6, display: 'inline-block' }}>
          HONEYPOT — JUAL DIBLOKIR
        </div>
      )}
      {token.rug && (
        <div className="badge danger" style={{ marginBottom: 6, display: 'inline-block' }}>
          RUG PULL — DEV KABUR
        </div>
      )}

      {held > 0 && (
        <div className="tiny muted" style={{ marginBottom: 6 }}>
          Holdings: {fmtQty(held)} {token.graduated ? token.ticker : 'token'} = {fmtUsd(held * curPrice)}
          {spotHold ? <> · avg {fmtPrice(spotHold.avgCost)}</> : null}
        </div>
      )}

      {!token.graduated && (
        <div className="row" style={{ gap: 6 }}>
          <input
            inputMode="decimal"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="long" onClick={() => buyTok(token.id, parseFloat(amt) || 0)}>
            Beli
          </button>
          <button className="short" disabled={held <= 0} onClick={() => sellTok(token.id, held)}>
            Jual
          </button>
        </div>
      )}

      {spot && (
        <button
          className="tiny"
          style={{ marginTop: 6 }}
          onClick={() => {
            select(spot.id);
            setTab('trade');
          }}
        >
          Trade di spot →
        </button>
      )}

      {token.graduated && launchPct !== 0 && (
        <div className="tiny muted" style={{ marginTop: 4 }}>
          sejak launch: {fmtPct(launchPct)}
        </div>
      )}
    </div>
  );
}

export function LaunchpadView() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  const launch = useStore((s) => s.launch);
  const settings = useStore((s) => s.settings);
  void v;

  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [kind, setKind] = useState<'meme' | 'shitcoin'>('meme');
  const [tag, setTag] = useState('Meme');

  const tokens = useMemo(() => tokenList(sim), [sim]);
  const cost = launchCost(settings);

  const doLaunch = () => {
    const n = name.trim() || suggestName(kind).name;
    const t = (ticker.trim() || suggestName(kind).ticker).toUpperCase().slice(0, 6);
    launch(n, t, kind, [tag]);
    setName('');
    setTicker('');
  };

  return (
    <div>
      <div className="panel" data-tut="launch-panel">
        <div className="panel-head">
          <span>Launch Token</span>
          <span className="badge warn">Biaya {fmtUsd(cost)}</span>
        </div>
        <div className="panel-body">
          <div className="seg" style={{ marginBottom: 10 }}>
            <button className={kind === 'meme' ? 'on' : ''} onClick={() => setKind('meme')}>
              Memecoin
            </button>
            <button className={kind === 'shitcoin' ? 'on' : ''} onClick={() => setKind('shitcoin')}>
              Shitcoin
            </button>
          </div>

          <div className="field">
            <label>Nama token</label>
            <input value={name} placeholder="cth: Dogicoin Deluxe" onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="field">
            <label>Ticker</label>
            <input value={ticker} placeholder="cth: DGDX" onChange={(e) => setTicker(e.target.value)} />
          </div>

          <div className="field">
            <label>Kategori naratif</label>
            <select value={tag} onChange={(e) => setTag(e.target.value)}>
              {['Meme', 'AI', 'RWA', 'Gaming', 'DeFi', 'DePIN', 'Privacy', 'ZK'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="hint" style={{ marginBottom: 10 }}>
            Token baru mulai dari bonding curve. Harga naik saat curve terkuras. Risiko: honeypot (12%), rug pull dev,
            dan dev yang bisa menjual sebelum kamu keluar.
          </div>

          <button className="primary" style={{ width: '100%' }} onClick={doLaunch}>
            Luncurkan Token
          </button>
          <button
            className="ghost tiny"
            style={{ width: '100%', marginTop: 6 }}
            onClick={() => {
              const s = suggestName(kind);
              setName(s.name);
              setTicker(s.ticker);
            }}
          >
            Generate nama acak
          </button>
        </div>
      </div>

      <div className="panel" style={{ margin: '0 10px 10px' }}>
        <div className="panel-head">
          <span>Token Live ({tokens.length})</span>
          <span className="badge">{tokens.filter((t) => t.graduated).length} listing</span>
        </div>
        {tokens.length === 0 ? (
          <div className="empty">Belum ada token yang luncur</div>
        ) : (
          tokens.map((t) => <TokenCard key={t.id} token={t} />)
        )}
      </div>
    </div>
  );
}
