import { useStore } from '../store';
import { encounterDef } from '../sim/encounter';
import { QUESTS, questById, stageProgress } from '../sim/quest';
import { LOCATION_BY_ID } from '../sim/hub';

/**
 * Bagian Phase 9 di tab Jalan:
 *  - EncounterDialog: muncul pas ketemu orang acak, dengan pilihan dialog + konsekuensi
 *  - QuestPanel: side quest berjenjang dari warga kota (progres dari aksi nyata)
 */

function effHint(ch: {
  effect: { cash?: number; mood?: number; followers?: number; jobXp?: number };
}): string {
  const parts: string[] = [];
  if (ch.effect.cash) parts.push(`${ch.effect.cash > 0 ? '+' : ''}$${Math.round(ch.effect.cash)}`);
  if (ch.effect.mood) parts.push(`mood ${ch.effect.mood > 0 ? '+' : ''}${ch.effect.mood}`);
  if (ch.effect.followers) parts.push(`+${ch.effect.followers} fol`);
  if (ch.effect.jobXp) parts.push(`+${ch.effect.jobXp} XP`);
  return parts.length ? parts.join(' · ') : '';
}

export function EncounterDialog() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  const encounterChoose = useStore((s) => s.encounterChoose);
  void v;

  const pending = sim.encounter?.pending;
  if (!pending) return null;
  const def = encounterDef(pending.defId);
  if (!def) return null;

  return (
    <div className="panel enc-panel">
      <div className="panel-head">
        <span>
          {def.icon} Encounter
        </span>
        <span className="badge accent">Di {LOCATION_BY_ID[sim.hub.locId]?.name ?? 'kota'}</span>
      </div>
      <div className="panel-body enc-body">
        <div className="enc-title">{def.title}</div>
        <div className="enc-scene">{def.scene}</div>
        <div className="enc-choices">
          {def.choices.map((ch, i) => (
            <button key={i} className="enc-choice" onClick={() => encounterChoose(i)}>
              <span className="enc-choice-label">{ch.label}</span>
              <span className="enc-choice-hint">{effHint(ch)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function QuestPanel() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  const questAccept = useStore((s) => s.questAccept);
  const questAbandon = useStore((s) => s.questAbandon);
  const questClaim = useStore((s) => s.questClaim);
  void v;

  const q = sim.quests;
  if (!q) return null;

  // misi yang tersedia dari NPC yang lagi di dekat pemain / friendship cukup
  const available = QUESTS.filter((def) => {
    if (q.completed.includes(def.id)) return false;
    if (q.active.some((a) => a.defId === def.id)) return false;
    const fr = sim.social.friendship[def.npcId] ?? 0;
    return fr >= def.reqFriendship;
  });

  const giverName = (npcId: string) => sim.bots.find((b) => b.id === npcId)?.name ?? npcId;

  return (
    <div className="panel">
      <div className="panel-head">
        <span>📋 Misi Sampingan</span>
        <span className="badge">
          {q.active.length} aktif · {q.completed.length} selesai
        </span>
      </div>
      <div className="panel-body quest-body">
        {q.active.length === 0 && available.length === 0 ? (
          <div className="tiny muted">
            Belum ada misi. Naikin friendship warga (ngobrol) buat buka misi sampingan.
          </div>
        ) : null}

        {q.active.map((aq) => {
          const def = questById(aq.defId);
          if (!def) return null;
          const stage = def.stages[aq.stage];
          if (!stage) return null;
          const prog = stageProgress(sim, aq, stage);
          const done = prog >= stage.need;
          const pct = Math.max(0, Math.min(100, (prog / Math.max(1, stage.need)) * 100));
          return (
            <div className="quest-card" key={aq.defId}>
              <div className="quest-head">
                <b>{def.title}</b>
                <span className="tiny muted">
                  Tahap {aq.stage + 1}/{def.stages.length} · {giverName(def.npcId)}
                </span>
              </div>
              <div className="quest-stage">{stage.desc}</div>
              <div className="quest-prog">
                <div className="quest-prog-bar">
                  <i style={{ width: `${pct}%` }} />
                </div>
                <span className="mono tiny">
                  {Math.min(prog, stage.need)}/{stage.need}
                </span>
              </div>
              <div className="quest-actions">
                <button className={`short${done ? ' accent-btn' : ''}`} disabled={!done} onClick={() => questClaim(aq.defId)}>
                  {done ? 'Klaim' : 'Berjalan'}
                </button>
                <button className="short ghost" onClick={() => questAbandon(aq.defId)}>
                  Tinggal
                </button>
              </div>
            </div>
          );
        })}

        {available.map((def) => {
          const giver = sim.bots.find((b) => b.id === def.npcId);
          return (
            <div className="quest-card avail" key={def.id}>
              <div className="quest-head">
                <b>
                  {giver?.emoji} {def.title}
                </b>
                <span className="tiny muted">dari {giverName(def.npcId)}</span>
              </div>
              <div className="tiny muted">{def.intro}</div>
              <div className="tiny muted" style={{ marginTop: 2 }}>
                {def.stages.length} tahap
              </div>
              <div className="quest-actions">
                <button className="short" onClick={() => questAccept(def.id)}>
                  Ambil Misi
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
