import { useStore } from '../store';
import { encounterDef } from '../sim/encounter';
import { QUESTS, questById, stageProgress } from '../sim/quest';
import { isBankrupt } from '../sim/meta';
import { LOCATION_BY_ID } from '../sim/hub';

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

/** Hubungan pemain ke NPC: sosmed → kencan → nikah → anak (Phase 10) */
export function RelationshipPanel() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  const dateNpc = useStore((s) => s.dateNpc);
  const proposeMarried = useStore((s) => s.proposeMarried);
  const divorceNpc = useStore((s) => s.divorceNpc);
  void v;

  const relMap = sim.relationship;
  const spouseEntry = relMap ? Object.entries(relMap).find(([, r]) => r?.level === 'spouse') : undefined;
  const spouse = spouseEntry ? spouseEntry[1] : undefined;
  const spouseBotId = spouseEntry ? spouseEntry[0] : null;
  const datingId = relMap ? Object.entries(relMap).find(([, r]) => r?.level === 'date')?.[0] : undefined;
  const dateTarget = datingId ? sim.bots.find((b) => b.id === datingId) : null;
  const datingRel = datingId ? relMap?.[datingId] : undefined;

  const statusLine = spouse
    ? `👨‍👩‍👧 Menikah · ${spouse.dates} kencan`
    : datingId
      ? `❤️ Kencan: ${sim.bots.find((b) => b.id === datingId)?.name ?? datingId} · tahap ${datingRel?.hearts ?? 0}`
      : '🙏 Belum ada hubungan khusus';

  return (
    <div className="panel">
      <div className="panel-head">
        <span>💞 Hubungan</span>
        <span className="badge">{statusLine}</span>
      </div>
      <div className="panel-body">
        {spouse && spouseBotId ? (
          <>
            <div className="tiny muted">Status: menikah denganku. Ada 2 anak — biaya hidup jadi lebih mahal.</div>
            <div className="tiny muted">Kids biaya $800/bln (didebet bersama bill hidup).</div>
            <div className="life-actions">
              <button className="short ghost" onClick={() => divorceNpc(spouseBotId)}>
                Putus
              </button>
            </div>
          </>
        ) : dateTarget ? (
          <>
            <div className="tiny muted">
              Terkencan sama {dateTarget.name} (friendship {Math.round(sim.social.friendship[dateTarget.id] ?? 0)} · tahap {datingRel?.hearts ?? 0}).
            </div>
            <div className="life-actions">
              <button className="short" onClick={() => dateNpc(dateTarget.id)}>
                Kencan lagi · $500
              </button>
              <button className="short" onClick={() => proposeMarried(dateTarget.id)}>
                Nangis... 😭 (usul)
              </button>
            </div>
          </>
        ) : (
          <div className="tiny muted">Naikin friendship warga lewat ngobrol buat buka kencan.</div>
        )}
      </div>
    </div>
  );
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
          <div className="tiny muted">Belum ada misi. Naikin friendship warga (ngobrol) buat buka misi sampingan.</div>
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

export function MinigamePanel() {
  const v = useStore((s) => s.v);
  const minigamePlay = useStore((s) => s.minigamePlay);
  void v;

  const kinds = ['chart', 'mood'];

  return (
    <div className="panel">
      <div className="panel-head">
        <span>🎮 Mini-game</span>
      </div>
      <div className="panel-body">
        <div className="tiny muted">Otot cepat. Chart Frenzy: baca candle → +cash/mood. Relax Run: relaksasi → +mood.</div>
        <div className="life-actions">
          {kinds.map((k) => (
            <button key={k} className="short" onClick={() => minigamePlay(k)}>
              {k === 'chart' ? 'Chart Frenzy' : 'Relax Run'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Meta (Phase 13): rumah / kredit / bangkrut */
export function MetaPanel() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  const payOffLoan = useStore((s) => s.payOffLoan);
  void v;

  const meta = sim.meta;
  const mortgageAssetId = meta?.mortgageAssetId ?? null;
  const loan = meta?.loan ?? 0;
  const bankruptFlag = meta?.bankrupt ?? isBankrupt(sim);

  return (
    <div className="panel">
      <div className="panel-head">
        <span>🏠 Meta</span>
        <span className={`badge ${bankruptFlag ? 'danger' : ''}`}>{bankruptFlag ? 'BANGKRUT' : 'AMAN'}</span>
      </div>
      <div className="panel-body">
        <div className="tiny muted">Kredit: ${Math.round(loan)} {mortgageAssetId ? `(as ${mortgageAssetId})` : ''}</div>
        <div className="tiny muted">Status: {bankruptFlag ? 'Kamu bangkrut. Wajar, pasar lagi naik turun.' : 'Belum bangkrut.'}</div>
        <div className="life-actions">
          <button className="short" disabled={!bankruptFlag} onClick={() => payOffLoan()}>
            Lunasi Kredit
          </button>
        </div>
      </div>
    </div>
  );
}
