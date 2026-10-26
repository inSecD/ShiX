import { useStore } from '../store';
import { equity } from '../sim/engine';
import { SCENARIOS, scenarioById } from '../sim/scenarios';
import { MISSIONS, missionMet, missionClaimed, missionsProgress } from '../sim/missions';
import { fmtPct, fmtUsd } from '../lib/format';

function ScenarioCard({
  sc,
  active
}: {
  sc: (typeof SCENARIOS)[number];
  active: boolean;
}) {
  const startScenario = useStore((s) => s.startScenario);
  const running = useStore((s) => s.sim.challenge?.scenarioId ?? null);

  const confirmStart = () => {
    if (running && !active) {
      if (!confirm(`Ganti ke skenario "${sc.name}"? Progres run sekarang akan diganti.`)) return;
    } else if (active) {
      if (!confirm(`Ulangi skenario "${sc.name}" dari awal? Progres sekarang akan diganti.`)) return;
    }
    startScenario(sc.id);
  };

  return (
    <div className={`scen ${active ? 'on' : ''} tone-${sc.tone}`}>
      <div className="row between">
        <div className="row" style={{ gap: 9, minWidth: 0 }}>
          <span className="scen-ico">{sc.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div className="scen-name">
              {sc.name} {active && <span className="badge accent">AKTIF</span>}
            </div>
            <div className="tiny muted">{sc.tagline}</div>
          </div>
        </div>
        <span className={`badge ${sc.tone === 'brutal' ? 'danger' : sc.tone === 'wild' ? 'warn' : ''}`}>
          +{(sc.targetPct * 100).toFixed(0)}%
        </span>
      </div>

      <div className="scen-desc">{sc.desc}</div>

      <div className="scen-meta">
        <span title="Regime awal">🌡️ {sc.regime}</span>
        <span title="Batas waktu">⏱ {sc.days}h</span>
        <span title="Modal">💵 {fmtUsd(sc.startingCash, true)}</span>
        <span title="Leverage">⚡ {sc.maxLeverage}x</span>
        <span
          title="Kesulitan"
          className={sc.difficulty === 'brutal' ? 'down' : sc.difficulty === 'easy' ? 'up' : ''}
        >
          {sc.difficulty === 'easy' ? 'Santai' : sc.difficulty === 'normal' ? 'Normal' : 'Brutal'}
        </span>
      </div>

      <button className="primary" style={{ width: '100%', marginTop: 9 }} onClick={confirmStart}>
        {active ? 'Ulangi skenario' : running ? 'Ganti skenario' : 'Mulai skenario'}
      </button>
    </div>
  );
}

export function ModesView() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  const settings = useStore((s) => s.settings);
  const exitScenario = useStore((s) => s.exitScenario);
  const setTab = useStore((s) => s.setTab);
  const startTut = useStore((s) => s.startTut);
  void v;

  const ch = sim.challenge;
  const active = ch?.scenarioId ? scenarioById(ch.scenarioId) : undefined;
  const eq = equity(sim);
  const pct = ch && ch.startEquity > 0 ? (eq / ch.startEquity - 1) * 100 : 0;
  const prog = ch ? Math.min(1, Math.max(0, pct / (ch.targetPct * 100))) : 0;
  const leftDays = ch ? Math.max(0, Math.ceil((ch.deadlineTick - sim.ticks) / 24)) : 0;
  const mp = missionsProgress(sim, settings.startingCash);

  return (
    <div>
      {active && ch && (
        <div className="panel">
          <div className="panel-head">
            <span>Skenario Berjalan · {active.name}</span>
            <span className={`badge ${ch.done ? (ch.won ? 'accent' : 'danger') : 'warn'}`}>
              {ch.done ? (ch.won ? 'MENANG' : 'GAGAL') : 'BERJALAN'}
            </span>
          </div>
          <div className="panel-body">
            <div className="row between tiny">
              <span className="muted">
                Target +{(ch.targetPct * 100).toFixed(0)}% · modal {fmtUsd(ch.startEquity, true)}
              </span>
              <span className={`mono ${pct >= 0 ? 'up' : 'down'}`} style={{ fontWeight: 700 }}>
                {fmtPct(pct)}
              </span>
            </div>
            <div className="curve" style={{ marginTop: 6 }}>
              <i style={{ width: `${prog * 100}%` }} />
            </div>
            <div className="row between tiny muted" style={{ marginTop: 5 }}>
              <span>{ch.done ? `hasil ${fmtPct(ch.finalPct ?? pct)}` : `sisa ${leftDays} hari`}</span>
              <span>terbaik {fmtPct(ch.bestPct)}</span>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 10 }}>
              <button className="tiny" style={{ flex: 1 }} onClick={() => setTab('market')}>
                Lanjut trading
              </button>
              <button
                className="ghost tiny"
                style={{ flex: 1 }}
                onClick={() => {
                  if (confirm('Keluar skenario dan buat dunia normal baru?')) exitScenario();
                }}
              >
                Keluar skenario
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel" data-tut="modes-scenarios">
        <div className="panel-head">
          <span>Skenario Pasar</span>
          <span className="badge">{SCENARIOS.length} mode</span>
        </div>
        <div className="panel-body scen-list">
          <div className="hint" style={{ marginBottom: 10 }}>
            Tiap skenario mengunci regime pasar, modal, leverage, dan target khusus. Dunia diganti total saat
            dimulai — persis kayak level di game.
          </div>
          {SCENARIOS.map((sc) => (
            <ScenarioCard key={sc.id} sc={sc} active={active?.id === sc.id} />
          ))}
        </div>
      </div>

      <div className="panel" data-tut="modes-missions">
        <div className="panel-head">
          <span>Misi Latihan</span>
          <span className="badge accent">
            {mp.done} / {mp.total}
          </span>
        </div>
        <div className="panel-body">
          <div className="curve" style={{ marginTop: 0, marginBottom: 10 }}>
            <i style={{ width: `${(mp.done / Math.max(1, mp.total)) * 100}%` }} />
          </div>
          <div className="mis-list">
            {MISSIONS.map((m) => {
              const met = missionMet(sim, m, settings.startingCash);
              const claimed = missionClaimed(sim, m);
              return (
                <div key={m.id} className={`mis ${met ? 'done' : ''}`}>
                  <span className="mis-ico">{met ? '✅' : m.icon}</span>
                  <div className="mis-copy">
                    <b>{m.title}</b>
                    <span>{m.desc}</span>
                    {!met && <span className="mis-hint">💡 {m.hint}</span>}
                  </div>
                  <div className="mis-right">
                    <span className={`mis-reward ${claimed ? 'up' : ''}`}>
                      {claimed ? 'diambil' : `+${fmtUsd(m.reward, true)}`}
                    </span>
                    {!met && (
                      <button className="tiny ghost" onClick={() => setTab(m.go)}>
                        Buka
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Bantuan</span>
        </div>
        <div className="panel-body">
          <div className="hint" style={{ marginBottom: 10 }}>
            Belum paham alurnya? Jalanin lagi tour step-by-step — ada highlight di tiap elemen penting.
          </div>
          <button className="primary" style={{ width: '100%' }} onClick={() => startTut(0)}>
            ▶ Mulai tutorial lagi
          </button>
        </div>
      </div>
    </div>
  );
}
