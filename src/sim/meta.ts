import type { SimState } from './types';
import { assetDef } from './lifestyle';

/**
 * Meta (Phase 13): rumah, kredit, dan bangkrut.
 * - `takeMortgage`: pinjam 70% nilai aset (rumah) → kredit aktif.
 * - `payOffLoan`: lunasi kredit pakai cash.
 * - `isBankrupt`: default bangkrut kalo kredit > 5x cash tersisa (bisa default bangkrut).
 */

export interface MetaState {
  bankrupt: boolean;
  mortgageAssetId: string | null;
  loan: number;
}

export function createMeta(): MetaState {
  return { bankrupt: false, mortgageAssetId: null, loan: 0 };
}

function num(v: unknown, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

export function normalizeMeta(x: unknown): MetaState {
  const m = x as Partial<MetaState> | null | undefined;
  if (!m || typeof m !== 'object') return createMeta();
  const bankrupt = !!m.bankrupt;
  const mortgageAssetId = typeof m.mortgageAssetId === 'string' ? m.mortgageAssetId : null;
  const loan = Math.max(0, num(m.loan, 0));
  return { bankrupt, mortgageAssetId, loan };
}

export function isBankrupt(state: SimState): boolean {
  const m = state.meta;
  if (!m) return false;
  if (m.bankrupt) return true;
  // default bangkrut kalo kreditnya > 5x cash — bangkrut = tidak ada jalan keluar
  return m.loan > 0 && state.cash < m.loan * 5;
}

export interface MetaResult {
  ok: boolean;
  msg: string;
}

/** ambil kredit buat aset (rumah) — butuh aset dimiliki & cash cukup buat down payment */
export function takeMortgage(state: SimState, assetId: string): MetaResult {
  const owned = state.lifestyle?.owned ?? [];
  const has = owned.includes(assetId);
  if (!has) return { ok: false, msg: 'Kamu belum punya aset itu' };
  const def = assetDef(assetId);
  const value = def?.price ?? 0;
  const loan = value * 0.7;
  const down = value * 0.3;
  if (state.cash < down) return { ok: false, msg: `Cash kurang buat down payment $${Math.round(down)}` };
  state.cash -= down;
  state.meta = { ...state.meta, bankrupt: false, mortgageAssetId: assetId, loan: state.meta?.loan + loan };
  return { ok: true, msg: `Kredit diambil: $${Math.round(loan)} (down payment $${Math.round(down)})` };
}

/** lunasi kredit — cash ditagih full loan */
export function payOffLoan(state: SimState): MetaResult {
  const m = state.meta;
  if (!m || m.loan <= 0) return { ok: false, msg: 'Belum ada kredit aktif' };
  if (state.cash < m.loan) return { ok: false, msg: `Cash kurang buat lunasi $${Math.round(m.loan)}` };
  state.cash -= m.loan;
  state.meta = { ...m, mortgageAssetId: null, loan: 0 };
  return { ok: true, msg: `Kredit lunas. Rumah makin awet di pundakmu. 🏠` };
}
