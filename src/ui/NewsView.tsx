import { useState } from 'react';
import { useStore } from '../store';
import { fmtShortDate, fmtTime } from '../lib/format';

const FILTERS = ['Semua', 'Macro', 'Kripto', 'Memecoin', 'Saham', 'Forex', 'Launchpad', 'Sektor'];

function match(tag: string, filter: string): boolean {
  if (filter === 'Semua') return true;
  const t = tag.toLowerCase();
  if (filter === 'Macro') return t.includes('macro') || t.includes('regime') || t.includes('suku') || t.includes('inflasi');
  if (filter === 'Kripto') return t.includes('kripto') || t.includes('whale') || t.includes('hack') || t.includes('etf') || t.includes('bursa');
  if (filter === 'Memecoin') return t.includes('meme') || t.includes('hype') || t.includes('dev') || t.includes('scam') || t.includes('honeypot');
  if (filter === 'Saham') return t.includes('saham') || t.includes('laporan');
  if (filter === 'Forex') return t.includes('forex');
  if (filter === 'Launchpad') return t.includes('launchpad') || t.includes('rug') || t.includes('listing');
  if (filter === 'Sektor') return t.includes('sektor');
  return false;
}

const SEV_CLASS: Record<string, string> = {
  low: 'badge',
  med: 'badge warn',
  high: 'badge danger',
  extreme: 'badge danger'
};

export function NewsView() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  const [filter, setFilter] = useState('Semua');
  void v;

  const events = sim.events.filter((e) => e.tags.some((t) => match(t, filter)));

  return (
    <div>
      <div className="chips">
        {FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {events.length === 0 && <div className="empty">Belum ada berita</div>}

      {events.map((e) => (
        <div key={e.id} className="news">
          <div className="news-head">
            <span className={SEV_CLASS[e.severity] ?? 'badge'}>
              {e.severity === 'extreme' ? 'KRITIS' : e.severity.toUpperCase()}
            </span>
            {e.tags.slice(0, 2).map((t) => (
              <span key={t} className="tiny muted">
                #{t}
              </span>
            ))}
            <div style={{ flex: 1 }} />
            <span className="news-time">
              {fmtShortDate(e.t)} {fmtTime(e.t)}
            </span>
          </div>
          <div className="news-title">{e.title}</div>
          <div className="news-body">{e.body}</div>
        </div>
      ))}
    </div>
  );
}
