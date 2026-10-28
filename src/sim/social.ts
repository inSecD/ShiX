import type { Bot, BotStrategy, ConvoState, PendingEvent, SimState, SocialState } from './types';

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

/** jeda (tick) sebelum bisa ngobrol lagi sama NPC yang sama */
export const CHAT_COOLDOWN = 6;

export function createSocial(): SocialState {
  return { friendship: {}, lastChat: {}, met: [], rumor: null, lastConvo: null };
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
  return { friendship, lastChat, met, rumor, lastConvo };
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

export function chatCooldownLeft(state: SimState, botId: string): number {
  const last = state.social.lastChat[botId];
  if (last == null) return 0;
  return Math.max(0, CHAT_COOLDOWN - (state.ticks - last));
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
  const tier = rumorTier(social.friendship[botId]);
  if (tier > 0 && state.pendingEvent && !social.rumor && Math.random() < 0.6) {
    rumor = rumorText(state, bot, state.pendingEvent, tier);
    social.rumor = { botId, text: rumor, tier, evId: state.pendingEvent.ev.id, at: state.simTime };
  }

  const greeting = INTRO[botId] ?? `${bot.name} ngobrol.`;
  const convo: ConvoState = { botId, greeting, rumor, gain, at: state.simTime };
  social.lastConvo = convo;

  return { ok: true, msg: rumor ? `${greeting} — "${rumor}"` : greeting, gain, rumor };
}
