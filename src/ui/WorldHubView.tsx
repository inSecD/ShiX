import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { STRATEGY_LABEL } from '../sim/bots';
import { chatCooldownLeft, friendshipOf, npcsAtLocation } from '../sim/social';
import { postCooldownLeft } from '../sim/profile';
import {
  LOCATIONS,
  LOCATION_BY_ID,
  isLocationUnlocked,
  locationHint
} from '../sim/hub';

const H_MAP = 340;

/** gedung siluet deterministik (persen x, lebar persen, tinggi persen, warna) */
const BUILDINGS: { x: number; w: number; h: number; c: string }[] = [
  { x: 14, w: 7, h: 20, c: '#161d2e' },
  { x: 21, w: 5, h: 28, c: '#141b2b' },
  { x: 27, w: 8, h: 16, c: '#171f30' },
  { x: 38, w: 6, h: 24, c: '#131a29' },
  { x: 47, w: 9, h: 18, c: '#161d2e' },
  { x: 57, w: 5, h: 30, c: '#121927' },
  { x: 66, w: 7, h: 22, c: '#151c2c' },
  { x: 77, w: 6, h: 26, c: '#141b2b' },
  { x: 85, w: 8, h: 15, c: '#171f30' }
];

/** pasangan lokasi yang dihubungkan jalan */
const ROADS: [string, string][] = [
  ['cafe', 'street'],
  ['street', 'park'],
  ['street', 'bursa'],
  ['street', 'home'],
  ['home', 'garage'],
  ['park', 'apartment'],
  ['park', 'gallery'],
  ['bursa', 'penthouse'],
  ['apartment', 'penthouse'],
  ['penthouse', 'mansion'],
  ['bursa', 'marina'],
  ['marina', 'villa'],
  ['villa', 'island'],
  ['penthouse', 'airport'],
  ['airport', 'mansion']
];

interface MarkerHit {
  id: string;
  x: number;
  y: number;
  r: number;
  unlocked: boolean;
}

/** "3j lalu" dari selisih milidetik */
function fmtAgo(deltaMs: number): string {
  const h = Math.floor(deltaMs / 3_600_000);
  if (h < 1) return 'baru saja';
  if (h < 24) return `${h}j lalu`;
  return `${Math.floor(h / 24)}h lalu`;
}

/** angka pendek: 950 → 950, 12400 → 12,4rb, 1200000 → 1,2jt */
function fmtFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')}rb`;
  return String(n);
}

export function WorldHubView() {
  const sim = useStore((s) => s.sim);
  const hubGoto = useStore((s) => s.hubGoto);
  const npcChat = useStore((s) => s.npcChat);
  const publishPost = useStore((s) => s.publishPost);
  const toggleFollow = useStore((s) => s.toggleFollow);
  const notify = useStore((s) => s.notify);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(360);
  const [draft, setDraft] = useState('');

  const owned = sim.lifestyle.owned;
  const locId = sim.hub.locId;
  const visited = sim.hub.visited;
  const current = LOCATION_BY_ID[locId] ?? LOCATION_BY_ID['street'];
  const npcs = npcsAtLocation(sim, locId);
  const social = sim.social;
  const feed = sim.feed;
  const profile = sim.profile;
  const postWait = postCooldownLeft(sim);
  const heldIds = new Set<string>();
  for (const p of Object.values(sim.positions)) if (p.qty > 0) heldIds.add(p.instId);
  for (const h of Object.values(sim.spotHoldings)) if (h.qty > 0) heldIds.add(h.instId);
  const convo = social.lastConvo;
  const activeRumor = social.rumor;
  const rumorBot = activeRumor ? sim.bots.find((b) => b.id === activeRumor.botId) : null;

  const doPost = () => {
    publishPost(draft);
    setDraft('');
  };

  const followBtn = (botId: string) => {
    const following = profile.following.includes(botId);
    return (
      <button className={`ct-follow${following ? ' on' : ''}`} onClick={() => toggleFollow(botId)}>
        {following ? '✓ Ikut' : '+ Ikuti'}
      </button>
    );
  };

  // ---- refs supaya loop rAF nggak perlu di-restart tiap render ----
  const widthRef = useRef(width);
  widthRef.current = width;
  const posRef = useRef({ x: current.x, y: current.y });
  const targetRef = useRef<{ x: number; y: number; id: string } | null>(null);
  const hitsRef = useRef<MarkerHit[]>([]);
  const sceneRef = useRef({ locId, owned });
  sceneRef.current = { locId, owned };
  const gotoRef = useRef(hubGoto);
  gotoRef.current = hubGoto;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 360;
      setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // snap avatar ke lokasi saat idle (mount / locId berubah dari luar)
  useEffect(() => {
    if (!targetRef.current) posRef.current = { x: current.x, y: current.y };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locId]);

  // ---- loop animasi: gerak + gambar ----
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const pos = posRef.current;
      const t = targetRef.current;
      let walking = false;
      if (t) {
        const dx = t.x - pos.x;
        const dy = t.y - pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.7) {
          pos.x = t.x;
          pos.y = t.y;
          targetRef.current = null;
          gotoRef.current(t.id);
        } else {
          pos.x += dx * 0.11;
          pos.y += dy * 0.11;
          walking = true;
        }
      }
      drawScene(walking);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawScene(walking: boolean) {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = widthRef.current;
    const H = H_MAP;
    cv.width = Math.max(1, Math.floor(w * dpr));
    cv.height = Math.floor(H * dpr);
    cv.style.height = `${H}px`;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, H);

    const X = (p: number) => (p / 100) * w;
    const Y = (p: number) => (p / 100) * H;
    const time = performance.now() / 1000;

    // langit
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0a0f1e');
    sky.addColorStop(0.55, '#141b30');
    sky.addColorStop(1, '#0b1220');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, H);

    // bintang
    ctx.fillStyle = 'rgba(220,230,255,0.5)';
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 97) % 100) / 100 * w;
      const sy = ((i * 53) % 40) / 100 * H;
      ctx.globalAlpha = 0.15 + 0.2 * Math.abs(Math.sin(time * 0.6 + i));
      ctx.fillRect(sx, sy, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;

    // bukit kanan-atas
    ctx.fillStyle = '#0f1524';
    ctx.beginPath();
    ctx.moveTo(X(62), Y(44));
    ctx.quadraticCurveTo(X(80), Y(8), X(100), Y(30));
    ctx.lineTo(X(100), Y(44));
    ctx.closePath();
    ctx.fill();

    // tanah
    const groundY = Y(56);
    const grd = ctx.createLinearGradient(0, groundY, 0, H);
    grd.addColorStop(0, '#101826');
    grd.addColorStop(1, '#0a1019');
    ctx.fillStyle = grd;
    ctx.fillRect(0, groundY, w, H - groundY);

    // air (waterfront kanan-bawah)
    const water = ctx.createLinearGradient(0, Y(66), 0, H);
    water.addColorStop(0, '#0d2036');
    water.addColorStop(1, '#0a1626');
    ctx.fillStyle = water;
    ctx.beginPath();
    ctx.moveTo(X(55), H);
    ctx.lineTo(X(70), Y(70));
    ctx.lineTo(X(100), Y(64));
    ctx.lineTo(X(100), H);
    ctx.closePath();
    ctx.fill();
    // riak
    ctx.strokeStyle = 'rgba(80,150,220,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const ry = Y(72) + i * 8;
      ctx.beginPath();
      for (let xx = X(58); xx <= X(100); xx += 6) {
        const yy = ry + Math.sin(xx * 0.05 + time * 1.5 + i) * 1.5;
        if (xx === X(58)) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }

    // gedung
    for (const b of BUILDINGS) {
      const bx = X(b.x);
      const bw = X(b.w);
      const bh = (b.h / 100) * H;
      const by = groundY - bh + 4;
      ctx.fillStyle = b.c;
      ctx.fillRect(bx, by, bw, bh + 20);
      // jendela
      ctx.fillStyle = 'rgba(255,210,120,0.35)';
      for (let wy = by + 4; wy < by + bh - 2; wy += 6) {
        for (let wx = bx + 2; wx < bx + bw - 3; wx += 5) {
          if (((wx + wy) | 0) % 3 === 0) ctx.fillRect(wx, wy, 2, 2.5);
        }
      }
    }

    // jalan
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a2338';
    ctx.lineWidth = 5;
    for (const [a, b] of ROADS) {
      const la = LOCATION_BY_ID[a];
      const lb = LOCATION_BY_ID[b];
      if (!la || !lb) continue;
      ctx.beginPath();
      ctx.moveTo(X(la.x), Y(la.y));
      ctx.lineTo(X(lb.x), Y(lb.y));
      ctx.stroke();
    }
    // marka putus-putus
    ctx.strokeStyle = 'rgba(120,140,180,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    for (const [a, b] of ROADS) {
      const la = LOCATION_BY_ID[a];
      const lb = LOCATION_BY_ID[b];
      if (!la || !lb) continue;
      ctx.beginPath();
      ctx.moveTo(X(la.x), Y(la.y));
      ctx.lineTo(X(lb.x), Y(lb.y));
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // marker lokasi
    const scene = sceneRef.current;
    hitsRef.current = [];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const R = 15;
    for (const loc of LOCATIONS) {
      const unlocked = isLocationUnlocked(loc, scene.owned);
      const isCur = loc.id === scene.locId;
      const mx = X(loc.x);
      const my = Y(loc.y);

      // shadow
      ctx.beginPath();
      ctx.ellipse(mx, my + R - 1, R * 0.7, R * 0.28, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();

      // ring pulse lokasi sekarang
      if (isCur) {
        const pr = R + 4 + Math.sin(time * 3) * 2.5;
        ctx.beginPath();
        ctx.arc(mx, my, pr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(22,208,154,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // pin
      ctx.beginPath();
      ctx.arc(mx, my, R, 0, Math.PI * 2);
      ctx.fillStyle = isCur ? '#12352b' : unlocked ? '#1a2338' : '#141a26';
      ctx.fill();
      ctx.lineWidth = isCur ? 2.4 : 1.4;
      ctx.strokeStyle = isCur ? '#16d09a' : unlocked ? '#36455f' : '#232b3a';
      ctx.stroke();

      // ikon
      ctx.globalAlpha = unlocked ? 1 : 0.45;
      ctx.font = '15px sans-serif';
      ctx.fillText(loc.icon, mx, my + 1);
      ctx.globalAlpha = 1;

      // label
      ctx.font = '10px sans-serif';
      ctx.fillStyle = unlocked ? '#c7d3e6' : '#5a6579';
      ctx.fillText(loc.name, mx, my + R + 10);

      // badge kunci
      if (!unlocked) {
        ctx.font = '9px sans-serif';
        ctx.fillStyle = '#6b7688';
        ctx.fillText('🔒', mx + R - 3, my - R + 3);
      }

      hitsRef.current.push({ id: loc.id, x: loc.x, y: loc.y, r: (R + 5), unlocked });
    }

    // avatar
    const ax = X(posRef.current.x);
    const ay = Y(posRef.current.y);
    const bob = walking ? Math.abs(Math.sin(time * 9)) * 2.5 : Math.sin(time * 2) * 0.8;
    // bayangan
    ctx.beginPath();
    ctx.ellipse(ax, ay + 13, 7, 2.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    // badan
    ctx.fillStyle = '#4d8dff';
    ctx.fillRect(ax - 5, ay - 12 - bob, 10, 14);
    // kepala
    ctx.fillStyle = '#f2d3b3';
    ctx.beginPath();
    ctx.arc(ax, ay - 16 - bob, 4.2, 0, Math.PI * 2);
    ctx.fill();
    // kaki (geliat saat jalan)
    ctx.strokeStyle = '#2f5fb0';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    const leg = walking ? Math.sin(time * 9) * 3.5 : 0;
    ctx.beginPath();
    ctx.moveTo(ax - 2, ay + 1 - bob);
    ctx.lineTo(ax - 2 - leg, ay + 9 - bob);
    ctx.moveTo(ax + 2, ay + 1 - bob);
    ctx.lineTo(ax + 2 + leg, ay + 9 - bob);
    ctx.stroke();
  }

  function onPointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * 100;
    const cy = ((e.clientY - rect.top) / rect.height) * 100;

    let best: MarkerHit | null = null;
    let bestD = Infinity;
    for (const hit of hitsRef.current) {
      const hitR = (hit.r / rect.width) * 100;
      const d = Math.hypot(cx - hit.x, cy - hit.y);
      if (d <= hitR && d < bestD) {
        best = hit;
        bestD = d;
      }
    }
    if (!best) return;

    const def = LOCATION_BY_ID[best.id];
    if (!best.unlocked) {
      notify(`🔒 ${def.name} terkunci · ${locationHint(def)}`, 'err');
      return;
    }
    // sudah di tempat & idle → nggak usah jalan
    if (best.id === locId && !targetRef.current) return;
    targetRef.current = { x: best.x, y: best.y, id: best.id };
  }

  const unlockedTotal = LOCATIONS.filter((l) => isLocationUnlocked(l, owned)).length;

  return (
    <div className="hub">
      <div className="panel hub-scene">
        <div className="panel-head">
          <span>Jalan-jalan</span>
          <span className="badge">
            {visited.length}/{LOCATIONS.length} tempat
          </span>
        </div>
        <div className="hub-map" ref={wrapRef}>
          <canvas ref={canvasRef} className="hub-canvas" onPointerDown={onPointer} />
          <div className="hub-hint">Tap pin buat jalan ke lokasi</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>🐦 CT Feed</span>
          <span className="badge accent">
            👥 {fmtFollowers(profile.followers)} · ⭐ {Math.round(profile.fame)}
          </span>
        </div>
        <div className="panel-body ct-feed">
          <div className="ct-composer">
            <textarea
              className="ct-input"
              rows={2}
              maxLength={180}
              placeholder="Lagi pingin ngomong apa ke publik? (mis. have fun on weekend!)"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="ct-composer-row">
              <span className="tiny muted">
                {fmtFollowers(profile.followers)} followers · {profile.following.length} following · cooldown{' '}
                {postWait}j
              </span>
              <button className="primary" disabled={postWait > 0 || !draft.trim()} onClick={doPost}>
                Post
              </button>
            </div>
          </div>

          {feed.posts.slice(0, 20).map((p) => (
            <div className={`ct-post${p.authorId === 'you' ? ' you' : ''}`} key={p.id}>
              <span className="ct-ico">{p.emoji}</span>
              <div className="ct-copy">
                <div className="ct-head">
                  <b>{p.name}</b>
                  {p.tag && <span className="ct-tag">${p.tag}</span>}
                  {p.authorId !== 'you' && followBtn(p.authorId)}
                  <span className="ct-time">{fmtAgo(sim.simTime - p.t)}</span>
                </div>
                <div className="ct-text">{p.text}</div>
                {p.mention && (
                  <div className="ct-mention">
                    🎯 sistem nangkep <b>${p.mention}</b>
                    {heldIds.has(p.mention) ? ' · lo lagi pegang ini' : ''}
                  </div>
                )}
                {(p.likes > 0 || p.reactions.length > 0) && (
                  <div className="ct-reacts">
                    {p.likes > 0 && <span className="ct-likes">❤️ {fmtFollowers(p.likes)}</span>}
                    {p.reactions.map((r, i) => (
                      <div className="ct-react" key={i}>
                        <span className="ct-react-ico">{r.emoji}</span>
                        <span>
                          <b>{r.name}</b>: {r.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {feed.posts.length === 0 && (
            <div className="tiny muted">Belum ada yang posting. Biarin sim jalan dulu…</div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Lokasi Sekarang</span>
          <span className="badge accent">{current.mood}</span>
        </div>
        <div className="panel-body hub-current">
          <div className="hub-current-head">
            <span className="hub-current-ico">{current.icon}</span>
            <div>
              <b>{current.name}</b>
              <div className="tiny muted">{current.desc}</div>
            </div>
          </div>
          <div className="hub-flavor">“{current.flavor}”</div>
        </div>
      </div>

      {npcs.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span>Orang di sini</span>
            <span className="badge">{npcs.length} orang</span>
          </div>
          <div className="panel-body hub-npcs">
            {npcs.map((n) => {
              const fr = friendshipOf(social, n.id);
              const wait = chatCooldownLeft(sim, n.id);
              return (
                <div className="npc-row" key={n.id}>
                  <span className="npc-ico">{n.emoji}</span>
                  <div className="npc-copy">
                    <div className="npc-name">
                      <b>{n.name}</b>
                      <span className="npc-strat">{STRATEGY_LABEL[n.strategy]}</span>
                    </div>
                    <div className="npc-friend">
                      <div className="npc-friend-bar">
                        <i style={{ width: `${Math.round(fr)}%` }} />
                      </div>
                      <span className="npc-friend-val">{Math.round(fr)}</span>
                    </div>
                  </div>
                  <button className="short" disabled={wait > 0} onClick={() => npcChat(n.id)}>
                    {wait > 0 ? `${wait}j` : 'Ngobrol'}
                  </button>
                </div>
              );
            })}
            {convo && npcs.some((n) => n.id === convo.botId) ? (
              <div className="npc-convo">
                <div className="npc-convo-line">{convo.greeting}</div>
                {convo.gain > 0 ? <div className="npc-convo-gain">+{convo.gain} pertemanan</div> : null}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {activeRumor ? (
        <div className="panel">
          <div className="panel-head">
            <span>Rumor</span>
            <span className="badge warn">Tier {activeRumor.tier}</span>
          </div>
          <div className="panel-body">
            <div className="npc-rumor">🗣️ {activeRumor.text}</div>
            <div className="tiny muted" style={{ marginTop: 4 }}>
              Dari {rumorBot?.name ?? 'orang dalam'} · berlaku sampai kejadian berikutnya
            </div>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-head">
          <span>Eksplorasi</span>
          <span className="badge">
            {unlockedTotal}/{LOCATIONS.length} terbuka
          </span>
        </div>
        <div className="panel-body hub-explore">
          {LOCATIONS.filter((l) => !isLocationUnlocked(l, owned)).map((l) => (
            <div className="hub-lockrow" key={l.id}>
              <span className="hub-lock-ico">{l.icon}</span>
              <span className="hub-lock-name">{l.name}</span>
              <span className="hub-lock-hint">{locationHint(l)}</span>
            </div>
          ))}
          {unlockedTotal === LOCATIONS.length ? (
            <div className="tiny muted">Semua lokasi kebuka. Kamu beneran udah kemana-mana. 🌍</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
