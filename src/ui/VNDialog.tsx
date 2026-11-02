import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { availableChoices, currentLine } from '../sim/dialogue';

/**
 * VN dialog (Phase 14 — V3.5): overlay dialog visual novel.
 * - tampilkan baris NPC + typewriter effect
 * - kalo ada choices (encounter) → tombol pilihan
 * - tap teks / tombol → advance / pilih
 */
export function VNDialog() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  const dialogueAdvance = useStore((s) => s.dialogueAdvance);
  const dialogueChoose = useStore((s) => s.dialogueChoose);
  const dialogueClose = useStore((s) => s.dialogueClose);
  void v;

  const d = sim.dialogue;
  const line = currentLine(sim);
  const choices = availableChoices(sim);

  const lineKey = line ? `${d.npcId}:${d.idx}:${line.text}` : 'closed';
  const [key, setKey] = useState(lineKey);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (lineKey !== key) {
      setKey(lineKey);
      setShown(0);
    }
  }, [lineKey, key]);
  useEffect(() => {
    if (!line) return;
    if (shown >= line.text.length) return;
    const t = window.setTimeout(() => setShown((s) => s + 1), 16);
    return () => window.clearTimeout(t);
  }, [shown, line]);

  if (!d.open || !line) return null;

  const npc = sim.bots.find((b) => b.id === d.npcId);
  const speaker = npc?.emoji ?? '🗨️';
  const name = npc?.name ?? 'Orang';
  const text = line.text;
  const tone = line.tone;

  const advance = () => {
    if (shown < text.length) {
      setShown(text.length);
      return;
    }
    dialogueAdvance();
  };

  return (
    <div className="vn-overlay" onClick={advance}>
      <div className={`vn-box tone-${tone}`}>
        <div className="vn-head">
          <span className="vn-speaker">
            {speaker} {name}
          </span>
          <button
            className="vn-close"
            onClick={(e) => {
              e.stopPropagation();
              dialogueClose();
            }}
          >
            ✕
          </button>
        </div>
        <div className="vn-text">
          {text.slice(0, shown)}
          {shown < text.length ? <i className="vn-caret">▍</i> : null}
        </div>
        {choices.length > 0 ? (
          <div className="vn-choices" onClick={(e) => e.stopPropagation()}>
            {choices.map((c, i) => (
              <button key={i} className="vn-choice" onClick={() => dialogueChoose(i)}>
                <span className="vn-choice-label">{c.label}</span>
                {c.outcome ? <span className="vn-choice-hint">{c.outcome}</span> : null}
              </button>
            ))}
          </div>
        ) : (
          <button className="vn-next" onClick={advance}>
            Lanjut ▸
          </button>
        )}
      </div>
    </div>
  );
}
