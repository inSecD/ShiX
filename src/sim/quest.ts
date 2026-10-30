import type { SimState } from './types';

/** notice lokal (hindari circular import sama engine) */
function pushNotice(state: SimState, msg: string): void {
  state.notices.push(msg);
  if (state.notices.length > 20) state.notices.splice(0, state.notices.length - 20);
}

/**
 * Side Quest (Phase 9): misi berjenjang dari warga kota.
 * Tiap misi punya beberapa tahap; tiap tahap punya syarat (dari state nyata)
 * dan bayaran. Progres naik lewat `bumpQuest` yang dipanggil tiap aksi pemain.
 */

/** jenis syarat tahap — 'friendship' & 'followers' dicek langsung dari state, sisanya dari counter */
export type QuestKind =
  | 'chat'
  | 'visit'
  | 'trade'
  | 'post'
  | 'like'
  | 'follow'
  | 'friendship'
  | 'followers';

export interface QuestReward {
  cash?: number;
  mood?: number;
  followers?: number;
  fame?: number;
  jobXp?: number;
  perk?: string;
}

export interface QuestStage {
  kind: QuestKind;
  /** target jumlah (untuk 'friendship' & 'followers' = nilai absolut) */
  need: number;
  /** botId / locId spesifik; null = yang mana aja */
  who: string | null;
  desc: string;
  reward: QuestReward;
}

export interface QuestDef {
  id: string;
  npcId: string;
  title: string;
  intro: string;
  /** friendship minimal sama npc buat misi ini kebuka */
  reqFriendship: number;
  stages: QuestStage[];
}

export const QUESTS: QuestDef[] = [
  {
    id: 'kenalan',
    npcId: 'bot_9',
    title: 'Kenalan Dulu Lah',
    intro:
      'Sinta (Taman Kota): "Kamu baru di kota ini ya? Jalan-jalan dulu, kenalan sama orang-orang. Nanti gue kasih upah."',
    reqFriendship: 5,
    stages: [
      {
        kind: 'chat',
        need: 2,
        who: null,
        desc: 'Ngobrol sama 2 warga di lokasi mana aja',
        reward: { cash: 150, mood: 6 }
      },
      {
        kind: 'visit',
        need: 3,
        who: null,
        desc: 'Kunjungi 3 lokasi berbeda',
        reward: { cash: 250, followers: 20, jobXp: 25 }
      }
    ]
  },
  {
    id: 'konten',
    npcId: 'bot_2',
    title: 'Gass Konten',
    intro:
      'DegenBoy (Cafe): "Bro lu harus rajin posting! Mau gue bantu bikin nama di CT? Bunyikan kenceng-kenceng."',
    reqFriendship: 10,
    stages: [
      {
        kind: 'post',
        need: 3,
        who: null,
        desc: 'Bikin 3 post di CT Feed',
        reward: { followers: 40, fame: 6 }
      },
      {
        kind: 'like',
        need: 8,
        who: null,
        desc: 'Like 8 post di CT Feed',
        reward: { cash: 200, followers: 30 }
      },
      {
        kind: 'followers',
        need: 150,
        who: null,
        desc: 'Capai 150 followers',
        reward: { cash: 600, fame: 10, jobXp: 40 }
      }
    ]
  },
  {
    id: 'jaringan',
    npcId: 'bot_0',
    title: 'Bangun Jaringan',
    intro:
      'Aria (Jalan Kota): "Trading itu soal koneksi. Follow orang-orang yang bener, jaga silaturahmi. Gue kasih bonus kalau jaringanmu kuat."',
    reqFriendship: 15,
    stages: [
      {
        kind: 'follow',
        need: 4,
        who: null,
        desc: 'Ikuti 4 akun di CT',
        reward: { cash: 250, mood: 5 }
      },
      {
        kind: 'friendship',
        need: 40,
        who: null,
        desc: 'Berteman sampai 40 friendship dengan 1 warga',
        reward: { cash: 400, jobXp: 50 }
      },
      {
        kind: 'chat',
        need: 5,
        who: null,
        desc: 'Ngobrol sama 5 warga',
        reward: { cash: 500, followers: 60, fame: 8 }
      }
    ]
  },
  {
    id: 'trader_sesi',
    npcId: 'bot_3',
    title: 'Sesi Trading',
    intro:
      'Quant-9 (Bursa): "Ngobrol doang nggak bikin kaya. Tunjukin eksekusi. Gue ukur disiplinmu lewat frekuensi dan hasil trade."',
    reqFriendship: 20,
    stages: [
      {
        kind: 'trade',
        need: 5,
        who: null,
        desc: 'Lakukan 5 trade',
        reward: { cash: 400, jobXp: 45 }
      },
      {
        kind: 'trade',
        need: 15,
        who: null,
        desc: 'Lakukan 15 trade total',
        reward: { cash: 900, fame: 10, jobXp: 80 }
      }
    ]
  }
];

export interface ActiveQuest {
  defId: string;
  stage: number;
  /** progress counter tahap sekarang (untuk kind berbasis jumlah) */
  progress: number;
}

export interface QuestState {
  active: ActiveQuest[];
  completed: string[];
}

export function createQuest(): QuestState {
  return { active: [], completed: [] };
}

function num(v: unknown, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

export function normalizeQuest(x: unknown): QuestState {
  const q = x as Partial<QuestState> | null | undefined;
  if (!q || typeof q !== 'object') return createQuest();
  const active: ActiveQuest[] = [];
  if (Array.isArray(q.active)) {
    for (const a of q.active) {
      if (!a || typeof a !== 'object') continue;
      const defId = (a as ActiveQuest).defId;
      const def = questById(defId);
      if (!def) continue; // misi yang udah nggak ada → buang
      const stage = Math.min(def.stages.length - 1, Math.max(0, Math.round(num((a as ActiveQuest).stage, 0))));
      active.push({
        defId,
        stage,
        progress: Math.max(0, Math.round(num((a as ActiveQuest).progress, 0)))
      });
    }
  }
  const completed = Array.isArray(q.completed)
    ? q.completed.filter((id): id is string => typeof id === 'string' && !!questById(id))
    : [];
  return { active, completed };
}

export function questById(id: string | null | undefined): QuestDef | undefined {
  if (!id) return undefined;
  return QUESTS.find((q) => q.id === id);
}

export function questOfNpc(state: SimState, npcId: string): QuestDef | undefined {
  const q = state.quests;
  if (!q) return undefined;
  return QUESTS.find((def) => {
    if (def.npcId !== npcId) return false;
    if (q.completed.includes(def.id)) return false;
    if (q.active.some((a) => a.defId === def.id)) return false;
    const fr = state.social.friendship[npcId] ?? 0;
    return fr >= def.reqFriendship;
  });
}

/** nilai "kind berbasis state absolut" — friendship & followers */
function absoluteValue(state: SimState, stage: QuestStage): number {
  if (stage.kind === 'followers') return state.profile.followers;
  if (stage.kind === 'friendship') {
    const best = Math.max(0, ...Object.values(state.social.friendship));
    return best;
  }
  return 0;
}

export function stageProgress(state: SimState, aq: ActiveQuest, stage: QuestStage): number {
  if (stage.kind === 'friendship' || stage.kind === 'followers') {
    return absoluteValue(state, stage);
  }
  return aq.progress;
}

export function stageDone(state: SimState, aq: ActiveQuest, stage: QuestStage): boolean {
  return stageProgress(state, aq, stage) >= stage.need;
}

export function questDone(state: SimState, aq: ActiveQuest): boolean {
  const def = questById(aq.defId);
  if (!def) return true;
  const stage = def.stages[aq.stage];
  if (!stage) return true;
  return stageDone(state, aq, stage);
}

/** misi yang lagi aktif + siap di-claim tahapnya (di UI tombolnya nyala) */
export function claimableQuest(state: SimState, aq: ActiveQuest): boolean {
  return questDone(state, aq);
}

// ---------- aksi pemain ----------

export interface QuestResult {
  ok: boolean;
  msg: string;
}

export function acceptQuest(state: SimState, defId: string): QuestResult {
  const q = state.quests;
  const def = questById(defId);
  if (!q || !def) return { ok: false, msg: 'Misi tidak ditemukan' };
  if (q.completed.includes(defId)) return { ok: false, msg: 'Misi udah selesai' };
  if (q.active.some((a) => a.defId === defId)) return { ok: false, msg: 'Misi udah aktif' };
  const fr = state.social.friendship[def.npcId] ?? 0;
  if (fr < def.reqFriendship)
    return { ok: false, msg: `Butuh friendship ${def.reqFriendship} sama pemberi misi (lo: ${Math.round(fr)})` };
  q.active.push({ defId, stage: 0, progress: 0 });
  return { ok: true, msg: `Misi diterima: ${def.title}` };
}

export function abandonQuest(state: SimState, defId: string): QuestResult {
  const q = state.quests;
  if (!q) return { ok: false, msg: 'Quest state hilang' };
  const i = q.active.findIndex((a) => a.defId === defId);
  if (i < 0) return { ok: false, msg: 'Misi nggak aktif' };
  q.active.splice(i, 1);
  const def = questById(defId);
  return { ok: true, msg: `Misi ditinggalkan: ${def?.title ?? defId}` };
}

/** klaim tahap yang udah selesai → bayaran, lanjut tahap berikutnya atau tamat */
export function claimQuest(state: SimState, defId: string): QuestResult {
  const q = state.quests;
  const def = questById(defId);
  if (!q || !def) return { ok: false, msg: 'Misi tidak ditemukan' };
  const aq = q.active.find((a) => a.defId === defId);
  if (!aq) return { ok: false, msg: 'Misi nggak aktif' };
  const stage = def.stages[aq.stage];
  if (!stage) return { ok: false, msg: 'Tahap nggak valid' };
  if (!stageDone(state, aq, stage)) return { ok: false, msg: 'Belum selesai tahapnya' };

  applyReward(state, stage.reward);
  const rewardText = rewardSummary(stage.reward);

  if (aq.stage + 1 >= def.stages.length) {
    // tamat
    q.active = q.active.filter((a) => a.defId !== defId);
    if (!q.completed.includes(defId)) q.completed.push(defId);
    pushNotice(state, `✅ Misi selesai: ${def.title} ${rewardText}`);
    return { ok: true, msg: `Misi "${def.title}" selesai! ${rewardText}` };
  }

  aq.stage += 1;
  aq.progress = 0;
  const next = def.stages[aq.stage];
  pushNotice(state, `Tahap berikutnya: ${next.desc} ${rewardText}`);
  return { ok: true, msg: `Tahap ${aq.stage + 1}/${def.stages.length}: ${next.desc} ${rewardText}` };
}

function applyReward(state: SimState, r: QuestReward): void {
  if (r.cash) state.cash += r.cash;
  const life = state.life;
  if (life) {
    if (r.mood) life.mood = Math.max(0, Math.min(100, life.mood + r.mood));
    if (r.jobXp) life.jobXp += r.jobXp;
  }
  if (r.followers) state.profile.followers = Math.max(0, state.profile.followers + r.followers);
  if (r.fame) state.profile.fame = Math.max(0, Math.min(100, state.profile.fame + r.fame));
}

function rewardSummary(r: QuestReward): string {
  const parts: string[] = [];
  if (r.cash) parts.push(`+$${Math.round(r.cash)}`);
  if (r.mood) parts.push(`+${r.mood} mood`);
  if (r.followers) parts.push(`+${r.followers} followers`);
  if (r.fame) parts.push(`+${r.fame} fame`);
  if (r.jobXp) parts.push(`+${r.jobXp} XP karier`);
  return parts.length ? `(${parts.join(', ')})` : '';
}

/**
 * Naikin progress misi tiap kali pemain ngelakuin aksi tertentu.
 * Dipanggil dari store: chat/visit/trade/post/like/follow.
 */
export function bumpQuest(state: SimState, kind: QuestKind, who: string | null = null): void {
  const q = state.quests;
  if (!q) return;
  for (const aq of q.active) {
    const def = questById(aq.defId);
    if (!def) continue;
    const stage = def.stages[aq.stage];
    if (!stage || stage.kind !== kind) continue;
    // kind absolut (friendship/followers) nggak pake counter
    if (kind === 'friendship' || kind === 'followers') continue;
    if (stage.who && who && stage.who !== who) continue;
    aq.progress += 1;
  }
}
