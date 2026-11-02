import type { LegacyState, SimState } from './types';
import { equity } from './engine';
import { businessesValue } from './business';
import { corporateValue } from './corporate';
import { lifestyleAssetsValue } from './lifestyle';

/**
 * Legacy & Dinasti (V3.5 pilar 4).
 * - Endgame: skor prestise, pencapaian, dan dinasti.
 * - Pencapaian dibuka otomatis dan memberi bonus kecil.
 * - Prestise tumbuh dari kekayaan, pengaruh, dan empire yang dibangun.
 */

export interface LegacyAchievement {
  id: string;
  name: string;
  icon: string;
  desc: string;
  reward: string;
}

export const LEGACY_ACHIEVEMENTS: LegacyAchievement[] = [
  { id: 'nw_1m', name: 'Jutawan Pertama', icon: '💰', desc: 'Kekayaan bersih ≥ $1 juta', reward: '+5 fame' },
  { id: 'nw_10m', name: 'Multi-Jutawan', icon: '💎', desc: 'Kekayaan bersih ≥ $10 juta', reward: '+10 fame' },
  { id: 'nw_100m', name: 'Raja Kekayaan', icon: '👑', desc: 'Kekayaan bersih ≥ $100 juta', reward: '+20 fame' },
  { id: 'nw_1b', name: 'Miliarder', icon: '🏛️', desc: 'Kekayaan bersih ≥ $1 miliar', reward: '+50 fame' },
  { id: 'followers_10k', name: 'Influencer', icon: '📣', desc: '≥ 10.000 followers CT', reward: '+100 followers' },
  { id: 'media_mogul', name: 'Media Mogul', icon: '📰', desc: 'Punya ≥ 3 outlet media', reward: '+5 influence' },
  { id: 'corp_raider', name: 'Corporate Raider', icon: '🏢', desc: 'Punya ≥ 3 perusahaan', reward: '+$50.000 cash' },
  { id: 'politician', name: 'Politisi', icon: '🗳️', desc: 'Sahkan ≥ 3 kebijakan', reward: '+10 reputasi' },
  { id: 'property_tycoon', name: 'Property Tycoon', icon: '🏰', desc: 'Punya ≥ 5 aset lifestyle', reward: '+$25.000 cash' },
  { id: 'master_trader', name: 'Master Trader', icon: '📈', desc: '≥ 100 trade', reward: '+5 fame' },
  { id: 'survivor', name: 'Survivor', icon: '🛡️', desc: 'Bertahan ≥ 30 hari sim', reward: '+$10.000 cash' },
  { id: 'legacy_1000', name: 'Legenda', icon: '🌟', desc: 'Prestise ≥ 1000', reward: 'Gelar Legenda' }
];

export function createLegacy(): LegacyState {
  return { prestige: 0, dynasty: 0, heir: '', achievements: [], lastTick: 0, score: 0 };
}

export function normalizeLegacy(l: unknown): LegacyState {
  const x = l as Partial<LegacyState> | null | undefined;
  if (!x || typeof x !== 'object') return createLegacy();
  const validIds = new Set(LEGACY_ACHIEVEMENTS.map((a) => a.id));
const achievements = Array.isArray(x.achievements)
  ? x.achievements.filter((a): a is string => typeof a === 'string' && validIds.has(a))
  : [];
  return {
    prestige: Math.max(0, Math.min(10000, Number(x.prestige) || 0)),
    dynasty: Math.max(0, Math.floor(Number(x.dynasty) || 0)),
    heir: typeof x.heir === 'string' ? x.heir.slice(0, 40) : '',
    achievements,
    lastTick: Number(x.lastTick) || 0,
    score: Math.max(0, Math.floor(Number(x.score) || 0))
  };
}

/** hitung kekayaan bersih (dipakai buat prestise & achievement) */
export function netWorthOf(state: SimState): number {
  return equity(state) + businessesValue(state.business) + corporateValue(state) + lifestyleAssetsValue(state.lifestyle);
}

/** skor prestise 0..10000 */
export function legacyScore(state: SimState): number {
  const nw = netWorthOf(state);
  const nwScore = Math.min(4000, Math.floor(Math.log10(Math.max(1, nw)) * 600));
  const followerScore = Math.min(1500, Math.floor(state.profile.followers / 10));
  const bizScore = state.business.owned.length * 200 + state.corporate.owned.length * 400;
  const mediaScore = state.media.owned.length * 250 + state.media.influence * 5;
  const polScore = state.political.policies.length * 300 + (state.political.office === 'minister' ? 800 : state.political.office === 'governor' ? 400 : state.political.office === 'mayor' ? 200 : 0);
  const tradeScore = Math.min(1000, state.fills.length * 2);
  const dayScore = Math.min(1000, Math.floor(state.ticks / 24) * 5);
  return nwScore + followerScore + bizScore + mediaScore + polScore + tradeScore + dayScore;
}

export interface LegacyResult {
  ok: boolean;
  msg: string;
}

export function nameHeir(state: SimState, name: string): LegacyResult {
  const clean = name.trim().slice(0, 40);
  if (!clean) return { ok: false, msg: 'Nama pewaris kosong' };
  state.legacy.heir = clean;
  return { ok: true, msg: `Pewaris dinasti: ${clean}` };
}

/** claim prestise: konversi skor jadi prestise (tidak reset progres) */
export function claimPrestige(state: SimState): LegacyResult {
  const score = legacyScore(state);
  if (score <= state.legacy.score) {
    return { ok: false, msg: `Prestise belum naik (skor ${score}, tercatat ${state.legacy.score})` };
  }
  const gained = score - state.legacy.score;
  state.legacy.score = score;
  state.legacy.prestige = Math.min(10000, state.legacy.prestige + gained);
  state.legacy.dynasty = Math.floor(state.legacy.prestige / 1000);
  state.legacy.lastTick = state.ticks;
  return { ok: true, msg: `Prestise +${gained} · total ${state.legacy.prestige}` };
}

/** cek & buka pencapaian baru, beri bonus */
export function legacyTick(state: SimState): void {
  const L = state.legacy;
  const nw = netWorthOf(state);
  const checks: Record<string, boolean> = {
    nw_1m: nw >= 1_000_000,
    nw_10m: nw >= 10_000_000,
    nw_100m: nw >= 100_000_000,
    nw_1b: nw >= 1_000_000_000,
    followers_10k: state.profile.followers >= 10_000,
    media_mogul: state.media.owned.length >= 3,
    corp_raider: state.corporate.owned.length >= 3,
    politician: state.political.policies.length >= 3,
    property_tycoon: state.lifestyle.owned.length >= 5,
    master_trader: state.fills.length >= 100,
    survivor: state.ticks >= 30 * 24,
    legacy_1000: L.prestige >= 1000
  };
  for (const ach of LEGACY_ACHIEVEMENTS) {
    if (L.achievements.includes(ach.id)) continue;
    if (!checks[ach.id]) continue;
    L.achievements.push(ach.id);
    // bonus
    switch (ach.id) {
      case 'nw_1m':
      case 'nw_10m':
      case 'nw_100m':
      case 'nw_1b':
        state.profile.fame = Math.min(100, state.profile.fame + (ach.id === 'nw_1m' ? 5 : ach.id === 'nw_10m' ? 10 : ach.id === 'nw_100m' ? 20 : 50));
        break;
      case 'followers_10k':
        state.profile.followers += 100;
        break;
      case 'media_mogul':
        state.media.influence = Math.min(100, state.media.influence + 5);
        break;
      case 'corp_raider':
        state.cash += 50_000;
        break;
      case 'politician':
        state.political.reputation = Math.min(100, state.political.reputation + 10);
        break;
      case 'property_tycoon':
        state.cash += 25_000;
        break;
      case 'master_trader':
        state.profile.fame = Math.min(100, state.profile.fame + 5);
        break;
      case 'survivor':
        state.cash += 10_000;
        break;
    }
  }
  L.lastTick = state.ticks;
}
