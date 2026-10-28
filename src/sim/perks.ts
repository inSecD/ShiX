import type { SimState } from './types';

/**
 * Perk aktif (Fase 5) — dipetakan dari aset & bisnis yang dimiliki.
 * Fee & sosial adalah dua mesin utama game, jadi perk nancep di sana:
 * gaya hidup ngasih efek mekanis, bukan cuma kumpulan angka.
 */
export interface PerkEffects {
  /** potongan fee trading (0.15 = fee −15%) */
  feeDiscount: number;
  /** pengurangan jeda ngobrol NPC (tick) */
  chatCooldownCut: number;
  /** multiplier chance rumor bocor pas ngobrol */
  rumorChanceMult: number;
  /** bonus tier presisi rumor (1 = bocoran selangkah lebih tajam) */
  rumorTierBonus: number;
}

const NEUTRAL: PerkEffects = {
  feeDiscount: 0,
  chatCooldownCut: 0,
  rumorChanceMult: 1,
  rumorTierBonus: 0
};

/** perk dari aset lifestyle */
const ASSET_PERKS: Record<string, Partial<PerkEffects>> = {
  watch: { chatCooldownCut: 1 }, // jam mewah → status membuka obrolan
  mansion: { feeDiscount: 0.15 }, // home office → relasi → fee lebih murah
  yacht: { chatCooldownCut: 3 }, // pesta networking → gossip lebih cepat
  jet: { rumorChanceMult: 2, feeDiscount: 0.05 }, // orang dalam → info lebih sering & akses murah
  island: { feeDiscount: 0.25, rumorTierBonus: 1 } // status offshore + sinyal sendiri
};

/** perk dari bisnis yang dijalankan */
const BUSINESS_PERKS: Record<string, Partial<PerkEffects>> = {
  coffee: { chatCooldownCut: 1 }, // kedai → tempat nongkrong
  bank: { feeDiscount: 0.08 } // relasi perbankan → fee lebih murah
};

function feeCap(v: number): number {
  return Math.max(0, Math.min(0.5, v));
}

/** gabungkan semua perk dari aset + bisnis yang dimiliki */
export function perksOf(state: SimState): PerkEffects {
  const out: PerkEffects = { ...NEUTRAL };

  for (const id of state.lifestyle?.owned ?? []) {
    const p = ASSET_PERKS[id];
    if (!p) continue;
    out.feeDiscount += p.feeDiscount ?? 0;
    out.chatCooldownCut += p.chatCooldownCut ?? 0;
    out.rumorChanceMult *= p.rumorChanceMult ?? 1;
    out.rumorTierBonus += p.rumorTierBonus ?? 0;
  }
  for (const b of state.business?.owned ?? []) {
    const p = BUSINESS_PERKS[b.id];
    if (!p) continue;
    out.feeDiscount += p.feeDiscount ?? 0;
    out.chatCooldownCut += p.chatCooldownCut ?? 0;
    out.rumorChanceMult *= p.rumorChanceMult ?? 1;
    out.rumorTierBonus += p.rumorTierBonus ?? 0;
  }

  out.feeDiscount = feeCap(out.feeDiscount);
  out.rumorChanceMult = Math.min(3, out.rumorChanceMult);
  out.rumorTierBonus = Math.min(2, out.rumorTierBonus);
  return out;
}

/** multiplier fee yang dipakai semua jalur order (1 = tanpa perk) */
export function feeMultOf(state: SimState): number {
  return 1 - perksOf(state).feeDiscount;
}

export interface ActivePerk {
  icon: string;
  name: string;
  text: string;
}

/** deskripsi perk aktif, buat ditampilin di UI */
export function activePerks(state: SimState): ActivePerk[] {
  const out: ActivePerk[] = [];
  const p = perksOf(state);
  if (p.feeDiscount > 0) {
    out.push({ icon: '💼', name: 'Relasi & Akses', text: `Fee trading −${Math.round(p.feeDiscount * 100)}%` });
  }
  if (p.chatCooldownCut > 0) {
    out.push({ icon: '☕', name: 'Networking', text: `Jeda ngobrol NPC −${p.chatCooldownCut} jam` });
  }
  if (p.rumorChanceMult > 1) {
    out.push({ icon: '📡', name: 'Orang Dalam', text: `Rumor bocor ${p.rumorChanceMult.toFixed(1)}× lebih sering` });
  }
  if (p.rumorTierBonus > 0) {
    out.push({ icon: '🕵️', name: 'Sinyal Satelit', text: `Presisi rumor +${p.rumorTierBonus} tier` });
  }
  return out;
}

/** apakah aset/bisnis ini punya perk mekanis (buat label di kartu) */
export function perkHint(kind: 'asset' | 'business', id: string): string | null {
  const p = kind === 'asset' ? ASSET_PERKS[id] : BUSINESS_PERKS[id];
  if (!p) return null;
  const bits: string[] = [];
  if (p.feeDiscount) bits.push(`fee −${Math.round(p.feeDiscount * 100)}%`);
  if (p.chatCooldownCut) bits.push(`jeda ngobrol −${p.chatCooldownCut}j`);
  if (p.rumorChanceMult) bits.push(`rumor ${p.rumorChanceMult}×`);
  if (p.rumorTierBonus) bits.push(`rumor +${p.rumorTierBonus} tier`);
  return bits.length ? `✦ Perk: ${bits.join(' · ')}` : null;
}
