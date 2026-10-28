import { useEffect, useRef } from 'react';
import { useStore } from './store';
import { TopBar } from './ui/TopBar';
import { BottomNav } from './ui/BottomNav';
import { HomeView } from './ui/HomeView';
import { MarketScreen } from './ui/MarketScreen';
import { WorldView } from './ui/WorldView';
import { TradePanel } from './ui/TradePanel';
import { PortfolioView } from './ui/PortfolioView';
import { NewsView } from './ui/NewsView';
import { LaunchpadView } from './ui/LaunchpadView';
import { RankView } from './ui/RankView';
import { LifestyleView } from './ui/LifestyleView';
import { SettingsView } from './ui/SettingsView';
import { MoreView } from './ui/MoreView';
import { ModesView } from './ui/ModesView';
import { DailyBar } from './ui/DailyBar';
import { Tutorial } from './ui/Tutorial';

const TICK_MS = 200;

export default function App() {
  const tab = useStore((s) => s.tab);
  const speed = useStore((s) => s.speed);
  const doTick = useStore((s) => s.doTick);
  const boot = useStore((s) => s.boot);
  const save = useStore((s) => s.save);
  const toast = useStore((s) => s.toast);
  const dismissToast = useStore((s) => s.dismissToast);
  const booted = useStore((s) => s.booted);
  const acc = useRef(0);

  useEffect(() => {
    void boot();
  }, [boot]);

  // market loop
  useEffect(() => {
    if (!booted) return;
    const id = window.setInterval(() => {
      if (speed <= 0) return;
      acc.current += (speed * 0.5 * TICK_MS) / 1000;
      const n = Math.floor(acc.current);
      acc.current -= n;
      if (n > 0) doTick(n);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [speed, doTick, booted]);

  // autosave
  useEffect(() => {
    if (!booted) return;
    const id = window.setInterval(() => void save(), 15000);
    const onHide = () => {
      if (document.visibilityState === 'hidden') void save();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [booted, save]);

  // toast auto dismiss
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => dismissToast(), 2600);
    return () => window.clearTimeout(id);
  }, [toast, dismissToast]);

  if (!booted) {
    return (
      <div className="app" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>
            ShiX
          </div>
          <div className="tiny muted">menyiapkan pasar...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar />
      {tab !== 'home' && <DailyBar />}
      <main>
        {tab === 'home' && <HomeView />}
        {tab === 'market' && <MarketScreen />}
        {tab === 'world' && <WorldView />}
        {tab === 'trade' && <TradePanel />}
        {tab === 'portfolio' && <PortfolioView />}
        {tab === 'news' && <NewsView />}
        {tab === 'launchpad' && <LaunchpadView />}
        {tab === 'rank' && <RankView />}
        {tab === 'lifestyle' && <LifestyleView />}
        {tab === 'settings' && <SettingsView />}
        {tab === 'modes' && <ModesView />}
        {tab === 'more' && <MoreView />}
      </main>
      <BottomNav />
      <Tutorial />
      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}
