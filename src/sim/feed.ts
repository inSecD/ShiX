import type { RNG } from './rng';
import type { Bot, BotStrategy, FeedPost, FeedState, SimState } from './types';

/** jeda minimal (tick) antar post, per jenis — biar feed nggak spam */
const COOLDOWN: Record<string, number> = {
  event: 6,
  mover: 8,
  hype: 10,
  rumor: 12
};

/** peluang feed ngepost di satu tick, kalau ada kandidat yang memenuhi syarat */
const POST_CHANCE = 0.4;

const MAX_POSTS = 60;

export function createFeed(): FeedState {
  return { posts: [], seq: 0, lastByKind: {}, lastEventId: null };
}

export function normalizeFeed(f: unknown): FeedState {
  const x = f as Partial<FeedState> | null | undefined;
  if (!x || typeof x !== 'object') return createFeed();

  const posts: FeedPost[] = [];
  if (Array.isArray(x.posts)) {
    for (const p of x.posts) {
      if (!p || typeof p !== 'object') continue;
      const post = p as Partial<FeedPost>;
      if (typeof post.id !== 'string' || typeof post.text !== 'string' || !post.text) continue;
      posts.push({
        id: post.id,
        t: Number(post.t) || 0,
        kind: typeof post.kind === 'string' ? post.kind : 'mover',
        authorId: typeof post.authorId === 'string' ? post.authorId : 'ct',
        name: typeof post.name === 'string' ? post.name : 'CT',
        emoji: typeof post.emoji === 'string' ? post.emoji : '🐦',
        text: post.text,
        tag: typeof post.tag === 'string' ? post.tag : null
      });
      if (posts.length >= MAX_POSTS) break;
    }
  }

  const lastByKind: Record<string, number> = {};
  if (x.lastByKind && typeof x.lastByKind === 'object') {
    for (const [k, v] of Object.entries(x.lastByKind)) {
      const n = Number(v);
      if (Number.isFinite(n)) lastByKind[k] = n;
    }
  }

  return {
    posts,
    seq: Number.isFinite(x.seq) ? (x.seq as number) : posts.length,
    lastByKind,
    lastEventId: typeof x.lastEventId === 'string' ? x.lastEventId : null
  };
}

function authorOf(state: SimState, rng: RNG, prefer?: BotStrategy): Bot {
  const bots = state.bots;
  if (prefer) {
    const match = bots.filter((b) => b.strategy === prefer);
    if (match.length) return rng.pick(match);
  }
  return rng.pick(bots);
}

function pushPost(state: SimState, post: Omit<FeedPost, 'id' | 't'>): void {
  const feed = state.feed;
  feed.seq += 1;
  feed.posts.unshift({ id: `fp${feed.seq}`, t: state.simTime, ...post });
  if (feed.posts.length > MAX_POSTS) feed.posts.length = MAX_POSTS;
  feed.lastByKind[post.kind] = state.ticks;
}

/** post dari pemain sendiri (dipanggil store pas beli aset/bisnis) */
export function feedFromYou(state: SimState, text: string, tag: string | null = null): void {
  pushPost(state, { kind: 'you', authorId: 'you', name: 'Kamu', emoji: '😎', text, tag });
}

// ---------- reaksi event ----------

const EVENT_TAKE: Record<BotStrategy, { up: string; down: string }> = {
  momentum: {
    up: 'Ikut arus. {title} — hijau mulai, gue masuk.',
    down: 'Tren ya tren. {title} jelas, jangan melawan arus.'
  },
  contrarian: {
    up: 'Semua euphoria? {title} keliatan kelewat panas. Gue ambil sisi kiri.',
    down: 'Semua panik justru enak. {title} diskon, gue beli.'
  },
  degen: {
    up: 'GAS!! {title}!!! 1000x CONFIRMED 🚀🚀',
    down: 'ini fine. *ngopi* {title} mah cuma koreksi. all in.'
  },
  quant: {
    up: 'Sesuai model. {title} → sinyal beli terkonfirmasi.',
    down: 'Model keluarin sinyal jual sejak {title}. Nothing personal.'
  },
  whale: {
    up: 'Udah gue antisipasi. {title} — posisi ditambah pelan-pelan.',
    down: 'Volatility = opportunity. {title} gue jalanin biasa aja.'
  },
  panic: {
    up: 'Jangan seneng dulu!! {title} itu jebakan! JEBAKAN!',
    down: 'GUE BILANG KAN!! {title} → semua ambruk! Semua!'
  }
};

function eventTake(state: SimState, rng: RNG): boolean {
  const ev = state.events[0];
  const feed = state.feed;
  if (!ev || ev.id === feed.lastEventId) return false;
  if (state.ticks - (feed.lastByKind['event'] ?? -999) < COOLDOWN['event']) return false;

  const bot = authorOf(state, rng);
  const takes = EVENT_TAKE[bot.strategy];
  const up = ev.impact >= 0;
  const title = ev.title.length > 54 ? ev.title.slice(0, 51) + '…' : ev.title;

  pushPost(state, {
    kind: 'event',
    authorId: bot.id,
    name: bot.name,
    emoji: bot.emoji,
    text: (up ? takes.up : takes.down).replace('{title}', title),
    tag: ev.tags[0] ?? null
  });
  feed.lastEventId = ev.id;
  return true;
}

// ---------- pelaku harga ----------

const MOVER_TAKE: Record<BotStrategy, (tag: string, pct: string, up: boolean) => string> = {
  momentum: (tag, pct, up) => `${tag} ${up ? '+' : ''}${pct}% dan pecah resistance. Gue ride.`,
  contrarian: (tag, pct, up) => `${tag} ${up ? '+' : ''}${pct}%? Kejauhan. Gue tunggu balik ke rata-rata.`,
  degen: (tag, pct, up) => `${tag} ${up ? '+' : ''}${pct}% 🚀🚀🚀 siapa yang belum masuk? GAS!!!`,
  quant: (tag, pct) => `Vol ${tag} ${pct}% keluar jalur distribusi normal. Menarik.`,
  whale: (tag, pct, up) => `Liquidity ${tag} ${up ? 'tipis ke atas' : 'dalam ke bawah'} (${pct}%). Bergerak pelan-pelan.`,
  panic: (tag, pct, up) => `${tag} ${up ? '+' : ''}${pct}%!! Itu pasti pump & dump!! AWAS!`
};

function moverTake(state: SimState, rng: RNG): boolean {
  const feed = state.feed;
  if (state.ticks - (feed.lastByKind['mover'] ?? -999) < COOLDOWN['mover']) return false;

  // cari pelaku terbesar hari ini (dibanding open)
  let best: { id: string; pct: number } | null = null;
  for (const id of state.order) {
    const inst = state.instruments[id];
    if (!inst || !inst.open) continue;
    const pct = ((inst.price - inst.open) / inst.open) * 100;
    if (!best || Math.abs(pct) > Math.abs(best.pct)) best = { id, pct };
  }
  if (!best || Math.abs(best.pct) < 2.5) return false;

  const inst = state.instruments[best.id];
  const up = best.pct >= 0;
  const pct = `${Math.abs(best.pct).toFixed(1)}`;
  const bot = authorOf(state, rng);

  pushPost(state, {
    kind: 'mover',
    authorId: bot.id,
    name: bot.name,
    emoji: bot.emoji,
    text: MOVER_TAKE[bot.strategy](inst.tag, pct, up),
    tag: inst.tag
  });
  return true;
}

// ---------- token hype (launchpad) ----------

const HYPE_TAKE = [
  '{tag} baru listing dan hype-nya gila-gilaan. Chart belum tidur semalam 🌙',
  'Anak-anak pada rame di {tag}. Volume naik 10x sejak tadi malam.',
  '{tag} lagi dibahas di mana-mana. FOMO-nya kerasa banget.',
  'Gue cuma observasi: {tag} hype-nya level lain. Hati-hati ya.'
];

function hypeTake(state: SimState, rng: RNG): boolean {
  const feed = state.feed;
  if (state.ticks - (feed.lastByKind['hype'] ?? -999) < COOLDOWN['hype']) return false;

  // token yang masih di kurva / baru graduation, dengan hype tertinggi
  let bestId: string | null = null;
  let bestHype = 1.15;
  for (const id of state.order) {
    const inst = state.instruments[id];
    if (!inst?.launchId || inst.hype <= bestHype) continue;
    bestHype = inst.hype;
    bestId = id;
  }
  if (!bestId) return false;

  const inst = state.instruments[bestId];
  const bot = authorOf(state, rng, 'degen');

  pushPost(state, {
    kind: 'hype',
    authorId: bot.id,
    name: bot.name,
    emoji: bot.emoji,
    text: rng.pick(HYPE_TAKE).replace('{tag}', inst.tag),
    tag: inst.tag
  });
  return true;
}

// ---------- gema rumor ----------

const RUMOR_ECHO = [
  'ada yang ngomongin isu {topik} di sini-sini. gw diem aja dulu.',
  'denger-denger orang dalam lagi ngumpul bahas {topik}. take it with a grain of salt.',
  'forum lagi rame soal {topik}. belum ada konfirmasi sih.'
];

function rumorTake(state: SimState, rng: RNG): boolean {
  const feed = state.feed;
  const rumor = state.social.rumor;
  if (!rumor) return false;
  if (state.ticks - (feed.lastByKind['rumor'] ?? -999) < COOLDOWN['rumor']) return false;
  if (feed.lastEventId && rumor.evId === feed.lastEventId) return false;

  const parts = rumor.text.split(' ');
  const topik = parts.length > 4 ? parts.slice(1, 4).join(' ').replace(/[.,]/g, '') : 'pasar';
  const bot = authorOf(state, rng);

  pushPost(state, {
    kind: 'rumor',
    authorId: bot.id,
    name: bot.name,
    emoji: bot.emoji,
    text: rng.pick(RUMOR_ECHO).replace('{topik}', topik),
    tag: null
  });
  return true;
}

// ---------- tick feed ----------

export function feedTick(state: SimState, rng: RNG): void {
  if (!state.feed) return;
  if (rng.float(0, 1) > POST_CHANCE) return;

  // urutan bobot: event terbaru paling fresh, lalu mover, hype, rumor
  const kinds: [string, () => boolean, number][] = [
    ['event', () => eventTake(state, rng), 4],
    ['mover', () => moverTake(state, rng), 3],
    ['hype', () => hypeTake(state, rng), 2],
    ['rumor', () => rumorTake(state, rng), 2]
  ];

  // coba satu per satu sesuai bobot acak (pick weighted, kalau gagal lanjut ke kandidat berikutnya)
  const total = kinds.reduce((s, k) => s + k[2], 0);
  let roll = rng.float(0, total);
  for (const [, fn, w] of kinds) {
    roll -= w;
    if (roll > 0) continue;
    if (fn()) return;
  }
  // kalau yang kepilih gagal (cooldown / nggak ada kandidat), coba sisanya secara berurutan
  for (const [, fn] of kinds) {
    if (fn()) return;
  }
}
