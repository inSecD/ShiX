import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { chatSuggestions, threadOf } from '../sim/conversation';
import { friendshipOf } from '../sim/social';
import { STRATEGY_LABEL } from '../sim/bots';
import { LOCATION_BY_ID } from '../sim/hub';
import { wibHour } from '../sim/ambience';

/**
 * NPC chat v2 (Phase 14 v5): percakapan multi-turn ala chat app.
 * - bubble NPC/kiri, pemain/kanan, typing indicator
 * - chip topik kontekstual + input bebas
 * - friendship bar naik tiap sesi (maks +3)
 */
export function NpcChat() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  const botId = useStore((s) => s.chatBotId);
  const typing = useStore((s) => s.chatTyping);
  const chatSend = useStore((s) => s.chatSend);
  const chatClose = useStore((s) => s.chatClose);
  const toggleFollow = useStore((s) => s.toggleFollow);
  void v;

  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  const bot = botId ? sim.bots.find((b) => b.id === botId) : null;
  const thread = botId ? threadOf(sim, botId) : undefined;
  const turns = thread?.turns ?? [];
  const suggestions = botId ? chatSuggestions(sim, botId) : [];
  const friend = botId ? friendshipOf(sim.social, botId) : 0;
  const following = botId ? sim.profile.following.includes(botId) : false;
  const loc = LOCATION_BY_ID[sim.hub.locId];
  const clock = `${String(wibHour(sim.simTime)).padStart(2, '0')}:00 WIB`;

  useEffect(() => {
    setDraft('');
  }, [botId]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, typing, botId]);

  if (!bot || !botId) return null;

  const send = () => {
    const text = draft.trim();
    if (!text || typing) return;
    chatSend(text);
    setDraft('');
  };

  return (
    <div className="npc-chat-overlay" onClick={chatClose}>
      <div className="npc-chat" role="dialog" aria-label={`Chat ${bot.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="npc-chat-head">
          <span className="npc-chat-ava">{bot.emoji}</span>
          <div className="npc-chat-id">
            <b>{bot.name}</b>
            <span>
              @{bot.handle} · {STRATEGY_LABEL[bot.strategy]}
            </span>
          </div>
          <button className={`npc-chat-follow${following ? ' on' : ''}`} onClick={() => toggleFollow(botId)}>
            {following ? '✓ Following' : '+ Follow'}
          </button>
          <button className="npc-chat-close" onClick={chatClose} aria-label="Tutup chat">
            ✕
          </button>
        </div>

        <div className="npc-chat-meta">
          <span>📍 {loc?.name ?? 'Kota'}</span>
          <span>🕒 {clock}</span>
          <span className="npc-chat-friend">❤ {friend}/100</span>
          <div className="npc-chat-bar">
            <i style={{ width: `${friend}%` }} />
          </div>
        </div>

        <div className="npc-chat-list" ref={listRef}>
          {turns.map((t, i) => (
            <div key={`${t.t}-${i}-${t.role}`} className={`npc-turn ${t.role}`}>
              {t.role === 'npc' ? <span className="npc-turn-ava">{bot.emoji}</span> : null}
              <div className={`npc-bubble ${t.role} tone-${t.tone ?? 'plain'}`}>{t.text}</div>
            </div>
          ))}
          {typing ? (
            <div className="npc-turn npc">
              <span className="npc-turn-ava">{bot.emoji}</span>
              <div className="npc-bubble npc npc-typing" aria-label={`${bot.name} lagi mikir`}>
                <i />
                <i />
                <i />
              </div>
            </div>
          ) : null}
        </div>

        <div className="npc-chat-suggest">
          {suggestions.map((s) => (
            <button key={s.id} onClick={() => chatSend(s.text, s.id)} disabled={typing}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="npc-chat-input">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                send();
              }
            }}
            placeholder={typing ? `${bot.name} lagi mikir…` : 'Tanya apa aja…'}
            maxLength={180}
            disabled={typing}
            aria-label="Pesan buat NPC"
          />
          <button className="primary" onClick={send} disabled={typing || !draft.trim()}>
            Kirim
          </button>
        </div>
        <div className="npc-chat-hint">Topik: pasar · portfolio · rumor · hidup · NPC inget obrolan sebelumnya</div>
      </div>
    </div>
  );
}
