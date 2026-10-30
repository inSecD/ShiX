import type { SimState } from './types';
import type { RNG } from './rng';

/** notice lokal (hindari circular import sama engine) */
function pushNotice(state: SimState, msg: string): void {
  state.notices.push(msg);
  if (state.notices.length > 20) state.notices.splice(0, state.notices.length - 20);
}

/**
 * Eksplorasi & Encounter (Phase 9).
 * Tiap kali jalan / ngobrol, bisa ketemu orang acak dengan pilihan dialog —
 * tiap pilihan punya konsekuensi nyata (cash, mood, followers, friendship, rumor).
 */

export interface EncounterEffect {
  cash?: number;
  mood?: number;
  energy?: number;
  followers?: number;
  fame?: number;
  jobXp?: number;
  friendship?: { botId: string; gain: number };
  /** bocorin event berikutnya sebagai rumor */
  rumor?: boolean;
}

export interface EncounterChoice {
  label: string;
  /** teks hasil pas pilihan diambil (kondisi sukses) */
  outcome: string;
  effect: EncounterEffect;
  /** kalo diisi, pilihan ini di-roll: fail → failOutcome/failEffect */
  successChance?: number;
  failOutcome?: string;
  failEffect?: EncounterEffect;
}

export interface EncounterDef {
  id: string;
  icon: string;
  title: string;
  scene: string;
  /** lokasi spesifik, atau null = bisa muncul di mana aja */
  where: string | null;
  weight: number;
  choices: EncounterChoice[];
}

export const ENCOUNTERS: EncounterDef[] = [
  {
    id: 'whale',
    icon: '🐋',
    title: 'Whale pemurah',
    scene:
      'Whale 0x7f (atau bajunya mirip) lagi duduk di bangku taman. Dia nyadar lo liatin portfolio-nya. "Mau gue kasih tau satu setup yang jarang orang tau?"',
    where: null,
    weight: 10,
    choices: [
      {
        label: 'Ikutin sinyalnya',
        outcome:
          'Dia sebut satu coin kecil. Lo masuk sedikit — dan besoknya naik 40%. Dia cuma senyum: "Jangan serakah."',
        effect: { cash: 900, fame: 4, followers: 25 },
        successChance: 0.6,
        failOutcome:
          'Lo masuk… ternyata itu perangkap liquidity. Si whale hilang kontak. Lo rugi tipis tapi dapat pelajaran.',
        failEffect: { cash: -350, mood: -6 }
      },
      {
        label: 'Tolak sopan, minta nasihat umum',
        outcome:
          '"Jangan FOMO. Simpen cash waktu semua panik." Nasihat klasik, tapi dia kayanya beneran ngerti pasar.',
        effect: { mood: 6, jobXp: 12 }
      }
    ]
  },
  {
    id: 'scammer',
    icon: '🐍',
    title: 'Penipu investasi',
    scene:
      'Seseorang nyamperin di Jalan Kota. "Bro, gue admin grup VIP. Pasti cuan, tinggal ikut sinyal. Modal $500 balik $5000 seminggu."',
    where: 'street',
    weight: 12,
    choices: [
      {
        label: 'Masuk grup VIP-nya',
        outcome:
          'Lo setor $500 ke "akun kustodian". Grupnya langsung dihapus. Klasik, tapi gue harap lo nggak ketagihan.',
        effect: { cash: -500, mood: -10 }
      },
      {
        label: 'Blokir + bikin thread EXPOSÉ',
        outcome:
          'Lo bongkar modusnya di CT Feed. Thread-nya rame, banyak yang makasih. Follower naik, scammer kabur.',
        effect: { followers: 70, fame: 8, mood: 5 },
        successChance: 0.75,
        failOutcome:
          'Lo ngetweet, tapi dia balik serang: "Fake news." Debat kusir, mood lo yang capek.',
        failEffect: { mood: -5, followers: 10 }
      }
    ]
  },
  {
    id: 'insider',
    icon: '🕵️',
    title: 'Orang dalam',
    scene:
      'Di dekat Bursa, seorang pria baju batik manggil lo pelan. "Gue kerja di salah satu emiten. Ada berita sebelum buka besok. $200, lo dapet arahnya."',
    where: 'bursa',
    weight: 9,
    choices: [
      {
        label: 'Bayar $200 buat infonya',
        outcome:
          'Dia bisikin: sektor Energi bakal kena sentimen positif. Lo dapet rumor tier tinggi — tinggal lo yang mutusin.',
        effect: { cash: -200, rumor: true, jobXp: 20 }
      },
      {
        label: 'Tolak — itu ilegal',
        outcome: 'Lo nolak. Dia buru-buru pergi. Lo tetep di jalur yang bener.',
        effect: { mood: 3, jobXp: 8 }
      }
    ]
  },
  {
    id: 'collector',
    icon: '🖼️',
    title: 'Kolektor seni',
    scene:
      'Di Gallery, seorang kolektor nunjuk ke karya digital lo (kalo lo punya) atau nawarin karya langka. "Seni itu lambat, tapi nilainya jujur."',
    where: 'gallery',
    weight: 8,
    choices: [
      {
        label: 'Jual karya dengan harga bagus',
        outcome: 'Kolektor bayar tunai di depan. Seni emang bisa bikin kaya kalo sabar.',
        effect: { cash: 1200, mood: 6 }
      },
      {
        label: 'Tahan — nilai naik pelan',
        outcome: 'Lo simpen. Nilainya belum cair, tapi hati lo tenang. Fokus naik.',
        effect: { mood: 8, fame: 3 }
      }
    ]
  },
  {
    id: 'fan',
    icon: '📸',
    title: 'Fans CT',
    scene:
      'Di Cafe, seorang fans ngenalin lo dari postingan CT Feed-nya. "Bro bro, boleh foto bareng? Gue sering baca analisamu!"',
    where: 'cafe',
    weight: 11,
    choices: [
      {
        label: 'Foto bareng + ngobrol',
        outcome: 'Foto di-post, tag lo. Engagements meledak. Si fans janji ajak komunitasnya.',
        effect: { followers: 90, fame: 7, mood: 8 }
      },
      {
        label: 'Singkat aja, lagi buru-buru',
        outcome: 'Lo minta maaf dan cabut. Si fans kecewa tipis. Oh well.',
        effect: { mood: -2 }
      }
    ]
  },
  {
    id: 'debt',
    icon: '💼',
    title: 'Penagih utang',
    scene:
      'Seseorang bawa map di Residensial. "Kami dari lembaga tagih. Ada tagihan tertunggak $400 atas nama Anda." Lo nggak inget pernah utang ini… tapi mereka bersikeras.',
    where: 'home',
    weight: 7,
    choices: [
      {
        label: 'Bayar $400 biar beres',
        outcome: 'Lo bayar. Repot emang, tapi setidaknya nggak dikejar-kejar lagi.',
        effect: { cash: -400, mood: -4 }
      },
      {
        label: 'Minta bukti & lawan',
        outcome:
          'Lo minta surat perjanjian. Mereka nggak bisa nunjukin → batal. Lo hemat $400 dan lumayan bangga.',
        effect: { cash: 0, mood: 9, jobXp: 10 },
        successChance: 0.7,
        failOutcome:
          'Ternyata ada kontrak lama yang lo lupa. Mereka bawa pengacara. Lo tetep kena $400 + pusing.',
        failEffect: { cash: -400, mood: -8 }
      }
    ]
  },
  {
    id: 'headhunter',
    icon: '🤵',
    title: 'Headhunter',
    scene:
      'Di Park, seorang recruiter duduk di sebelah lo. "Portofolionya menarik. Perusahaan gue butuh orang sepintar lo. Ada bonus karier kalau mau lanjut."',
    where: 'park',
    weight: 9,
    choices: [
      {
        label: 'Ikut wawancara kilat',
        outcome: 'Prosesnya cepet. Lo dapet XP karier lumayan buat naik level kerjaan.',
        effect: { jobXp: 60, mood: 4, energy: -10 }
      },
      {
        label: 'Nolak, fokus trading dulu',
        outcome: 'Lo tetep di jalur sendiri. Santai aja, nggak semua tawaran harus dikejar.',
        effect: { mood: 4, jobXp: 10 }
      }
    ]
  },
  {
    id: 'hustler',
    icon: '🍜',
    title: 'Pedagang kaki lima',
    scene:
      'Penjual gorengan di pinggir jalan nawarin dagangan sambil cerita. "Dulu saya juga pernah kaya dari saham, terus jatuh. Sekarang mah nggak neko-neko, yang penting halal."',
    where: null,
    weight: 10,
    choices: [
      {
        label: 'Beli banyak + sedekah sisa',
        outcome: 'Lo bayar lebih dari harga. Dia doain rejeki lo lancar. Hatimu adem, fokus naik.',
        effect: { cash: -20, mood: 12 }
      },
      {
        label: 'Bayar pas + dengerin ceritanya',
        outcome: 'Ceritanya bikin lo mikir soal risiko. Pelajaran berharga dari pengalaman orang lain.',
        effect: { mood: 5, jobXp: 15 }
      }
    ]
  }
];

export interface ActiveEncounter {
  defId: string;
  at: number;
}

export interface EncounterState {
  /** encounter yang lagi nunggu dipilih pemain */
  pending: ActiveEncounter | null;
  /** tick terakhir kali encounter muncul (buat cooldown anti-spam) */
  lastTick: number;
  /** berapa kali tiap encounter udah muncul */
  seen: Record<string, number>;
  /** total encounter yang udah kejadian */
  total: number;
}

export function createEncounter(): EncounterState {
  return { pending: null, lastTick: -999, seen: {}, total: 0 };
}

function num(v: unknown, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

export function normalizeEncounter(x: unknown): EncounterState {
  const e = x as Partial<EncounterState> | null | undefined;
  if (!e || typeof e !== 'object') return createEncounter();
  const pending =
    e.pending && typeof e.pending === 'object' && typeof (e.pending as ActiveEncounter).defId === 'string'
      ? { defId: (e.pending as ActiveEncounter).defId, at: num((e.pending as ActiveEncounter).at, 0) }
      : null;
  const seen: Record<string, number> = {};
  if (e.seen && typeof e.seen === 'object') {
    for (const [k, v] of Object.entries(e.seen)) seen[k] = Math.max(0, Math.round(num(v, 0)));
  }
  return {
    pending,
    lastTick: num(e.lastTick, -999),
    seen,
    total: Math.max(0, Math.round(num(e.total, 0)))
  };
}

export function encounterDef(id: string): EncounterDef | undefined {
  return ENCOUNTERS.find((e) => e.id === id);
}

/** jarak minimal (tick) antar encounter biar nggak spam tiap langkah */
const ENCOUNTER_GAP = 8;

function defAt(def: EncounterDef, locId: string): boolean {
  return def.where === null || def.where === locId;
}

/**
 * Coba munculin encounter. Trigger 'travel' pas pindah lokasi, 'chat' pas ngobrol NPC.
 * Kalo kena, encounter langsung jadi `pending` — pemain pilih di UI.
 */
export function maybeEncounter(
  state: SimState,
  rng: RNG,
  trigger: 'travel' | 'chat'
): EncounterDef | null {
  const enc = state.encounter;
  if (!enc || enc.pending) return null;
  if (state.ticks - enc.lastTick < ENCOUNTER_GAP) return null;

  const baseChance = trigger === 'travel' ? 0.34 : 0.22;
  if (!rng.chance(baseChance)) return null;

  // kumpulin kandidat yang cocok sama lokasi sekarang; yang jarang keliatan dikasih bobot lebih
  const here = state.hub.locId;
  const cands: EncounterDef[] = [];
  const weights: number[] = [];
  for (const def of ENCOUNTERS) {
    if (!defAt(def, here)) continue;
    cands.push(def);
    // makin sering keliatan, makin kecil bobotnya biar variasi
    const seen = enc.seen[def.id] ?? 0;
    weights.push(def.weight / (1 + seen * 0.8));
  }
  if (cands.length === 0) return null;

  const def = cands[rng.weightedIndex(weights)];
  enc.pending = { defId: def.id, at: state.simTime };
  enc.lastTick = state.ticks;
  enc.seen[def.id] = (enc.seen[def.id] ?? 0) + 1;
  enc.total += 1;
  return def;
}

export interface EncounterResult {
  ok: boolean;
  msg: string;
}

function applyEffect(state: SimState, eff: EncounterEffect): void {
  if (eff.cash) state.cash += eff.cash;
  const life = state.life;
  if (life) {
    if (eff.mood) life.mood = Math.max(0, Math.min(100, life.mood + eff.mood));
    if (eff.energy) life.energy = Math.max(0, Math.min(100, life.energy + eff.energy));
    if (eff.jobXp) life.jobXp += eff.jobXp;
  }
  if (eff.followers) {
    state.profile.followers = Math.max(0, state.profile.followers + eff.followers);
  }
  if (eff.fame) {
    state.profile.fame = Math.max(0, Math.min(100, state.profile.fame + eff.fame));
  }
  if (eff.friendship) {
    const cur = state.social.friendship[eff.friendship.botId] ?? 0;
    state.social.friendship[eff.friendship.botId] = Math.max(
      0,
      Math.min(100, cur + eff.friendship.gain)
    );
  }
  if (eff.rumor && !state.social.rumor && state.pendingEvent) {
    const inst = state.pendingEvent.instId ? state.instruments[state.pendingEvent.instId] : null;
    const up = state.pendingEvent.impact >= 0;
    const topik = inst ? inst.name : 'pasar';
    const text = `Orang dalam bilang ${topik} bakal ${up ? 'melonjak' : 'tertekan'} dalam waktu dekat.`;
    state.social.rumor = {
      botId: 'bot_3',
      text,
      tier: 3,
      evId: state.pendingEvent.ev.id,
      at: state.simTime
    };
  }
}

/** ambil pilihan ke-`idx` dari encounter yang lagi pending */
export function resolveEncounter(state: SimState, rng: RNG, idx: number): EncounterResult {
  const enc = state.encounter;
  if (!enc?.pending) return { ok: false, msg: 'Nggak ada encounter yang lagi aktif' };
  const def = encounterDef(enc.pending.defId);
  if (!def) {
    enc.pending = null;
    return { ok: false, msg: 'Encounter hilang' };
  }
  const choice = def.choices[idx];
  if (!choice) return { ok: false, msg: 'Pilihan nggak valid' };

  let outcome = choice.outcome;
  let eff = choice.effect;
  if (choice.successChance != null && !rng.chance(choice.successChance)) {
    outcome = choice.failOutcome ?? 'Nggak ada yang terjadi.';
    eff = choice.failEffect ?? {};
  }

  applyEffect(state, eff);
  enc.pending = null;

  const summary = effectSummary(eff);
  pushNotice(state, `${def.icon} ${def.title}: ${outcome}`);
  return { ok: true, msg: summary ? `${outcome} ${summary}` : outcome };
}

/** ringkasan human-readable dari efek — biar pemain ngerti apa yang dia dapet */
function effectSummary(eff: EncounterEffect): string {
  const parts: string[] = [];
  if (eff.cash) parts.push(`${eff.cash > 0 ? '+' : ''}$${Math.round(eff.cash)}`);
  if (eff.mood) parts.push(`mood ${eff.mood > 0 ? '+' : ''}${eff.mood}`);
  if (eff.energy) parts.push(`energi ${eff.energy > 0 ? '+' : ''}${eff.energy}`);
  if (eff.followers) parts.push(`+${eff.followers} followers`);
  if (eff.fame) parts.push(`+${eff.fame} fame`);
  if (eff.jobXp) parts.push(`+${eff.jobXp} XP karier`);
  if (eff.friendship) parts.push(`+${eff.friendship.gain} friendship`);
  if (eff.rumor) parts.push('dapat rumor dalam');
  return parts.length ? `(${parts.join(', ')})` : '';
}
