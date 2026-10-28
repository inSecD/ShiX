import type { SimState } from './types';

export interface BusinessDef {
  id: string;
  name: string;
  icon: string;
  tier: number;
  /** harga beli (level 1) */
  price: number;
  /** pendapatan per tick (1 tick = 1 jam) di level 1 */
  baseIncome: number;
  /** biaya jalan per hari simulasi (24 tick) di level 1 */
  upkeep: number;
  maxLevel: number;
  desc: string;
}

export const BUSINESS_DEFS: BusinessDef[] = [
  {
    id: 'coffee',
    name: 'Kedai Kopi',
    icon: '☕',
    tier: 1,
    price: 5_000,
    baseIncome: 1.2,
    upkeep: 12,
    maxLevel: 3,
    desc: 'Kedai kecil di sudut jalan. Pelanggan tetap, cashflow stabil.'
  },
  {
    id: 'foodtruck',
    name: 'Food Truck',
    icon: '🚚',
    tier: 2,
    price: 16_000,
    baseIncome: 4,
    upkeep: 30,
    maxLevel: 3,
    desc: 'Keliling kota ngejar kerumunan. Flexibel, cepat balik modal.'
  },
  {
    id: 'restaurant',
    name: 'Restoran',
    icon: '🍽️',
    tier: 3,
    price: 55_000,
    baseIncome: 13,
    upkeep: 95,
    maxLevel: 3,
    desc: 'Tempat makan rame. Antrian panjang tiap jam makan.'
  },
  {
    id: 'startup',
    name: 'Startup Tech',
    icon: '💻',
    tier: 4,
    price: 220_000,
    baseIncome: 48,
    upkeep: 420,
    maxLevel: 3,
    desc: 'Produk digital scale cepat. Volatile tapi upside gede.'
  },
  {
    id: 'bank',
    name: 'Bank Kecil',
    icon: '🏦',
    tier: 5,
    price: 1_200_000,
    baseIncome: 260,
    upkeep: 2_400,
    maxLevel: 3,
    desc: 'Pinjam-meminjam. Uang kerja sendiri tiap jam.'
  }
];

export function businessDef(id: string): BusinessDef | undefined {
  return BUSINESS_DEFS.find((b) => b.id === id);
}

export interface BusinessInstance {
  id: string;
  level: number;
}

export interface BusinessState {
  owned: BusinessInstance[];
  lastUpkeepTick: number;
}

const INCOME_MULT = 1.7; // per level
const UPKEEP_MULT = 1.35; // per level

/** pendapatan per tick untuk sebuah def di level tertentu (biar UI nggak hardcode multiplier) */
export function businessIncomeOf(def: BusinessDef, level: number): number {
  return def.baseIncome * levelMult(level, INCOME_MULT);
}

/** biaya jalan per hari untuk sebuah def di level tertentu */
export function businessUpkeepOf(def: BusinessDef, level: number): number {
  return def.upkeep * levelMult(level, UPKEEP_MULT);
}
export function createBusiness(): BusinessState {
  return { owned: [], lastUpkeepTick: 0 };
}

export function normalizeBusiness(bs: unknown, tick: number): BusinessState {
  const b = bs as Partial<BusinessState> | null | undefined;
  if (!b || typeof b !== 'object') return createBusiness();
  const owned: BusinessInstance[] = [];
  if (Array.isArray(b.owned)) {
    for (const o of b.owned) {
      const def = o && typeof o === 'object' ? businessDef((o as BusinessInstance).id) : undefined;
      if (!def) continue;
      const level = Math.max(1, Math.min(def.maxLevel, Math.round(Number((o as BusinessInstance).level) || 1)));
      if (owned.some((x) => x.id === def.id)) continue;
      owned.push({ id: def.id, level });
    }
  }
  return { owned, lastUpkeepTick: Number.isFinite(b.lastUpkeepTick) ? (b.lastUpkeepTick as number) : tick };
}

export function getBusiness(bs: BusinessState, id: string): BusinessInstance | undefined {
  return bs.owned.find((b) => b.id === id);
}

function levelMult(level: number, mult: number): number {
  return Math.pow(mult, level - 1);
}

/** pendapatan gabungan per tick (per jam simulasi) */
export function businessIncomePerTick(bs: BusinessState): number {
  let sum = 0;
  for (const b of bs.owned) {
    const def = businessDef(b.id);
    if (def) sum += def.baseIncome * levelMult(b.level, INCOME_MULT);
  }
  return sum;
}

/** biaya jalan gabungan per hari (24 tick) */
export function businessDailyUpkeep(bs: BusinessState): number {
  let sum = 0;
  for (const b of bs.owned) {
    const def = businessDef(b.id);
    if (def) sum += def.upkeep * levelMult(b.level, UPKEEP_MULT);
  }
  return sum;
}

/** nilai bisnis buat net worth = modal yang disetor (beli + semua upgrade), jadi net-worth-neutral */
export function businessValueOf(def: BusinessDef, level: number): number {
  return Math.round(def.price * (1 + 0.25 * level * (level - 1)));
}

export function businessesValue(bs: BusinessState): number {
  let sum = 0;
  for (const b of bs.owned) {
    const def = businessDef(b.id);
    if (def) sum += businessValueOf(def, b.level);
  }
  return sum;
}

/** biaya upgrade dari `level` ke `level+1` */
export function upgradeCost(def: BusinessDef, level: number): number {
  return Math.round(def.price * 0.5 * level);
}

export interface BusinessResult {
  ok: boolean;
  msg: string;
}

export function buyBusiness(state: SimState, businessId: string): BusinessResult {
  const def = businessDef(businessId);
  if (!def) return { ok: false, msg: 'Bisnis tidak ditemukan' };
  const bs = state.business;
  if (getBusiness(bs, businessId)) return { ok: false, msg: `Sudah punya ${def.name}` };
  if (!(state.cash >= def.price)) return { ok: false, msg: 'Dana tidak cukup buat beli bisnis ini' };

  state.cash -= def.price;
  bs.owned.push({ id: businessId, level: 1 });
  bs.lastUpkeepTick = state.ticks;
  return { ok: true, msg: `Beli ${def.name} · +${fmtMoney(def.baseIncome)}/jam` };
}

export function upgradeBusiness(state: SimState, businessId: string): BusinessResult {
  const def = businessDef(businessId);
  if (!def) return { ok: false, msg: 'Bisnis tidak ditemukan' };
  const bs = state.business;
  const inst = getBusiness(bs, businessId);
  if (!inst) return { ok: false, msg: `Belum punya ${def.name}` };
  if (inst.level >= def.maxLevel) return { ok: false, msg: `${def.name} sudah level maksimal` };

  const cost = upgradeCost(def, inst.level);
  if (!(state.cash >= cost)) return { ok: false, msg: 'Dana tidak cukup buat upgrade' };

  state.cash -= cost;
  inst.level += 1;
  return { ok: true, msg: `Upgrade ${def.name} → level ${inst.level}` };
}

/** tambah pendapatan tiap tick; debit biaya jalan tiap 1 hari (24 tick) */
export function businessTick(state: SimState): void {
  const bs = state.business;
  if (!bs) return;

  const income = businessIncomePerTick(bs);
  if (income > 0) state.cash += income;

  if (state.ticks - bs.lastUpkeepTick >= 24) {
    bs.lastUpkeepTick = state.ticks;
    const upkeep = businessDailyUpkeep(bs);
    if (upkeep > 0) state.cash -= upkeep;
  }
}

function fmtMoney(v: number): string {
  return `$${Math.round(v).toLocaleString('en-US')}`;
}
