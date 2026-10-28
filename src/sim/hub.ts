import { assetDef } from './lifestyle';

export interface LocationDef {
  id: string;
  name: string;
  icon: string;
  /** posisi di peta (persen 0-100) */
  x: number;
  y: number;
  mood: string;
  desc: string;
  /** baris flavor yang muncul saat tiba (basis buat CT Feed Fase 3b) */
  flavor: string;
  /** aset yang harus dimiliki buat membuka lokasi (any-of). kosong = selalu terbuka */
  requires: string[];
}

/** peta dunia: kota (kiri/atas), residensial (tengah/bawah), waterfront (kanan/bawah), bukit+udara (kanan/atas) */
export const LOCATIONS: LocationDef[] = [
  {
    id: 'street',
    name: 'Jalan Kota',
    icon: '🛣️',
    x: 18,
    y: 46,
    mood: 'Ramai',
    desc: 'Simpul jantung kota. Semua rute tembus dari sini.',
    flavor: 'Deru motor, neon toko, dan bau gorengan di tikungan.',
    requires: []
  },
  {
    id: 'park',
    name: 'Taman Kota',
    icon: '🌳',
    x: 34,
    y: 30,
    mood: 'Tenang',
    desc: 'Titik napas di tengah hiruk-pikuk. Tempat rehat gratis.',
    flavor: 'Angin sepoi, ojek payung, dan pelancong yang lagi selfie.',
    requires: []
  },
  {
    id: 'cafe',
    name: 'Kafe Degen',
    icon: '☕',
    x: 9,
    y: 64,
    mood: 'Santai',
    desc: 'Nongkrong sesama trader. Rumornya mengalir di sini.',
    flavor: 'Secangkir kopi dingin dan dua orang heboh soal chart.',
    requires: []
  },
  {
    id: 'bursa',
    name: 'Lantai Bursa',
    icon: '📈',
    x: 45,
    y: 52,
    mood: 'Panas',
    desc: 'Nadi pasar. Layar merah-hijau berkedut tanpa henti.',
    flavor: 'Bel berbunyi. Seseorang menangis di sudut, yang lain melompat.',
    requires: []
  },
  {
    id: 'home',
    name: 'Rumah',
    icon: '🏠',
    x: 24,
    y: 74,
    mood: 'Pulang',
    desc: 'Tempat pulang pertama. Sederhana, tapi punya arti.',
    flavor: 'Aroma masakan dan lampu hangat menunggu di balik pintu.',
    requires: ['house_basic', 'watch']
  },
  {
    id: 'garage',
    name: 'Garasi',
    icon: '🔧',
    x: 7,
    y: 84,
    mood: 'Mesin',
    desc: 'Sarang kendaraan. Bensin, knalpot, dan ambisi.',
    flavor: 'Bau oli dan detak mesin yang baru dinyalakan.',
    requires: ['motor', 'sports_car', 'classic_car']
  },
  {
    id: 'apartment',
    name: 'Apartemen',
    icon: '🏢',
    x: 53,
    y: 32,
    mood: 'Modern',
    desc: 'Lantai tinggi dekat bursa. Pemandangan kota 24 jam.',
    flavor: 'Kaca floor-to-ceiling dan lift yang selalu dingin.',
    requires: ['apartment']
  },
  {
    id: 'gallery',
    name: 'Galeri Seni',
    icon: '🖼️',
    x: 39,
    y: 14,
    mood: 'Halus',
    desc: 'Dinding putih dan karya yang nilainya naik pelan-pelan.',
    flavor: 'Bisik pelan, lantai kayu, dan satu karya yang bikin berhenti.',
    requires: ['art']
  },
  {
    id: 'penthouse',
    name: 'Penthouse',
    icon: '🌆',
    x: 60,
    y: 20,
    mood: 'Elite',
    desc: 'Atap kota. Rooftop party sampai fajar.',
    flavor: 'DJ set jauh di bawah, kota berkilau seperti peta bintang.',
    requires: ['penthouse']
  },
  {
    id: 'mansion',
    name: 'Mansion Bukit',
    icon: '🏰',
    x: 74,
    y: 24,
    mood: 'Agung',
    desc: 'Kastil mini di puncak bukit, garda 24 jam.',
    flavor: 'Gerbang besi terbuka perlahan. Kolam berkilau di kejauhan.',
    requires: ['mansion']
  },
  {
    id: 'marina',
    name: 'Marina',
    icon: '⛵',
    x: 64,
    y: 76,
    mood: 'Bebas',
    desc: 'Dermaga kapal mewah. Ombak dan angin asin.',
    flavor: 'Tali tambat berderak dan burung laut mengejar ikan.',
    requires: ['yacht']
  },
  {
    id: 'villa',
    name: 'Villa Pantai',
    icon: '🏖️',
    x: 80,
    y: 70,
    mood: 'Syahdu',
    desc: 'Private beach, kolam infinity, sunset tiap hari.',
    flavor: 'Pasir putih dan jingga senja yang meleleh ke laut.',
    requires: ['villa']
  },
  {
    id: 'airport',
    name: 'Bandara',
    icon: '✈️',
    x: 88,
    y: 42,
    mood: 'Bergerak',
    desc: 'Landasan pribadi. Kemanapun, kapanpun.',
    flavor: 'Baling-baling berputar dan peta dunia terbentang di kokpit.',
    requires: ['jet']
  },
  {
    id: 'island',
    name: 'Pulau Pribadi',
    icon: '🏝️',
    x: 90,
    y: 88,
    mood: 'Ultimate',
    desc: 'Seluruh pulau. Status puncak. Punya dermaga sendiri.',
    flavor: 'Deburan sendirian di pantai yang tak punya nama.',
    requires: ['island']
  }
];

export const LOCATION_BY_ID: Record<string, LocationDef> = Object.fromEntries(
  LOCATIONS.map((l) => [l.id, l])
);

export const HOME_LOC = 'street';

export interface HubState {
  /** lokasi tempat avatar berdiri (dipakai buat sorot & sinkron posisi) */
  locId: string;
  /** semua lokasi yang pernah dikunjungi */
  visited: string[];
}

export function createHub(): HubState {
  return { locId: HOME_LOC, visited: [HOME_LOC] };
}

export function normalizeHub(h: unknown): HubState {
  const s = h as Partial<HubState> | null | undefined;
  if (!s || typeof s !== 'object') return createHub();
  const locId = typeof s.locId === 'string' && LOCATION_BY_ID[s.locId] ? s.locId : HOME_LOC;
  const visited = Array.isArray(s.visited)
    ? s.visited.filter((id): id is string => typeof id === 'string' && !!LOCATION_BY_ID[id])
    : [];
  if (!visited.includes(locId)) visited.push(locId);
  return { locId, visited };
}

export function isLocationUnlocked(def: LocationDef, owned: string[]): boolean {
  if (!def.requires || def.requires.length === 0) return true;
  return def.requires.some((id) => owned.includes(id));
}

/** teks kecil yang jelasin cara membuka lokasi; null kalo selalu terbuka */
export function locationHint(def: LocationDef): string | null {
  if (!def.requires || def.requires.length === 0) return null;
  const names = def.requires.map((id) => assetDef(id)?.name).filter((n): n is string => !!n);
  if (names.length === 0) return null;
  return names.length === 1 ? `Butuh ${names[0]}` : `Butuh salah satu: ${names.join(' / ')}`;
}

export function unlockedLocations(owned: string[]): LocationDef[] {
  return LOCATIONS.filter((l) => isLocationUnlocked(l, owned));
}
