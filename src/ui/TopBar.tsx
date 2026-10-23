import { useStore } from '../store';
import { equity } from '../sim/engine';
import { fmtClock, fmtPct, fmtUsd } from '../lib/format';

const SPEEDS = [
  { label: 'II', v: 0 },
  { label: '1x', v: 1 },
  { label: '2x', v: 2 },
  { label: '5x', v: 5 },
  { label: '10x', v: 10 }
];

export function TopBar() {
  const sim = useStore((s) => s.sim);
  const settings = useStore((s) => s.settings);
  const v = useStore((s) => s.v);
  const speed = useStore((s) => s.speed);
  const setSpeed = useStore((s) => s.setSpeed);
  const setTab = useStore((s) => s.setTab);
  const tab = useStore((s) => s.tab);
  void v;

  const eq = equity(sim);
  const base = sim.challenge?.startEquity ?? settings.startingCash;
  const changePct = base > 0 ? ((eq - base) / base) * 100 : 0;

  return (
    <header className="topbar">
      <div className="topbar-main">
        <div className="brand">
          Shi<span>X</span>
        </div>
        <span className="regime">{sim.macro.regime}</span>
        <div className="topbar-equity">
          <span className="val">{fmtUsd(eq, true)}</span>
          <span className={`ret ${changePct >= 0 ? 'up' : 'down'}`}>{fmtPct(changePct)}</span>
        </div>
        <button
          className={`icon-btn ${tab === 'more' || tab === 'settings' || tab === 'news' || tab === 'launchpad' ? 'on' : ''}`}
          onClick={() => setTab('more')}
          aria-label="Menu"
          title="Menu"
        >
          ☰
        </button>
      </div>

      <div className="topbar-foot">
        {SPEEDS.map((s) => (
          <button
            key={s.v}
            className={`speed-btn ${speed === s.v ? 'on' : ''}`}
            onClick={() => setSpeed(s.v)}
          >
            {s.v === 0 ? '❚❚' : s.label}
          </button>
        ))}
        <div className="clock">{fmtClock(sim.simTime)}</div>
      </div>
    </header>
  );
}
