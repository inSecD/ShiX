import { useMemo } from 'react';
import { useStore } from '../store';
import { CLASS_LABEL } from '../sim/universe';
import { isSpotable } from '../sim/trading';
import { fmtPct, fmtPrice } from '../lib/format';
import type { AssetClass } from '../sim/types';

const FILTERS: (AssetClass | 'all' | 'watch')[] = ['all', 'watch', 'crypto', 'meme', 'shitcoin', 'stock', 'forex', 'commodity', 'index'];

function changeOf(candles: { c: number; t: number }[], back: number): number {
  if (candles.length < 2) return 0;
  const idx = Math.max(0, candles.length - 1 - back);
  const a = candles[idx]?.c ?? 0;
  const b = candles[candles.length - 1]?.c ?? 0;
  if (!a) return 0;
  return ((b - a) / a) * 100;
}

export function MarketView() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const watchlist = useStore((s) => s.watchlist);
  void v;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = sim.order
      .map((id) => sim.instruments[id])
      .filter((i) => !!i)
      .filter((i) => {
        if (filter === 'watch') return watchlist.includes(i.id);
        if (filter !== 'all' && i.cls !== filter) return false;
        return true;
      })
      .filter((i) => {
        if (!q) return true;
        return (
          i.id.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          i.sector.toLowerCase().includes(q) ||
          i.tag.toLowerCase().includes(q)
        );
      });
    list.sort((a, b) => b.mcap - a.mcap);
    return list.slice(0, 260);
  }, [sim, search, filter, watchlist]);

  const label = (f: (typeof FILTERS)[number]) =>
    f === 'all' ? 'Semua' : f === 'watch' ? '★ Watch' : CLASS_LABEL[f];

  return (
    <div>
      <div className="search-row">
        <input
          value={search}
          placeholder="Cari ticker / nama / sektor..."
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="chips">
        {FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {label(f)}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 12px 6px', display: 'flex', justifyContent: 'space-between' }}>
        <span className="tiny muted">{rows.length} instrumen</span>
        <span className="tiny muted">perubahan 24J</span>
      </div>

      {rows.map((i) => {
        const ch = changeOf(i.candles, 24);
        const w = watchlist.includes(i.id);
        return (
          <div
            key={i.id}
            className={`mrow ${selectedId === i.id ? 'sel' : ''}`}
            onClick={() => select(i.id)}
          >
            <div style={{ minWidth: 0 }}>
              <div className="sym">
                {i.id} {w ? <span style={{ color: 'var(--warn)' }}>★</span> : null}
              </div>
              <div className="nm">
                {i.name}
                {isSpotable(i) ? <span className="muted"> · spot</span> : null}
              </div>
            </div>
            <div className="px">{fmtPrice(i.price)}</div>
            <div className={`ch ${ch >= 0 ? 'up' : 'down'}`}>{fmtPct(ch)}</div>
          </div>
        );
      })}

      {rows.length === 0 && <div className="empty">Tidak ada instrumen yang cocok</div>}
    </div>
  );
}
