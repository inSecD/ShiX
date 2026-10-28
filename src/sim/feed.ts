import type { RNG } from './rng';
import type { Bot, BotStrategy, FeedPost, FeedState, PostMedia, SimState } from './types';

/** jeda minimal (tick) antar post, per jenis — biar feed nggak spam */
const COOLDOWN: Record<string, number> = {
  event: 6,
  mover: 8,
  hype: 10,
  rumor: 12,
  chat: 5
};

/** peluang feed ngepost di satu tick, kalau ada kandidat yang memenuhi syarat */
const POST_CHANCE = 0.5;

const MAX_POSTS = 100;
export { MAX_POSTS };

export function createFeed(): FeedState {
  return { posts: [], seq: 0, lastByKind: {}, lastEventId: null };
}

function normalizeMedia(m: unknown): PostMedia | null {
  if (!m || typeof m !== 'object') return null;
  const x = m as Partial<PostMedia>;
  const seed = typeof x.seed === 'string' ? x.seed : '';
  if (x.kind === 'chart' && typeof x.instId === 'string') {
    return { kind: 'chart', instId: x.instId, seed };
  }
  if (x.kind === 'art') {
    return { kind: 'art', seed, emoji: typeof x.emoji === 'string' ? x.emoji : '🎨' };
  }
  return null;
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
        handle: typeof post.handle === 'string' ? post.handle : 'ct',
        text: post.text,
        tag: typeof post.tag === 'string' ? post.tag : null,
        mention: typeof post.mention === 'string' ? post.mention : null,
        likes: Math.max(0, Math.round(Number(post.likes) || 0)),
        reactions: Array.isArray(post.reactions)
          ? post.reactions
              .filter((r): r is NonNullable<typeof r> => !!r && typeof r.text === 'string')
              .slice(0, 6)
              .map((r) => ({
                name: typeof r.name === 'string' ? r.name : 'Trader',
                emoji: typeof r.emoji === 'string' ? r.emoji : '🤖',
                text: r.text
              }))
          : [],
        media: normalizeMedia(post.media),
        liked: !!post.liked,
        reposted: !!post.reposted,
        reposts: Math.max(0, Math.round(Number(post.reposts) || 0)),
        replies: Math.max(0, Math.round(Number(post.replies) || 0)),
        replyTo: typeof post.replyTo === 'string' ? post.replyTo : null
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

/** angka pseudo-random deterministik dari seed (biar engagement post stabil & testable) */
function pseudo(seed: number): number {
  let x = (Math.imul(seed ^ 0x9e3779b1, 0x85ebca6b) >>> 0) || 1;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296; // >>> 0 biar selalu positif (XOR JS itu signed)
}

type PostInput = Omit<FeedPost, 'id' | 't' | 'handle' | 'mention' | 'likes' | 'reactions' | 'media' | 'liked' | 'reposted' | 'reposts' | 'replies' | 'replyTo'> &
  Partial<Pick<FeedPost, 'handle' | 'mention' | 'likes' | 'media' | 'reposts' | 'replies' | 'replyTo'>>;

function pushPost(state: SimState, post: PostInput): void {
  const feed = state.feed;
  feed.seq += 1;

  // engagement dasar: makin banyak follower makin rame (deterministik per post)
  const author = post.authorId === 'you' ? null : state.bots.find((b) => b.id === post.authorId);
  const reach = author ? author.followers : (state.profile?.followers ?? 50);
  const likes =
    post.likes ?? 1 + Math.floor(pseudo(feed.seq * 31 + 7) * (2 + reach * 0.06));
  const reposts = post.reposts ?? Math.floor(pseudo(feed.seq * 91 + 5) * (1 + reach * 0.004));
  const replies = post.replies ?? Math.floor(pseudo(feed.seq * 57 + 13) * 8);

  feed.posts.unshift({
    id: `fp${feed.seq}`,
    t: state.simTime,
    handle: post.handle ?? (post.authorId === 'you' ? 'kamu' : author?.handle ?? 'ct'),
    mention: null,
    reactions: [],
    media: null,
    liked: false,
    reposted: false,
    replyTo: null,
    ...post,
    // engagement wajib terisi walau post lama/nggak nyediain
    likes: post.likes ?? likes,
    reposts: post.reposts ?? reposts,
    replies: post.replies ?? replies
  });
  if (feed.posts.length > MAX_POSTS) feed.posts.length = MAX_POSTS;
  feed.lastByKind[post.kind] = state.ticks;
}

/** post dari pemain sendiri (dipanggil store pas beli aset/bisnis) */
export function feedFromYou(state: SimState, text: string, tag: string | null = null): void {
  pushPost(state, { kind: 'you', authorId: 'you', name: 'Kamu', emoji: '😎', text, tag });
}

// ---------- interaksi pemain (ala X) ----------

export function toggleLike(state: SimState, postId: string): { ok: boolean; msg: string } {
  const post = state.feed.posts.find((p) => p.id === postId);
  if (!post) return { ok: false, msg: 'Post tidak ditemukan' };
  post.liked = !post.liked;
  post.likes = Math.max(0, post.likes + (post.liked ? 1 : -1));
  return { ok: true, msg: post.liked ? 'Disukai' : 'Batal suka' };
}

export function toggleRepost(state: SimState, postId: string): { ok: boolean; msg: string } {
  const post = state.feed.posts.find((p) => p.id === postId);
  if (!post) return { ok: false, msg: 'Post tidak ditemukan' };
  post.reposted = !post.reposted;
  post.reposts = Math.max(0, post.reposts + (post.reposted ? 1 : -1));
  return { ok: true, msg: post.reposted ? 'Di-repost' : 'Batal repost' };
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
    handle: bot.handle,
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
    handle: bot.handle,
    text: MOVER_TAKE[bot.strategy](inst.tag, pct, up),
    tag: inst.tag,
    media: { kind: 'chart', instId: inst.id, seed: `mv${feed.seq}` }
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
    handle: bot.handle,
    text: rng.pick(HYPE_TAKE).replace('{tag}', inst.tag),
    tag: inst.tag,
    media: rng.chance(0.6) ? { kind: 'chart', instId: inst.id, seed: `hy${feed.seq}` } : null
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
    handle: bot.handle,
    text: rng.pick(RUMOR_ECHO).replace('{topik}', topik),
    tag: null
  });
  return true;
}

// ---------- obrolan kerumun (biar feed kayak timeline beneran) ----------

const CHAT_TAKE = [
  'pagi-pagi udah buka chart. kopi dulu atau CL dulu ya ☕',
  'weekend enaknya ngapain, santai atau scalp? 🌴',
  'baru submit TP di {tag}. semoga kali ini beneran kena 🙏',
  'gaji masuk, 50% langsung ke {tag}. wish me luck 🙏',
  'kenapa {tag} diam aja hari ini, gerak dong 😴',
  'nyangkut di {tag} tapi tetep sabar. time in the market > timing 🧘',
  'catatan buat diri sendiri: jangan FOMO masuk di puncak. catet.',
  'hari ini market flat banget, adem ayem 😴',
  'siapa yang juga megang {tag}? angkat tangan 🙋',
  'DCA terus, stop overthinking. boring is good.',
  'market merah tapi hati tetap ijo 💚',
  'tumben volume sepi… waspada aja dulu',
  'naik turun itu biasa, yang penting risetnya matang 📚',
  'semangat buat yang lagi nyangkut, kita bareng-bareng 🤝',
  'baru aja jual separuh posisi, tidur nyenyak > cuan maksimal 😌',
  'jam 3 pagi masih ngeliatin chart. sehat nggak sih ini 😵‍💫'
];

function chatTake(state: SimState, rng: RNG): boolean {
  const feed = state.feed;
  if (state.ticks - (feed.lastByKind['chat'] ?? -999) < COOLDOWN['chat']) return false;

  // sebut koin acak yang lagi likuid, biar obrolan nyambung ke pasar
  const liquid = state.order.filter((id) => {
    const inst = state.instruments[id];
    return inst && inst.mcap > 5e8;
  });
  const tag = liquid.length ? state.instruments[rng.pick(liquid)].tag : null;
  const bot = authorOf(state, rng);
  const text = rng.pick(CHAT_TAKE).replace('{tag}', tag ?? 'market');

  // sesekali bawa media: gambar prosedural, kadang chart koin yang disebut
  let chartId: string | null = null;
  if (tag && rng.chance(0.25)) {
    chartId = state.order.find((id) => state.instruments[id]?.tag === tag) ?? null;
  }
  const media: PostMedia | null = chartId
    ? { kind: 'chart', instId: chartId, seed: `ch${feed.seq}` }
    : rng.chance(0.3)
      ? { kind: 'art', seed: `art${feed.seq}`, emoji: rng.pick(['☕', '🌆', '🌴', '📈', '💤', '🍜', '🎮', '🌙']) }
      : null;

  pushPost(state, {
    kind: 'chat',
    authorId: bot.id,
    name: bot.name,
    emoji: bot.emoji,
    handle: bot.handle,
    text,
    tag,
    media
  });
  return true;
}

// ---------- tick feed ----------

export function feedTick(state: SimState, rng: RNG): void {
  if (!state.feed) return;
  if (rng.float(0, 1) > POST_CHANCE) return;

  // urutan bobot: event terbaru paling fresh, lalu mover, hype, rumor, obrolan
  const kinds: [string, () => boolean, number][] = [
    ['event', () => eventTake(state, rng), 4],
    ['mover', () => moverTake(state, rng), 3],
    ['hype', () => hypeTake(state, rng), 2],
    ['rumor', () => rumorTake(state, rng), 2],
    ['chat', () => chatTake(state, rng), 4]
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
