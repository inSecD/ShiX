import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { STRATEGY_LABEL } from '../sim/bots';
import { chatCooldownLeft, friendshipOf, lastNpcMemory, npcsAtLocation } from '../sim/social';
import { venueChatter, venueScene, type ChatterLine } from '../sim/ambience';
import { postCooldownLeft } from '../sim/profile';
import { LifePanel } from './LifePanel';
import { QuestPanel, RelationshipPanel, MinigamePanel, MetaPanel } from './HubExtras';
import { VNDialog } from './VNDialog';
import { NpcChat } from './NpcChat';
import {
  LOCATIONS,
  LOCATION_BY_ID,
  isLocationUnlocked,
  locationHint
} from '../sim/hub';

const H_MAP = typeof window !== 'undefined' && window.innerWidth < 640 ? 420 : 340;

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

/** target jalan; act dijalankan begitu avatar sampai */
interface WalkTarget {
  x: number;
  y: number;
  id: string;
  act?: { type: 'chat' | 'staff' | 'exit'; botId?: string };
}

/** area tap di dalam venue (persen) */
interface IndoorHit {
  kind: 'npc' | 'crowd' | 'staff' | 'exit';
  id: string;
  x: number;
  y: number;
  r: number;
}

/** posisi duduk kerumunan (persen). pintu di kanan, jadi maksimal 11 kursi */
const CROWD_SEATS: { x: number; y: number }[] = [
  { x: 7, y: 64 },
  { x: 14, y: 64 },
  { x: 21, y: 64 },
  { x: 28, y: 64 },
  { x: 35, y: 64 },
  { x: 42, y: 64 },
  { x: 56, y: 64 },
  { x: 63, y: 64 },
  { x: 70, y: 64 },
  { x: 77, y: 64 },
  { x: 84, y: 64 }
];
const NAMED_SEAT = { x: 49, y: 61 };
const STAFF_POS = { x: 78, y: 46 };
const ENTRY_POS = { x: 90, y: 88 };

interface VenuePalette {
  wall: string;
  panel: string;
  floor: string;
  accent: string;
  counter: string;
  glow: string;
}

const VENUE_PAL: Record<string, VenuePalette> = {
  cafe: {
    wall: '#2a2119',
    panel: '#241c14',
    floor: '#1b1510',
    accent: '#ffb35c',
    counter: '#4a3423',
    glow: 'rgba(255,170,80,0.14)'
  },
  home: {
    wall: '#2c241f',
    panel: '#261f1a',
    floor: '#1d1713',
    accent: '#ffd27a',
    counter: '#3c2e25',
    glow: 'rgba(255,210,120,0.12)'
  },
  garage: {
    wall: '#1a222c',
    panel: '#161d26',
    floor: '#121821',
    accent: '#6fd0ff',
    counter: '#2a3543',
    glow: 'rgba(110,200,255,0.1)'
  },
  apartment: {
    wall: '#1b2333',
    panel: '#171e2c',
    floor: '#121722',
    accent: '#8fb8ff',
    counter: '#2a3550',
    glow: 'rgba(120,170,255,0.1)'
  },
  gallery: {
    wall: '#2b2a30',
    panel: '#25242a',
    floor: '#1a191e',
    accent: '#f0e6d2',
    counter: '#3a3840',
    glow: 'rgba(255,245,220,0.1)'
  },
  penthouse: {
    wall: '#121728',
    panel: '#0f1322',
    floor: '#0b0f1a',
    accent: '#c084fc',
    counter: '#232b45',
    glow: 'rgba(180,100,255,0.14)'
  },
  bar: {
    wall: '#1a1622',
    panel: '#15111d',
    floor: '#0f0c16',
    accent: '#ff6b9d',
    counter: '#2a1f33',
    glow: 'rgba(255,100,160,0.12)'
  },
  kantor: {
    wall: '#1e2533',
    panel: '#181f2b',
    floor: '#121822',
    accent: '#7ec8ff',
    counter: '#253040',
    glow: 'rgba(120,190,255,0.1)'
  },
  klub: {
    wall: '#0f0a1a',
    panel: '#0a0614',
    floor: '#06040e',
    accent: '#c084fc',
    counter: '#1f1630',
    glow: 'rgba(190,100,255,0.16)'
  },
  mal: {
    wall: '#2a2a30',
    panel: '#22222a',
    floor: '#18181e',
    accent: '#ffd27a',
    counter: '#33333a',
    glow: 'rgba(255,210,120,0.1)'
  },
  gym: {
    wall: '#1a2228',
    panel: '#151c22',
    floor: '#10161c',
    accent: '#6fd0ff',
    counter: '#23303a',
    glow: 'rgba(110,200,255,0.1)'
  },
  restoran: {
    wall: '#2a1f1a',
    panel: '#241a15',
    floor: '#1a130f',
    accent: '#ffb35c',
    counter: '#3a2a1f',
    glow: 'rgba(255,170,80,0.12)'
  },
  bank: {
    wall: '#1e2533',
    panel: '#181f2b',
    floor: '#121822',
    accent: '#7ec8ff',
    counter: '#253040',
    glow: 'rgba(120,190,255,0.1)'
  },
  kantor_polisi: {
    wall: '#1a2030',
    panel: '#151a28',
    floor: '#10141f',
    accent: '#6fd0ff',
    counter: '#232a3a',
    glow: 'rgba(110,200,255,0.1)'
  },
  rumah_sakit: {
    wall: '#1e2430',
    panel: '#181e28',
    floor: '#121822',
    accent: '#7be3b0',
    counter: '#253040',
    glow: 'rgba(120,230,180,0.1)'
  },
  sekolah: {
    wall: '#2a2418',
    panel: '#231e14',
    floor: '#1a1610',
    accent: '#ffd27a',
    counter: '#332a1a',
    glow: 'rgba(255,210,120,0.1)'
  }
};

const BODY_COLOR: Record<string, string> = {
  momentum: '#4d8dff',
  contrarian: '#8b7bff',
  degen: '#ff9f43',
  quant: '#39c5bb',
  whale: '#63b3ed',
  panic: '#ff6b6b'
};

/** kotak sudut membulat buat bubble */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** Phase 14: tap di dalam area gedung → nggak jalan ke sana */
function insideBuilding(cx: number, cy: number): boolean {
  for (const b of BUILDINGS) {
    const top = 56 - b.h;
    const bottom = top + b.h + 20;
    if (cx >= b.x && cx <= b.x + b.w && cy >= top && cy <= bottom) return true;
  }
  return false;
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
  const staffTalk = useStore((s) => s.staffTalk);
  const publishPost = useStore((s) => s.publishPost);
  const toggleFollow = useStore((s) => s.toggleFollow);
  const notify = useStore((s) => s.notify);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(360);
  const [draft, setDraft] = useState('');
  const [chatterSlot, setChatterSlot] = useState(0);

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

  // interior scene: kerumunan + chatter deterministik, dihitung sekali per render
  const interior = current.indoor ? venueScene(sim, locId) : null;
  const chatter = interior ? venueChatter(sim, locId, chatterSlot) : [];

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
  const posRef = useRef({ x: current.indoor ? ENTRY_POS.x : current.x, y: current.indoor ? ENTRY_POS.y : current.y });
  const targetRef = useRef<WalkTarget | null>(null);
  const hitsRef = useRef<MarkerHit[]>([]);
  const indoorHitsRef = useRef<IndoorHit[]>([]);
  const sceneRef = useRef({ locId, owned });
  sceneRef.current = { locId, owned };
  const interiorRef = useRef<{ scene: typeof interior; chatter: ChatterLine[] }>({ scene: null, chatter: [] });
  interiorRef.current = { scene: interior, chatter };
  const gotoRef = useRef(hubGoto);
  gotoRef.current = hubGoto;
  const chatRef = useRef(npcChat);
  chatRef.current = npcChat;
  const staffRef = useRef(staffTalk);
  staffRef.current = staffTalk;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 360;
      const minW = window.innerWidth < 768 ? 640 : 0;
      setWidth(Math.max(w, minW));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // snap avatar ke lokasi saat idle (mount / locId berubah dari luar)
  useEffect(() => {
    if (!targetRef.current) {
      posRef.current = current.indoor ? { x: ENTRY_POS.x, y: ENTRY_POS.y } : { x: current.x, y: current.y };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locId]);

  // chatter interior berganti tiap 7 detik (deterministik per slot)
  useEffect(() => {
    setChatterSlot(0);
  }, [locId]);
  useEffect(() => {
    if (!current.indoor) return;
    const id = window.setInterval(() => setChatterSlot((s) => s + 1), 7000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.indoor]);

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
          if (t.act?.type === 'exit') gotoRef.current('street');
          else if (t.act?.type === 'staff') staffRef.current(sceneRef.current.locId);
          else if (t.act?.type === 'chat' && t.act.botId) chatRef.current(t.act.botId);
          else gotoRef.current(t.id);
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

    const locNow = LOCATION_BY_ID[sceneRef.current.locId];
    if (locNow?.indoor) {
      const time = performance.now() / 1000;
      drawInterior(ctx, w, X, Y, walking, time);
    } else {
      drawOutdoor(walking);
    }
  }

  function drawOutdoor(walking: boolean) {
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
    const R = w < 640 ? 12 : 15;
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

      // glow untuk lokasi terbuka / sekarang
      if (unlocked || isCur) {
        ctx.save();
        ctx.globalAlpha = isCur ? 0.3 : 0.1;
        ctx.shadowColor = isCur ? '#16d09a' : '#4d8dff';
        ctx.shadowBlur = isCur ? 16 : 10;
        ctx.fillStyle = isCur ? '#16d09a' : '#4d8dff';
        ctx.beginPath();
        ctx.arc(mx, my, R + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // pin (rounded square)
      const pr = R;
      const rx = mx - pr;
      const ry = my - pr;
      const rad = 5;
      ctx.beginPath();
      ctx.moveTo(rx + rad, ry);
      ctx.lineTo(rx + 2 * pr - rad, ry);
      ctx.quadraticCurveTo(rx + 2 * pr, ry, rx + 2 * pr, ry + rad);
      ctx.lineTo(rx + 2 * pr, ry + 2 * pr - rad);
      ctx.quadraticCurveTo(rx + 2 * pr, ry + 2 * pr, rx + 2 * pr - rad, ry + 2 * pr);
      ctx.lineTo(rx + rad, ry + 2 * pr);
      ctx.quadraticCurveTo(rx, ry + 2 * pr, rx, ry + 2 * pr - rad);
      ctx.lineTo(rx, ry + rad);
      ctx.quadraticCurveTo(rx, ry, rx + rad, ry);
      ctx.closePath();
      const grad = ctx.createLinearGradient(rx, ry, rx, ry + 2 * pr);
      if (isCur) { grad.addColorStop(0, '#1e5a44'); grad.addColorStop(1, '#0f2e24'); }
      else if (unlocked) { grad.addColorStop(0, '#2a3555'); grad.addColorStop(1, '#1a2238'); }
      else { grad.addColorStop(0, '#1c2230'); grad.addColorStop(1, '#12171f'); }
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = isCur ? 2 : 1.2;
      ctx.strokeStyle = isCur ? '#16d09a' : unlocked ? '#5a6a8a' : '#2a3344';
      ctx.stroke();

      // ikon
      ctx.globalAlpha = unlocked ? 1 : 0.4;
      ctx.font = w < 640 ? '12px sans-serif' : '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(loc.icon, mx, my + 1);
      ctx.globalAlpha = 1;

      // label pill
      ctx.font = w < 640 ? '8px sans-serif' : '10px sans-serif';
      const tw = ctx.measureText(loc.name).width + 8;
      const lx = mx - tw / 2;
      const ly = my + R + (w < 640 ? 8 : 10);
      ctx.fillStyle = 'rgba(8,12,20,0.85)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(lx, ly - 7, tw, 14, 4);
      else ctx.rect(lx, ly - 7, tw, 14);
      ctx.fill();
      ctx.fillStyle = unlocked ? '#c7d3e6' : '#5a6579';
      ctx.textBaseline = 'middle';
      ctx.fillText(loc.name, mx, ly);

      // badge kunci
      if (!unlocked) {
        ctx.font = '9px sans-serif';
        ctx.fillStyle = '#6b7688';
        ctx.textAlign = 'center';
        ctx.fillText('🔒', mx + R - 2, my - R + 4);
      }

      hitsRef.current.push({ id: loc.id, x: loc.x, y: loc.y, r: (R + 5), unlocked });
    }

    // avatar
    const ax = X(posRef.current.x);
    const ay = Y(posRef.current.y);
    drawAvatar(ctx, ax, ay, walking, time);
  }

  function drawAvatar(ctx: CanvasRenderingContext2D, ax: number, ay: number, walking: boolean, time: number) {
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

  /** interior scene (Phase 14 v4): venue hidup — kerumunan, chatter, staff, pintu */
  function drawInterior(
    ctx: CanvasRenderingContext2D,
    w: number,
    X: (p: number) => number,
    Y: (p: number) => number,
    walking: boolean,
    time: number
  ) {
    const loc = sceneRef.current.locId;
    const pal = VENUE_PAL[loc] ?? VENUE_PAL.cafe;
    const scene = interiorRef.current.scene;
    const chatter = interiorRef.current.chatter;
    const crowd = scene?.crowd ?? [];
    const staff = scene?.info.staff ?? null;
    const named = npcsAtLocation(sim, loc);
    indoorHitsRef.current = [];

    // ---- dinding ----
    ctx.fillStyle = pal.wall;
    ctx.fillRect(0, 0, w, H_MAP);
    ctx.fillStyle = pal.panel;
    for (let px = 0; px < w; px += Math.max(18, w * 0.055)) ctx.fillRect(px, 0, 1, Y(62));
    // baseboard
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, Y(60), w, Y(2));

    // ---- jendela / properti dinding ----
    if (loc === 'gallery') {
      for (let i = 0; i < 3; i++) {
        const fx = X(7 + i * 16);
        const fy = Y(11);
        const fw = X(10);
        const fh = Y(23);
        ctx.fillStyle = '#15141a';
        ctx.fillRect(fx - 2, fy - 2, fw + 4, fh + 4);
        ctx.fillStyle = i === 0 ? '#3a4155' : i === 1 ? '#4b3345' : '#33474a';
        ctx.fillRect(fx, fy, fw, fh);
        ctx.fillStyle = pal.accent;
        ctx.globalAlpha = 0.55;
        if (i === 0) ctx.fillRect(fx + 6, fy + 8, fw * 0.5, fh * 0.35);
        if (i === 1) ctx.beginPath(), ctx.arc(fx + fw * 0.55, fy + fh * 0.45, fw * 0.24, 0, Math.PI * 2), ctx.fill();
        if (i === 2) ctx.fillRect(fx + fw * 0.25, fy + fh * 0.2, fw * 0.18, fh * 0.6);
        ctx.globalAlpha = 1;
      }
    } else {
      const wide = loc === 'penthouse';
      const wx = X(4);
      const wy = Y(8);
      const ww = X(wide ? 56 : 34);
      const wh = Y(32);
      const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
      sky.addColorStop(0, '#070b16');
      sky.addColorStop(0.6, '#101a33');
      sky.addColorStop(1, '#1c2a4c');
      ctx.fillStyle = sky;
      ctx.fillRect(wx, wy, ww, wh);
      // bulan
      ctx.fillStyle = 'rgba(230,236,255,0.75)';
      ctx.beginPath();
      ctx.arc(wx + ww * 0.78, wy + wh * 0.22, Math.min(9, ww * 0.045), 0, Math.PI * 2);
      ctx.fill();
      // skyline
      const cols = wide ? 16 : 10;
      for (let i = 0; i < cols; i++) {
        const bw = ww / cols;
        const bh = wh * (0.22 + ((i * 37) % 45) / 100);
        const bx = wx + i * bw;
        const by = wy + wh - bh;
        ctx.fillStyle = '#0a1120';
        ctx.fillRect(bx + 1, by, bw - 2, bh);
        ctx.fillStyle = 'rgba(255,206,120,0.55)';
        for (let wyy = by + 4; wyy < wy + wh - 2; wyy += 6) {
          for (let wxx = bx + 3; wxx < bx + bw - 3; wxx += 5) {
            if (((wxx + wyy + i) | 0) % 4 === 0) ctx.fillRect(wxx, wyy, 1.6, 2);
          }
        }
      }
      // frame jendela
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(wx, wy, ww, wh);
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy);
      ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.stroke();
    }

    // neon sign
    const sign = scene?.info.sign ?? 'OPEN';
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '700 13px sans-serif';
    ctx.shadowColor = pal.accent;
    ctx.shadowBlur = 14;
    ctx.fillStyle = pal.accent;
    ctx.fillText(sign, w - 10, Y(16));
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(w - 12 - ctx.measureText(sign).width, Y(20), ctx.measureText(sign).width, 1.5);
    ctx.globalAlpha = 1;
    ctx.restore();

    // lampu gantung + glow
    for (const lx of [18, 50, 82]) {
      const px = X(lx);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, Y(7));
      ctx.stroke();
      ctx.fillStyle = '#1a1a22';
      ctx.beginPath();
      ctx.moveTo(px - 7, Y(9));
      ctx.lineTo(px + 7, Y(9));
      ctx.lineTo(px + 4, Y(6));
      ctx.lineTo(px - 4, Y(6));
      ctx.closePath();
      ctx.fill();
      const glow = ctx.createRadialGradient(px, Y(12), 2, px, Y(12), Math.max(34, w * 0.1));
      glow.addColorStop(0, pal.glow);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(px - w * 0.12, Y(8), w * 0.24, Y(30));
    }

    // ---- lantai ----
    const floorY = Y(62);
    const floor = ctx.createLinearGradient(0, floorY, 0, H_MAP);
    floor.addColorStop(0, pal.floor);
    floor.addColorStop(1, '#080b12');
    ctx.fillStyle = floor;
    ctx.fillRect(0, floorY, w, H_MAP - floorY);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const yy = floorY + (H_MAP - floorY) * (i / 5);
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy);
      ctx.stroke();
    }

    // ---- properti venue ----
    if (loc === 'garage') {
      ctx.fillStyle = '#121923';
      ctx.fillRect(X(4), Y(24), X(38), Y(34));
      ctx.strokeStyle = 'rgba(120,180,230,0.12)';
      for (let i = 1; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(X(4), Y(24 + i * 4.5));
        ctx.lineTo(X(42), Y(24 + i * 4.5));
        ctx.stroke();
      }
      // papan alat
      ctx.fillStyle = '#1b2530';
      ctx.fillRect(X(58), Y(20), X(30), Y(18));
      ctx.strokeStyle = '#6fd0ff';
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(X(62 + i * 5), Y(23));
        ctx.lineTo(X(62 + i * 5), Y(34));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (loc === 'home') {
      // sofa + TV
      ctx.fillStyle = '#3d3028';
      roundRect(ctx, X(5), Y(52), X(36), Y(10), 4);
      ctx.fill();
      ctx.fillStyle = '#4b3b31';
      roundRect(ctx, X(5), Y(50), X(36), Y(6), 3);
      ctx.fill();
      ctx.fillStyle = '#0c1320';
      ctx.fillRect(X(60), Y(20), X(28), Y(18));
      ctx.strokeStyle = 'rgba(140,180,255,0.25)';
      ctx.strokeRect(X(60), Y(20), X(28), Y(18));
      ctx.fillStyle = 'rgba(120,170,255,0.15)';
      ctx.fillRect(X(62), Y(22), X(24), Y(14));
    }
    if (loc === 'gallery') {
      // bangku + spotlight
      ctx.fillStyle = '#3a3840';
      ctx.fillRect(X(8), Y(54), X(28), Y(4));
      ctx.fillRect(X(56), Y(54), X(28), Y(4));
      ctx.fillStyle = 'rgba(255,245,220,0.05)';
      for (const sx of [18, 40, 70]) {
        ctx.beginPath();
        ctx.moveTo(X(sx), Y(8));
        ctx.lineTo(X(sx - 8), Y(54));
        ctx.lineTo(X(sx + 8), Y(54));
        ctx.closePath();
        ctx.fill();
      }
    }

    // ---- staff (di belakang counter) ----
    if (staff) {
      const sx = X(STAFF_POS.x);
      const sy = Y(STAFF_POS.y);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 10, 10, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.accent;
      ctx.fillRect(sx - 5, sy - 8, 10, 15);
      ctx.fillStyle = '#f2d3b3';
      ctx.beginPath();
      ctx.arc(sx, sy - 12, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(staff.emoji, sx, sy - 24);
      ctx.font = '9px sans-serif';
      ctx.fillStyle = 'rgba(230,237,247,0.65)';
      ctx.fillText(`${staff.name} · ${staff.role}`, sx, sy + 4);
      indoorHitsRef.current.push({ kind: 'staff', id: staff.id, x: STAFF_POS.x, y: STAFF_POS.y, r: 6 });
    }

    // ---- counter / meja ----
    if (loc !== 'gallery') {
      const cy = Y(52);
      const counter = ctx.createLinearGradient(0, cy, 0, cy + Y(9));
      counter.addColorStop(0, pal.counter);
      counter.addColorStop(1, '#0c0f18');
      ctx.fillStyle = counter;
      roundRect(ctx, X(4), cy, X(66), Y(9), 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(X(4), cy, X(66), 1.5);
      // item di atas counter
      if (loc === 'cafe') {
        ctx.fillStyle = '#c9ccd6';
        ctx.fillRect(X(24), cy - 7, X(7), 7);
        ctx.fillStyle = '#8f95a6';
        ctx.fillRect(X(25), cy - 5, X(5), 3);
        ctx.fillStyle = '#e8e2d8';
        for (let i = 0; i < 4; i++) ctx.fillRect(X(38 + i * 3), cy - 4, X(1.4), 3);
      } else if (loc === 'penthouse') {
        ctx.fillStyle = 'rgba(160,120,255,0.5)';
        for (let i = 0; i < 7; i++) {
          const bx = X(12 + i * 7);
          ctx.fillRect(bx, cy - 6 - (i % 3), 2, 6 + (i % 3));
        }
      } else if (loc === 'garage') {
        ctx.fillStyle = '#3a4654';
        ctx.fillRect(X(20), cy - 4, X(16), 4);
        ctx.fillStyle = '#6fd0ff';
        ctx.fillRect(X(24), cy - 2, X(2), 2);
      } else {
        ctx.fillStyle = '#c9ccd6';
        ctx.beginPath();
        ctx.ellipse(X(30), cy - 3, 4, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ---- kerumunan ----
    crowd.slice(0, CROWD_SEATS.length).forEach((m) => {
      const seat = CROWD_SEATS[m.seat] ?? CROWD_SEATS[CROWD_SEATS.length - 1];
      const cx = X(seat.x);
      const baseY = Y(seat.y);
      const bob = Math.sin(time * 2 + m.seat * 1.7) * 0.7;
      const cy = baseY + bob;
      // stool
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 4, 6, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // badan
      ctx.fillStyle = BODY_COLOR[m.strategy] ?? '#4d8dff';
      ctx.fillRect(cx - 5, cy - 10, 10, 13);
      // kepala
      ctx.fillStyle = '#f2d3b3';
      ctx.beginPath();
      ctx.arc(cx, cy - 14, 4.2, 0, Math.PI * 2);
      ctx.fill();
      // emoji kecil
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(m.emoji, cx + 6, cy - 12);
      indoorHitsRef.current.push({ kind: 'crowd', id: m.id, x: seat.x, y: seat.y - 6, r: 4.4 });
    });

    // ---- NPC kenalan ----
    const n = named[0];
    if (n) {
      const cx = X(NAMED_SEAT.x);
      const cy = Y(NAMED_SEAT.y);
      // ring emas
      ctx.strokeStyle = 'rgba(255,210,120,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 5, 8, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = BODY_COLOR[n.strategy] ?? '#4d8dff';
      ctx.fillRect(cx - 5, cy - 10, 10, 14);
      ctx.fillStyle = '#f2d3b3';
      ctx.beginPath();
      ctx.arc(cx, cy - 14, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(n.emoji, cx, cy - 23);
      // name tag
      const label = n.name;
      ctx.font = '9px sans-serif';
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = 'rgba(12,16,26,0.9)';
      roundRect(ctx, cx - tw / 2, cy - 35, tw, 12, 3);
      ctx.fill();
      ctx.fillStyle = pal.accent;
      ctx.fillText(label, cx, cy - 29);
      indoorHitsRef.current.push({ kind: 'npc', id: n.id, x: NAMED_SEAT.x, y: NAMED_SEAT.y - 8, r: 5.5 });
    }

    // ---- chatter bubbles ----
    const maxBubbleW = Math.max(96, Math.min(150, w * 0.34));
    chatter.slice(0, 3).forEach((line, i) => {
      const member = crowd.find((m) => m.id === line.memberId);
      if (!member) return;
      const seat = CROWD_SEATS[member.seat];
      if (!seat) return;
      const bx = X(seat.x);
      const by = Y(seat.y) - 40 - i * 15;
      drawChatBubble(ctx, bx, by, line.emoji, line.text, line.tone, maxBubbleW, w);
    });

    // memori NPC kenalan (kalau ada) — tetap nyambung sama obrolan sebelumnya
    if (n) {
      const mem = lastNpcMemory(sim, n.id);
      if (mem) {
        drawChatBubble(ctx, X(NAMED_SEAT.x), Y(NAMED_SEAT.y) - 58, n.emoji, mem.text, 'think', maxBubbleW, w);
      }
    }

    // ---- pintu keluar ----
    const dx = X(88);
    const dy = Y(56);
    const dw = X(10);
    const dh = Y(30);
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(dx, dy, dw, dh);
    ctx.strokeStyle = pal.accent;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(dx + 1, dy + 1, dw - 2, dh - 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(70,220,160,0.75)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KELUAR', dx + dw / 2, dy - 6);
    ctx.beginPath();
    ctx.arc(dx + dw * 0.78, dy + dh * 0.52, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // keset glow
    ctx.fillStyle = 'rgba(70,220,160,0.08)';
    ctx.beginPath();
    ctx.ellipse(X(93), Y(88), 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    indoorHitsRef.current.push({ kind: 'exit', id: 'exit', x: 93, y: 72, r: 8 });

    // ---- debu / partikel hangat ----
    for (let i = 0; i < 14; i++) {
      const px = ((i * 73 + time * 3) % 100) / 100 * w;
      const py = Y(24 + ((i * 41) % 55));
      ctx.fillStyle = 'rgba(255,220,170,0.16)';
      ctx.fillRect(px, py + Math.sin(time + i) * 3, 1.2, 1.2);
    }

    // ---- avatar ----
    drawAvatar(ctx, X(posRef.current.x), Y(posRef.current.y), walking, time);

    // ---- label jumlah orang ----
    ctx.textAlign = 'left';
    ctx.font = '9px sans-serif';
    ctx.fillStyle = 'rgba(70,220,160,0.8)';
    ctx.beginPath();
    ctx.arc(X(5), Y(93), 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(210,220,235,0.7)';
    ctx.fillText(`${crowd.length + 1} orang di sini`, X(7.5), Y(93.6));
  }

  /** bubble chatter di canvas */
  function drawChatBubble(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    emoji: string,
    text: string,
    tone: ChatterLine['tone'],
    maxW: number,
    canvasW: number
  ) {
    const label = `${emoji} ${text}`;
    ctx.font = '9px sans-serif';
    let t = label;
    while (ctx.measureText(t).width > maxW - 12 && t.length > 6) t = t.slice(0, -1);
    if (t !== label) t = `${t.slice(0, Math.max(4, t.length - 1))}…`;
    const tw = Math.min(maxW, ctx.measureText(t).width + 12);
    const bx = Math.max(3, Math.min(cx - tw / 2, canvasW - tw - 3));
    const by = cy - 14;
    const toneColor =
      tone === 'joy' ? 'rgba(80,220,160,0.75)' : tone === 'sad' ? 'rgba(240,140,170,0.7)' : tone === 'think' ? 'rgba(140,170,230,0.65)' : 'rgba(160,175,200,0.55)';
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = 'rgba(8,12,20,0.94)';
    roundRect(ctx, bx, by, tw, 15, 3);
    ctx.fill();
    ctx.strokeStyle = toneColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    // ekor bubble
    ctx.beginPath();
    ctx.moveTo(Math.max(bx + 8, Math.min(cx - 2, bx + tw - 10)), by + 15);
    ctx.lineTo(Math.max(bx + 4, Math.min(cx + 2, bx + tw - 6)), by + 19);
    ctx.lineTo(Math.max(bx + 12, Math.min(cx + 6, bx + tw - 2)), by + 15);
    ctx.closePath();
    ctx.fillStyle = 'rgba(8,12,20,0.94)';
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#dbe4f3';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, bx + 6, by + 8);
  }

  function onPointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * 100;
    const cy = ((e.clientY - rect.top) / rect.height) * 100;

    // ---- di dalam venue: tap orang / staff / pintu / lantai ----
    if (interiorRef.current.scene) {
      let hitBest: IndoorHit | null = null;
      let hitD = Infinity;
      for (const hit of indoorHitsRef.current) {
        const d = Math.hypot(cx - hit.x, cy - hit.y);
        if (d <= hit.r && d < hitD) {
          hitBest = hit;
          hitD = d;
        }
      }
      if (hitBest) {
        if (hitBest.kind === 'exit') {
          targetRef.current = { x: 93, y: 88, id: locId, act: { type: 'exit' } };
        } else if (hitBest.kind === 'staff') {
          targetRef.current = { x: STAFF_POS.x, y: 74, id: locId, act: { type: 'staff' } };
        } else {
          targetRef.current = {
            x: Math.max(7, Math.min(87, hitBest.x)),
            y: 80,
            id: locId,
            act: { type: 'chat', botId: hitBest.id }
          };
        }
        return;
      }
      // tap lantai → jalan bebas di dalam
      if (cy < 69) return;
      targetRef.current = {
        x: Math.max(6, Math.min(88, cx)),
        y: Math.max(72, Math.min(94, cy)),
        id: locId
      };
      return;
    }

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
    if (!best) {
      // Phase 14: jalan bebas di kota — tap di tanah → target pergi ke sana
      if (insideBuilding(cx, cy) || cy > 68) return;
      targetRef.current = { x: cx, y: cy, id: locId };
      return;
    }

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
          <div className="hub-hint">
            {current.indoor ? 'Tap orang buat ngobrol · tap pintu buat keluar' : 'Tap pin atau tanah buat jalan ke lokasi'}
          </div>
        </div>
      </div>

      <VNDialog />
      <NpcChat />

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

      {interior && (
        <div className="panel venue-panel">
          <div className="panel-head">
            <span>✨ Suasana</span>
            <span className="badge accent">{interior.crowd.length + 1} orang</span>
          </div>
          <div className="panel-body venue-body">
            <div className="venue-vibe">“{interior.info.vibe}”</div>
            <div className="venue-actions">
              <button className="short" onClick={() => staffTalk(locId)}>
                {interior.info.staff.emoji} Ngobrol sama {interior.info.staff.name}
              </button>
              <button className="short" onClick={() => hubGoto('street')}>
                ↩ Keluar
              </button>
            </div>
            <div className="venue-chatter">
              {chatter.map((c) => (
                <div className="venue-chatter-line" key={`${c.memberId}-${c.text}`}>
                  <span className="venue-chatter-ico">{c.emoji}</span>
                  <div>
                    <b>{c.name}</b> <span>{c.text}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="tiny muted">Tap orang di canvas buat ngobrol · tap pintu buat keluar</div>
          </div>
        </div>
      )}

      <LifePanel />

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

      <QuestPanel />

      <RelationshipPanel />

      <MinigamePanel />

      <MetaPanel />

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
