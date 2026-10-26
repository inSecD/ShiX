import { useStore } from '../store';
import { equity } from '../sim/engine';
import { fmtPct } from '../lib/format';

export function DailyBar() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  const setTab = useStore((s) => s.setTab);
  void v;

  const ch = sim.challenge;
  if (!ch) return null;

  const eq = equity(sim);
  const pct = ch.startEquity > 0 ? (eq / ch.startEquity - 1) * 100 : 0;
  const target = ch.targetPct * 100;
  const prog = Math.min(1, Math.max(0, pct / target));
  const left = Math.max(0, ch.deadlineTick - sim.ticks);
  const days = Math.floor(left / 24);
  const hours = left % 24;

  return (
    <button
      className={`daily-bar ${ch.done ? (ch.won ? 'won' : 'lost') : ''}`}
      onClick={() => setTab(ch.scenarioId ? 'modes' : 'settings')}
    >
      <div className="daily-top">
        <span className="daily-title">
          {ch.label || 'TANTANGAN HARIAN'}{' '}
          {!ch.scenarioId && <span className="daily-day">{ch.dayKey}</span>}
        </span>
        <span className="mono" style={{ fontSize: 11 }}>
          {ch.done ? (ch.won ? 'LOLOS' : 'GAGAL') : `${fmtPct(pct)} / +${target.toFixed(0)}%`}
        </span>
      </div>
      <div className="daily-track">
        <i style={{ width: `${prog * 100}%` }} />
      </div>
      <div className="daily-sub">
        {ch.done
          ? `hasil ${fmtPct(ch.finalPct ?? pct)} · terbaik ${fmtPct(ch.bestPct)}`
          : `sisa ${days}h ${hours}j · streak ${ch.streak} · attempt ${ch.attempts}`}
      </div>
    </button>
  );
}
