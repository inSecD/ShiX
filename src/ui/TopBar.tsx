import { useStore } from '../store';
import { equity, unrealizedPnl } from '../sim/engine';
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
  const v = useStore((s) => s.v);
  const speed = useStore((s) => s.speed);
  const setSpeed = useStore((s) => s.setSpeed);

  const eq = equity(sim);
  const upnl = unrealizedPnl(sim);
  const dayStart = sim.order.length
    ? sim.instruments[sim.order[0]]?.open ?? 0
    : 0;
  void dayStart;
  void v;

  const startEq = sim.equityCurve[0] ?? eq;
  const changePct = startEq > 0 ? ((eq - startEq) / startEq) * 100 : 0;

  return (
    <header className="topbar">
      <div className="topbar-main">
        <div className="brand">
          Shi<span>X</span>
        </div>
        <span className="regime">{sim.macro.regime}</span>
        <div style={{ flex: 1 }} />
        <span className="tiny muted mono">
          {sim.instruments[sim.order[0]] ? '' : ''}
          {sim.macro.rate.toFixed(2)}% · USD {sim.macro.usd >= 0 ? '+' : ''}
          {(sim.macro.usd * 100).toFixed(0)}
        </span>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="k">Equity</div>
          <div className="v">{fmtUsd(eq, true)}</div>
        </div>
        <div className="stat">
          <div className="k">Cash</div>
          <div className="v">{fmtUsd(sim.cash, true)}</div>
        </div>
        <div className="stat">
          <div className="k">Margin</div>
          <div className="v">{fmtUsd(sim.locked, true)}</div>
        </div>
        <div className="stat">
          <div className="k">Unrealized</div>
          <div className={`v ${upnl >= 0 ? 'up' : 'down'}`}>{fmtUsd(upnl, true)}</div>
        </div>
        <div className="stat">
          <div className="k">Return</div>
          <div className={`v ${changePct >= 0 ? 'up' : 'down'}`}>{fmtPct(changePct)}</div>
        </div>
        <div className="stat">
          <div className="k">Realized</div>
          <div className={`v ${sim.realized >= 0 ? 'up' : 'down'}`}>{fmtUsd(sim.realized, true)}</div>
        </div>
      </div>

      <div className="speed-row">
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
