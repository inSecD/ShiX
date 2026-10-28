import { useStore, type Tab } from '../store';

const ITEMS: { tab: Tab; icon: string; title: string; desc: string }[] = [
  { tab: 'world', icon: '🌍', title: 'Dunia', desc: 'Komoditas, rute kirim, pabrik, dan pasar gelap' },
  { tab: 'news', icon: '📰', title: 'Berita', desc: 'Headline makro, whale, dan event pasar' },
  { tab: 'launchpad', icon: '🚀', title: 'Launchpad', desc: 'Luncurkan token, bonding curve, cek rug risk' },
  { tab: 'modes', icon: '🎯', title: 'Skenario & Misi', desc: 'Misi latihan berhadiah + skenario pasar' },
  { tab: 'settings', icon: '⚙️', title: 'Setelan & Tantangan', desc: 'Seed dunia, modal, save/load, daily challenge' },
  { tab: 'trade', icon: '⚡', title: 'Trade Klasik', desc: 'Chart penuh + order ticket dalam satu layar' }
];

export function MoreView() {
  const setTab = useStore((s) => s.setTab);
  const startTut = useStore((s) => s.startTut);
  const tutDone = useStore((s) => s.tutDone);

  return (
    <div className="more">
      <div className="panel">
        <div className="panel-head">
          <span>Menu</span>
          <span className="badge">SHIX</span>
        </div>
        <div className="menu-list">
          {ITEMS.map((it) => (
            <button key={it.tab} className="menu-row" onClick={() => setTab(it.tab)}>
              <span className="menu-ico">{it.icon}</span>
              <span className="menu-copy">
                <b>{it.title}</b>
                <span>{it.desc}</span>
              </span>
              <span className="menu-arrow">›</span>
            </button>
          ))}
          <button className="menu-row" onClick={() => startTut(0)}>
            <span className="menu-ico">🎓</span>
            <span className="menu-copy">
              <b>Tutorial step-by-step</b>
              <span> Tour berhighlight di tiap elemen penting</span>
            </span>
            <span className="menu-arrow">{tutDone ? '↻' : '▶'}</span>
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Tips Cepat</span>
        </div>
        <div className="panel-body menu-tips">
          <div>• 1 tick = 1 jam pasar. Saham/index hanya bergerak di jam bursa; crypto 24/7.</div>
          <div>• Di Market, tap instrumen → chart dan trade card langsung terbuka.</div>
          <div>• Di Dunia, beli murah di satu negara lalu kirim untuk jual mahal di negara lain.</div>
          <div>• Pasang TP/SL/trailing dari trade card; TP + SL otomatis OCO.</div>
          <div>• Tantangan harian pakai seed tetap; target +10% dalam 7 hari.</div>
          <div className="tiny muted" style={{ marginTop: 6 }}>
            ShiX Terminal · data tersimpan lokal di perangkat ini.
          </div>
        </div>
      </div>
    </div>
  );
}
