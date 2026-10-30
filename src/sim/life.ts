import type { SimState } from './types';
import { feeMultOf } from './perks';
import { KIDS_COST } from './relationship';

/**
 * Life Sim (Phase 8): stamina, mood, kerjaan + karier XP, dan biaya hidup.
 * Semua ngaruh ke trading lewat `focusFeeMult` — capek/stres = fee lebih mahal.
 */

export interface JobDef {
  id: string;
  name: string;
  icon: string;
  /** XP karier minimal buat ngelamar */
  reqXp: number;
  /** gaji total per shift */
  pay: number;
  /** durasi shift (jam simulasi) */
  hours: number;
  /** energi terkuras per shift */
  energyCost: number;
  /** mood terkuras per shift */
  moodCost: number;
  /** XP karier per shift */
  xp: number;
  desc: string;
}

/** tangga karier — dari kedai kopi sampe ngatur duit orang */
export const JOBS: JobDef[] = [
  {
    id: 'barista',
    name: 'Barista',
    icon: '☕',
    reqXp: 0,
    pay: 75,
    hours: 6,
    energyCost: 30,
    moodCost: 10,
    xp: 25,
    desc: 'Kedai kopi sudut jalan. Gaji kecil, obrolan pelanggan lumayan.'
  },
  {
    id: 'ojek',
    name: 'Driver Ojek',
    icon: '🛵',
    reqXp: 0,
    pay: 95,
    hours: 6,
    energyCost: 38,
    moodCost: 12,
    xp: 28,
    desc: 'Keliling kota antar penumpang. Bebas, tapi capek.'
  },
  {
    id: 'admin',
    name: 'Admin Toko',
    icon: '📦',
    reqXp: 50,
    pay: 150,
    hours: 7,
    energyCost: 32,
    moodCost: 14,
    xp: 38,
    desc: 'Urus stok & kasir. Rutin dan adem.'
  },
  {
    id: 'freelance',
    name: 'Freelance Dev',
    icon: '💻',
    reqXp: 160,
    pay: 280,
    hours: 6,
    energyCost: 34,
    moodCost: 10,
    xp: 60,
    desc: 'Kerja dari mana aja. Deadline bisa gila, gajinya nggak.'
  },
  {
    id: 'analyst',
    name: 'Staf Analis',
    icon: '📊',
    reqXp: 400,
    pay: 470,
    hours: 7,
    energyCost: 40,
    moodCost: 16,
    xp: 110,
    desc: 'Riset laporan keuangan. Otak diajak kerja serius.'
  },
  {
    id: 'prop',
    name: 'Trader Prop',
    icon: '💹',
    reqXp: 900,
    pay: 900,
    hours: 8,
    energyCost: 48,
    moodCost: 20,
    xp: 180,
    desc: 'Dana orang, tekanan orang. Tapi namamu di papan.'
  },
  {
    id: 'fundmgr',
    name: 'Fund Manager',
    icon: '🤵',
    reqXp: 1600,
    pay: 2100,
    hours: 8,
    energyCost: 46,
    moodCost: 18,
    xp: 260,
    desc: 'Ngatur duit miliaran. Puncak karier di kota ini.'
  }
];

export function jobById(id: string | null): JobDef | null {
  if (!id) return null;
  return JOBS.find((j) => j.id === id) ?? null;
}

/** biaya makan + transport per hari simulasi */
export const DAILY_COST = 55;

export interface LifeState {
  /** 0..100 — dibutuhkan buat kerja; habis = pingsan */
  energy: number;
  /** 0..100 — mood rendah nurunin fokus */
  mood: number;
  /** kerjaan sekarang, null = nganggur */
  jobId: string | null;
  /** XP karier kumulatif — buat buka kerjaan berikutnya */
  jobXp: number;
  /** lagi shift? */
  working: boolean;
  /** sisa jam shift berjalan */
  shiftLeft: number;
  /** sisa jam tidur/istirahat */
  restLeft: number;
  /** tick terakhir tagihan hidup dibayar (jadwal per 24 jam) */
  lastBillTick: number;
  /** tick terakhir jajan (cooldown) */
  lastSnackTick: number;
  /** utang kalau tagihan nggak kebayar */
  debt: number;
  /** job yang udah diumumin kebuka (anti spam notice) */
  announced: string[];
}

export function createLife(): LifeState {
  return {
    energy: 100,
    mood: 100,
    jobId: null,
    jobXp: 0,
    working: false,
    shiftLeft: 0,
    restLeft: 0,
    lastBillTick: 0,
    lastSnackTick: -999,
    debt: 0,
    announced: []
  };
}

function num(v: unknown, min: number, max: number, dflt: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}

export function normalizeLife(x: unknown): LifeState {
  const l = x as Partial<LifeState> | null | undefined;
  if (!l || typeof l !== 'object') return createLife();
  const jobId = typeof l.jobId === 'string' && jobById(l.jobId) ? l.jobId : null;
  return {
    energy: num(l.energy, 0, 100, 100),
    mood: num(l.mood, 0, 100, 100),
    jobId,
    jobXp: num(l.jobXp, 0, 1e9, 0),
    working: !!l.working && !!jobId,
    shiftLeft: Math.max(0, Math.round(Number(l.shiftLeft) || 0)),
    restLeft: Math.max(0, Math.round(Number(l.restLeft) || 0)),
    lastBillTick: Number.isFinite(Number(l.lastBillTick)) ? Number(l.lastBillTick) : 0,
    lastSnackTick: Number.isFinite(Number(l.lastSnackTick)) ? Number(l.lastSnackTick) : -999,
    debt: num(l.debt, 0, 1e9, 0),
    announced: Array.isArray(l.announced)
      ? l.announced.filter((a): a is string => typeof a === 'string')
      : []
  };
}

/** fokus 0..1 dari gabungan energi + mood — inti life sim ke trading */
export function focusOf(l: LifeState): number {
  return (l.energy * 0.55 + l.mood * 0.45) / 100;
}

/** multiplier fee akibat fokus: 1 = fit, 1.5 = totally capek */
export function focusFeeMult(state: SimState): number {
  const l = state.life;
  if (!l) return 1;
  return 1 + (1 - focusOf(l)) * 0.5;
}

/** multiplier fee final buat SEMUA jalur order: perk (diskon) × fokus (penalti capek) */
export function tradeFeeMult(state: SimState): number {
  return feeMultOf(state) * focusFeeMult(state);
}

function notice(state: SimState, msg: string): void {
  state.notices.push(msg);
  if (state.notices.length > 20) state.notices.splice(0, state.notices.length - 20);
}

// ---------- aksi pemain ----------

export interface LifeResult {
  ok: boolean;
  msg: string;
}

/** ngelamar kerjaan (butuh XP karier) */
export function applyJob(state: SimState, jobId: string): LifeResult {
  const job = jobById(jobId);
  const l = state.life;
  if (!job || !l) return { ok: false, msg: 'Kerjaan tidak ditemukan' };
  if (l.jobId === jobId) return { ok: false, msg: 'Udah kerja di sini' };
  if (l.jobXp < job.reqXp)
    return { ok: false, msg: `Butuh ${job.reqXp} XP karier (lo: ${Math.floor(l.jobXp)})` };
  if (l.working) return { ok: false, msg: 'Pulang kerja dulu sebelum pindah' };
  l.jobId = jobId;
  return { ok: true, msg: `Dapat kerjaan: ${job.icon} ${job.name}` };
}

export function quitJob(state: SimState): LifeResult {
  const l = state.life;
  const job = jobById(l?.jobId ?? null);
  if (!l || !job) return { ok: false, msg: 'Belum punya kerjaan' };
  if (l.working) return { ok: false, msg: 'Pulang kerja dulu sebelum resign' };
  l.jobId = null;
  return { ok: true, msg: `Resign dari ${job.name}` };
}

/** masuk / pulang shift */
export function toggleShift(state: SimState): LifeResult {
  const l = state.life;
  if (!l) return { ok: false, msg: 'Life state hilang' };
  if (l.restLeft > 0) return { ok: false, msg: 'Lagi tidur — bangun dulu' };
  if (l.working) {
    l.working = false;
    l.shiftLeft = 0;
    return { ok: true, msg: 'Pulang dari shift' };
  }
  const job = jobById(l.jobId);
  if (!job) return { ok: false, msg: 'Belum punya kerjaan — lamar dulu' };
  if (l.energy < 20) return { ok: false, msg: 'Energi di bawah 20 — istirahat dulu' };
  l.working = true;
  l.shiftLeft = job.hours;
  return { ok: true, msg: `Masuk shift ${job.name} · $${Math.round(job.pay / job.hours)}/jam` };
}

/** tidur 8 jam: energi & mood pulih, tapi nggak digaji */
export function takeSleep(state: SimState): LifeResult {
  const l = state.life;
  if (!l) return { ok: false, msg: 'Life state hilang' };
  if (l.restLeft > 0) return { ok: false, msg: 'Lagi tidur' };
  if (l.working) return { ok: false, msg: 'Pulang kerja dulu sebelum tidur' };
  l.restLeft = 8;
  return { ok: true, msg: 'Tidur 8 jam… zzz' };
}

/** jajan kopi: energi + mood instan, bayar $15, cooldown 6 jam */
export function takeSnack(state: SimState): LifeResult {
  const l = state.life;
  if (!l) return { ok: false, msg: 'Life state hilang' };
  const wait = 6 - (state.ticks - l.lastSnackTick);
  if (wait > 0) return { ok: false, msg: `Jajan lagi ${wait} jam lagi` };
  if (state.cash < 15) return { ok: false, msg: 'Uang nggak cukup buat jajan' };
  state.cash -= 15;
  l.lastSnackTick = state.ticks;
  l.energy = Math.min(100, l.energy + 12);
  l.mood = Math.min(100, l.mood + 8);
  return { ok: true, msg: 'Ngopi + gorengan. +12 energi, +8 mood' };
}

// ---------- tick ----------

function announceUnlocks(state: SimState, l: LifeState): void {
  for (const job of JOBS) {
    if (job.reqXp === 0) continue;
    if (l.announced.includes(job.id)) continue;
    if (l.jobXp >= job.reqXp) {
      l.announced.push(job.id);
      notice(state, `Karier baru terbuka: ${job.icon} ${job.name} — gaji $${job.pay}/shift`);
    }
  }
}

/** dipanggil engine tiap tick (1 jam) */
export function lifeTick(state: SimState, warmup = false): void {
  const l = state.life;
  if (!l) return;

  if (l.restLeft > 0) {
    // tidur: pulih cepat
    l.restLeft -= 1;
    l.energy = Math.min(100, l.energy + 9);
    l.mood = Math.min(100, l.mood + 3);
  } else if (l.working) {
    const job = jobById(l.jobId);
    if (!job) {
      l.working = false;
    } else {
      const per = 1 / job.hours;
      state.cash += job.pay * per;
      l.energy = Math.max(0, l.energy - job.energyCost * per);
      l.mood = Math.max(0, l.mood - job.moodCost * per);
      l.jobXp += job.xp * per;
      l.shiftLeft -= 1;
      if (l.energy <= 0) {
        // kelelahan → pingsan, dipaksa tidur
        l.working = false;
        l.shiftLeft = 0;
        l.restLeft = 6;
        l.mood = Math.max(0, l.mood - 15);
        notice(state, 'Kelelahan — kamu pingsan dan tidur 6 jam. Shift bubar.');
      } else if (l.shiftLeft <= 0) {
        l.working = false;
        if (!warmup) notice(state, `Shift ${job.icon} ${job.name} selesai · gaji $${Math.round(job.pay)}`);
      }
    }
  } else {
    // bangun, nggak kerja: pulih pelan
    l.energy = Math.min(100, l.energy + 0.7);
    l.mood = Math.min(100, l.mood + 0.25);
  }

  if (warmup) return;

  // umumin kerjaan yang kebuka (XP udah cukup)
  announceUnlocks(state, l);

  // tagihan hidup tiap hari (24 jam) — + anak $800/bln kalo lagi menikah
  const married = !!state.relationship && Object.values(state.relationship).some((r) => r?.level === 'spouse');
  const bill = DAILY_COST + (married ? KIDS_COST : 0);
  if (state.ticks - l.lastBillTick >= 24) {
    l.lastBillTick = state.ticks;
    if (state.cash >= bill) {
      state.cash -= bill;
    } else {
      const short = bill - Math.max(0, state.cash);
      state.cash = Math.max(0, state.cash);
      l.debt += short;
      l.mood = Math.max(0, l.mood - 10);
      notice(state, `Biaya hidup nggak kebayar · utang $${Math.round(l.debt)}`);
    }
  }

  // lunasi utang kalo duitnya lega
  if (l.debt > 0 && state.cash >= l.debt + 500) {
    state.cash -= l.debt;
    l.debt = 0;
    notice(state, 'Utang hidup lunas. Napas lega. 😌');
  }
}
