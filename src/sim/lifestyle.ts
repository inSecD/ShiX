import type { SimState } from './types';

export type AssetCategory = 'property' | 'vehicle' | 'collection';

export interface AssetDef {
  id: string;
  name: string;
  icon: string;
  cat: AssetCategory;
  tier: number;
  price: number;
  /** biaya rawat per hari simulasi (1 hari = 24 tick) */
  upkeep: number;
  desc: string;
  /** deskripsi perk — efek mekanisnya dipetakan di fase berikutnya */
  perks: string[];
  /** lokasi open-world tempat aset ini muncul (untuk fase hub) */
  locId: string;
}

export const ASSET_DEFS: AssetDef[] = [
  // ---- Properti ----
  {
    id: 'house_basic',
    name: 'Rumah Suburban',
    icon: '🏠',
    cat: 'property',
    tier: 1,
    price: 150_000,
    upkeep: 40,
    desc: 'Rumah pertama. Sederhana, tapi udah punya tempat pulang.',
    perks: ['Buka lokasi: Rumah'],
    locId: 'home'
  },
  {
    id: 'apartment',
    name: 'Apartemen Pusat Kota',
    icon: '🏢',
    cat: 'property',
    tier: 2,
    price: 520_000,
    upkeep: 150,
    desc: 'Lantai tinggi, pemandangan kota, dekat bursa.',
    perks: ['Buka lokasi: Apartemen'],
    locId: 'apartment'
  },
  {
    id: 'villa',
    name: 'Villa Pantai',
    icon: '🏖️',
    cat: 'property',
    tier: 3,
    price: 2_200_000,
    upkeep: 650,
    desc: 'Private beach, kolam infinity, sunset tiap hari.',
    perks: ['Buka lokasi: Villa'],
    locId: 'villa'
  },
  {
    id: 'penthouse',
    name: 'Penthouse Skyline',
    icon: '🌆',
    cat: 'property',
    tier: 4,
    price: 8_500_000,
    upkeep: 2_100,
    desc: 'Atap kota. Rooftop party sampai pagi.',
    perks: ['Buka lokasi: Penthouse'],
    locId: 'penthouse'
  },
  {
    id: 'mansion',
    name: 'Mansion Bukit',
    icon: '🏰',
    cat: 'property',
    tier: 5,
    price: 26_000_000,
    upkeep: 6_500,
    desc: 'Kastil mini di puncak bukit, garda keamanan 24 jam.',
    perks: ['Buka lokasi: Mansion', 'Perk: fee trading −15%'],
    locId: 'mansion'
  },
  {
    id: 'island',
    name: 'Pulau Pribadi',
    icon: '🏝️',
    cat: 'property',
    tier: 6,
    price: 160_000_000,
    upkeep: 32_000,
    desc: 'Seluruh pulau. Status ultimate. Pajawat punya dermaga sendiri.',
    perks: ['Buka lokasi: Pulau', 'Perk: fee −25% · rumor +1 tier'],
    locId: 'island'
  },

  // ---- Kendaraan ----
  {
    id: 'motor',
    name: 'Motor Sport',
    icon: '🏍️',
    cat: 'vehicle',
    tier: 1,
    price: 9_000,
    upkeep: 8,
    desc: 'Kenceng, irit, bisa nembus macet.',
    perks: ['Buka lokasi: Garasi'],
    locId: 'garage'
  },
  {
    id: 'sports_car',
    name: 'Mobil Sport',
    icon: '🏎️',
    cat: 'vehicle',
    tier: 2,
    price: 140_000,
    upkeep: 90,
    desc: '0-100 dalam 3 detik. Flex pertama yang berasa.',
    perks: ['Buka lokasi: Garasi'],
    locId: 'garage'
  },
  {
    id: 'yacht',
    name: 'Yacht 50m',
    icon: '⛵',
    cat: 'vehicle',
    tier: 4,
    price: 3_400_000,
    upkeep: 2_600,
    desc: 'Kapal mewah buat pesta laut & networking.',
    perks: ['Buka lokasi: Marina', 'Perk: jeda ngobrol −3 jam'],
    locId: 'marina'
  },
  {
    id: 'jet',
    name: 'Jet Pribadi',
    icon: '✈️',
    cat: 'vehicle',
    tier: 6,
    price: 48_000_000,
    upkeep: 21_000,
    desc: 'Terbang kemanapun kapanpun. Time is money.',
    perks: ['Buka lokasi: Bandara', 'Perk: rumor 2× · fee −5%'],
    locId: 'airport'
  },

  // ---- Koleksi ----
  {
    id: 'watch',
    name: 'Jam Mewah',
    icon: '⌚',
    cat: 'collection',
    tier: 1,
    price: 65_000,
    upkeep: 12,
    desc: 'Rolex sekelas. Diam-diam nunjukin status.',
    perks: ['Buka lokasi: Rumah', 'Perk: jeda ngobrol −1 jam'],
    locId: 'home'
  },
  {
    id: 'art',
    name: 'Seni Klasik',
    icon: '🖼️',
    cat: 'collection',
    tier: 3,
    price: 900_000,
    upkeep: 220,
    desc: 'Karya seni yang nilainya naik pelan-pelan.',
    perks: ['Buka lokasi: Galeri'],
    locId: 'gallery'
  },
  {
    id: 'classic_car',
    name: 'Mobil Klasik',
    icon: '🚗',
    cat: 'collection',
    tier: 3,
    price: 1_600_000,
    upkeep: 350,
    desc: 'Antik yang dicari kolektor. Rarity tinggi.',
    perks: ['Buka lokasi: Garasi'],
    locId: 'garage'
  }
];

export function assetDef(id: string): AssetDef | undefined {
  return ASSET_DEFS.find((a) => a.id === id);
}

export interface LifestyleStats {
  spent: number;
  received: number;
  upkeepPaid: number;
}

export interface LifestyleState {
  owned: string[];
  lastUpkeepTick: number;
  stats: LifestyleStats;
}

export function createLifestyle(): LifestyleState {
  return { owned: [], lastUpkeepTick: 0, stats: { spent: 0, received: 0, upkeepPaid: 0 } };
}

export function normalizeLifestyle(ls: unknown, tick: number): LifestyleState {
  const l = ls as Partial<LifestyleState> | null | undefined;
  if (!l || typeof l !== 'object') return createLifestyle();
  const owned = Array.isArray(l.owned) ? l.owned.filter((id) => !!assetDef(id)) : [];
  const rawStats = (l.stats && typeof l.stats === 'object' ? l.stats : {}) as Partial<LifestyleStats>;
  return {
    owned,
    lastUpkeepTick: Number.isFinite(l.lastUpkeepTick) ? (l.lastUpkeepTick as number) : tick,
    stats: {
      spent: Number(rawStats.spent) || 0,
      received: Number(rawStats.received) || 0,
      upkeepPaid: Number(rawStats.upkeepPaid) || 0
    }
  };
}

export function ownedAssets(ls: LifestyleState): AssetDef[] {
  return ls.owned.map(assetDef).filter((a): a is AssetDef => !!a);
}

export function lifestyleAssetsValue(ls: LifestyleState): number {
  let sum = 0;
  for (const id of ls.owned) {
    const def = assetDef(id);
    if (def) sum += def.price;
  }
  return sum;
}

export function dailyUpkeep(ls: LifestyleState): number {
  let sum = 0;
  for (const id of ls.owned) {
    const def = assetDef(id);
    if (def) sum += def.upkeep;
  }
  return sum;
}

/** penjualan aset ilang 30% (illiquid) — biar spending tetep jadi lubang */
export const SELL_RATE = 0.7;

export interface AssetResult {
  ok: boolean;
  msg: string;
}

export function buyAsset(state: SimState, assetId: string): AssetResult {
  const def = assetDef(assetId);
  if (!def) return { ok: false, msg: 'Aset tidak ditemukan' };
  const ls = state.lifestyle;
  if (ls.owned.includes(assetId)) return { ok: false, msg: `Sudah punya ${def.name}` };
  if (!(state.cash >= def.price)) return { ok: false, msg: 'Dana tidak cukup buat beli aset ini' };

  state.cash -= def.price;
  ls.owned.push(assetId);
  ls.stats.spent += def.price;
  return { ok: true, msg: `Beli ${def.name} · rawat ${fmtMoney(def.upkeep)}/hari` };
}

export function sellAsset(state: SimState, assetId: string): AssetResult {
  const def = assetDef(assetId);
  if (!def) return { ok: false, msg: 'Aset tidak ditemukan' };
  const ls = state.lifestyle;
  const idx = ls.owned.indexOf(assetId);
  if (idx < 0) return { ok: false, msg: `Belum punya ${def.name}` };

  const proceeds = Math.round(def.price * SELL_RATE);
  ls.owned.splice(idx, 1);
  state.cash += proceeds;
  ls.stats.received += proceeds;
  return { ok: true, msg: `Jual ${def.name} · masuk ${fmtMoney(proceeds)}` };
}

/** debit biaya rawat tiap 1 hari simulasi (24 tick). No-op kalo belum punya aset. */
export function lifestyleTick(state: SimState): void {
  const ls = state.lifestyle;
  if (!ls) return;
  if (state.ticks - ls.lastUpkeepTick < 24) return;
  ls.lastUpkeepTick = state.ticks;

  const upkeep = dailyUpkeep(ls);
  if (!(upkeep > 0)) return;
  state.cash -= upkeep;
  ls.stats.upkeepPaid += upkeep;
}

function fmtMoney(v: number): string {
  return `$${Math.round(v).toLocaleString('en-US')}`;
}
