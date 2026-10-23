import { useStore, type Tab } from '../store';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'market', icon: '📊', label: 'Market' },
  { id: 'trade', icon: '⚡', label: 'Trade' },
  { id: 'portfolio', icon: '💼', label: 'Porto' },
  { id: 'news', icon: '📰', label: 'Berita' },
  { id: 'launchpad', icon: '🚀', label: 'Launch' },
  { id: 'settings', icon: '⚙️', label: 'Setelan' }
];

export function BottomNav() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);

  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <button key={t.id} className={`nav-btn ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
          <span className="ico">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
