import type { PoliticalState, SimState } from './types';

/**
 * Politik & Kebijakan (V3.5 pilar 3).
 * - Pemain bisa masuk partai, lobi kebijakan, nyapres, dan menang jabatan.
 * - Kebijakan yang disahkan mempengaruhi macro, sektor, dan pajak.
 * - Reputasi politik tumbuh dari kebijakan populer dan donasi.
 */

export interface PoliticalPartyDef {
  id: string;
  name: string;
  icon: string;
  ideology: string;
  desc: string;
}

export const POLITICAL_PARTIES: PoliticalPartyDef[] = [
  { id: 'progress', name: 'Partai Progres', icon: '🌱', ideology: 'Pro-pasar & inovasi', desc: 'Dukung deregulasi & teknologi. Populer di kota.' },
  { id: 'solidaritas', name: 'Partai Solidaritas', icon: '🤝', ideology: 'Pro-rakyat & subsidi', desc: 'Dukung subsidi & proteksi. Populer di kelas menengah.' },
  { id: 'stabilitas', name: 'Partai Stabilitas', icon: '🏛️', ideology: 'Pro-ordo & keamanan', desc: 'Dukung stabilitas & hukum. Populer di elite.' }
];

export interface PolicyDef {
  id: string;
  name: string;
  icon: string;
  tier: number;
  cost: number; // biaya lobi
  desc: string;
  /** efek yang diterapkan saat disahkan */
  effect: (state: SimState) => void;
}

export const POLICY_DEFS: PolicyDef[] = [
  {
    id: 'tax_cut',
    name: 'Pemotongan Pajak',
    icon: '💸',
    tier: 1,
    cost: 25_000,
    desc: 'Pajak bisnis turun. Cashflow bisnis & korporasi naik.',
    effect: (s) => { s.macro.gdpGrowth = (s.macro.gdpGrowth ?? 0) + 0.005; }
  },
  {
    id: 'deregulation',
    name: 'Deregulasi',
    icon: '📜',
    tier: 1,
    cost: 30_000,
    desc: 'Aturan dilonggarkan. Sektor tech & media panas.',
    effect: (s) => { s.sectorHeat.Tech = (s.sectorHeat.Tech ?? 0) + 15; s.sectorHeat.Media = (s.sectorHeat.Media ?? 0) + 10; }
  },
  {
    id: 'subsidy',
    name: 'Subsidi Rakyat',
    icon: '🎁',
    tier: 2,
    cost: 60_000,
    desc: 'Subsidi konsumsi. Sektor consumer & retail naik.',
    effect: (s) => { s.sectorHeat.Consumer = (s.sectorHeat.Consumer ?? 0) + 20; s.macro.inflation = Math.max(0, (s.macro.inflation ?? 0) - 0.01); }
  },
  {
    id: 'rate_cut',
    name: 'Potong Suku Bunga',
    icon: '📉',
    tier: 2,
    cost: 80_000,
    desc: 'Suku bunga turun. Pasar naik, kredit murah.',
    effect: (s) => { s.macro.rate = Math.max(0, (s.macro.rate ?? 0) - 0.01); s.hypeIndex = Math.min(100, s.hypeIndex + 5); }
  },
  {
    id: 'infra',
    name: 'Infrastruktur',
    icon: '🏗️',
    tier: 3,
    cost: 150_000,
    desc: 'Jalan & bandara. GDP naik, sektor energy & finance panas.',
    effect: (s) => { s.macro.gdpGrowth = (s.macro.gdpGrowth ?? 0) + 0.01; s.sectorHeat.Energy = (s.sectorHeat.Energy ?? 0) + 12; s.sectorHeat.Finance = (s.sectorHeat.Finance ?? 0) + 8; }
  },
  {
    id: 'crackdown',
    name: 'Penegakan Hukum',
    icon: '⚖️',
    tier: 2,
    cost: 50_000,
    desc: 'Penegakan hukum. Reputasi naik, sektor spekulatif turun.',
    effect: (s) => { s.sectorHeat.Crypto = (s.sectorHeat.Crypto ?? 0) - 15; }
  }
];

export function politicalPartyDef(id: string): PoliticalPartyDef | undefined {
  return POLITICAL_PARTIES.find((p) => p.id === id);
}

export function policyDef(id: string): PolicyDef | undefined {
  return POLICY_DEFS.find((p) => p.id === id);
}

export function createPolitical(): PoliticalState {
  return { party: null, reputation: 0, influence: 0, policies: [], lastElectionTick: -999, office: 'none', lobbying: 0 };
}

export function normalizePolitical(p: unknown): PoliticalState {
  const x = p as Partial<PoliticalState> | null | undefined;
  if (!x || typeof x !== 'object') return createPolitical();
  const party = typeof x.party === 'string' && politicalPartyDef(x.party) ? x.party : null;
  const reputation = Math.max(0, Math.min(100, Number(x.reputation) || 0));
  const influence = Math.max(0, Math.min(100, Number(x.influence) || 0));
  const policies = Array.isArray(x.policies) ? x.policies.filter((id): id is string => typeof id === 'string' && !!policyDef(id)) : [];
  const office = x.office === 'mayor' || x.office === 'governor' || x.office === 'minister' ? x.office : 'none';
  return {
    party,
    reputation,
    influence,
    policies,
    lastElectionTick: Number(x.lastElectionTick) || -999,
    office,
    lobbying: Math.max(0, Number(x.lobbying) || 0)
  };
}

export interface PoliticalResult {
  ok: boolean;
  msg: string;
}

export function joinParty(state: SimState, partyId: string): PoliticalResult {
  const def = politicalPartyDef(partyId);
  if (!def) return { ok: false, msg: 'Partai tidak ditemukan' };
  const pol = state.political;
  if (pol.party === partyId) return { ok: false, msg: `Sudah di ${def.name}` };
  pol.party = partyId;
  pol.reputation = Math.max(pol.reputation, 10);
  pol.influence = Math.max(pol.influence, 5);
  return { ok: true, msg: `Bergabung dengan ${def.icon} ${def.name}` };
}

export function lobbyPolicy(state: SimState, policyId: string): PoliticalResult {
  const def = policyDef(policyId);
  if (!def) return { ok: false, msg: 'Kebijakan tidak ditemukan' };
  const pol = state.political;
  if (pol.policies.includes(policyId)) return { ok: false, msg: `${def.name} sudah disahkan` };
  if (pol.lobbying > state.ticks) return { ok: false, msg: 'Lobi masih cooldown' };
  if (state.cash < def.cost) return { ok: false, msg: `Cash kurang · lobi $${def.cost.toLocaleString('en-US')}` };
  // chance of success based on reputation + influence
  const chance = Math.min(0.9, 0.35 + pol.reputation / 200 + pol.influence / 200);
  state.cash -= def.cost;
  pol.lobbying = state.ticks + 6;
  if (Math.random() < chance) {
    pol.policies.push(policyId);
    def.effect(state);
    pol.reputation = Math.min(100, pol.reputation + 8);
    pol.influence = Math.min(100, pol.influence + 5);
    return { ok: true, msg: `Lobi berhasil · ${def.icon} ${def.name} disahkan` };
  }
  pol.reputation = Math.max(0, pol.reputation - 3);
  return { ok: false, msg: `Lobi gagal · ${def.name} ditolak` };
}

export function runElection(state: SimState): PoliticalResult {
  const pol = state.political;
  if (pol.lastElectionTick > 0 && state.ticks - pol.lastElectionTick < 48) {
    return { ok: false, msg: 'Pemilu berikutnya belum waktunya' };
  }
  pol.lastElectionTick = state.ticks;
  const support = pol.reputation + pol.influence * 0.5 + pol.policies.length * 5;
  const rival = 40 + Math.random() * 30;
  if (support >= rival) {
    if (pol.office === 'none') pol.office = 'mayor';
    else if (pol.office === 'mayor') pol.office = 'governor';
    else if (pol.office === 'governor') pol.office = 'minister';
    pol.reputation = Math.min(100, pol.reputation + 10);
    pol.influence = Math.min(100, pol.influence + 8);
    return { ok: true, msg: `Menang pemilu · jabatan naik ke ${pol.office}` };
  }
  pol.reputation = Math.max(0, pol.reputation - 8);
  return { ok: false, msg: 'Kalah pemilu · reputasi turun' };
}

export function politicalTick(state: SimState): void {
  const pol = state.political;
  if (!pol) return;
  // reputasi drift ke 30
  pol.reputation += (30 - pol.reputation) * 0.001;
  pol.reputation = Math.max(0, Math.min(100, pol.reputation));
  // pengaruh tumbuh pelan jika punya partai
  if (pol.party) pol.influence = Math.min(100, pol.influence + 0.02);
  // bonus cash dari jabatan
  if (pol.office === 'mayor') state.cash += 0.5;
  else if (pol.office === 'governor') state.cash += 1.5;
  else if (pol.office === 'minister') state.cash += 4;
}
