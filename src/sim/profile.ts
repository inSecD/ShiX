import type { FeedPost, ProfileState, SimState } from './types';
import { parseMention } from './mentions';
import { clamp } from './events';

/** jeda minimal (tick) antar post pemain — 1 post / 3 jam */
export const POST_COOLDOWN = 3;

/** follower minimal sebelum post lo mulai gerakin hype koin (efek influencer) */
export const INFLUENCE_THRESHOLD = 500;

export function createProfile(): ProfileState {
  return { followers: 42, following: [], fame: 5, lastPostTick: -999, lifetimeLikes: 0, posts: 0 };
}

export function normalizeProfile(p: unknown): ProfileState {
  const x = p as Partial<ProfileState> | null | undefined;
  if (!x || typeof x !== 'object') return createProfile();
  const following = Array.isArray(x.following)
    ? x.following.filter((id): id is string => typeof id === 'string')
    : [];
  return {
    followers: Math.max(0, Math.round(Number(x.followers) || createProfile().followers)),
    following: [...new Set(following)],
    fame: clamp(Number(x.fame) || 0, 0, 100),
    lastPostTick: Number.isFinite(x.lastPostTick) ? (x.lastPostTick as number) : -999,
    lifetimeLikes: Math.max(0, Math.round(Number(x.lifetimeLikes) || 0)),
    posts: Math.max(0, Math.round(Number(x.posts) || 0))
  };
}

export function postCooldownLeft(state: SimState): number {
  return Math.max(0, POST_COOLDOWN - (state.ticks - state.profile.lastPostTick));
}

export function toggleFollow(state: SimState, botId: string): { ok: boolean; msg: string } {
  const bot = state.bots.find((b) => b.id === botId);
  if (!bot) return { ok: false, msg: 'Akun tidak ditemukan' };
  const list = state.profile.following;
  const i = list.indexOf(botId);
  if (i >= 0) {
    list.splice(i, 1);
    return { ok: true, msg: `Berhenti ikuti ${bot.name}` };
  }
  list.push(botId);
  // ngikutin → deket dikit (networking)
  state.social.friendship[botId] = Math.min(100, (state.social.friendship[botId] ?? 0) + 3);
  return { ok: true, msg: `Ikuti ${bot.name} · +3 pertemanan` };
}

// ---------- reaksi audiens ----------

interface ReactCtx {
  /** koin yang disebut post, kalo ada */
  tag: string | null;
  /** bot ini ikut pegang koin itu */
  botHolds: boolean;
  /** pemain pegang koin itu (publik sebagian — AI boleh tau pas disebut) */
  playerHolds: boolean;
}

type ReactionSet = { ctx: (c: ReactCtx) => string; generic: string };

/** persona AI — sama dengan vibe NPC: momentum ngikut arus, degen teriak, panic curiga */
const REACTIONS: Record<string, ReactionSet> = {
  momentum: {
    ctx: ({ tag, botHolds }) =>
      botHolds
        ? `Konfirmasi dari sisi gue juga — $${tag} udah gue pack dari tadi.`
        : `$${tag} arahnya jelas sih. Gue standby buy.`,
    generic: 'Chart-nya gue incer terus nih.'
  },
  contrarian: {
    ctx: ({ tag, playerHolds }) =>
      playerHolds
        ? `Post promosi $${tag} dari yang nyangkut... klasik. Gue mah netral.`
        : `Semua rame soal $${tag} justru tanda over. Hati-hati.`,
    generic: 'Yang rame belum tentu bener.'
  },
  degen: {
    ctx: ({ tag, botHolds, playerHolds }) =>
      botHolds || playerHolds
        ? `$${tag} GANG 🤝🔥 sama-sama pegang, GAS SAMPAI PAHAM!`
        : `$${tag}?? kasih CA-nya bang, gue masuk sekarang!!`,
    generic: 'Santai emang weekend, tapi chart tetep jalan 😎'
  },
  quant: {
    ctx: ({ tag }) => `$${tag} volume-profile-nya menarik. Gue catet.`,
    generic: 'Data aneh pekan ini. Gue diam dulu.'
  },
  whale: {
    ctx: ({ tag, botHolds }) =>
      botHolds ? `Udah gue akumulasi $${tag} pelan-pelan. Diem aja ya.` : `Ukuran segitu harus pelan. $${tag} noted.`,
    generic: 'Posisi gue mah jarang diumbar.'
  },
  panic: {
    ctx: ({ tag, playerHolds }) =>
      playerHolds
        ? `WK?! Lo nyangkut di $${tag}? Gue udah bilang jangan!!1!`
        : `Hati-hati!! $${tag} itu jebakan!! Serius!!`,
    generic: 'Jangan diapa-apain dulu. Serius.'
  }
};

function reactionFor(
  state: SimState,
  botId: string,
  ctx: ReactCtx
): { name: string; emoji: string; text: string } {
  const bot = state.bots.find((b) => b.id === botId)!;
  const set = REACTIONS[bot.strategy] ?? REACTIONS.quant;
  const text = ctx.tag || ctx.botHolds || ctx.playerHolds ? set.ctx(ctx) : set.generic;
  return { name: bot.name, emoji: bot.emoji, text };
}

// ---------- publish ----------

export interface PublishResult {
  ok: boolean;
  msg: string;
  likes?: number;
  mentionTag?: string | null;
}

export function publishPost(state: SimState, rawText: string): PublishResult {
  const text = rawText.trim();
  if (!text) return { ok: false, msg: 'Post kosong' };
  if (text.length > 180) return { ok: false, msg: 'Maksimal 180 karakter' };

  const wait = postCooldownLeft(state);
  if (wait > 0) return { ok: false, msg: `Boleh ngepost lagi ${wait} jam lagi` };

  const profile = state.profile;
  profile.lastPostTick = state.ticks;
  profile.posts += 1;

  // sistem ngerti maksud lo: ticker/nama/kelas + konteks posisi lo
  const mention = parseMention(state, text);
  const inst = mention ? state.instruments[mention.instId] : null;

  const heldIds = new Set<string>();
  for (const p of Object.values(state.positions)) if (p.qty > 0) heldIds.add(p.instId);
  for (const h of Object.values(state.spotHoldings)) if (h.qty > 0) heldIds.add(h.instId);

  // audiens bereaksi: 2-4 orang, ikut-ikutan yang follow & yang nyangkut koinnya
  const reactorPool = [...state.bots.map((b) => b.id)];
  const n = 2 + Math.floor(Math.random() * 3);
  const reactors: string[] = [];
  for (let i = 0; i < n && reactorPool.length; i++) {
    const idx = Math.floor(Math.random() * reactorPool.length);
    reactors.push(reactorPool.splice(idx, 1)[0]);
  }

  const reactions = reactors.map((botId) => {
    const bot = state.bots.find((b) => b.id === botId)!;
    const botHolds = !!inst && bot.holdings.some((h) => h.instId === inst.id && h.qty > 0);
    return reactionFor(state, botId, {
      tag: inst ? inst.id : null,
      botHolds,
      playerHolds: !!inst && heldIds.has(inst.id)
    });
  });

  // engagement: reach tumbuh sama follower; mention koin = post lebih "penting"
  const reach = 1 + profile.followers / 200;
  const mentionBoost = inst ? 1.6 : 1;
  const fameBoost = 0.7 + profile.fame / 100;
  const likes = Math.max(1, Math.round(reach * mentionBoost * fameBoost * (0.6 + Math.random() * 1.4) + reactions.length * 2));

  profile.lifetimeLikes += likes;
  profile.fame = clamp(profile.fame + likes / (25 + profile.followers / 8), 0, 100);

  // follower baru: makin terkenal makin cepat nambah; post yang "menyentuh" koin dapet bonus
  const gained = Math.max(0, Math.round((likes * (0.5 + profile.fame / 100) * (inst ? 1.4 : 1)) / 6 - profile.followers * 0.002));
  profile.followers += gained;

  // efek influencer: follower cukup → post lo ngangkat hype koin yang disebut (dibatasi)
  let hypeMsg = '';
  if (inst && profile.followers >= INFLUENCE_THRESHOLD) {
    const power = Math.min(1, profile.followers / 20_000);
    const bump = 0.04 + 0.12 * power;
    inst.hype = clamp(inst.hype + bump, 0, 1.8);
    hypeMsg = ` · $${inst.id} hype +${(bump * 100).toFixed(0)}%`;
  }

  // catat ke feed
  const feed = state.feed;
  feed.seq += 1;
  const post: FeedPost = {
    id: `fp${feed.seq}`,
    t: state.simTime,
    kind: 'you',
    authorId: 'you',
    name: 'Kamu',
    emoji: '😎',
    text,
    tag: inst ? inst.id : null,
    mention: inst ? inst.id : null,
    likes,
    reactions
  };
  feed.posts.unshift(post);
  if (feed.posts.length > 60) feed.posts.length = 60;

  const viaTxt = mention ? ` · sistem nangkep $${inst!.id} (${mention.via})` : '';
  return {
    ok: true,
    msg: `Post tayang · +${likes} likes · +${gained} followers${viaTxt}${hypeMsg}`,
    likes,
    mentionTag: inst ? inst.id : null
  };
}

// ---------- pertumbuhan harian ----------

/** passive follower growth tiap hari — akun yang aktif & terkenal tumbuh lebih cepat */
export function profileTick(state: SimState): void {
  const p = state.profile;
  if (state.ticks % 24 !== 0 || state.ticks === 0) return;
  const active = state.ticks - p.lastPostTick < 48;
  const growth = Math.round((p.fame / 30) * (active ? 1.6 : 0.5) * (0.5 + Math.random()));
  p.followers += Math.max(0, growth);
}
