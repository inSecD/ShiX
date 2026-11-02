import type { MediaOutletInstance, MediaState, SimState } from './types';

/**
 * Media & Influence (V3.5 pilar 1).
 * - Pemain bisa punya outlet media (blog, podcast, portal, TV, radio, newsletter).
 * - Media meningkatkan jangkauan CT Feed, fame, dan pengaruh narasi.
 * - Artikel/media bisa mempengaruhi hype koin & hype pasar.
 */

export const MEDIA_PUBLISH_COOLDOWN = 4;

export interface MediaOutletDef {
  id: string;
  name: string;
  icon: string;
  tier: number;
  price: number;
  upkeep: number;
  reach: number;
  credibility: number;
  desc: string;
}

export const MEDIA_OUTLETS: MediaOutletDef[] = [
  { id: 'blog', name: 'Blog Pribadi', icon: '📝', tier: 1, price: 5_000, upkeep: 5, reach: 2, credibility: 60, desc: 'Mulai dari nol. Tulis, posting, bangun audiens.' },
  { id: 'newsletter', name: 'Newsletter', icon: '📧', tier: 2, price: 30_000, upkeep: 18, reach: 4, credibility: 70, desc: 'Inbox langsung. Audiens yang paling setia.' },
  { id: 'podcast', name: 'Podcast', icon: '🎙️', tier: 2, price: 45_000, upkeep: 30, reach: 5, credibility: 65, desc: 'Suara lo didengar. Interview trader & analis.' },
  { id: 'radio', name: 'Radio', icon: '📻', tier: 2, price: 60_000, upkeep: 40, reach: 6, credibility: 60, desc: 'Suara di jalan. Audiens pasif tapi luas.' },
  { id: 'portal', name: 'Portal Berita', icon: '📰', tier: 3, price: 250_000, upkeep: 120, reach: 12, credibility: 75, desc: 'Newsroom kecil. Redaktur & jurnalis.' },
  { id: 'tv', name: 'TV Channel', icon: '📺', tier: 4, price: 1_200_000, upkeep: 600, reach: 30, credibility: 80, desc: 'Layar lebar. Jangkauan nasional.' }
];

export function mediaDef(id: string): MediaOutletDef | undefined {
  return MEDIA_OUTLETS.find((m) => m.id === id);
}

export function createMedia(): MediaState {
  return { owned: [], influence: 0, credibility: 50, lastPublishTick: -999, articles: 0, campaigns: [] };
}

export function normalizeMedia(m: unknown): MediaState {
  const x = m as Partial<MediaState> | null | undefined;
  if (!x || typeof x !== 'object') return createMedia();
  const owned: MediaOutletInstance[] = Array.isArray(x.owned)
    ? x.owned
        .filter((o) => o && typeof o.id === 'string' && mediaDef(o.id))
        .map((o) => ({ id: o.id, boughtAt: Number(o.boughtAt) || 0, level: Math.max(1, Math.floor(Number(o.level) || 1)) }))
    : [];
  return {
    owned,
    influence: Math.max(0, Math.min(100, Number(x.influence) || 0)),
    credibility: Math.max(0, Math.min(100, Number(x.credibility) || 50)),
    lastPublishTick: Number(x.lastPublishTick) || -999,
    articles: Math.max(0, Math.floor(Number(x.articles) || 0)),
    campaigns: Array.isArray(x.campaigns)
      ? x.campaigns
          .filter((c) => c && typeof c.assetId === 'string')
          .map((c) => ({ assetId: c.assetId, ticksLeft: Math.max(0, Math.floor(Number(c.ticksLeft) || 0)), strength: Math.max(0, Number(c.strength) || 0) }))
      : []
  };
}

/** total reach dari semua outlet yang dimiliki */
export function mediaReach(state: SimState): number {
  return state.media.owned.reduce((sum, o) => {
    const def = mediaDef(o.id);
    if (!def) return sum;
    return sum + def.reach * o.level;
  }, 0);
}

/** skor pengaruh media 0..100 (dipakai UI & efek) */
export function mediaInfluence(state: SimState): number {
  return state.media.influence;
}

export interface MediaResult {
  ok: boolean;
  msg: string;
}

export function buyMedia(state: SimState, outletId: string): MediaResult {
  const def = mediaDef(outletId);
  if (!def) return { ok: false, msg: 'Outlet nggak ketemu' };
  if (state.media.owned.some((o) => o.id === outletId)) {
    return { ok: false, msg: `Sudah punya ${def.name}` };
  }
  if (state.cash < def.price) {
    return { ok: false, msg: `Cash kurang · butuh $${def.price.toLocaleString('en-US')}` };
  }
  state.cash -= def.price;
  state.media.owned.push({ id: outletId, boughtAt: state.simTime, level: 1 });
  state.media.influence = Math.max(0, Math.min(100, state.media.influence + def.reach * 1.5));
  return { ok: true, msg: `Beli ${def.icon} ${def.name} · jangkauan +${def.reach}` };
}

export function upgradeMedia(state: SimState, outletId: string): MediaResult {
  const inst = state.media.owned.find((o) => o.id === outletId);
  const def = inst ? mediaDef(outletId) : undefined;
  if (!inst || !def) return { ok: false, msg: 'Outlet nggak dimiliki' };
  const cost = Math.round(def.price * 0.6 * inst.level);
  if (state.cash < cost) return { ok: false, msg: `Cash kurang · upgrade $${cost.toLocaleString('en-US')}` };
  state.cash -= cost;
  inst.level += 1;
  state.media.influence = Math.max(0, Math.min(100, state.media.influence + def.reach * 0.8));
  return { ok: true, msg: `${def.name} upgrade ke Lv.${inst.level} · jangkauan +${def.reach}` };
}

export function publishArticle(state: SimState, rawText: string, assetId?: string | null): MediaResult {
  const text = rawText.trim();
  if (!text) return { ok: false, msg: 'Artikel kosong' };
  if (text.length > 240) return { ok: false, msg: 'Maksimal 240 karakter' };
  if (state.media.owned.length === 0) return { ok: false, msg: 'Beli outlet dulu sebelum publish' };
  const wait = state.ticks - state.media.lastPublishTick;
  if (wait < MEDIA_PUBLISH_COOLDOWN) {
    return { ok: false, msg: `Boleh publish lagi ${MEDIA_PUBLISH_COOLDOWN - wait} jam lagi` };
  }

  const reach = mediaReach(state);
  const influence = state.media.influence;
  state.media.lastPublishTick = state.ticks;
  state.media.articles += 1;

  // efek ke profil pemain: jangkauan media → follower & fame
  const gainedFollowers = Math.max(1, Math.round(reach * (1 + influence / 100) * 1.5));
  const gainedFame = Math.min(5, Math.round(reach * 0.15));
  state.profile.followers += gainedFollowers;
  state.profile.fame = Math.max(0, Math.min(100, state.profile.fame + gainedFame));
  state.media.credibility = Math.max(0, Math.min(100, state.media.credibility + 1));

  // efek ke pasar: kalau sebut aset, hype koin naik; hype pasar ikut naik sedikit
  let hypeMsg = '';
  if (assetId && state.instruments[assetId]) {
    const inst = state.instruments[assetId];
    const bump = Math.min(0.18, 0.03 + reach * 0.004);
    inst.hype = Math.max(0, Math.min(1.8, inst.hype + bump));
    hypeMsg = ` · $${inst.id} hype +${(bump * 100).toFixed(0)}%`;
  }
  state.hypeIndex = Math.max(0, Math.min(100, state.hypeIndex + reach * 0.05));

  // catat ke CT Feed sebagai post media
  const feed = state.feed;
  feed.seq += 1;
  const post = {
    id: `mp${feed.seq}`,
    t: state.simTime,
    kind: 'hype' as const,
    authorId: 'media',
    name: 'Media Empire',
    emoji: '📰',
    handle: 'media',
    text: text.length > 120 ? `${text.slice(0, 117)}…` : text,
    tag: assetId ?? null,
    mention: assetId ?? null,
    likes: Math.max(5, Math.round(reach * 8)),
    reactions: [],
    media: null,
    liked: false,
    reposted: false,
    reposts: Math.floor(reach / 2),
    replies: Math.floor(reach * 1.5),
    replyTo: null
  };
  feed.posts.unshift(post);
  if (feed.posts.length > 80) feed.posts.length = 80;

  return {
    ok: true,
    msg: `Artikel tayang via ${state.media.owned.length} outlet · +${gainedFollowers} followers · +${gainedFame} fame${hypeMsg}`
  };
}

export function mediaCampaign(state: SimState, assetId: string, budget: number): MediaResult {
  if (state.media.owned.length === 0) return { ok: false, msg: 'Beli outlet dulu' };
  if (!state.instruments[assetId]) return { ok: false, msg: 'Aset tidak ditemukan' };
  if (budget <= 0) return { ok: false, msg: 'Budget harus > 0' };
  if (state.cash < budget) return { ok: false, msg: 'Cash kurang' };
  const reach = mediaReach(state);
  const strength = Math.min(0.25, 0.05 + reach * 0.003 + budget / 200_000);
  state.cash -= budget;
  state.media.campaigns.push({ assetId, ticksLeft: 12, strength });
  state.media.influence = Math.max(0, Math.min(100, state.media.influence + reach * 0.5));
  state.media.credibility = Math.max(0, Math.min(100, state.media.credibility + 0.5));
  return { ok: true, msg: `Kampanye ${state.instruments[assetId].name} · 12 jam · kekuatan ${(strength * 100).toFixed(0)}%` };
}

/** tick media: pengaruh tumbuh pasif, upkeep dipotong, kampanye jalan */
export function mediaTick(state: SimState): void {
  const m = state.media;
  if (m.owned.length === 0) return;
  const reach = mediaReach(state);
  m.influence = Math.max(0, Math.min(100, m.influence + reach * 0.02));
  m.credibility = Math.max(0, Math.min(100, m.credibility + 0.05));
  // kampanye
  const remaining: typeof m.campaigns = [];
  for (const c of m.campaigns) {
    const inst = state.instruments[c.assetId];
    if (inst) inst.hype = Math.max(0, Math.min(1.8, inst.hype + c.strength * 0.02));
    state.hypeIndex = Math.max(0, Math.min(100, state.hypeIndex + c.strength * 0.1));
    c.ticksLeft -= 1;
    if (c.ticksLeft > 0) remaining.push(c);
  }
  m.campaigns = remaining;
  // upkeep
  const upkeep = m.owned.reduce((s, o) => {
    const def = mediaDef(o.id);
    return s + (def ? def.upkeep * o.level : 0);
  }, 0);
  if (state.cash >= upkeep) {
    state.cash -= upkeep;
  } else {
    m.influence = Math.max(0, Math.min(100, m.influence - 0.5));
    m.credibility = Math.max(0, Math.min(100, m.credibility - 0.3));
  }
}
