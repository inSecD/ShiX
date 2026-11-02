import type { CorporateCompanyInstance, CorporateState, SimState } from './types';

/**
 * Corporate & Bisnis (V3.5 pilar 2).
 * - Perusahaan yang lebih besar dari bisnis kecil: karyawan, upgrade, IPO, M&A.
 * - Pendapatan per tick dipengaruhi level, jumlah karyawan, reputasi, dan heat sektor.
 */

export interface CorporateCompanyDef {
  id: string;
  name: string;
  icon: string;
  tier: number;
  price: number;
  baseRevenue: number;
  upkeep: number;
  maxEmployees: number;
  maxLevel: number;
  sector: string;
  desc: string;
}

export const CORPORATE_DEFS: CorporateCompanyDef[] = [
  { id: 'techcorp', name: 'Tech Corp', icon: '💻', tier: 1, price: 80_000, baseRevenue: 12, upkeep: 90, maxEmployees: 6, maxLevel: 4, sector: 'Tech', desc: 'Perusahaan software. Scale cepat, butuh talenta.' },
  { id: 'mediaco', name: 'Media Co', icon: '📰', tier: 2, price: 150_000, baseRevenue: 18, upkeep: 140, maxEmployees: 8, maxLevel: 4, sector: 'Media', desc: 'Rumah produksi & portal. Sinergi dengan Media Empire.' },
  { id: 'bankcorp', name: 'Bank Corp', icon: '🏦', tier: 3, price: 400_000, baseRevenue: 45, upkeep: 360, maxEmployees: 10, maxLevel: 4, sector: 'Finance', desc: 'Lembaga keuangan. Stabil, tapi diawasi ketat.' },
  { id: 'energyco', name: 'Energy Co', icon: '⚡', tier: 4, price: 900_000, baseRevenue: 95, upkeep: 780, maxEmployees: 12, maxLevel: 4, sector: 'Energy', desc: 'Energi & komoditas. Besar, lambat, tapi kuat.' },
  { id: 'retailchain', name: 'Retail Chain', icon: '🛒', tier: 3, price: 260_000, baseRevenue: 32, upkeep: 240, maxEmployees: 14, maxLevel: 4, sector: 'Consumer', desc: 'Jaringan toko. Volume tinggi, margin tipis.' }
];

export function corporateDef(id: string): CorporateCompanyDef | undefined {
  return CORPORATE_DEFS.find((c) => c.id === id);
}

export function createCorporate(): CorporateState {
  return { owned: [], lastTick: 0 };
}

export function normalizeCorporate(c: unknown): CorporateState {
  const x = c as Partial<CorporateState> | null | undefined;
  if (!x || typeof x !== 'object') return createCorporate();
  const owned: CorporateCompanyInstance[] = [];
  if (Array.isArray(x.owned)) {
    for (const o of x.owned) {
      const def = o && typeof o === 'object' ? corporateDef((o as CorporateCompanyInstance).id) : undefined;
      if (!def) continue;
      const level = Math.max(1, Math.min(def.maxLevel, Math.round(Number((o as CorporateCompanyInstance).level) || 1)));
      const employees = Math.max(1, Math.min(def.maxEmployees * level, Math.round(Number((o as CorporateCompanyInstance).employees) || 1)));
      const reputation = Math.max(0, Math.min(100, Number((o as CorporateCompanyInstance).reputation) || 50));
      const ipo = !!(o as CorporateCompanyInstance).ipo;
      const sharesOutstanding = Math.max(100, Math.round(Number((o as CorporateCompanyInstance).sharesOutstanding) || (ipo ? 1000 : 100)));
      const playerShares = Math.max(0, Math.min(100, Number((o as CorporateCompanyInstance).playerShares) || (ipo ? 60 : 100)));
      if (owned.some((x) => x.id === def.id)) continue;
      owned.push({ id: def.id, level, employees, reputation, ipo, sharesOutstanding, playerShares, acquiredAt: Number((o as CorporateCompanyInstance).acquiredAt) || 0 });
    }
  }
  return { owned, lastTick: Number(x.lastTick) || 0 };
}

export interface CorporateResult {
  ok: boolean;
  msg: string;
}

function companyValue(def: CorporateCompanyDef, inst: CorporateCompanyInstance): number {
  const base = def.price * Math.pow(1.35, inst.level - 1);
  const empBonus = 1 + inst.employees * 0.08;
  const ipoMult = inst.ipo ? 1.6 : 1;
  return Math.round(base * empBonus * ipoMult);
}

export function corporateValue(state: SimState): number {
  let sum = 0;
  for (const inst of state.corporate.owned) {
    const def = corporateDef(inst.id);
    if (def) sum += Math.round(companyValue(def, inst) * (inst.playerShares / 100));
  }
  return sum;
}

export function buyCorporate(state: SimState, companyId: string): CorporateResult {
  const def = corporateDef(companyId);
  if (!def) return { ok: false, msg: 'Perusahaan tidak ditemukan' };
  const corp = state.corporate;
  if (corp.owned.some((c) => c.id === companyId)) return { ok: false, msg: `Sudah punya ${def.name}` };
  if (state.cash < def.price) return { ok: false, msg: `Cash kurang · butuh $${def.price.toLocaleString('en-US')}` };
  state.cash -= def.price;
  corp.owned.push({ id: companyId, level: 1, employees: 2, reputation: 50, ipo: false, sharesOutstanding: 100, playerShares: 100, acquiredAt: state.simTime });
  return { ok: true, msg: `Akuisisi ${def.icon} ${def.name} · karyawan 2` };
}

export function hireCorporate(state: SimState, companyId: string): CorporateResult {
  const def = corporateDef(companyId);
  const inst = state.corporate.owned.find((c) => c.id === companyId);
  if (!def || !inst) return { ok: false, msg: 'Perusahaan tidak ditemukan' };
  const cap = def.maxEmployees * inst.level;
  if (inst.employees >= cap) return { ok: false, msg: `${def.name} sudah penuh (${cap} karyawan)` };
  const salary = 120;
  if (state.cash < salary) return { ok: false, msg: 'Cash kurang buat gaji' };
  state.cash -= salary;
  inst.employees += 1;
  inst.reputation = Math.min(100, inst.reputation + 1);
  return { ok: true, msg: `Hire 1 karyawan · ${def.name} total ${inst.employees}/${cap}` };
}

export function upgradeCorporate(state: SimState, companyId: string): CorporateResult {
  const def = corporateDef(companyId);
  const inst = state.corporate.owned.find((c) => c.id === companyId);
  if (!def || !inst) return { ok: false, msg: 'Perusahaan tidak ditemukan' };
  if (inst.level >= def.maxLevel) return { ok: false, msg: `${def.name} sudah level maksimal` };
  const cost = Math.round(def.price * 0.5 * inst.level);
  if (state.cash < cost) return { ok: false, msg: `Cash kurang · upgrade $${cost.toLocaleString('en-US')}` };
  state.cash -= cost;
  inst.level += 1;
  inst.reputation = Math.min(100, inst.reputation + 3);
  return { ok: true, msg: `Upgrade ${def.name} → Lv.${inst.level}` };
}

export function ipoCorporate(state: SimState, companyId: string): CorporateResult {
  const def = corporateDef(companyId);
  const inst = state.corporate.owned.find((c) => c.id === companyId);
  if (!def || !inst) return { ok: false, msg: 'Perusahaan tidak ditemukan' };
  if (inst.ipo) return { ok: false, msg: `${def.name} sudah IPO` };
  if (inst.level < 2 || inst.employees < 3) return { ok: false, msg: 'Butuh level ≥2 dan ≥3 karyawan buat IPO' };
  inst.ipo = true;
  inst.sharesOutstanding = 1000;
  inst.playerShares = 60;
  const raised = Math.round(companyValue(def, inst) * 0.4);
  state.cash += raised;
  inst.reputation = Math.min(100, inst.reputation + 5);
  return { ok: true, msg: `IPO ${def.name} · lepas 40% saham · +$${raised.toLocaleString('en-US')} cash` };
}

export function acquireCorporate(state: SimState, companyId: string): CorporateResult {
  const def = corporateDef(companyId);
  if (!def) return { ok: false, msg: 'Target tidak ditemukan' };
  const corp = state.corporate;
  if (corp.owned.some((c) => c.id === companyId)) return { ok: false, msg: `Sudah punya ${def.name}` };
  const cost = Math.round(def.price * 1.3);
  if (state.cash < cost) return { ok: false, msg: `Cash kurang · akuisisi $${cost.toLocaleString('en-US')}` };
  state.cash -= cost;
  corp.owned.push({ id: companyId, level: 1, employees: 2, reputation: 40, ipo: false, sharesOutstanding: 100, playerShares: 100, acquiredAt: state.simTime });
  // boost reputasi perusahaan lain (sinergi)
  for (const c of corp.owned) if (c.id !== companyId) c.reputation = Math.min(100, c.reputation + 2);
  return { ok: true, msg: `Akuisisi ${def.icon} ${def.name} · $${cost.toLocaleString('en-US')}` };
}

export function dividendCorporate(state: SimState, companyId: string): CorporateResult {
  const def = corporateDef(companyId);
  const inst = state.corporate.owned.find((c) => c.id === companyId);
  if (!def || !inst) return { ok: false, msg: 'Perusahaan tidak ditemukan' };
  if (!inst.ipo) return { ok: false, msg: `${def.name} belum IPO, belum bisa dividen` };
  const payout = Math.round(companyValue(def, inst) * 0.03 * (inst.playerShares / 100));
  state.cash += payout;
  inst.reputation = Math.min(100, inst.reputation + 2);
  return { ok: true, msg: `Dividen ${def.name} · +$${payout.toLocaleString('en-US')}` };
}

export function corporateTick(state: SimState): void {
  const corp = state.corporate;
  if (!corp || corp.owned.length === 0) return;
  for (const inst of corp.owned) {
    const def = corporateDef(inst.id);
    if (!def) continue;
    const heat = (state.sectorHeat?.[def.sector] ?? 0) / 100;
    const revenue = def.baseRevenue * Math.pow(1.25, inst.level - 1) * (1 + inst.employees * 0.12) * (1 + heat) * (inst.reputation / 100) * (inst.playerShares / 100);
    const salary = inst.employees * 0.8;
    state.cash += Math.max(0, revenue - salary);
    // reputasi drift ke 50
    inst.reputation += (50 - inst.reputation) * 0.002;
    inst.reputation = Math.max(0, Math.min(100, inst.reputation));
  }
}
