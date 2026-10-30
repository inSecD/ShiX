import { useStore } from '../store';
import { DAILY_COST, JOBS, focusOf, jobById } from '../sim/life';

/** bar 0..100 dengan warna ngikutin kondisi */
function Bar({ label, v, good }: { label: string; v: number; good: boolean }) {
  const color = good ? (v >= 60 ? 'var(--up)' : 'var(--warn, #e8b93f)') : 'var(--down)';
  return (
    <div className="life-bar-row">
      <span className="life-bar-label">{label}</span>
      <div className="life-bar">
        <i style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: color }} />
      </div>
      <span className="life-bar-val mono">{Math.round(v)}</span>
    </div>
  );
}

/**
 * Panel Kehidupan (Fase 8): energi/mood, kerjaan + XP karier, shift, tagihan.
 * Fokus lo (energi+mood) nentuin fee trading — capek = fee bengkak.
 */
export function LifePanel() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  const jobApply = useStore((s) => s.jobApply);
  const jobQuit = useStore((s) => s.jobQuit);
  const lifeShift = useStore((s) => s.lifeShift);
  const lifeSleep = useStore((s) => s.lifeSleep);
  const lifeSnack = useStore((s) => s.lifeSnack);
  void v;

  const life = sim.life;
  if (!life) return null;
  const job = jobById(life.jobId);
  const focus = focusOf(life);
  const feePct = ((focus ? 1 + (1 - focus) * 0.5 : 1) - 1) * 100;

  // XP buat kerjaan berikutnya yang belum kebuka
  const next = JOBS.find((j) => j.reqXp > life.jobXp);
  const prevReq = next ? (JOBS[JOBS.indexOf(next) - 1]?.reqXp ?? 0) : life.jobXp;
  const prog = next
    ? Math.max(0, Math.min(1, (life.jobXp - prevReq) / Math.max(1, next.reqXp - prevReq)))
    : 1;

  const snackWait = Math.max(0, 6 - (sim.ticks - (life.lastSnackTick ?? -999)));

  return (
    <div className="panel">
      <div className="panel-head">
        <span>Kehidupan</span>
        <span className={`badge ${focus >= 0.7 ? 'accent' : focus >= 0.4 ? 'warn' : 'danger'}`}>
          Fokus {Math.round(focus * 100)}%
        </span>
      </div>
      <div className="panel-body life-body">
        <Bar label="⚡ Energi" v={life.energy} good />
        <Bar label="🙂 Mood" v={life.mood} good={life.mood >= 35} />

        <div className="life-status">
          {life.restLeft > 0 ? (
            <span>😴 Tidur — sisa {life.restLeft} jam</span>
          ) : life.working && job ? (
            <span>
              {job.icon} Shift {job.name} — sisa {life.shiftLeft} jam
            </span>
          ) : job ? (
            <span>
              {job.icon} {job.name} · gaji ${job.pay}/shift
            </span>
          ) : (
            <span>🪑 Nganggur — gaji $0</span>
          )}
          <span className="muted">XP karier {Math.floor(life.jobXp)}</span>
        </div>

        {feePct > 0 ? (
          <div className="tiny muted">
            Fokus lo bikin fee trading <span className="down">+{feePct.toFixed(0)}%</span>
            {focus >= 0.95 ? ' — badan fit, fee normal' : ''}
          </div>
        ) : null}

        <div className="life-actions">
          <button className="short" disabled={!!life.working} onClick={lifeShift}>
            {life.working ? 'Kerja…' : 'Masuk Shift'}
          </button>
          <button className="short" disabled={life.restLeft > 0} onClick={lifeSleep}>
            Tidur 8j
          </button>
          <button
            className="short"
            disabled={snackWait > 0 || life.restLeft > 0}
            title="$15 · +12 energi · +8 mood"
            onClick={lifeSnack}
          >
            {snackWait > 0 ? `Ngopi ${snackWait}j` : 'Ngopi $15'}
          </button>
          {job && !life.working ? (
            <button className="short ghost" onClick={jobQuit}>
              Resign
            </button>
          ) : null}
        </div>

        {next ? (
          <div className="life-promo">
            <div className="row between tiny">
              <span className="muted">
                {next.icon} {next.name} · butuh {next.reqXp} XP
              </span>
              <span className="mono">{Math.floor(life.jobXp)}/{next.reqXp}</span>
            </div>
            <div className="life-bar" style={{ marginTop: 4 }}>
              <i style={{ width: `${prog * 100}%`, background: 'var(--accent)' }} />
            </div>
          </div>
        ) : (
          <div className="tiny muted">Karier mentok. Kamu orang paling atas. 🤵</div>
        )}

        <div className="life-jobs">
          <div className="tiny muted" style={{ marginBottom: 4 }}>
            Lowongan · biaya hidup ${DAILY_COST}/hari
          </div>
          {JOBS.map((j) => {
            const locked = life.jobXp < j.reqXp;
            const cur = life.jobId === j.id;
            return (
              <div className={`life-job${cur ? ' on' : ''}`} key={j.id}>
                <span className="life-job-ico">{j.icon}</span>
                <div className="life-job-copy">
                  <b>
                    {j.name}
                    {locked ? <span className="muted"> 🔒 {j.reqXp} XP</span> : null}
                  </b>
                  <div className="tiny muted">
                    ${j.pay}/shift · {j.hours}j · {j.desc}
                  </div>
                </div>
                <button
                  className="short"
                  disabled={cur || locked}
                  onClick={() => jobApply(j.id)}
                >
                  {cur ? 'Aktif' : locked ? 'Kunci' : 'Lamar'}
                </button>
              </div>
            );
          })}
        </div>

        {life.debt > 0 ? (
          <div className="tiny down" style={{ marginTop: 6 }}>
            ⚠️ Utang hidup ${Math.round(life.debt)} — kebayar otomatis kalau cash lega
          </div>
        ) : null}
      </div>
    </div>
  );
}
