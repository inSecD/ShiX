import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { fmtPct, fmtPrice, fmtQty, fmtUsd } from '../lib/format';
import {
  BLACK_MARKET_LEVEL,
  COMMODITIES,
  COMMODITY_BY_ID,
  COUNTRIES,
  COUNTRY_BY_ID,
  FACTORY_MAX_LEVEL,
  bestRoutes,
  blackOffers,
  countryEfficiency,
  coverage,
  getHolding,
  getMarket,
  holdingQty,
  holdingsPnl,
  worldAssetsValue,
  levelProgress,
  marketChange,
  nextLevelXp,
  shipQuote
} from '../sim/world';
import type { CountryDef, RouteEstimate } from '../sim/world';

type Section = 'pasar' | 'rute' | 'industri' | 'hitam';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'pasar', label: 'Pasar', icon: '🌐' },
  { id: 'rute', label: 'Logistik', icon: '🚢' },
  { id: 'industri', label: 'Industri', icon: '🏭' },
  { id: 'hitam', label: 'Pasar Gelap', icon: '🕶️' }
];

const MAP_W = 900;
const MAP_H = 250;

function project(c: CountryDef): { x: number; y: number } {
  return { x: ((c.lon + 180) / 360) * MAP_W, y: ((90 - c.lat) / 180) * MAP_H };
}

function PriceSpark({ data, up }: { data: number[]; up: boolean }) {
  const d = useMemo(() => {
    if (data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    return data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 34 - ((v - min) / range) * 30;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }, [data]);
  if (!d) return <div className="empty tiny">Belum ada history</div>;
  return (
    <svg className="spark world-spark" viewBox="0 0 100 36" preserveAspectRatio="none">
      <path
        d={d}
        fill="none"
        stroke={up ? 'var(--up)' : 'var(--down)'}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function WorldMap({
  countryId,
  home,
  onSelect,
  flows
}: {
  countryId: string;
  home: string;
  onSelect: (id: string) => void;
  flows: { from: string; to: string; kind: string; id: string }[];
}) {
  const nodes = COUNTRIES.map((c) => ({ c, p: project(c) }));
  return (
    <svg className="world-map" viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label="Peta perdagangan dunia">
      <defs>
        <radialGradient id="worldGlow" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#4d8dff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#07090f" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={MAP_W} height={MAP_H} fill="url(#worldGlow)" />
      {[1, 2, 3, 4, 5].map((i) => (
        <line
          key={`h${i}`}
          x1={0}
          x2={MAP_W}
          y1={(MAP_H / 6) * i}
          y2={(MAP_H / 6) * i}
          className="world-grid"
        />
      ))}
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <line
          key={`v${i}`}
          x1={(MAP_W / 8) * i}
          x2={(MAP_W / 8) * i}
          y1={0}
          y2={MAP_H}
          className="world-grid"
        />
      ))}
      <g className="world-land" transform="scale(1.40625 0.892857)">

        <path d="M92 76 L146 52 L204 62 L214 92 L184 116 L162 142 L130 126 L108 96 Z" />
        <path d="M180 148 L218 152 L228 184 L205 226 L184 214 L174 180 Z" />
        <path d="M300 66 L346 58 L358 86 L332 102 L306 90 Z" />
        <path d="M306 106 L366 106 L382 150 L352 202 L320 176 L300 140 Z" />
        <path d="M356 54 L520 50 L548 94 L500 126 L430 120 L380 100 Z" />
        <path d="M420 126 L446 132 L436 162 L414 152 Z" />
        <path d="M470 136 L530 142 L534 170 L495 176 L470 160 Z" />
        <path d="M520 196 L576 190 L590 220 L550 236 L514 220 Z" />
      </g>
      <g>
        {flows.map((f) => {
          const a = COUNTRY_BY_ID[f.from];
          const b = COUNTRY_BY_ID[f.to];
          if (!a || !b) return null;
          const p1 = project(a);
          const p2 = project(b);
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2 - 20;
          return (
            <path
              key={f.id}
              d={`M${p1.x.toFixed(1)},${p1.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`}
              className={`world-flow ${f.kind}`}
            />
          );
        })}
      </g>
      {nodes.map(({ c, p }) => {
        const on = c.id === countryId;
        const isHome = c.id === home;
        return (
          <g
            key={c.id}
            className={`world-node ${on ? 'on' : ''}`}
            onClick={() => onSelect(c.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect(c.id);
            }}
          >
            <title>{c.name}</title>
            {isHome && <circle cx={p.x} cy={p.y} r={9} className="world-home-ring" />}
            <circle cx={p.x} cy={p.y} r={on ? 5.4 : 3.6} className="world-dot" />
            <text x={p.x + 7} y={p.y + 3.5} className="world-label">
              {c.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function WorldView() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  const worldCountry = useStore((s) => s.worldCountry);
  const setWorldCountry = useStore((s) => s.setWorldCountry);
  const worldBuy = useStore((s) => s.worldBuy);
  const worldSell = useStore((s) => s.worldSell);
  const worldShip = useStore((s) => s.worldShip);
  const worldBuild = useStore((s) => s.worldBuild);
  const worldBlack = useStore((s) => s.worldBlack);
  void v;

  const world = sim.world;
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('w');
  const [section, setSection] = useState<Section>(
    requested && SECTIONS.some((s) => s.id === requested) ? (requested as Section) : 'pasar'
  );
  const [commodity, setCommodity] = useState('food');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [qty, setQty] = useState('100');
  const [shipFrom, setShipFrom] = useState('ID');
  const [shipTo, setShipTo] = useState('SG');
  const [shipQty, setShipQty] = useState('100');
  const [blackQty, setBlackQty] = useState('50');

  const country = COUNTRY_BY_ID[worldCountry] ?? COUNTRIES[0];
  const home = COUNTRY_BY_ID[world.home] ?? COUNTRIES[0];
  const selectedMarket = getMarket(world, worldCountry, commodity);
  const selectedDef = COMMODITY_BY_ID[commodity];
  const selectedHolding = getHolding(world, worldCountry, commodity);
  const price = selectedMarket?.price ?? 0;
  const change = marketChange(world, worldCountry, commodity);
  const held = selectedHolding?.qty ?? 0;
  const qtyNum = Math.max(0, Number(qty) || 0);
  const gross = price * qtyNum;
  const fee = gross * 0.01;
  const total = side === 'buy' ? gross + fee : gross - fee;
  const maxBuy = price > 0 ? Math.floor(sim.cash / (price * 1.01)) : 0;
  const maxSell = Math.floor(held);
  const maxQty = side === 'buy' ? maxBuy : maxSell;
  const commodityValue = worldAssetsValue(world);
  const commodityPnl = holdingsPnl(world);
  const levelPct = levelProgress(world);
  const routes = useMemo(() => bestRoutes(world, 8), [world, v]);
  const offers = useMemo(() => blackOffers(world, worldCountry), [world, worldCountry, v]);
  const flows = world.flows.slice(0, 14);
  const shipQuoteNow = shipQuote(shipFrom, shipTo, commodity, Math.max(0, Number(shipQty) || 0));
  const heldAtFrom = holdingQty(world, shipFrom, commodity);
  const blackNum = Math.max(0, Number(blackQty) || 0);

  const pickRoute = (r: RouteEstimate) => {
    setCommodity(r.commodity);
    setShipFrom(r.from);
    setShipTo(r.to);
    setShipQty('100');
    setSection('rute');
  };

  const selectCountry = (id: string) => {
    setWorldCountry(id);
  };

  return (
    <div className="world">
      <section className="world-hero">
        <div className="world-hero-top">
          <div>
            <div className="home-eyebrow">Perdagangan dunia · {home.name}</div>
            <div className="world-title">Dunia</div>
            <div className="tiny muted">
              Level {world.level} · {fmtQty(world.xp)} XP · {world.factories.length} pabrik
            </div>
          </div>
          <div className="world-hero-stats">
            <div>
              <span>Komoditas</span>
              <b>{fmtUsd(commodityValue)}</b>
            </div>
            <div>
              <span>P/L komoditas</span>
              <b className={commodityPnl >= 0 ? 'up' : 'down'}>{fmtUsd(commodityPnl)}</b>
            </div>
            <div>
              <span>Pengiriman</span>
              <b>{world.shipments.filter((s) => s.status === 'in_transit').length} aktif</b>
            </div>
          </div>
        </div>
        <div className="curve world-xp" style={{ marginTop: 10 }}>
          <i style={{ width: `${levelPct * 100}%` }} />
        </div>
        <div className="row between tiny muted" style={{ marginTop: 4 }}>
          <span>{world.level >= 10 ? 'Level maksimum' : `${fmtQty(world.xp)} / ${fmtQty(nextLevelXp(world.level + 1))} XP`}</span>
          <span>HQ: {home.name}</span>
        </div>
      </section>

      <div className="panel world-map-card">
        <WorldMap countryId={worldCountry} home={world.home} onSelect={selectCountry} flows={flows} />
        <div className="world-map-legend">
          <span><i className="dot ai" /> AI</span>
          <span><i className="dot player" /> Kamu</span>
          <span><i className="dot black" /> Hitam</span>
        </div>
        <div className="chips world-chips">
          {COUNTRIES.map((c) => (
            <button
              key={c.id}
              className={`chip ${c.id === worldCountry ? 'on' : ''}`}
              onClick={() => selectCountry(c.id)}
            >
              {c.id === home.id ? '★ ' : ''}
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="world-tabs">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`world-tab ${section === s.id ? 'on' : ''}`}
            onClick={() => setSection(s.id)}
          >
            <span>{s.icon}</span> {s.label}
          </button>
        ))}
      </div>

      {section === 'pasar' && (
        <>
          <div className="world-market-grid">
            <div className="panel world-market-panel">
              <div className="panel-head">
                <span>Harga di {country.name}</span>
                <span className="badge">{country.region}</span>
              </div>
              <div className="panel-body world-country-facts">
                <span>Market size <b>{country.marketSize}/5</b></span>
                <span>Logistik <b>{country.logistics}/5</b></span>
                <span>Regulasi <b>{country.regulation}/5</b></span>
                <span>Efisiensi <b>{(countryEfficiency(country) * 100).toFixed(0)}%</b></span>
              </div>
              <div className="scroll-x">
                <table className="tbl world-tbl">
                  <thead>
                    <tr>
                      <th>Komoditas</th>
                      <th>Harga</th>
                      <th>24j</th>
                      <th>Coverage</th>
                      <th>Stok kamu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMMODITIES.map((cm) => {
                      const m = getMarket(world, worldCountry, cm.id);
                      if (!m) return null;
                      const h = getHolding(world, worldCountry, cm.id);
                      const ch = marketChange(world, worldCountry, cm.id);
                      return (
                        <tr
                          key={cm.id}
                          className={cm.id === commodity ? 'sel' : ''}
                          onClick={() => setCommodity(cm.id)}
                        >
                          <td className="lbl">
                            <div style={{ fontWeight: 700 }}>
                              {cm.icon} {cm.name}
                            </div>
                            <div className="tiny muted">{cm.cat}</div>
                          </td>
                          <td className="mono">{fmtPrice(m.price)}</td>
                          <td className={`mono ${ch >= 0 ? 'up' : 'down'}`}>{fmtPct(ch)}</td>
                          <td className="mono">{(coverage(m) || 0).toFixed(1)}x</td>
                          <td className="mono">{h ? fmtQty(h.qty) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="world-side">
              <div className="panel">
                <div className="panel-head">
                  <span>{selectedDef.icon} {selectedDef.name}</span>
                  <span className={`badge ${change >= 0 ? 'accent' : 'danger'}`}>{fmtPct(change)}</span>
                </div>
                <div className="panel-body">
                  <div className="row between">
                    <div>
                      <div className="tiny muted">Harga {country.name}</div>
                      <div className="mono" style={{ fontSize: 22, fontWeight: 800 }}>{fmtUsd(price)}</div>
                    </div>
                    <div className="right">
                      <div className="tiny muted">Coverage</div>
                      <div className="mono">{(selectedMarket ? coverage(selectedMarket) : 0).toFixed(1)}x</div>
                    </div>
                  </div>
                  <PriceSpark data={selectedMarket?.history ?? []} up={change >= 0} />
                  <div className="world-side-stats">
                    <span>Supply <b>{fmtQty(selectedMarket?.supply ?? 0)}</b></span>
                    <span>Demand <b>{fmtQty(selectedMarket?.demand ?? 0)}</b></span>
                  </div>
                  <div className="seg world-side-seg">
                    <button className={side === 'buy' ? 'on' : ''} onClick={() => setSide('buy')}>Beli</button>
                    <button className={side === 'sell' ? 'on' : ''} onClick={() => setSide('sell')}>Jual</button>
                  </div>
                  <div className="field">
                    <label>Jumlah</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      placeholder="0"
                    />
                    <div className="quick-row">
                      {[0.25, 0.5, 0.75, 1].map((p) => (
                        <button key={p} onClick={() => setQty(String(Math.floor(maxQty * p)))}>
                          {p === 1 ? 'MAX' : `${p * 100}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="world-ticket-hint">
                    <span>{side === 'buy' ? 'Cash tersedia' : 'Stok di sini'}</span>
                    <b>{side === 'buy' ? fmtUsd(sim.cash) : `${fmtQty(held)} unit`}</b>
                  </div>
                  <div className="world-ticket-hint">
                    <span>Estimasi total</span>
                    <b>{side === 'buy' ? fmtUsd(total) : fmtUsd(total)}</b>
                  </div>
                  <div className="tiny muted" style={{ margin: '4px 0 8px' }}>
                    Fee 1% · harga lokal, tanpa leverage
                  </div>
                  <button
                    className={`${side === 'buy' ? 'long' : 'short'} world-submit`}
                    onClick={() =>
                      side === 'buy'
                        ? worldBuy(worldCountry, commodity, qtyNum)
                        : worldSell(worldCountry, commodity, qtyNum)
                    }
                    disabled={qtyNum <= 0 || (side === 'buy' ? qtyNum > maxBuy : qtyNum > maxSell)}
                  >
                    {side === 'buy' ? 'Beli di ' : 'Jual di '}
                    {country.name}
                  </button>
                  {selectedHolding && (
                    <div className="tiny muted" style={{ marginTop: 8 }}>
                      Avg cost {fmtUsd(selectedHolding.avgCost)} · P/L{' '}
                      <span className={price >= selectedHolding.avgCost ? 'up' : 'down'}>
                        {fmtUsd((price - selectedHolding.avgCost) * held)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="panel">
                <div className="panel-head">
                  <span>Kabar Dunia</span>
                  <span className="badge">{world.events.length}</span>
                </div>
                <div className="panel-body world-news">
                  {world.events.slice(0, 4).map((ev) => (
                    <div key={ev.id} className="world-news-row">
                      <span className={`dot ${ev.severity === 'high' ? 'black' : 'ai'}`} />
                      <div>
                        <b>{ev.title}</b>
                        <span>{ev.body}</span>
                      </div>
                    </div>
                  ))}
                  {!world.events.length && <div className="tiny muted">Belum ada kabar dunia.</div>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {section === 'rute' && (
        <>
          <div className="panel">
            <div className="panel-head">
              <span>Peluang Arbitrase</span>
              <span className="badge">spread kotor</span>
            </div>
            <div className="scroll-x">
              <table className="tbl world-tbl">
                <thead>
                  <tr>
                    <th>Komoditas</th>
                    <th>Rute</th>
                    <th>Beli</th>
                    <th>Jual</th>
                    <th>Spread</th>
                    <th>Ongkos</th>
                    <th>ETA</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {routes.map((r) => {
                    const cm = COMMODITY_BY_ID[r.commodity];
                    return (
                      <tr key={r.commodity}>
                        <td className="lbl">
                          <div style={{ fontWeight: 700 }}>{cm.icon} {cm.name}</div>
                          <div className="tiny muted">100 unit</div>
                        </td>
                        <td className="mono">{r.from} → {r.to}</td>
                        <td className="mono">{fmtPrice(r.buyPrice)}</td>
                        <td className="mono">{fmtPrice(r.sellPrice)}</td>
                        <td className="mono up">{fmtPct(r.spreadPct)}</td>
                        <td className="mono">{fmtUsd(r.cost)}</td>
                        <td className="mono">{r.ticks}t</td>
                        <td>
                          <button className="ghost tiny" onClick={() => pickRoute(r)}>Kirim</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="world-two">
            <div className="panel">
              <div className="panel-head">
                <span>Kirim Barang</span>
                <span className="badge">stok {fmtQty(heldAtFrom)}</span>
              </div>
              <div className="panel-body">
                <div className="field">
                  <label>Komoditas</label>
                  <select value={commodity} onChange={(e) => setCommodity(e.target.value)}>
                    {COMMODITIES.map((cm) => (
                      <option key={cm.id} value={cm.id}>{cm.icon} {cm.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid2">
                  <div className="field">
                    <label>Dari</label>
                    <select value={shipFrom} onChange={(e) => setShipFrom(e.target.value)}>
                      {COUNTRIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Tujuan</label>
                    <select value={shipTo} onChange={(e) => setShipTo(e.target.value)}>
                      {COUNTRIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Jumlah</label>
                  <input type="number" min={0} value={shipQty} onChange={(e) => setShipQty(e.target.value)} />
                </div>
                <div className="world-ticket-hint">
                  <span>Ongkos / ETA</span>
                  <b>{fmtUsd(shipQuoteNow.cost)} · {shipQuoteNow.ticks} tick</b>
                </div>
                <div className="tiny muted" style={{ margin: '4px 0 8px' }}>
                  Stok di {COUNTRY_BY_ID[shipFrom]?.name ?? shipFrom}: {fmtQty(heldAtFrom)} unit
                </div>
                <button
                  className="primary"
                  style={{ width: '100%' }}
                  disabled={shipFrom === shipTo || (Number(shipQty) || 0) <= 0 || (Number(shipQty) || 0) > heldAtFrom}
                  onClick={() => worldShip(shipFrom, shipTo, commodity, Number(shipQty) || 0)}
                >
                  🚢 Kirim ke {COUNTRY_BY_ID[shipTo]?.name ?? shipTo}
                </button>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <span>Pengiriman</span>
                <span className="badge">{world.shipments.filter((s) => s.status === 'in_transit').length} aktif</span>
              </div>
              <div className="panel-body world-ships">
                {world.shipments.length === 0 && <div className="tiny muted">Belum ada pengiriman.</div>}
                {world.shipments.slice(0, 10).map((s) => (
                  <div key={s.id} className="world-ship-row">
                    <div>
                      <b>{COMMODITY_BY_ID[s.commodity]?.name ?? s.commodity}</b>
                      <span className="tiny muted"> {s.from} → {s.to}</span>
                    </div>
                    <div className="right">
                      <b>{fmtQty(s.qty)}</b>
                      <span className={`tiny ${s.status === 'arrived' ? 'up' : 'muted'}`}>
                        {s.status === 'arrived' ? 'tiba' : `${Math.max(0, s.arriveTick - sim.ticks)} tick`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span>Aliran Perdagangan</span>
              <span className="badge">AI + player</span>
            </div>
            <div className="panel-body world-flows">
              {flows.slice(0, 10).map((f) => (
                <div key={f.id} className="world-flow-row">
                  <span className={`dot ${f.kind === 'player' ? 'player' : f.kind === 'black' ? 'black' : 'ai'}`} />
                  <span className="mono">{f.from} → {f.to}</span>
                  <span className="tiny muted">{COMMODITY_BY_ID[f.commodity]?.name ?? f.commodity}</span>
                  <span className="mono">{fmtQty(f.qty)}</span>
                  <span className="tiny muted">{fmtUsd(f.value, true)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {section === 'industri' && (
        <>
          <div className="panel">
            <div className="panel-head">
              <span>Pabrik · {home.name}</span>
              <span className="badge">{world.factories.length} / {COMMODITIES.length}</span>
            </div>
            <div className="panel-body tiny muted">
              Pabrik hanya bisa dibangun di markas. Produksi masuk otomatis ke stok {home.name} setiap tick.
            </div>
          </div>
          <div className="world-factories">
            {COMMODITIES.map((cm) => {
              const f = world.factories.find((x) => x.commodity === cm.id);
              const next = (f?.level ?? 0) + 1;
              const cost = cm.base * 70 * next;
              const m = getMarket(world, world.home, cm.id);
              const output = 1.5 * (f?.level ?? 0) * countryEfficiency(home);
              const value = output * (m?.price ?? 0);
              const maxed = next > FACTORY_MAX_LEVEL;
              return (
                <div key={cm.id} className="panel world-factory">
                  <div className="panel-head">
                    <span>{cm.icon} {cm.name}</span>
                    <span className={`badge ${f ? 'accent' : ''}`}>{f ? `L${f.level}` : 'BELUM'}</span>
                  </div>
                  <div className="panel-body">
                    <div className="world-factory-stats">
                      <div><span>Output / jam</span><b>{fmtQty(output)}</b></div>
                      <div><span>Nilai / jam</span><b>{fmtUsd(value)}</b></div>
                      <div><span>Biaya</span><b>{maxed ? 'MAX' : fmtUsd(cost)}</b></div>
                    </div>
                    <button
                      className="primary"
                      style={{ width: '100%' }}
                      disabled={maxed}
                      onClick={() => worldBuild(cm.id)}
                    >
                      {maxed ? 'Level maksimum' : `${f ? 'Upgrade' : 'Bangun'} L${next} · ${fmtUsd(cost)}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {section === 'hitam' && (
        <>
          {world.level < BLACK_MARKET_LEVEL ? (
            <div className="panel world-black-locked">
              <div className="panel-head">
                <span>Pasar Gelap</span>
                <span className="badge danger">TERKUNCI</span>
              </div>
              <div className="panel-body">
                <div className="world-lock-icon">🕶️</div>
                <p className="tiny muted">
                  Butuh intel level {BLACK_MARKET_LEVEL}. Terus trading komoditas untuk naik level.
                </p>
                <div className="curve" style={{ marginTop: 8 }}>
                  <i style={{ width: `${levelPct * 100}%` }} />
                </div>
                <div className="row between tiny muted" style={{ marginTop: 5 }}>
                  <span>Level {world.level}</span>
                  <span>{fmtQty(world.xp)} XP</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="panel">
                <div className="panel-head">
                  <span>Tawaran {country.name}</span>
                  <span className="badge danger">RISIKO TINGGI</span>
                </div>
                <div className="panel-body">
                  <div className="field">
                    <label>Jumlah per transaksi</label>
                    <input type="number" min={0} value={blackQty} onChange={(e) => setBlackQty(e.target.value)} />
                  </div>
                  <div className="tiny muted">
                    Pasar gelap memberi harga diskon/premium di luar pasar resmi. Ada peluang barang disita aparat.
                  </div>
                </div>
              </div>
              <div className="world-offers">
                {offers.map((o) => {
                  const cm = COMMODITY_BY_ID[o.commodity];
                  return (
                    <div key={`${o.side}-${o.commodity}`} className="panel world-offer">
                      <div className="panel-head">
                        <span>{cm.icon} {cm.name}</span>
                        <span className={`badge ${o.side === 'buy' ? 'accent' : 'warn'}`}>
                          {o.side === 'buy' ? 'BELI' : 'JUAL'}
                        </span>
                      </div>
                      <div className="panel-body">
                        <div className="world-offer-price">
                          <span>{fmtUsd(o.price)}</span>
                          <span className="tiny muted">pasar {fmtUsd(o.marketPrice)}</span>
                        </div>
                        <div className="world-offer-meta">
                          <span className="up">Edge {fmtPct(o.edgePct, 1)}</span>
                          <span className="down">Risiko {o.risk.toFixed(0)}%</span>
                          <span className="muted">Stok {fmtQty(o.held)}</span>
                        </div>
                        <button
                          className={`${o.side === 'buy' ? 'long' : 'short'}`}
                          style={{ width: '100%' }}
                          onClick={() => worldBlack(worldCountry, o.commodity, o.side, blackNum)}
                        >
                          {o.side === 'buy' ? 'Beli gelap' : 'Jual gelap'} · {fmtQty(blackNum)} unit
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!offers.length && (
                  <div className="panel">
                    <div className="empty">Belum ada tawaran di negara ini. Tunggu kelangkaan atau cek negara lain.</div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
