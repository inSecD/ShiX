import { useStore, type Tab } from '../store';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'market', icon: '📊', label: 'Market' },
  { id: 'world', icon: '🌍', label: 'World' },
  { id: 'portfolio', icon: '💼', label: 'Porto' },
  { id: 'rank', icon: '🏆', label: 'Rank' }
];

export function BottomNav() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);

  const active = (id: Tab) => {
    if (tab === id) return true;
    if (id === 'market' && tab === 'trade') return true;
    return false;
  };

  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`nav-btn ${active(t.id) ? 'on' : ''}`}
          data-tut={`nav-${t.id}`}
          onClick={() => setTab(t.id)}
        >
          <span className="ico">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
