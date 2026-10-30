import type { SimState } from './types';

/**
 * Relationship (Phase 10): sosmed → kencan → nikah → anak.
 * Tiap bot punya level relasi sendiri: friend → date → spouse.
 * Biaya nyata: kencan $500, nikah $20.000, anak $800/bln.
 */

export const DATE_COST = 500;
export const MARRIAGE_COST = 20_000;
export const KIDS_COST = 800;

export const DATING_FRIENDSHIP_REQ = 60;
export const MARRIAGE_ACCEPT_FRIENDSHIP = 70;

export interface RelationshipState {
  level: 'none' | 'friend' | 'date' | 'spouse';
  /** progress menuju level berikutnya (0..100) */
  hearts: number;
  /** jumlah kencan dilakukan */
  dates: number;
}

export function createRelationship(): Record<string, RelationshipState> {
  return {};
}

function num(v: unknown, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

export function normalizeRelationship(x: unknown): Record<string, RelationshipState> {
  const r = x as Record<string, RelationshipState> | null | undefined;
  const out: Record<string, RelationshipState> = {};
  if (!r || typeof r !== 'object') return out;
  for (const [k, v] of Object.entries(r)) {
    const level = v?.level === 'friend' || v?.level === 'date' || v?.level === 'spouse' ? v.level : 'none';
    out[k] = {
      level,
      hearts: Math.max(0, Math.min(100, Math.round(num(v?.hearts, level === 'spouse' ? 100 : level === 'date' ? 30 : 0)))),
      dates: Math.max(0, Math.round(num(v?.dates, 0)))
    };
  }
  return out;
}

export function relationshipOf(state: SimState, botId: string): RelationshipState | undefined {
  return state.relationship?.[botId];
}

/** bot mana yang lagi menikah */
export function spouseOf(state: SimState): RelationshipState | undefined {
  const rels = state.relationship;
  if (!rels) return undefined;
  for (const v of Object.values(rels)) if (v?.level === 'spouse') return v;
  return undefined;
}

export interface RelationshipResult {
  ok: boolean;
  msg: string;
}

/** sosmed → kencan. Butuh friendship cukup. */
export function startDating(state: SimState, botId: string): RelationshipResult {
  const rel = state.relationship?.[botId];
  if (rel?.level === 'spouse') return { ok: false, msg: 'Kamu sudah menikah' };
  if (rel?.level === 'date') return { ok: false, msg: 'Kamu sudah kencan sama dia' };
  const fr = state.social.friendship[botId] ?? 0;
  if (fr < DATING_FRIENDSHIP_REQ)
    return { ok: false, msg: `Butuh friendship ${DATING_FRIENDSHIP_REQ} buat kencan (lo: ${Math.round(fr)})` };
  if (!state.relationship) state.relationship = {};
  state.relationship[botId] = {
    level: 'date',
    hearts: Math.max(30, rel?.hearts ?? 30),
    dates: (rel?.dates ?? 0) + 1
  };
  // biaya kencan → mood + friendship
  state.cash -= DATE_COST;
  state.life.mood = Math.min(100, state.life.mood + 12);
  const cur = state.social.friendship[botId] ?? 0;
  state.social.friendship[botId] = Math.min(100, cur + 12);
  return { ok: true, msg: `Kencan ditarik! ❤️ ${botId} (${state.bots.find((b) => b.id === botId)?.name ?? ''}) — mood naik` };
}

/** nikah. Butuh level 'date' + friendship cukup buat diterima. */
export function proposeMarriage(state: SimState, botId: string): RelationshipResult {
  const rel = state.relationship?.[botId];
  if (rel?.level === 'spouse') return { ok: false, msg: 'Kamu udah menikah' };
  if (!rel || rel.level !== 'date') return { ok: false, msg: 'Belum kencan dulu' };
  const fr = state.social.friendship[botId] ?? 0;
  if (state.cash < MARRIAGE_COST) return { ok: false, msg: `Belum cukup dana buat nikah (butuh $${MARRIAGE_COST})` };
  if (fr < MARRIAGE_ACCEPT_FRIENDSHIP)
    return { ok: false, msg: `Dia nanya-nanya. Friendship ${MARRIAGE_ACCEPT_FRIENDSHIP} belum cukup (lo: ${Math.round(fr)})` };

  state.cash -= MARRIAGE_COST;
  state.relationship[botId] = { level: 'spouse', hearts: 100, dates: rel.dates };
  state.life.mood = Math.min(100, state.life.mood + 25);
  state.profile.fame = Math.min(100, state.profile.fame + 8);
  return { ok: true, msg: `🥳 Nikah! ${state.bots.find((b) => b.id === botId)?.name ?? ''}` };
}

/** divorce / putus — opsional tapi biar state bisa balik */
export function divorce(state: SimState, botId: string): RelationshipResult {
  const rel = state.relationship?.[botId];
  if (rel?.level !== 'spouse') return { ok: false, msg: 'Belum menikah' };
  state.relationship[botId] = { level: 'friend', hearts: Math.max(40, (rel.hearts || 40) - 40), dates: Math.max(0, (rel.dates || 0) - 1) };
  return { ok: true, msg: 'Putus. Sedih, tapi hidup harus jalan. 💔' };
}
