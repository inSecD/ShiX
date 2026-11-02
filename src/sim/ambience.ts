import type { Bot, BotStrategy, SimState } from './types';
import { hashString, RNG } from './rng';
import { NPC_AT } from './social';

/**
 * Interior crowd & ambience (Phase 14 v4).
 * - Kerumunan diambil dari 300 bot yang beneran ada (punya strategi, P&L, holding).
 * - Deterministik per venue + hari: masuk lagi besok, orangnya beda.
 * - Chatter dibangun dari kondisi pasar, portofolio bot, rumor, dan jam WIB.
 */

export interface VenueStaff {
  id: string;
  name: string;
  emoji: string;
  role: string;
}

export interface VenueInfo {
  locId: string;
  /** label singkat buat neon / papan */
  sign: string;
  vibe: string;
  /** jumlah kerumunan (di luar NPC kenalan & staff) */
  crowd: number;
  staff: VenueStaff;
}

export const VENUE_INFO: Record<string, VenueInfo> = {
  cafe: {
    locId: 'cafe',
    sign: 'KAFE DEGEN',
    vibe: 'Hangat · aroma kopi · meja penuh orang bahas chart',
    crowd: 10,
    staff: { id: 'staff_cafe', name: 'Bima', emoji: '☕', role: 'barista' }
  },
  home: {
    locId: 'home',
    sign: 'RUMAH',
    vibe: 'Tenang · lampu kuning · televisi nyala pelan',
    crowd: 4,
    staff: { id: 'staff_home', name: 'Mbak Sari', emoji: '🍲', role: 'asisten rumah' }
  },
  garage: {
    locId: 'garage',
    sign: 'GARASI',
    vibe: 'Bau oli · radio lama · kunci pas berserakan',
    crowd: 5,
    staff: { id: 'staff_garage', name: 'Joko', emoji: '🔧', role: 'montir' }
  },
  apartment: {
    locId: 'apartment',
    sign: 'APARTEMEN',
    vibe: 'Dingin · kaca tinggi · kota berkedip di bawah',
    crowd: 5,
    staff: { id: 'staff_apartment', name: 'Pak Hans', emoji: '🛎️', role: 'concierge' }
  },
  gallery: {
    locId: 'gallery',
    sign: 'GALERI',
    vibe: 'Sunyi · lampu spot · langkah pelan di lantai kayu',
    crowd: 7,
    staff: { id: 'staff_gallery', name: 'Maya', emoji: '🖼️', role: 'kurator' }
  },
  bar: {
    locId: 'bar',
    sign: 'BAR MALAM',
    vibe: 'Redup · musik jazz · gelas berdenting',
    crowd: 9,
    staff: { id: 'staff_bar', name: 'Rizal', emoji: '🍸', role: 'bartender' }
  },
  kantor: {
    locId: 'kantor',
    sign: 'KANTOR',
    vibe: 'AC dingin · keyboard berketik · kopi di meja',
    crowd: 6,
    staff: { id: 'staff_kantor', name: 'Ibu Rina', emoji: '📋', role: 'sekretaris' }
  },
  klub: {
    locId: 'klub',
    sign: 'KLUB MALAM',
    vibe: 'Bass berat · lampu strobo · orang menari',
    crowd: 14,
    staff: { id: 'staff_klub', name: 'DJ Arka', emoji: '🎧', role: 'DJ' }
  },
  mal: {
    locId: 'mal',
    sign: 'MAL KOTA',
    vibe: 'Ramai · neon toko · eskalator berputar',
    crowd: 12,
    staff: { id: 'staff_mal', name: 'Mas Dodo', emoji: '🛍️', role: 'info desk' }
  },
  gym: {
    locId: 'gym',
    sign: 'GYM',
    vibe: 'Besi berdenting · keringat · cermin panjang',
    crowd: 8,
    staff: { id: 'staff_gym', name: 'Coach Dedi', emoji: '💪', role: 'trainer' }
  },
  restoran: {
    locId: 'restoran',
    sign: 'RESTORAN',
    vibe: 'Lampu lilin · aroma steak · percakapan pelan',
    crowd: 9,
    staff: { id: 'staff_restoran', name: 'Mbak Tari', emoji: '🍽️', role: 'pelayan' }
  },
  bank: {
    locId: 'bank',
    sign: 'BANK',
    vibe: 'Loket · antrian · brankas dingin',
    crowd: 7,
    staff: { id: 'staff_bank', name: 'Pak Andi', emoji: '🏦', role: 'teller' }
  },
  kantor_polisi: {
    locId: 'kantor_polisi',
    sign: 'POLISI',
    vibe: 'Berkas · radio · langkah tegas',
    crowd: 5,
    staff: { id: 'staff_polisi', name: 'Bripka Rudi', emoji: '🚓', role: 'petugas' }
  },
  rumah_sakit: {
    locId: 'rumah_sakit',
    sign: 'RUMAH SAKIT',
    vibe: 'Koridor putih · bau antiseptik · monitor berbunyi',
    crowd: 6,
    staff: { id: 'staff_rs', name: 'Perawat Lina', emoji: '🏥', role: 'perawat' }
  },
  sekolah: {
    locId: 'sekolah',
    sign: 'SEKOLAH',
    vibe: 'Kelas · papan tulis · bel berbunyi',
    crowd: 10,
    staff: { id: 'staff_sekolah', name: 'Bu Wati', emoji: '📚', role: 'guru' }
  },
  penthouse: {
    locId: 'penthouse',
    sign: 'PENTHOUSE',
    vibe: 'Neon · musik rendah · kota jadi peta bintang',
    crowd: 11,
    staff: { id: 'staff_penthouse', name: 'Rendra', emoji: '🍸', role: 'bartender' }
  }
};

export function venueInfo(locId: string): VenueInfo | null {
  return VENUE_INFO[locId] ?? null;
}

export interface CrowdMember {
  id: string;
  name: string;
  emoji: string;
  seat: number;
  strategy: BotStrategy;
  pnlPct: number;
  trades: number;
  holding: string | null;
}

export interface VenueScene {
  info: VenueInfo;
  crowd: CrowdMember[];
}

export interface ChatterLine {
  memberId: string;
  name: string;
  emoji: string;
  text: string;
  tone: 'plain' | 'joy' | 'sad' | 'think';
}

const HOUR = 3_600_000;

/** jam WIB (UTC+7) dari simTime */
export function wibHour(simTime: number): number {
  return new Date(simTime + 7 * HOUR).getUTCHours();
}

export function phaseOf(simTime: number): string {
  const h = wibHour(simTime);
  if (h < 5) return 'subuh';
  if (h < 11) return 'pagi';
  if (h < 15) return 'siang';
  if (h < 19) return 'sore';
  return 'malam';
}

export interface MarketMood {
  sym: string;
  chg: number;
  dir: 'naik' | 'turun';
  pct: string;
}

function fmtPct(chg: number): string {
  return `${(Math.abs(chg) * 100).toFixed(1).replace('.', ',')}%`;
}

/** instrumen dengan pergerakan harian paling gede */
export function topMover(state: SimState): MarketMood | null {
  let best: { sym: string; chg: number } | null = null;
  for (const id of state.order) {
    const inst = state.instruments[id];
    if (!inst || !inst.open) continue;
    const chg = (inst.price - inst.open) / inst.open;
    if (!Number.isFinite(chg)) continue;
    if (!best || Math.abs(chg) > Math.abs(best.chg)) best = { sym: inst.name, chg };
  }
  if (!best) return null;
  return {
    sym: best.sym,
    chg: best.chg,
    dir: best.chg >= 0 ? 'naik' : 'turun',
    pct: fmtPct(best.chg)
  };
}

/** topik rumor yang beredar (tanpa ngebocorin detail event) */
function rumorTopic(state: SimState): string | null {
  if (!state.social.rumor) return null;
  const p = state.pendingEvent;
  if (!p) return 'pasar';
  if (p.instId) return state.instruments[p.instId]?.name ?? 'pasar';
  if (p.sector) return `sektor ${p.sector}`;
  return 'pasar';
}

/** pilih kerumunan deterministik per venue + hari */
export function venueScene(state: SimState, locId: string): VenueScene | null {
  const info = venueInfo(locId);
  if (!info) return null;

  const day = Math.floor(state.simTime / 86_400_000);
  const seed = (hashString(locId) ^ (state.seed >>> 0) ^ Math.imul(day + 1, 0x9e3779b1)) >>> 0;
  const rng = new RNG(seed);

  const pool = state.bots.filter((b) => !Object.prototype.hasOwnProperty.call(NPC_AT, b.id));
  const picked: Bot[] = [];
  const used = new Set<number>();
  const want = Math.min(info.crowd, pool.length);
  let guard = 0;
  while (picked.length < want && guard < want * 40) {
    guard++;
    const i = rng.int(0, pool.length - 1);
    if (used.has(i)) continue;
    used.add(i);
    picked.push(pool[i]);
  }

  const crowd: CrowdMember[] = picked.map((b, i) => ({
    id: b.id,
    name: b.name,
    emoji: b.emoji,
    seat: i,
    strategy: b.strategy,
    pnlPct: b.pnlPct,
    trades: b.trades,
    holding: b.holdings[0]?.instId ?? null
  }));

  return { info, crowd };
}

const STRATEGY_LINES: Record<BotStrategy, string[]> = {
  momentum: [
    'Trend {sym} belum patah. Gue ikut arus aja.',
    '{sym} {dir} {pct}. Trailing stop gue udah rapi.',
    'Jangan dilawan, momentum {sym} masih kuat.',
    'Gue masuk pas breakout. Masih nyaman.'
  ],
  contrarian: [
    'Semua orang {dir} di {sym}. Gue malah cari sisi lain.',
    'Kalo semua udah setuju, biasanya udah telat.',
    '{sym} {dir} {pct}? Justru di situ gue mulai curiga.',
    'Keramaian itu tanda likuiditas, bukan kebenaran.'
  ],
  degen: [
    'GAS {sym}! {pct} doang mah pemanasan.',
    'Gue tadi all-in {sym}. Kalo rugi, nasi goreng seminggu.',
    'Ada koin baru? Kirim alamatnya, gue lagi apes.',
    '{sym} {dir} {pct}. Ini baru namanya hidup.'
  ],
  quant: [
    'Volatilitas {sym} naik. Model gue belum kasih sinyal jelas.',
    'Korelasi {sym} sama indeks lagi aneh. Hati-hati.',
    'Gue nggak feeling. Gue data. {sym} {dir} {pct}.',
    'Risiko ekor gemuk. Posisi kecil dulu.'
  ],
  whale: [
    'Ada akumulasi senyap di {sym}. Nggak usah ramai.',
    'Likuiditas tipis. Sekali sapu, harga lompat.',
    '{sym} {dir} {pct}. Sabar itu bagian dari strategi.',
    'Gue nggak buru-buru. Pasar selalu kasih pintu.'
  ],
  panic: [
    'Gue cut loss {sym} tadi. Darah di mana-mana.',
    'Jangan bilang gue panik. Gue cuma cepat sadar.',
    '{sym} {dir} {pct}... ini awal kehancuran.',
    'Gue udah pasang stop. Tapi tangan gue gemetar.'
  ]
};

const VENUE_LINES: Record<string, string[]> = {
  cafe: [
    'Kopi di sini enak, tapi chart-nya bikin asam lambung.',
    'Tadi ada yang narik profit gede di meja pojok.',
    'Barista-nya udah hafal pesanan gue: kopi hitam, stop loss.',
    'Wifi kafe ini lebih stabil daripada portfolio gue.'
  ],
  home: [
    'Rumah harusnya tempat istirahat. Tapi chart ikut pulang.',
    'Gue janji cuma buka satu posisi. Bohong.',
    'Lampu kamar masih nyala. Itu tanda chart belum ditutup.',
    'Sofa ini saksi bisu tiga kali liquidation.'
  ],
  garage: [
    'Mesin sehat, portfolio belum tentu.',
    'Tadi ada yang benerin motor sambil nunggu candle.',
    'Bensin naik, altcoin turun. Dunia memang adil.',
    'Kunci pas di sini lebih jujur daripada analyst.'
  ],
  apartment: [
    'Kota dari atas kelihatan tenang. Chart dari dekat bikin gila.',
    'Lift tadi penuh orang buru-buru ke bursa.',
    'Sewa naik tiap tahun. Gaji trading belum tentu.',
    'Jendela bagus buat ngeliatin orang panik dari ketinggian.'
  ],
  gallery: [
    'Karya di pojok katanya bakal naik. Gue sih suka warnanya.',
    'Harga seni naik pelan. Chart lo bisa turun cepat.',
    'Kurator bilang ini investasi rasa. Gue bilang ini mahal.',
    'Di sini semua orang ngomong pelan, takut ketahuan rugi.'
  ],
  penthouse: [
    'Rooftop penuh malam ini. Semua orang punya cerita cuan.',
    'Minuman di sini lebih mahal dari posisi gue.',
    'DJ-nya bagus. Chart-nya yang nggak enak didengar.',
    'Dari sini kota kelihatan kecil. Utang juga kecil. Bohong.'
  ],
  bar: [
    'Bartender-nya udah hafal pesanan gue: whisky, tanpa es, tanpa stop loss.',
    'Tadi ada yang curhat rugi di bar. Gue denger sambil pura-pura nggak.',
    'Musik jazz di sini bikin chart terasa jauh. Sebentar doang.',
    'Gelas kosong lebih jujur daripada analyst.'
  ],
  kantor: [
    'Meeting pagi soal target Q3. Chart kantor lebih rapi dari chart pasar.',
    'AC dingin bikin fokus, tapi kopi udah dingin juga.',
    'Ada yang bawa laptop sambil trading di bawah meja.',
    'Gue kerja di sini, tapi pikiran gue di bursa.'
  ],
  klub: [
    'Bass-nya bikin chart terasa jauh. Sebentar doang, katanya.',
    'Strobo nyala, semua orang menari. Besok pagi baru sadar.',
    'DJ-nya ganti track, portfolio gue juga ganti arah.',
    'Di sini nggak ada yang bahas candle. Untung.'
  ],
  mal: [
    'Eskalator berputar, portfolio gue juga berputar.',
    'Ada promo, semua orang belanja. Pasar nggak ada promo.',
    'Food court penuh, tapi gue cuma nongkrong sambil mantau HP.',
    'Mal ini lebih rame dari bursa pas jam makan siang.'
  ],
  gym: [
    'Besi berdenting. Chart juga berdenting, tapi beda bunyi.',
    'Tadi ada yang angkat beban sambil mantau HP. Dedikasi.',
    'Kardio bikin napas berat, tapi pikiran jadi ringan.',
    'Gue nggak tahu mana yang lebih berat: deadlift atau cut loss.'
  ],
  restoran: [
    'Steak-nya enak. Chart-nya nggak. Tapi sekarang gue nggak peduli.',
    'Meja pojok itu favorit gue. Bisa mantau HP tanpa ketahuan.',
    'Pelayan-nya udah hafal pesanan gue: air putih, tanpa es.',
    'Makan enak bikin portfolio terasa lebih kecil. Sementara.'
  ],
  bank: [
    'Antrian panjang. Pasar juga antrian, tapi nggak kelihatan.',
    'Teller-nya ramah. Beda sama market yang nggak pernah ramah.',
    'Brankas dingin. Gue lebih suka dingin chart yang naik.',
    'Gue ngurus administrasi. Boring, tapi perlu.'
  ],
  kantor_polisi: [
    'Radio berderak. Pasar juga berderak, tapi tanpa sirine.',
    'Berkas bertumpuk. Chart gue juga bertumpuk, tapi nggak rapi.',
    'Petugasnya tegas. Market nggak tegas, market licin.',
    'Gue lapor kehilangan. Bukan uang, tapi kesabaran.'
  ],
  rumah_sakit: [
    'Monitor berbunyi. Chart juga berbunyi, tapi beda nada.',
    'Bau antiseptik. Lebih enak dari bau rugi.',
    'Perawat-nya cepat. Market nggak pernah cepat pas gue butuh.',
    'Gue istirahat. Chart boleh istirahat juga.'
  ],
  sekolah: [
    'Bel berbunyi. Chart juga berbunyi, tapi nggak ada jam pulang.',
    'Papan tulis penuh rumus. Chart penuh angka, tapi nggak ada guru.',
    'Tawa di koridor. Pasar nggak pernah tawa.',
    'Gue belajar. Market juga belajar, tapi nggak pernah lulus.'
  ]
};

function clip(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** satu baris chatter untuk satu orang di venue */
function chatterFor(
  state: SimState,
  member: CrowdMember,
  locId: string,
  rng: RNG,
  mood: MarketMood | null,
  topic: string | null
): ChatterLine {
  const sym = mood?.sym ?? 'pasar';
  const dir = mood?.dir ?? 'gerak';
  const pct = mood?.pct ?? 'tipis';
  const venue = VENUE_LINES[locId] ?? VENUE_LINES.cafe;
  const own = STRATEGY_LINES[member.strategy];
  const phase = phaseOf(state.simTime);
  const lastFill = state.fills[state.fills.length - 1];

  const fill = (t: string) =>
    t
      .replaceAll('{sym}', sym)
      .replaceAll('{dir}', dir)
      .replaceAll('{pct}', pct)
      .replaceAll('{phase}', phase);

  const roll = rng.next();
  let text: string;
  let tone: ChatterLine['tone'] = 'plain';

  if (roll < 0.38) {
    // reaksi ke mover
    text = fill(rng.pick(own));
    tone = member.strategy === 'panic' ? 'sad' : mood?.dir === 'naik' ? 'joy' : 'think';
  } else if (roll < 0.55) {
    // portofolio sendiri
    if (member.trades === 0) {
      text = 'Gue masih nunggu sinyal. Modal utuh, hati tenang.';
    } else if (member.pnlPct > 18) {
      text = `Portfolio gue ${member.pnlPct.toFixed(0)}% naik. Gue pura-pura santai.`;
      tone = 'joy';
    } else if (member.pnlPct < -18) {
      text = `Gue ${Math.abs(member.pnlPct).toFixed(0)}% di bawah. Ini cuma koreksi, kan?`;
      tone = 'sad';
    } else if (member.holding) {
      text = `Gue masih pegang ${member.holding}. Nunggu alasan buat jual.`;
    } else {
      text = 'Gue lagi nganggur posisi. Cash itu juga posisi.';
    }
  } else if (roll < 0.7) {
    // suasana venue
    text = rng.pick(venue);
    tone = 'think';
  } else if (roll < 0.84 && topic) {
    // rumor yang beredar
    text = `Katanya ${topic} bakal gerak. Temen gue denger dari orang dalam.`;
    tone = 'think';
  } else if (roll < 0.93 && lastFill) {
    // gosip transaksi terakhir pemain
    const inst = state.instruments[lastFill.instId]?.name ?? lastFill.instId;
    text =
      lastFill.pnl < 0
        ? `Ada yang baru cut loss di ${inst}. Wajahnya kayak habis liq.`
        : `Ada yang baru cuan di ${inst}. Traktirannya belum kelar.`;
    tone = lastFill.pnl < 0 ? 'sad' : 'joy';
  } else {
    // refleksi jam
    text =
      phase === 'subuh'
        ? 'Subuh gini masih melek? Kita dua orang yang salah prioritas.'
        : phase === 'pagi'
          ? 'Pagi-pagi udah buka chart. Kopi dulu, jangan FOMO.'
          : phase === 'malam'
            ? 'Malam makin larut, volume makin tipis. Jangan kaget.'
            : 'Pasar lagi nunggu katalis. Sabar dikit.';
    tone = 'plain';
  }

  return { memberId: member.id, name: member.name, emoji: member.emoji, text: clip(text), tone };
}

/** 3 baris chatter yang dipilih merata posisinya, berubah tiap slot */
export function venueChatter(state: SimState, locId: string, slot: number): ChatterLine[] {
  const scene = venueScene(state, locId);
  if (!scene || scene.crowd.length === 0) return [];

  const day = Math.floor(state.simTime / 86_400_000);
  const seed =
    (hashString(`${locId}:${slot}`) ^ (state.seed >>> 0) ^ Math.imul(day + 7, 0x85ebca6b)) >>> 0;
  const rng = new RNG(seed);
  const mood = topMover(state);
  const topic = rumorTopic(state);

  const order = scene.crowd.map((_, i) => i);
  const picked: number[] = [];
  const n = order.length;
  if (n <= 2) {
    picked.push(...order);
  } else if (n < 6) {
    const half = Math.floor(n / 2);
    picked.push(rng.int(0, half - 1), rng.int(half, n - 1));
  } else {
    const third = Math.floor(n / 3);
    picked.push(rng.int(0, third - 1), rng.int(third, 2 * third - 1), rng.int(2 * third, n - 1));
  }

  return picked.map((i) => chatterFor(state, scene.crowd[i], locId, rng, mood, topic));
}

/** baris staff venue — dipakai buat dialog VN (speaker sintetis) */
export function staffLines(state: SimState, locId: string): string[] {
  const info = venueInfo(locId);
  if (!info) return [];
  const mood = topMover(state);
  const topic = rumorTopic(state);
  const phase = phaseOf(state.simTime);
  const hour = wibHour(state.simTime);
  const scene = venueScene(state, locId);
  const count = (scene?.crowd.length ?? 0) + 1;

  const greet =
    hour < 5
      ? 'Subuh, Bang. Mau kopi atau baru pulang?'
      : hour < 11
        ? 'Pagi, Bang. Mau mulai hari dengan apa?'
        : hour < 15
          ? 'Siang, Bang. Panas di luar, di sini adem.'
          : hour < 19
            ? 'Sore, Bang. Mau duduk di mana?'
            : 'Malam, Bang. Mau yang bikin melek atau yang bikin tenang?';

  const market = mood
    ? `Tadi ${mood.sym} ${mood.dir} ${mood.pct}. ${count} orang di sini pada bahas itu.`
    : `${count} orang di sini, tapi nggak ada yang berani buka posisi.`;

  const venueLine: Record<string, string> = {
    cafe: 'Kopinya baru gue seduh. Jangan buru-buru pulang.',
    home: 'Makan dulu, Bang. Chart nggak bakal kabur.',
    garage: 'Mesin udah gue cek. Sekarang cek portfolio lo.',
    apartment: 'Lift arah bursa penuh tadi. Hati-hati bawa kopi.',
    gallery: 'Silakan lihat-lihat. Karya yang di pojok katanya bakal naik.',
    penthouse: 'Rooftop penuh malam ini. Mau minum apa?',
    bar: 'Gelas pertama on the house. Yang kedua bayar sendiri.',
    kantor: 'Kopi di meja masih hangat. Rapat mulai lima menit lagi.',
    klub: 'Earplug ada di kasir. Bass-nya nggak kenal kompromi.',
    mal: 'Info desk buka sampai malam. Mau tanya arah toko?',
    gym: 'Towel ada di loker. Jangan lupa minum.',
    restoran: 'Menu hari ini: steak, pasta, dan chart yang nggak enak.',
    bank: 'Loket 3 buka. Isi formulir dulu.',
    kantor_polisi: 'Lapor di meja depan. Bawa identitas.',
    rumah_sakit: 'Pendaftaran di lobi. Silakan duduk.',
    sekolah: 'Bel masuk jam delapan. Jangan terlambat.'
  };

  const lines = [greet, market, venueLine[locId] ?? `Suasana ${phase} lagi ramai.`];
  if (topic) lines.push(`Oh ya, katanya ${topic} bakal gerak. Gue sih cuma jual jasa.`);
  return lines;
}
