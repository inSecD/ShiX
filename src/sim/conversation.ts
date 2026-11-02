import type {
  Bot,
  BotStrategy,
  ChatThread,
  ChatTurn,
  NpcMemoryEntry,
  PendingEvent,
  SimState
} from './types';
import { hashString, RNG } from './rng';
import { equity } from './engine';
import { friendshipOf, lastNpcMemory, rememberNpcEvent, rumorText, rumorTier } from './social';
import { perksOf } from './perks';
import { phaseOf, topMover, venueInfo, wibHour, type MarketMood } from './ambience';
import { LOCATION_BY_ID } from './hub';
import { fmtPct, fmtPrice, fmtUsd } from '../lib/format';

/**
 * NPC Conversation Engine v2 (Phase 14 v5).
 * - Percakapan multi-turn: pemain bisa pilih topik atau ngetik bebas.
 * - Jawaban dirakit dari fakta sim: market mover, portfolio bot, rumor,
 *   posisi pemain, jam WIB, venue, dan ingatan sebelumnya.
 * - Personality per strategi + lore 10 NPC kenalan, jadi tiap orang beda suara.
 * - Tanpa API eksternal: semua dihitung lokal & deterministik per giliran.
 */

export type TopicId =
  | 'market'
  | 'portfolio'
  | 'rumor'
  | 'advice'
  | 'self'
  | 'life'
  | 'player'
  | 'future'
  | 'joke'
  | 'greeting'
  | 'thanks'
  | 'bye'
  | 'instrument'
  | 'unknown';

export interface ChatTopic {
  id: TopicId;
  /** label pendek buat chip */
  label: string;
  /** pertanyaan yang dikirim saat chip dipilih */
  question: string;
  keywords: string[];
}

export const CHAT_TOPICS: ChatTopic[] = [
  {
    id: 'market',
    label: '📈 Pasar',
    question: 'Gimana kondisi pasar sekarang?',
    keywords: [
      'pasar', 'market', 'chart', 'harga', 'ihsg', 'saham', 'kripto', 'crypto',
      'bitcoin', 'btc', 'ethereum', 'eth', 'makro', 'inflasi', 'suku bunga',
      'volume', 'candle', 'bullish', 'bearish', 'tren', 'trend', 'naik', 'turun'
    ]
  },
  {
    id: 'portfolio',
    label: '💼 Portfolio lo',
    question: 'Portfolio lo gimana sekarang?',
    keywords: [
      'portfolio', 'porto', 'posisi', 'holding', 'pnl', 'profit', 'rugi', 'modal',
      'saldo', 'cash', 'aset', 'equity', 'all-in', 'all in'
    ]
  },
  {
    id: 'rumor',
    label: '🗣️ Rumor',
    question: 'Ada rumor apa yang lo denger?',
    keywords: ['rumor', 'gosip', 'kabar', 'denger', 'dengar', 'bocor', 'orang dalam', 'isu', 'bisik']
  },
  {
    id: 'advice',
    label: '🧭 Minta saran',
    question: 'Menurut lo gue harus gimana?',
    keywords: [
      'saran', 'masukan', 'menurut', 'rekomendasi', 'mending', 'harus', 'cocok',
      'entry', 'beli', 'jual', 'hold', 'cut loss', 'take profit', 'stop loss', 'setup'
    ]
  },
  {
    id: 'self',
    label: '🙋 Kenalan',
    question: 'Cerita dong soal lo.',
    keywords: [
      'siapa', 'kenalan', 'nama lo', 'nama kamu', 'asal', 'hobi', 'cerita', 'umur',
      'background', 'latar', 'kerja di', 'pengalaman'
    ]
  },
  {
    id: 'life',
    label: '☕ Hidup',
    question: 'Lagi capek, temenin ngobrol dong.',
    keywords: [
      'hidup', 'capek', 'lelah', 'tidur', 'ngantuk', 'kopi', 'makan', 'keluarga',
      'pacar', 'sendirian', 'susah', 'senang', 'bahagia', 'libur', 'kerja', 'stress',
      'stres', 'bosan'
    ]
  },
  {
    id: 'player',
    label: '📊 Posisi gue',
    question: 'Liat posisi gue dong.',
    keywords: [
      'posisi gue', 'portfolio gue', 'porto gue', 'equity gue', 'uang gue',
      'trading gue', 'trade gue', 'akun gue', 'saldo gue', 'rugi gue', 'profit gue',
      'modal gue', 'cash gue'
    ]
  },
  {
    id: 'future',
    label: '🔮 Prediksi',
    question: 'Prediksi besok gimana?',
    keywords: ['besok', 'prediksi', 'ramalan', 'outlook', 'minggu depan', 'bulan depan', 'bakal', 'prospek', 'ke depan']
  },
  {
    id: 'joke',
    label: '😄 Bercanda',
    question: 'Lelucon dong biar santai.',
    keywords: ['lucu', 'lelucon', 'bercanda', 'joke', 'ketawa', 'haha', 'lawak', 'garing']
  },
  {
    id: 'greeting',
    label: '👋 Sapaan',
    question: 'Halo, apa kabar?',
    keywords: ['hai', 'halo', 'hello', 'hi', 'pagi', 'siang', 'sore', 'malam', 'apa kabar', 'kabar']
  },
  {
    id: 'thanks',
    label: '🙏 Makasih',
    question: 'Makasih ya sarannya.',
    keywords: ['makasih', 'terima kasih', 'thanks', 'thank you', 'tengkyu', 'syukur']
  },
  {
    id: 'bye',
    label: '👋 Pamit',
    question: 'Oke, gue pamit dulu.',
    keywords: ['bye', 'dadah', 'pamit', 'cabut', 'sampai jumpa', 'duluan', 'selamat tinggal']
  }
];

const TOPIC_BY_ID: Record<string, ChatTopic> = {};
for (const t of CHAT_TOPICS) TOPIC_BY_ID[t.id] = t;

/** versi topik buat diucapin di dalam kalimat */
const SPEECH: Record<string, string> = {
  market: 'pasar',
  portfolio: 'portfolio lo',
  rumor: 'gosip',
  advice: 'saran',
  self: 'diri lo',
  life: 'hidup',
  player: 'posisi lo',
  future: 'prediksi',
  joke: 'lelucon',
  greeting: 'sapaan',
  thanks: 'terima kasih',
  bye: 'pamit',
  instrument: 'aset itu',
  unknown: 'itu'
};

function speechOf(topic: string | null | undefined): string {
  if (!topic) return 'obrolan';
  return SPEECH[topic] ?? 'obrolan';
}

/** cari instrumen yang disebut namanya di teks */
function findInstrument(state: SimState, text: string): { id: string; name: string; price: number; open: number } | null {
  const t = text.toLowerCase();
  for (const id of state.order) {
    const inst = state.instruments[id];
    if (!inst || !inst.name || inst.name.length < 2) continue;
    if (t.includes(inst.name.toLowerCase())) {
      return { id, name: inst.name, price: inst.price, open: inst.open };
    }
  }
  return null;
}

/** deteksi niat dari teks bebas — skor keyword, instrumen menang duluan */
export function detectTopic(state: SimState, raw: string): TopicId {
  const text = raw.toLowerCase().trim();
  if (!text) return 'unknown';

  const short = text.length <= 34;
  if (short) {
    for (const id of ['bye', 'thanks', 'greeting'] as const) {
      const def = TOPIC_BY_ID[id];
      if (def.keywords.some((k) => text === k || text.startsWith(`${k} `) || text.endsWith(` ${k}`))) return id;
    }
  }
  if (findInstrument(state, text)) return 'instrument';

  let best: TopicId = 'unknown';
  let bestScore = 0;
  for (const def of CHAT_TOPICS) {
    let score = 0;
    for (const kw of def.keywords) {
      if (!text.includes(kw)) continue;
      score += kw.includes(' ') ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = def.id;
    }
  }
  return bestScore > 0 ? best : 'unknown';
}

export interface ChatSuggestion {
  id: TopicId;
  label: string;
  text: string;
}

function suggestion(id: TopicId): ChatSuggestion {
  const def = TOPIC_BY_ID[id];
  return { id, label: def.label, text: def.question };
}

/** chip topik yang relevan sama kondisi sekarang */
export function chatSuggestions(state: SimState, botId: string): ChatSuggestion[] {
  const thread = state.social.threads?.[botId];
  const bot = state.bots.find((b) => b.id === botId);
  const pos = Object.values(state.positions).filter((p) => p.qty > 0).length;
  const tier = rumorTier(friendshipOf(state.social, botId));
  const playerTurns = thread ? thread.turns.filter((t) => t.role === 'player').length : 0;

  const extras: TopicId[] = ['advice', 'future', 'life', 'joke'];
  if (state.social.rumor || (state.pendingEvent && tier > 0)) extras.push('rumor');
  if (pos > 0) extras.push('player');
  if (playerTurns < 2 || friendshipOf(state.social, botId) < 20) extras.push('self');
  if (bot?.strategy === 'degen' || bot?.strategy === 'panic') extras.push('joke');

  const rng = new RNG(hashString(`${botId}:${state.ticks}:${thread?.turns.length ?? 0}`));
  const picked: TopicId[] = ['market', 'portfolio'];
  for (const id of rng.shuffle(extras)) {
    if (picked.length >= 5) break;
    if (!picked.includes(id)) picked.push(id);
  }
  return picked.map(suggestion);
}

/** benang percakapan yang udah ada (atau undefined) */
export function threadOf(state: SimState, botId: string): ChatThread | undefined {
  return state.social.threads?.[botId];
}

function ensureThread(state: SimState, botId: string): ChatThread {
  if (!state.social.threads) state.social.threads = {};
  let thread = state.social.threads[botId];
  if (!thread) {
    thread = { botId, turns: [], lastTopic: null, lastAt: state.simTime, gains: 0 };
    state.social.threads[botId] = thread;
  }
  return thread;
}

function trimThread(thread: ChatThread): void {
  if (thread.turns.length > 24) thread.turns = thread.turns.slice(-24);
}

function pushTurn(thread: ChatThread, turn: ChatTurn): void {
  thread.turns.push(turn);
  trimThread(thread);
  thread.lastAt = turn.t;
}

/** buka sesi baru: reset jatah gain, lalu masukin sapaan NPC */
export function openChatThread(state: SimState, botId: string, lines: string[]): ChatThread {
  const thread = ensureThread(state, botId);
  thread.gains = 0;
  const clean = lines
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0)
    .slice(0, 4);
  for (const text of clean) {
    pushTurn(thread, { role: 'npc', text: text.slice(0, 220), t: state.simTime, tone: 'plain' });
  }
  return thread;
}

/** catat pesan pemain; topik bisa dipaksa dari chip */
export function appendPlayerTurn(state: SimState, botId: string, text: string, forcedTopic?: string): ChatTurn {
  const thread = ensureThread(state, botId);
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 180);
  const topic = forcedTopic ?? detectTopic(state, clean);
  const turn: ChatTurn = { role: 'player', text: clean, t: state.simTime, topic };
  pushTurn(thread, turn);
  return turn;
}

interface Facts {
  bot: Bot;
  name: string;
  strategy: BotStrategy;
  pnl: number;
  cashPct: number;
  holdings: string[];
  regime: string;
  hype: number;
  mood: MarketMood | null;
  locId: string;
  venue: string;
  phase: string;
  hour: number;
  friendship: number;
  tier: number;
  rumor: SimState['social']['rumor'];
  pending: PendingEvent | null;
  playerEquity: number;
  playerPos: number;
  lastFill: SimState['fills'][number] | null;
  memory: NpcMemoryEntry | null;
  thread: ChatThread;
}

function factsOf(state: SimState, bot: Bot): Facts {
  const social = state.social;
  const friendship = friendshipOf(social, bot.id);
  const locId = state.hub.locId;
  const holdings = bot.holdings
    .map((h) => state.instruments[h.instId]?.name ?? h.instId)
    .filter(Boolean)
    .slice(0, 3);
  const pos =
    Object.values(state.positions).filter((p) => p.qty > 0).length +
    Object.values(state.spotHoldings).filter((h) => h.qty > 0).length;
  const lastFill = state.fills[state.fills.length - 1] ?? null;
  const freshFill = lastFill && state.simTime - lastFill.t <= 24 * 3_600_000 ? lastFill : null;
  return {
    bot,
    name: bot.name,
    strategy: bot.strategy,
    pnl: bot.pnlPct,
    cashPct: bot.equity > 0 ? Math.round((bot.cash / bot.equity) * 100) : 100,
    holdings,
    regime: state.macro.regime,
    hype: state.hypeIndex,
    mood: topMover(state),
    locId,
    venue: LOCATION_BY_ID[locId]?.name ?? venueInfo(locId)?.sign ?? 'kota',
    phase: phaseOf(state.simTime),
    hour: wibHour(state.simTime),
    friendship,
    tier: Math.min(3, rumorTier(friendship) + perksOf(state).rumorTierBonus),
    rumor: social.rumor,
    pending: state.pendingEvent,
    playerEquity: equity(state),
    playerPos: pos,
    lastFill: freshFill,
    memory: lastNpcMemory(state, bot.id),
    thread: ensureThread(state, bot.id)
  };
}

/** sapaan kecil sesuai jam */
function timeGreeting(f: Facts): string {
  if (f.hour < 5) return 'Subuh-subuh masih bangun?';
  if (f.hour < 11) return 'Pagi. Baru mulai?';
  if (f.hour < 15) return 'Siang. Panas di luar.';
  if (f.hour < 19) return 'Sore. Pas buat ngobrol.';
  return 'Malam. Pasar udah tipis.';
}

const HOOK: Record<BotStrategy, string[]> = {
  momentum: [
    'Lo sendiri udah entry, atau masih nunggu breakout?',
    'Lo lebih nyaman ikut arus atau nunggu pullback?',
    'Menurut lo, momentum ini masih ada tenaganya?',
    'Lo udah pasang rencana keluar, belum?'
  ],
  contrarian: [
    'Lo tim ikut arus, atau cari pembalikan?',
    'Kalo semua orang setuju, lo berani ambil sisi lain?',
    'Lo pernah ngerasa sendirian di posisi yang bener?',
    'Lo lebih takut ketinggalan atau takut nyangkut?'
  ],
  degen: [
    'Lo berani all-in nggak? Jujur.',
    'Ada koin baru yang lo pantau?',
    'Lo tipe yang Averaging down atau cut loss?',
    'Modal lo masih utuh, kan?'
  ],
  quant: [
    'Lo mau gue jabarin angka yang mana?',
    'Lo udah tentuin invalidasi sebelum entry?',
    'Lo percaya data atau feeling?',
    'Ukuran posisi lo udah sesuai risiko?'
  ],
  whale: [
    'Lo punya rencana keluar, atau cuma berharap?',
    'Lo lebih takut rugi atau takut kelihatan bodoh?',
    'Lo masuk pakai ukuran berapa?',
    'Lo sabar, atau cuma belum yakin?'
  ],
  panic: [
    'Lo yakin pasar aman? Gue nggak.',
    'Lo udah pasang stop loss, belum?',
    'Lo nggak deg-degan lihat chart kayak gini?',
    'Lo masih bisa tidur nyenyak?'
  ]
};

const STANCE: Record<BotStrategy, (m: MarketMood, f: Facts) => string> = {
  momentum: (m, f) =>
    m.dir === 'naik'
      ? `Selama struktur ${m.sym} belum rusak, gue masih ikut arah naik. ${f.hype > 60 ? 'Hype-nya tinggi, tapi gue nggak mau telat.' : 'Belum euforia, masih sehat.'}`
      : `Momentum ${m.sym} lagi berat. Gue nggak lawan arah, tapi gue juga nggak nambah.`,
  contrarian: (m, f) =>
    `Tapi justru karena semua orang lihat ${m.sym} ${m.dir}, gue mulai nyari alasan buat ambil sisi sebaliknya. ${f.hype > 65 ? 'Hype segini biasanya tanda akhir, bukan awal.' : 'Belum ekstrem, tapi menarik.'}`,
  degen: (m) =>
    `Gue udah nyemplung di ${m.sym} tadi. Kalau salah, ya nasi goreng seminggu. Kalau bener, traktir.`,
  quant: (_m, f) =>
    `Volatilitas naik. Conviction model gue cuma ${Math.round(38 + (f.hype % 27))}%, jadi posisi kecil. Spread dan volume belum konfirmasi.`,
  whale: (m) =>
    `Likuiditas ${m.sym} tipis. Gue lebih suka nunggu semua orang selesai panik, baru masuk pelan-pelan.`,
  panic: () =>
    `Gue udah pasang stop ketat. Tangan gue dingin. Tiap kali chart kayak gini, gue inget dua kali liquidation.`
};

const CASH_COMMENT: Record<BotStrategy, string> = {
  momentum: 'Gue sisain cash buat nambah kalo breakout lanjut.',
  contrarian: 'Cash gede biar bisa masuk pas orang lain nyerah.',
  degen: 'Cash cuma numpang lewat. Biasanya habis di koin baru.',
  quant: 'Cash itu optionality. Model gue nggak maksa harus selalu full.',
  whale: 'Dry powder gue banyak. Gue milih sabar.',
  panic: 'Cash gue lebih banyak dari biasanya. Itu keputusan terbaik minggu ini.'
};

const ADVICE: Record<BotStrategy, string> = {
  momentum: 'Jangan kejar candle yang udah panjang. Tunggu pullback ke area struktur, baru masuk dengan stop di bawah low.',
  contrarian: 'Kalo semua orang udah satu sisi, cari tanda kelelahan. Tapi jangan lawan arus tanpa invalidasi yang jelas.',
  degen: 'Kalo mau degen, pakai uang yang lo rela ilang. Jangan pernah pakai uang sewa atau uang makan.',
  quant: 'Tentukan invalidasi dulu, baru ukuran posisi. Jangan sebaliknya. Risiko per ide maksimal 1-2% equity.',
  whale: 'Masuk bertahap. Biar lo yang nunggu harga, bukan harga yang nunggu lo. Dan sisain cash.',
  panic: 'Kecilin posisi. Stop loss itu bukan tanda lemah, itu napas. Kalo nggak bisa tidur, posisi lo kegedean.'
};

const JOKES: Record<BotStrategy, string[]> = {
  momentum: [
    'Momentum itu kayak angin. Kalo telat, lo cuma dapet debu.',
    'Gue nggak pernah telat. Gue cuma datang pas harga udah naik.',
    'Trailing stop gue rapi. Sayangnya hati gue nggak bisa di-trail.'
  ],
  contrarian: [
    'Gue suka keramaian. Di situ gue bisa ngitung berapa orang yang salah.',
    'Kalo semua orang bilang beli, gue cek dompet. Biasanya di situ gue sadar.',
    'Gue kontrarian. Artinya gue sering bener, tapi telat sadar.'
  ],
  degen: [
    'Portfolio gue punya dua warna: hijau dan cerita.',
    'Gue pernah all-in shitcoin jam tiga pagi. Yang paling nyesek, ternyata bukan yang terakhir.',
    'Risk management gue itu: jangan sampai ketahuan ibu.'
  ],
  quant: [
    'Ada tiga jenis trader: yang bisa ngitung, yang nggak bisa ngitung, dan yang ngaku quant.',
    'Model gue akurat 60%. Sayangnya 40% sisanya yang bikin gue bangun tengah malam.',
    'Gue nggak percaya feeling. Kecuali feeling soal kopi.'
  ],
  whale: [
    'Gue nggak rugi. Gue cuma memberi likuiditas ke orang lain.',
    'Ukuran posisi gue bikin market bergerak. Kamu bikin market berkedip.',
    'Gue nggak panik. Gue cuma pindah dana ke tempat yang lebih tenang.'
  ],
  panic: [
    'Stop loss gue rapi. Sayangnya tangan gue nggak.',
    'Gue udah cut loss. Besoknya harga naik. Klasik.',
    'Gue trader jangka panjang. Panjangnya sekitar lima menit.'
  ]
};

const SELF_LORE: Record<string, string> = {
  bot_0: 'Gue Aria. Dulu gue kerja di tim riset, sekarang ngikutin momentum karena pasar lebih jujur dari spreadsheet.',
  bot_1: 'Gue Kai. Kontrarian sejak gue sadar keramaian sering salah. Kopi pahit, buku lama, chart sepi.',
  bot_2: 'Gue DegenBoy. Nama gue udah menjelaskan semuanya. 1000x atau 0, tapi sekarang gue coba napas dulu.',
  bot_3: 'Gue Quant-9. Latar statistik. Gue nggak percaya feeling, kecuali feeling soal kopi.',
  bot_4: 'Gue Whale 0x7f. Nggak perlu banyak cerita. Posisi gue yang bicara.',
  bot_5: 'Gue Panik Pete. Trader biasa, cuma jantung gue nggak pernah setuju sama strategi gue.',
  bot_6: 'Gue Nala. Mesin, jalan, dan chart. Kalo pasar bikin pusing, gue bawa motor.',
  bot_7: 'Gue Viktor. Gue beli seni dan data. Dua-duanya naik pelan, dua-duanya butuh kesabaran.',
  bot_8: 'Gue Moonkid. Gue percaya siklus. Bulan penuh, altcoin naik, besok gue bingung lagi.',
  bot_9: 'Gue Sinta. Kontrarian yang suka taman. Kalo semua orang panik, gue biasanya malah tenang.'
};

const CROWD_LORE: Record<BotStrategy, string> = {
  momentum: 'Gue mulai dari scalping waktu kuliah. Sekarang ikut tren aja, sambil berharap nggak telat.',
  contrarian: 'Gue nggak suka ikut keramaian. Biasanya gue masuk pas orang lain mulai keluar.',
  degen: 'Gue pernah all-in shitcoin jam tiga pagi. Nggak bangga, tapi cerita itu yang bikin gue dikenal.',
  quant: 'Latar gue statistik. Gue nggak percaya feeling, kecuali feeling soal kopi.',
  whale: 'Gue nggak suka ngomong soal angka. Yang penting posisi dan likuiditas.',
  panic: 'Gue trader biasa. Cuma jantung gue nggak pernah setuju sama apa yang gue klik.'
};

const VENUE_ACTIVITY: Record<string, string> = {
  cafe: 'gue biasanya ngopi sambil mantau layar',
  home: 'gue duduk di sofa, TV nyala tapi nggak ditonton',
  garage: 'gue bersihin kunci pas sambil dengerin radio',
  apartment: 'gue ngeliatin kota dari jendela',
  gallery: 'gue jalan pelan di antara lukisan',
  penthouse: 'gue di rooftop, musik rendah, kota di bawah',
  street: 'gue cuma duduk di pinggir jalan, nunggu pasar buka'
};

function cap(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

interface Reply {
  lines: string[];
  tone: 'plain' | 'joy' | 'sad' | 'think';
}

function marketReply(f: Facts, rng: RNG): Reply {
  const mood = f.mood;
  if (!mood) {
    return {
      lines: [
        rng.pick(['Pasar lagi adem. Belum ada mover yang layak dikejar.', 'Chart lagi datar. Kadang datar itu tanda badai.', 'Volume tipis. Gue lebih milih nunggu.']),
        `Regime ${f.regime.toLowerCase()}, hype ${Math.round(f.hype)}/100.`,
        rng.pick(['Lo lagi nyari entry, atau cuma nemenin gue ngopi?', 'Lo posisinya lagi berat ke mana?', 'Mau gue arahin ke sektor yang lagi rame?'])
      ],
      tone: 'think'
    };
  }
  const data = rng.pick([
    `${mood.sym} ${mood.dir} ${mood.pct} hari ini. Regime ${f.regime.toLowerCase()}, hype ${Math.round(f.hype)}/100.`,
    `Yang paling rame ${mood.sym}: ${mood.dir} ${mood.pct}. Makro lagi ${f.regime.toLowerCase()}.`,
    `Gue baru cek ${mood.sym}. ${cap(mood.dir)} ${mood.pct}, dan itu yang paling kentara hari ini.`
  ]);
  return { lines: [data, STANCE[f.strategy](mood, f), rng.pick(HOOK[f.strategy])], tone: mood.dir === 'naik' ? 'joy' : 'think' };
}

function portfolioReply(f: Facts, rng: RNG): Reply {
  const pnlLine =
    f.pnl >= 15
      ? rng.pick([
          `Portfolio gue ${fmtPct(f.pnl, 1)}. Lagi enak, tapi gue nggak mau berhenti waspada.`,
          `Gue ${fmtPct(f.pnl, 1)}. Jangan bilang siapa-siapa, nanti gue dikira jenius.`
        ])
      : f.pnl <= -15
        ? rng.pick([
            `Portfolio gue ${fmtPct(f.pnl, 1)}. Lagi berat. Gue fokus bertahan dulu.`,
            `Gue ${fmtPct(f.pnl, 1)}. Ini bukan koreksi lagi, ini ujian mental.`
          ])
        : rng.pick([
            `Portfolio gue ${fmtPct(f.pnl, 1)}. Masih di tengah, belum ada alasan buat gaya.`,
            `Gue ${fmtPct(f.pnl, 1)}. Datar-datar aja, yang penting nggak mati.`
          ]);
  const posLine = f.holdings.length
    ? rng.pick([
        `Posisi gue masih ${f.holdings.join(', ')}.`,
        `Gue pegang ${f.holdings.slice(0, 2).join(' & ')}. Sisanya cash.`
      ])
    : rng.pick(['Gue lagi kosong posisi. Cash itu juga posisi.', 'Belum ada posisi kebuka. Gue nunggu setup.']);
  return {
    lines: [pnlLine, posLine, `Cash ${f.cashPct}% dari equity. ${CASH_COMMENT[f.strategy]}`, rng.pick(HOOK[f.strategy])],
    tone: f.pnl >= 0 ? 'plain' : 'sad'
  };
}

function rumorReply(state: SimState, f: Facts, rng: RNG): Reply {
  if (f.rumor) {
    return {
      lines: [
        `Gosip yang lagi beredar: "${f.rumor.text}"`,
        f.tier >= 3
          ? 'Gue denger itu dari orang yang biasanya nggak salah. Tapi tetep, jangan all-in cuma karena gosip.'
          : 'Itu yang gue denger. Kebenarannya belum tentu.',
        'Lo udah ambil posisi, atau masih nunggu konfirmasi?'
      ],
      tone: 'think'
    };
  }
  if (f.tier <= 0) {
    return {
      lines: [
        'Gue belum cukup kenal lo buat bagi gosip.',
        'Ngobrol beberapa kali dulu. Baru gue buka yang lebih dalam.',
        'Bukan pelit. Cuma gosip itu mata uang, dan gue belum tahu harga lo.'
      ],
      tone: 'plain'
    };
  }
  if (f.pending && rng.chance(0.75)) {
    const text = rumorText(state, f.bot, f.pending, f.tier);
    state.social.rumor = { botId: f.bot.id, text, tier: f.tier, evId: f.pending.ev.id, at: state.simTime };
    rememberNpcEvent(state, f.bot.id, 'rumor', text);
    return {
      lines: [text, 'Jangan sebar dulu. Gue cuma bilang ke lo.', 'Lo mau main di arah itu?'],
      tone: 'think'
    };
  }
  return {
    lines: [
      'Belum ada gosip baru yang layak dipercaya. Pasar lagi nunggu katalis.',
      'Kadang nggak ada kabar itu juga kabar.',
      rng.pick(['Lo denger sesuatu?', 'Ada yang aneh di chart yang lo lihat?'])
    ],
    tone: 'plain'
  };
}

function adviceReply(f: Facts, rng: RNG): Reply {
  const posLine =
    f.playerPos > 0
      ? `Lo udah ${f.playerPos} posisi kebuka. Jangan nambah cuma karena takut ketinggalan.`
      : 'Lo masih cash heavy. Nggak apa-apa, nunggu setup itu gratis.';
  return {
    lines: [
      posLine,
      ADVICE[f.strategy],
      rng.pick([
        'Keputusan tetap punya lo. Gue cuma ngomong dari pengalaman.',
        'Ini bukan ajakan beli. Ini cara gue ngeliat risiko.',
        'Kalo ragu, kecilin ukuran. Ragu itu sinyal, bukan kelemahan.'
      ])
    ],
    tone: 'think'
  };
}

function selfReply(f: Facts, rng: RNG): Reply {
  const lore = SELF_LORE[f.bot.id] ?? CROWD_LORE[f.strategy];
  const activity = VENUE_ACTIVITY[f.locId] ?? 'gue cuma duduk, nunggu pasar buka';
  return {
    lines: [
      lore,
      `Sekarang gue di ${f.venue}, ${f.phase} gini ${activity}.`,
      rng.pick(['Lo sendiri gimana?', 'Lo udah lama trading?', 'Kenalin dong lo.'])
    ],
    tone: 'plain'
  };
}

function lifeReply(f: Facts, rng: RNG): Reply {
  const moodLine =
    f.pnl <= -12
      ? rng.pick([
          'Lagi agak capek. Chart merah bikin tidur nggak nyenyak.',
          'Jujur, minggu ini berat. Tapi gue masih di sini.',
          'Gue lagi mode bertahan. Bukan cuma di portfolio, di kepala juga.'
        ])
      : f.pnl >= 12
        ? rng.pick([
            'Lagi lumayan. Tapi gue tetap cek chart tiap sejam, kayak orang kurang kerjaan.',
            'Portfolio hijau bikin kopi terasa lebih enak. Bahaya, bisa bikin sombong.',
            'Lagi enak, tapi gue nggak mau lupa cara merasa biasa aja.'
          ])
        : rng.pick([
            'Biasa aja. Pasar datar, hidup juga datar. Kadang itu yang gue butuh.',
            'Lagi ngerasa kosong dikit. Bukan rugi, cuma lelah.',
            'Gue baik-baik aja. Cuma butuh ngobrol yang nggak bahas candle.'
          ]);
  const venueLine = `Di ${f.venue}, ${f.phase} gini ${VENUE_ACTIVITY[f.locId] ?? 'gue cuma duduk'}.`;
  return {
    lines: [moodLine, venueLine, rng.pick(['Lo gimana? Capek juga?', 'Lo bisa istirahat nggak minggu ini?', 'Lo lagi kejar apa, selain cuan?'])],
    tone: f.pnl >= 12 ? 'joy' : f.pnl <= -12 ? 'sad' : 'plain'
  };
}

function playerReply(state: SimState, f: Facts, rng: RNG): Reply {
  const base = `Equity lo ${fmtUsd(f.playerEquity, true)}. ${f.playerPos} posisi kebuka.`;
  if (!f.lastFill) {
    return {
      lines: [
        base,
        'Gue belum liat lo eksekusi hari ini. Masih ngintip, atau lagi nunggu?',
        rng.pick(['Kalo lo mau, gue bisa bantu baca setup.', 'Jangan buru-buru. Pasar besok masih ada.'])
      ],
      tone: 'plain'
    };
  }
  const fillName = state.instruments[f.lastFill.instId]?.name ?? f.lastFill.instId;
  const arah = f.lastFill.side === 'buy' ? 'beli' : 'jual';
  const pnl =
    f.lastFill.pnl > 0
      ? `Untung ${fmtUsd(f.lastFill.pnl, true)}.`
      : f.lastFill.pnl < 0
        ? `Minus ${fmtUsd(Math.abs(f.lastFill.pnl), true)}.`
        : 'Flat.';
  const reaction: Record<BotStrategy, string> = {
    momentum: 'Arah lo sejalan sama tren. Tapi jangan lupa trailing stop.',
    contrarian: 'Lo ambil sisi yang nggak rame. Gue suka. Semoga lo bener.',
    degen: 'Ukuran lo berani. Gue hormat, sekaligus khawatir.',
    quant: 'Semoga ukuran posisinya udah dihitung, bukan feeling.',
    whale: 'Kecil buat gue, gede buat lo. Pastikan lo bisa tidur.',
    panic: 'Gue udah deg-degan cuma denger ceritanya.'
  };
  return {
    lines: [base, `Gue liat lo ${arah} ${fillName} tadi. ${pnl}`, reaction[f.strategy]],
    tone: f.lastFill.pnl >= 0 ? 'joy' : 'sad'
  };
}

function futureReply(f: Facts, rng: RNG): Reply {
  const head =
    f.tier >= 3 && f.pending
      ? `Gue denger ${pendingTopicName(f.pending)} bakal gerak ${f.pending.impact >= 0 ? 'naik' : 'turun'}. Itu level gosip yang lumayan.`
      : f.tier >= 2 && f.pending
        ? `Ada katalis di ${pendingTopicName(f.pending)}. Arahnya condong ${f.pending.impact >= 0 ? 'naik' : 'turun'}, tapi belum pasti.`
        : f.tier >= 1 && f.pending
          ? 'Ada bisik-bisik soal katalis, tapi gue belum berani sebut arah.'
          : `Gue nggak punya kristal. Regime ${f.regime.toLowerCase()} biasanya bikin gerakan makin liar.`;
  const scenario =
    f.strategy === 'momentum'
      ? 'Skenario gue: selama tren nggak patah, lanjut. Kalo patah, gue keluar dulu, bukan nambah.'
      : f.strategy === 'contrarian'
        ? 'Skenario gue: kalo semua udah pesimis, cari tanda balik. Tapi tunggu konfirmasi, jangan tebak.'
        : f.strategy === 'degen'
          ? 'Skenario gue: dua-duanya bisa. Makanya gue kecilin size biar bisa ketawa kalo salah.'
          : f.strategy === 'quant'
            ? 'Skenario gue: dua arah dengan probabilitas mirip. Yang penting ukuran posisi, bukan prediksi.'
            : f.strategy === 'whale'
              ? 'Skenario gue: sabar. Yang panik duluan biasanya yang bayar.'
              : 'Skenario gue: siapin stop, siapin cash, terus jangan lihat chart tiap menit.';
  return {
    lines: [head, scenario, rng.pick(['Lo mau main aman atau cari upside?', 'Lo punya rencana B?', 'Jangan taruh semua di satu skenario.'])],
    tone: 'think'
  };
}

/** nama topik dari pending event tanpa perlu akses state (dipakai di futureReply) */
function pendingTopicName(p: PendingEvent): string {
  if (p.instId) return 'aset itu';
  if (p.sector) return `sektor ${p.sector}`;
  return 'pasar';
}function jokeReply(f: Facts, rng: RNG): Reply {
  return {
    lines: [rng.pick(JOKES[f.strategy]), rng.pick(['Cukup? Gue masih punya stok.', 'Jangan ketawa dulu, nanti pasar denger.', 'Itu bukan saran finansial, itu cuma pelampiasan.'])],
    tone: 'joy'
  };
}

function greetingReply(f: Facts, rng: RNG): Reply {
  return {
    lines: [
      `${timeGreeting(f)} ${f.name} di sini.`,
      rng.pick(['Mau ngobrolin apa?', 'Lagi mikirin apa?', 'Ada yang bisa gue bantu?']),
      f.friendship >= 40 ? 'Seneng lo masih mampir.' : 'Belum sering ngobrol, tapi gue terbuka.'
    ],
    tone: 'joy'
  };
}

function thanksReply(_f: Facts, rng: RNG): Reply {
  return {
    lines: [rng.pick(['Sama-sama.', 'Santai.', 'Nggak masalah.']), rng.pick(['Jangan lupa istirahat.', 'Kalo butuh temen ngobrol, gue di sini.', 'Semoga keputusan lo mulus.'])],
    tone: 'joy'
  };
}

function byeReply(_f: Facts, rng: RNG): Reply {
  return {
    lines: [rng.pick(['Oke, cabut.', 'Gas, hati-hati.', 'Sip, duluan.']), rng.pick(['Jangan lupa stop loss.', 'Cek chart secukupnya.', 'Sampai ketemu lagi.'])],
    tone: 'joy'
  };
}

function instrumentReply(state: SimState, f: Facts, text: string, rng: RNG): Reply {
  const inst = findInstrument(state, text);
  if (!inst) return marketReply(f, rng);
  const chg = inst.open > 0 ? ((inst.price - inst.open) / inst.open) * 100 : 0;
  const stance: Record<BotStrategy, string> = {
    momentum: 'Selama nggak break low hari ini, gue masih berat ke atas.',
    contrarian: 'Kalo semua udah bilang bagus, gue mulai cari alasan buat keluar.',
    degen: 'Gue sih udah masuk. Kecil, tapi deg-degan.',
    quant: 'Spread-nya masih wajar. Gue nunggu konfirmasi volume.',
    whale: 'Likuiditasnya cukup buat posisi gue. Buat lo? Tergantung ukuran.',
    panic: 'Gue baru cut di nama itu. Jangan tanya lagi, please.'
  };
  return {
    lines: [
      `${inst.name} sekarang ${fmtPrice(inst.price)}, ${chg >= 0 ? 'naik' : 'turun'} ${Math.abs(chg).toFixed(1).replace('.', ',')}% dari open.`,
      stance[f.strategy],
      rng.pick(['Lo lagi pegang, atau cuma ngincer entry?', 'Mau gue bantu baca level pentingnya?', 'Lo udah punya rencana keluar?'])
    ],
    tone: chg >= 0 ? 'joy' : 'think'
  };
}

function unknownReply(_f: Facts, text: string, rng: RNG): Reply {
  const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 56);
  return {
    lines: [
      rng.pick([`"${snippet}"... oke, gue denger.`, `Hmm, "${snippet}". Menarik.`, `Lo bilang "${snippet}". Gue catat.`]),
      'Gue belum yakin nangkep arahnya. Lo lagi nanya soal pasar, portfolio, rumor, atau cuma mau ngobrol?',
      rng.pick(['Coba pilih topik di bawah, biar gue nggak ngarang.', 'Kalo mau, tanya lebih spesifik. Gue jawab sebisanya.'])
    ],
    tone: 'think'
  };
}

function buildReply(state: SimState, f: Facts, topic: TopicId, text: string, rng: RNG): Reply {
  switch (topic) {
    case 'market':
      return marketReply(f, rng);
    case 'portfolio':
      return portfolioReply(f, rng);
    case 'rumor':
      return rumorReply(state, f, rng);
    case 'advice':
      return adviceReply(f, rng);
    case 'self':
      return selfReply(f, rng);
    case 'life':
      return lifeReply(f, rng);
    case 'player':
      return playerReply(state, f, rng);
    case 'future':
      return futureReply(f, rng);
    case 'joke':
      return jokeReply(f, rng);
    case 'greeting':
      return greetingReply(f, rng);
    case 'thanks':
      return thanksReply(f, rng);
    case 'bye':
      return byeReply(f, rng);
    case 'instrument':
      return instrumentReply(state, f, text, rng);
    default:
      return unknownReply(f, text, rng);
  }
}

export interface ChatReplyResult {
  lines: string[];
  tone: 'plain' | 'joy' | 'sad' | 'think';
  topic: TopicId;
  gain: number;
}

/**
 * NPC membalas pesan terakhir pemain.
 * - menyimpan giliran NPC + memori topik
 * - menaikkan friendship maksimal 3x per sesi
 * - konsisten dengan fakta sim saat itu
 */
export function replyToPlayer(state: SimState, botId: string, text: string, forcedTopic?: string): ChatReplyResult {
  const bot = state.bots.find((b) => b.id === botId);
  if (!bot) return { lines: ['...'], tone: 'plain', topic: 'unknown', gain: 0 };

  const thread = ensureThread(state, botId);
  const f = factsOf(state, bot);
  const topic = (forcedTopic ?? detectTopic(state, text)) as TopicId;
  const rng = new RNG(hashString(`${botId}:${state.ticks}:${text}:${thread.turns.length}`));

  const prevTopic = thread.lastTopic;
  const playerTurns = thread.turns.filter((t) => t.role === 'player').length;

  const reply = buildReply(state, f, topic, text, rng);
  const lines = [...reply.lines];

  // koherensi multi-turn: inget topik sebelumnya / sadar lo balik ke topik yang sama
  if (prevTopic && playerTurns >= 2) {
    if (prevTopic === topic && rng.chance(0.4)) {
      lines.unshift(rng.pick([`Lo balik lagi ke ${speechOf(topic)}. Berarti lo serius.`, `Kita udah bahas ${speechOf(topic)} tadi. Gue tambahin dikit.`]));
    } else if (prevTopic !== topic && rng.chance(0.3)) {
      lines.unshift(`Tadi lo nanya soal ${speechOf(prevTopic)}. Gue masih inget.`);
    }
  } else if (f.memory && f.memory.ev !== 'chat' && rng.chance(0.22)) {
    lines.unshift(`Ngomong-ngomong, gue masih inget ${f.memory.text.slice(0, 70)}.`);
  }

  // memori topik: catat saat topik berubah atau di awal sesi
  if (topic !== prevTopic || playerTurns <= 1) {
    rememberNpcEvent(state, botId, 'chat', `Lo nanya soal ${speechOf(topic)}`);
  }

  // friendship: maksimal +3 per sesi, anti-farming
  let gain = 0;
  if (thread.gains < 3 && f.friendship < 100) {
    gain = 1;
    thread.gains += 1;
    state.social.friendship[botId] = Math.min(100, f.friendship + 1);
  }

  for (const line of lines.slice(0, 4)) {
    pushTurn(thread, {
      role: 'npc',
      text: line.replace(/\s+/g, ' ').trim().slice(0, 220),
      t: state.simTime,
      tone: reply.tone,
      topic
    });
  }
  thread.lastTopic = topic;
  thread.lastAt = state.simTime;

  return { lines: lines.slice(0, 4), tone: reply.tone, topic, gain };
}
