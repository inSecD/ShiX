import type { SimState } from './types';
import { equity } from './engine';

export interface Mission {
  id: string;
  icon: string;
  title: string;
  desc: string;
  hint: string;
  reward: number;
  /** tab to jump to when the player taps this mission */
  go: 'market' | 'launchpad' | 'world' | 'portfolio';
}

/**
 * Chained tutorial missions. Flags like `bought` / `bracket` are set by the
 * store when the matching action succeeds; `double` is evaluated live from
 * equity. Rewards are claimed once (tracked via sim.progress['claim_' + id]).
 */
export const MISSIONS: Mission[] = [
  {
    id: 'bought',
    icon: '🛒',
    title: 'Order pertama',
    desc: 'Beli aset pertama kamu — spot maupun futures.',
    hint: 'Market → pilih aset → tekan BELI / BUKA LONG.',
    reward: 1000,
    go: 'market'
  },
  {
    id: 'bracket',
    icon: '🛡️',
    title: 'Amankan posisi',
    desc: 'Pasang Stop Loss atau Take Profit di posisi yang terbuka.',
    hint: 'Setelah buka posisi, isi kolom TP / SL lalu Simpan Bracket.',
    reward: 1500,
    go: 'market'
  },
  {
    id: 'launched',
    icon: '🚀',
    title: 'Jadi developer',
    desc: 'Luncurkan tokenmu sendiri di launchpad.',
    hint: 'Launchpad → isi nama → Luncurkan Token.',
    reward: 2000,
    go: 'launchpad'
  },
  {
    id: 'graduated',
    icon: '🎓',
    title: 'Lulus bonding curve',
    desc: 'Bawa token milikmu sampai graduasi listing di spot.',
    hint: 'Beli token di curve sampai progress 100% (10x harga launch).',
    reward: 5000,
    go: 'launchpad'
  },
  {
    id: 'factory',
    icon: '🏭',
    title: 'Baron komoditas',
    desc: 'Bangun pabrik pertama kamu di tab Dunia.',
    hint: 'Dunia → pilih komoditas → Bangun Pabrik.',
    reward: 3000,
    go: 'world'
  },
  {
    id: 'double',
    icon: '👑',
    title: 'Sultan pasar',
    desc: 'Gandakan total aset sampai 2x modal awal.',
    hint: 'Kumpulkan equity 2x lipat dari modal awal.',
    reward: 10000,
    go: 'portfolio'
  }
];

export function missionMet(sim: SimState, m: Mission, startingCash: number): boolean {
  if (m.id === 'double') return equity(sim) >= startingCash * 2;
  return !!sim.progress[m.id];
}

export function missionClaimed(sim: SimState, m: Mission): boolean {
  return !!sim.progress['claim_' + m.id];
}

export interface MissionStatus {
  met: boolean;
  claimed: boolean;
  index: number;
}

export function missionStatus(sim: SimState, m: Mission, startingCash: number): MissionStatus {
  return {
    met: missionMet(sim, m, startingCash),
    claimed: missionClaimed(sim, m),
    index: MISSIONS.findIndex((x) => x.id === m.id)
  };
}

export function missionsProgress(sim: SimState, startingCash: number): { done: number; total: number } {
  let done = 0;
  for (const m of MISSIONS) if (missionMet(sim, m, startingCash)) done++;
  return { done, total: MISSIONS.length };
}

/**
 * Grant rewards for any newly completed, unclaimed missions.
 * Returns the messages for the missions that were just claimed.
 */
export function claimMissionRewards(sim: SimState, startingCash: number): string[] {
  const got: string[] = [];
  for (const m of MISSIONS) {
    if (!missionMet(sim, m, startingCash)) continue;
    if (missionClaimed(sim, m)) continue;
    sim.progress['claim_' + m.id] = true;
    sim.cash += m.reward;
    const msg = `MISI SELESAI: ${m.title} · hadiah +$${m.reward.toLocaleString('en-US')}`;
    got.push(msg);
    sim.notices.push(msg);
    if (sim.notices.length > 20) sim.notices.splice(0, sim.notices.length - 20);
  }
  return got;
}
