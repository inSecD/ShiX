import type { SimState } from './types';
import { RNG } from './rng';

/**
 * Mini-game (Phase 12): otot cepat & reward.
 * - 'chart': Chart Frenzy — baca 8 candle, score dari rng, reward cash + score*25, mood + score*3
 * - 'mood': Relax Run — latihan relaksasi, reward mood +15, cash -20, fame +2
 */

export interface MinigameResult {
  ok: boolean;
  msg: string;
  score?: number;
  rewardCash?: number;
  rewardMood?: number;
  rewardFame?: number;
}

export const MINIGAME_KINDS = ['chart', 'mood'] as const;
export type MinigameKind = (typeof MINIGAME_KINDS)[number];

function rngOf(state: SimState): RNG {
  return new RNG((state.rngState ^ Date.now()) >>> 0);
}

export function runMinigame(state: SimState, kind: string): MinigameResult {
  if (kind === 'chart') {
    const rng = rngOf(state);
    const score = rng.int(0, 8);
    const rewardCash = score * 25;
    const rewardMood = score * 3;
    state.cash += rewardCash;
    state.life.mood = Math.max(0, Math.min(100, state.life.mood + rewardMood));
    state.profile.fame = Math.max(0, Math.min(100, state.profile.fame + Math.round(rewardCash / 500)));
    state.rngState = rng.state;
    return {
      ok: true,
      msg: `Chart Frenzy selesai · score ${score}/8 · +$${rewardCash} · +${rewardMood} mood`,
      score,
      rewardCash,
      rewardMood
    };
  }

  if (kind === 'mood') {
    state.life.mood = Math.min(100, state.life.mood + 15);
    state.cash = Math.max(0, state.cash - 20);
    state.profile.fame = Math.min(100, state.profile.fame + 2);
    state.rngState = rngOf(state).state;
    return { ok: true, msg: 'Relax Run selesai · +15 mood · -$20 cash · +2 fame', rewardMood: 15 };
  }

  return { ok: false, msg: 'Minigame tidak dikenal' };
}
