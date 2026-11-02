import type { Bot, BotStrategy, ConvoState, NpcMemoryEntry, PendingEvent, SimState, SocialState } from './types';
import { perksOf } from './perks';

/** lokasi tiap NPC nongol — nyambung ke unlock aset (Fase 1-2), jadi makin kaya makin banyak yang bisa ditemui */
export const NPC_AT: Record<string, string> = {
  bot_0: 'street', // Aria
  bot_9: 'park', // Sinta
  bot_2: 'cafe', // DegenBoy
  bot_3: 'bursa', // Quant-9
  bot_1: 'home', // Kai
  bot_6: 'garage', // Nala
  bot_8: 'apartment', // Moonkid
  bot_7: 'gallery', // Viktor
  bot_4: 'marina', // Whale 0x7f
  bot_5: 'mansion' // Panik Pete
};

const INTRO: Record<string, string> = {
  bot_0: 'Aria nyapa sopan. "Lagi monitor momentum, nih."',
  bot_1: 'Kai angkat kopi. "Pasar lagi nggak jelas. Gue suka banget."',
  bot_2: 'DegenBoy melambai. "GAS! Ada kape baru, 1000x atau0!"',
  bot_3: 'Quant-9 nunjuk layar. "Sinyalku lagi hijau semua."',
  bot_4: 'Whale 0x7f diem aja, cuman angguk pelan.',
  bot_5: 'Panik Pete gemetaran. "Jangan beli apa-apa. Serius."',
  bot_6: 'Nala nge-rev mesin. "Kapan road trip nih?"',
  bot_7: 'Viktor ngukur bingkai seni. "Nilai itu pelan, tapi nyata."',
  bot_8: 'Moonkid loncat-loncat. "Bulannya penuh banget malam ini!"',
  bot_9: 'Sinta tersenyum santai. "Pelan-pelan, santai aja."'
};

const OPENER: Record<BotStrategy, string> = {
  momentum: 'Eh,',
  contrarian: 'Jujur ya,',
  degen: 'Woy,',
  quant: 'Data bilang,',
  whale: 'Dari dalam,',
  panic: 'AWAS,'
};

/** sapaan buat bot kerumunan (bukan 10 NPC kenalan) — biar nggak flat */
function crowdGreeting(state: SimState, bot: Bot): string {
  const pnl = Math.round(bot.pnlPct);
  const hold = bot.holdings[0]?.instId;
  const options = [
    `${bot.name} nyapa. "Lagi ngapain? Gue baru balik dari layar."`,
    `${bot.name} ngangkat gelas. "Pasar ${state.macro.regime.toLowerCase()} gini bikin susah tidur."`,
    hold
      ? `${bot.name} nunjuk layar HP. "Lagi mantau ${hold}, masih nyangkut dikit."`
      : `${bot.name} nyapa santai. "Cash gue utuh. Itu juga prestasi, kan?"`,
    pnl > 15
      ? `${bot.name} senyum tipis. "Portfolio gue ${pnl}% naik. Jangan bilang siapa-siapa."`
      : pnl < -15
        ? `${bot.name} nghela napas. "Gue ${Math.abs(pnl)}% di bawah. Lagi mode bertahan."`
        : `${bot.name} nyapa. "Lagi nunggu katalis. Lo bawa rumor nggak?"`
  ];
  return options[(state.ticks + bot.id.length) % options.length];
}

/** obrolan kecil berbasis strategi + portfolio — bagian dari NPC brain */
function botSmallTalk(state: SimState, bot: Bot): string {
  const pnl = Math.round(bot.pnlPct);
  const hold = bot.holdings[0]?.instId;
  const moverId = state.order.find((id) => {
    const inst = state.instruments[id];
    return inst && inst.open > 0 && Math.abs((inst.price - inst.open) / inst.open) > 0.02;
  });
  const mover = moverId ? state.instruments[moverId] : null;

  if (bot.strategy === 'panic' && pnl < 0) {
    return `"Gue udah cut dua kali hari ini. Tangan gue masih gemetar."`;
  }
  if (hold) {
    return `"Gue masih pegang ${hold}. ${pnl >= 0 ? 'Lumayan hijau' : 'Merah tipis'}, tapi belum mau nambah."`;
  }
  if (mover) {
    const chg = ((mover.price - mover.open) / mover.open) * 100;
    return `"${mover.name} ${chg >= 0 ? 'naik' : 'turun'} ${Math.abs(chg).toFixed(1).replace('.', ',')}%. Lo udah liat?"`;
  }
  switch (bot.strategy) {
    case 'quant':
      return `"Gue lagi backtest. Hasilnya bagus, tapi masa lalu nggak selalu bayar sewa."`;
    case 'whale':
      return `"Gue nggak lihat chart tiap menit. Gue lihat siapa yang panik."`;
    case 'degen':
      return `"Kalau ada koin baru, kabarin. Gue lagi cari alasan buat deg-degan."`;
    case 'contrarian':
      return `"Kalo semua orang di sini setuju, gue mulai mikir kebalikannya."`;
    case 'momentum':
      return `"Trend itu teman. Selama lo nggak telat masuk."`;
    default:
      return `"Pasar ${state.macro.regime.toLowerCase()}. Gue sih kecil-kecilan dulu."`;
  }
}


/** jeda (tick) sebelum bisa ngobrol lagi sama NPC yang sama */
export const CHAT_COOLDOWN = 6;

export function createSocial(): SocialState {
  return { friendship: {}, lastChat: {}, met: [], rumor: null, lastConvo: null, npcMemory: {} };
}

export function normalizeSocial(s: unknown): SocialState {
  const x = s as Partial<SocialState> | null | undefined;
  if (!x || typeof x !== 'object') return createSocial();

  const friendship: Record<string, number> = {};
  if (x.friendship && typeof x.friendship === 'object') {
    for (const [k, v] of Object.entries(x.friendship)) {
      const n = Number(v);
      if (Number.isFinite(n)) friendship[k] = Math.max(0, Math.min(100, n));
    }
  }
  const lastChat: Record<string, number> = {};
  if (x.lastChat && typeof x.lastChat === 'object') {
    for (const [k, v] of Object.entries(x.lastChat)) {
      const n = Number(v);
      if (Number.isFinite(n)) lastChat[k] = n;
    }
  }
  const met = Array.isArray(x.met) ? x.met.filter((id): id is string => typeof id === 'string') : [];
  const rumor = x.rumor && typeof x.rumor === 'object' ? (x.rumor as SocialState['rumor']) : null;
  const lastConvo = x.lastConvo && typeof x.lastConvo === 'object' ? (x.lastConvo as ConvoState) : null;
  const npcMemory: Record<string, NpcMemoryEntry[]> = {};
  if (x.npcMemory && typeof x.npcMemory === 'object') {
    for (const [k, v] of Object.entries(x.npcMemory)) {
      if (!Array.isArray(v)) continue;
      const clean = v
        .filter((e) => e && typeof e.ev === 'string' && typeof e.text === 'string')
        .map((e) => ({ t: Number(e.t) || 0, ev: e.ev, text: e.text }));
      if (clean.length) npcMemory[k] = clean;
    }
  }
  return { friendship, lastChat, met, rumor, lastConvo, npcMemory };
}

/** catat ingatan NPC tentang kejadian pemain */
export function rememberNpcEvent(state: SimState, botId: string, ev: string, text: string): void {
  if (!state.social.npcMemory) state.social.npcMemory = {};
  const list = state.social.npcMemory[botId] ?? [];
  list.push({ t: state.simTime, ev, text });
  state.social.npcMemory[botId] = list;
  if (list.length > 20) state.social.npcMemory[botId] = list.slice(-20);
}

/** entry ingatan NPC terakhir tentang pemain */
export function lastNpcMemory(state: SimState, botId: string): NpcMemoryEntry | null {
  const list = state.social.npcMemory?.[botId];
  if (!list || list.length === 0) return null;
  return list[list.length - 1];
}

/** respons NPC berbasis ingatan terakhir + konteks — "otak"-nya */
export function npcContextLine(state: SimState, botId: string): string | null {
  const mem = lastNpcMemory(state, botId);
  if (!mem) return null;
  const bot = state.bots.find((b) => b.id === botId);
  const who = bot?.name ?? botId;
  if (mem.ev === 'trade') {
    const strat = bot?.strategy ?? 'momentum';
    const react =
      strat === 'panic'
        ? `Gue denger trade lo kemarin bikin gue ngeri. Cash lo habis dikasih... hmm. Tapi pasar lagi move.`
        : strat === 'degen'
          ? `Trade lo kemarin brutal banget. Semoga cash-nya nggak cuma kenangan.`
          : strat === 'whale'
            ? `Trade lo kemarin... menarik. Lo punya risk tolerance yang rare.`
            : `Trade lo kemarin mengotori pasar. Semua orang denger cerita lo sekarang.`;
    return `${who} ingat trade lo: "${mem.text}". ${react}`;
  }
  if (mem.ev === 'encounter') return `${who} masih mikir kejadian tadi: "${mem.text}"`;
  if (mem.ev === 'rumor') return `${who} ikut bercerita soal rumor terakhir: "${mem.text}"`;
  if (mem.ev === 'quest') return `${who} cerita misi yang belum selesai: "${mem.text}"`;
  if (mem.ev === 'chat') return `${who} masih mikir obrolan mereka kemarin.`;
  return null;
}

export function friendshipOf(social: SocialState, botId: string): number {
  return social.friendship[botId] ?? 0;
}

/** tier rumor: 0 nggak dapat, 1 umum, 2 + sektor/arah, 3 nyebut nama aset */
export function rumorTier(friendship: number): number {
  if (friendship >= 80) return 3;
  if (friendship >= 50) return 2;
  if (friendship >= 20) return 1;
  return 0;
}

export function npcsAtLocation(state: SimState, locId: string): Bot[] {
  return state.bots.filter((b) => NPC_AT[b.id] === locId);
}

/** NPC pertama yang lagi di lokasi itu — buat pembuka dialog saat encounter muncul */
export function npcAtLocation(state: SimState, locId: string): Bot | undefined {
  const botId = Object.keys(NPC_AT).find((k) => NPC_AT[k] === locId);
  if (!botId) return undefined;
  return state.bots.find((b) => b.id === botId);
}

export function chatCooldownLeft(state: SimState, botId: string): number {
  const last = state.social.lastChat[botId];
  if (last == null) return 0;
  // perk networking (aset/bisnis) memotong jeda ngobrol
  const gap = Math.max(1, CHAT_COOLDOWN - perksOf(state).chatCooldownCut);
  return Math.max(0, gap - (state.ticks - last));
}

function rumorText(state: SimState, bot: Bot, pending: PendingEvent, tier: number): string {
  const inst = pending.instId ? state.instruments[pending.instId] : null;
  const up = pending.impact >= 0;
  const gerak = up ? 'melonjak' : 'tertekan';
  const arah = up ? 'positif' : 'negatif';

  let topik: string;
  if (inst) topik = inst.name;
  else if (pending.sector) topik = `sektor ${pending.sector}`;
  else if (pending.ev.tags.includes('Kripto') || pending.ev.tags.includes('Memecoin')) topik = 'kripto';
  else topik = 'pasar';

  const open = OPENER[bot.strategy];
  if (tier >= 3 && inst) return `${open} ${topik} lagi diomongin orang dalam. Katanya bakal ${gerak}, gerakannya gede.`;
  if (tier >= 3) return `${open} ${topik} lagi rame dibahas, arahnya condong ${arah}.`;
  if (tier >= 2) return `${open} ada isu soal ${topik}, konon arahnya ${arah}. Awas ya.`;
  return `${open} denger-denger pasar lagi mau goyah. Lebih baik awas dulu deh.`;
}

export interface ChatResult {
  ok: boolean;
  msg: string;
  gain: number;
  rumor: string | null;
  wait?: number;
  /** deretan baris VN dari respons NPC — greeting + rumor + konteks */
  lines?: string[];
}

export function chatWith(state: SimState, botId: string): ChatResult {
  const bot = state.bots.find((b) => b.id === botId);
  if (!bot) return { ok: false, msg: 'NPC nggak ketemu', gain: 0, rumor: null };

  const social = state.social;
  const wait = chatCooldownLeft(state, botId);
  if (wait > 0) return { ok: false, msg: `${bot.name} lagi sibuk · ${wait} jam lagi`, gain: 0, rumor: null, wait };

  social.lastChat[botId] = state.ticks;
  if (!social.met.includes(botId)) social.met.push(botId);

  const cur = friendshipOf(social, botId);
  const gain = cur >= 100 ? 0 : Math.max(1, Math.round(9 - cur / 18));
  social.friendship[botId] = Math.min(100, cur + gain);

  // coba bocorin event berikutnya (bukan cheat: cuma sinyal arah/topik, tetep butuh keputusan lo)
  let rumor: string | null = null;
  const perks = perksOf(state);
  const tier = Math.min(3, rumorTier(social.friendship[botId]) + perks.rumorTierBonus);
  if (tier > 0 && state.pendingEvent && !social.rumor && Math.random() < 0.6 * perks.rumorChanceMult) {
    rumor = rumorText(state, bot, state.pendingEvent, tier);
    social.rumor = { botId, text: rumor, tier, evId: state.pendingEvent.ev.id, at: state.simTime };
  }

  const greeting = INTRO[botId] ?? crowdGreeting(state, bot);
  const convo: ConvoState = { botId, greeting, rumor, gain, at: state.simTime };
  social.lastConvo = convo;

  // NPC brain (Phase 14 v2/v4): greeting + small talk + rumor + reaksi dari ingatan
  const ctx = npcContextLine(state, botId);
  const lines = [greeting, botSmallTalk(state, bot)];
  if (rumor) lines.push(rumor);
  if (ctx) lines.push(ctx);
  const msg = lines.join(' · ');
  return { ok: true, msg, gain, rumor, lines };
}
