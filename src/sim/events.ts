import type { RNG } from './rng';
import { CURRENCIES } from './names';
import type { AssetClass, GameEvent, MacroState, PendingEvent, Severity, SimState } from './types';
import { applyStoryBeat } from './story';

type Scope = 'macro' | 'inst' | 'sector' | 'class' | 'global';

interface Template {
  id: string;
  weight: number;
  severity: Severity;
  scope: Scope;
  title: string;
  body: string;
  impact: number;
  hype: number;
  cls: AssetClass[];
  macro: Partial<MacroState>;
  tags: string[];
}

const T: Template[] = [
  {
    id: 'fed_hike',
    weight: 6,
    severity: 'high',
    scope: 'macro',
    title: 'Bank Sentral menaikkan suku bunga {bps} bps',
    body: 'Komite kebijakan moneter menaikkan suku bunga acuan. Aset berisiko tekanan, dollar menguat.',
    impact: -0.02,
    hype: 0,
    cls: ['crypto', 'meme', 'shitcoin', 'stock', 'index', 'commodity'],
    macro: { rate: 0.25, risk: -0.35, liquidity: -0.3 },
    tags: ['Macro', 'Suku bunga']
  },
  {
    id: 'fed_cut',
    weight: 6,
    severity: 'high',
    scope: 'macro',
    title: 'Bank Sentral memotong suku bunga {bps} bps',
    body: 'Pemotongan suku bunga, likuiditas global longgar lagi. Risk appetite naik.',
    impact: 0.02,
    hype: 0.1,
    cls: ['crypto', 'meme', 'shitcoin', 'stock', 'index'],
    macro: { rate: -0.25, risk: 0.4, liquidity: 0.45 },
    tags: ['Macro', 'Suku bunga']
  },
  {
    id: 'cpi_hot',
    weight: 6,
    severity: 'med',
    scope: 'macro',
    title: 'Inflasi lebih panas dari perkiraan',
    body: 'Inflasi core {hot} dari consensus. Ekspektasi suku bunga naik, duration panjang kena sell-off.',
    impact: -0.015,
    hype: 0,
    cls: ['crypto', 'meme', 'shitcoin', 'stock', 'index', 'commodity'],
    macro: { inflation: 0.4, rate: 0.12, risk: -0.25 },
    tags: ['Macro', 'Inflasi']
  },
  {
    id: 'cpi_cool',
    weight: 6,
    severity: 'med',
    scope: 'macro',
    title: 'Inflasi mendingin',
    body: 'Data CPI lebih dingin. Ruang untuk pelonggaran kebijakan moneter makin lebar.',
    impact: 0.012,
    hype: 0.05,
    cls: ['crypto', 'meme', 'shitcoin', 'stock', 'index'],
    macro: { inflation: -0.35, rate: -0.1, risk: 0.3 },
    tags: ['Macro', 'Inflasi']
  },
  {
    id: 'riskoff',
    weight: 4,
    severity: 'extreme',
    scope: 'macro',
    title: 'Sell-off risk-off global',
    body: 'Investor kabur ke aset aman. Posisi berleverage ditutup paksa di seluruh pasar.',
    impact: -0.03,
    hype: 0,
    cls: ['crypto', 'meme', 'shitcoin', 'stock', 'index', 'commodity'],
    macro: { risk: -0.7, liquidity: -0.6, usd: 0.3 },
    tags: ['Macro', 'Risk-off']
  },
  {
    id: 'meltup',
    weight: 3,
    severity: 'extreme',
    scope: 'macro',
    title: 'Rally risk-on meledak',
    body: 'Aman likuiditas masuk deras. Semua aset berisiko meroket tanpa henti.',
    impact: 0.025,
    hype: 0.2,
    cls: ['crypto', 'meme', 'shitcoin', 'stock', 'index', 'commodity'],
    macro: { risk: 0.75, liquidity: 0.7, usd: -0.25 },
    tags: ['Macro', 'Risk-on']
  },
  {
    id: 'bank_crisis',
    weight: 2,
    severity: 'extreme',
    scope: 'macro',
    title: 'Krisis likuiditas bank',
    body: 'Counterparty gagal memenuhi margin call. Dana dialihkan ke safe haven.',
    impact: -0.045,
    hype: 0,
    cls: ['crypto', 'meme', 'shitcoin', 'stock', 'index'],
    macro: { risk: -0.95, liquidity: -0.9, usd: 0.5 },
    tags: ['Macro', 'Krisis']
  },
  {
    id: 'stimulus',
    weight: 3,
    severity: 'med',
    scope: 'macro',
    title: 'Paket stimulus fiskal diumumkan',
    body: 'Belanja pemerintah dinyalakan. Efek permintaan dan risk appetite naik.',
    impact: 0.015,
    hype: 0.1,
    cls: ['crypto', 'meme', 'shitcoin', 'stock', 'index', 'commodity'],
    macro: { risk: 0.45, liquidity: 0.35 },
    tags: ['Macro', 'Fiskal']
  },
  {
    id: 'crypto_etf',
    weight: 4,
    severity: 'high',
    scope: 'class',
    title: 'Arus dana ETF crypto rekor',
    body: 'Institusi membanjiri produk ETF berbasis aset kripto. Selera risk-on merambat ke altcoin.',
    impact: 0.05,
    hype: 0.25,
    cls: ['crypto', 'meme', 'shitcoin'],
    macro: { liquidity: 0.2, risk: 0.25 },
    tags: ['Kripto', 'Aliran dana']
  },
  {
    id: 'meme_crackdown',
    weight: 4,
    severity: 'high',
    scope: 'class',
    title: 'Regulator memperketat aturan memecoin',
    body: 'Bursa besar memperingatkan transaksi meme coin. Selera risk-on di token spekulatif menguap.',
    impact: -0.12,
    hype: -0.3,
    cls: ['meme', 'shitcoin'],
    macro: { risk: -0.2 },
    tags: ['Regulasi', 'Memecoin']
  },
  {
    id: 'sector_rotation',
    weight: 6,
    severity: 'low',
    scope: 'sector',
    title: 'Rotasi masuk ke sektor {sector}',
    body: 'Dana mulai berputar ke sektor {sector}. Saham sektor ini menguat didorong dana yang pindah.',
    impact: 0.04,
    hype: 0,
    cls: ['stock'],
    macro: {},
    tags: ['Sektor']
  },
  {
    id: 'sector_selloff',
    weight: 6,
    severity: 'med',
    scope: 'sector',
    title: 'Sektor {sector} diobral',
    body: 'Kabar buruk menimpa sektor {sector}. Rotasi dana menjauh.',
    impact: -0.05,
    hype: 0,
    cls: ['stock'],
    macro: {},
    tags: ['Sektor']
  },
  {
    id: 'whale_accum',
    weight: 6,
    severity: 'med',
    scope: 'inst',
    title: 'Whale akumulasi {inst}',
    body: 'Dom besar akumulasi {inst}. Order book menipis di sisi atas.',
    impact: 0.14,
    hype: 0.2,
    cls: ['crypto', 'meme', 'shitcoin'],
    macro: {},
    tags: ['Whale', 'Aliran dana']
  },
  {
    id: 'whale_dump',
    weight: 6,
    severity: 'high',
    scope: 'inst',
    title: 'Whale dump {inst}',
    body: 'Dom besar melempar posisinya ke pasar. {inst} kehilangan support.',
    impact: -0.16,
    hype: -0.15,
    cls: ['crypto', 'meme', 'shitcoin'],
    macro: {},
    tags: ['Whale', 'Aliran dana']
  },
  {
    id: 'etf_approve',
    weight: 3,
    severity: 'high',
    scope: 'inst',
    title: '{inst} mendapat persetujuan produk ETF',
    body: 'Regulator menyetujui produk ETF {inst}. Saldo institusional masuk ke pasar.',
    impact: 0.24,
    hype: 0.35,
    cls: ['crypto'],
    macro: { risk: 0.2, liquidity: 0.15 },
    tags: ['ETF', 'Kripto']
  },
  {
    id: 'etf_reject',
    weight: 3,
    severity: 'high',
    scope: 'inst',
    title: 'Permintaan ETF {inst} ditolak',
    body: 'Regulator menolak produk ETF {inst}. Narratif institusional mati.',
    impact: -0.22,
    hype: -0.3,
    cls: ['crypto'],
    macro: { risk: -0.15 },
    tags: ['ETF', 'Kripto']
  },
  {
    id: 'exchange_halt',
    weight: 3,
    severity: 'extreme',
    scope: 'inst',
    title: 'Bursa hentikan penarikan {inst}',
    body: 'Bursa menunda penarikan {inst} karena masalah teknis. Panik selling dimulai.',
    impact: -0.38,
    hype: -0.35,
    cls: ['crypto', 'meme', 'shitcoin'],
    macro: {},
    tags: ['Bursa', 'Kripto']
  },
  {
    id: 'exploit',
    weight: 3,
    severity: 'extreme',
    scope: 'inst',
    title: 'Eksploitasi bridge {inst}',
    body: 'Peretas menguras bridge {inst}. Ekosistem {inst} kehilangan cadangan besar.',
    impact: -0.45,
    hype: -0.4,
    cls: ['crypto', 'shitcoin'],
    macro: {},
    tags: ['Hack', 'Kripto']
  },
  {
    id: 'unlock_cliff',
    weight: 4,
    severity: 'med',
    scope: 'inst',
    title: 'Unlock cliff {inst} tercapai',
    body: 'Tim {inst} melepas token baru ke pasar. Supply mendadak, tekanan jual.',
    impact: -0.13,
    hype: -0.1,
    cls: ['crypto', 'shitcoin'],
    macro: {},
    tags: ['Tokenomik', 'Unlock']
  },
  {
    id: 'listing',
    weight: 3,
    severity: 'med',
    scope: 'inst',
    title: '{inst} listing di bursa tier-1',
    body: '{inst} resmi listing di bursa besar. Volume dan volatilitas naik.',
    impact: 0.16,
    hype: 0.25,
    cls: ['crypto', 'meme', 'shitcoin'],
    macro: {},
    tags: ['Listing', 'Bursa']
  },
  {
    id: 'delisting',
    weight: 3,
    severity: 'high',
    scope: 'inst',
    title: 'Peringatan delisting {inst}',
    body: 'Bursa mengeluarkan peringatan delisting untuk {inst}. Likuiditas menguap.',
    impact: -0.2,
    hype: -0.2,
    cls: ['crypto', 'meme', 'shitcoin'],
    macro: {},
    tags: ['Delisting', 'Bursa']
  },
  {
    id: 'short_squeeze',
    weight: 3,
    severity: 'high',
    scope: 'inst',
    title: 'Short squeeze {inst}',
    body: 'Short covering masif pada {inst}. Naik vertikal, tak lama kemudian berbalik.',
    impact: 0.3,
    hype: 0.3,
    cls: ['crypto', 'meme', 'shitcoin', 'stock'],
    macro: {},
    tags: ['Squeeze', 'Short']
  },
  {
    id: 'viral',
    weight: 6,
    severity: 'high',
    scope: 'inst',
    title: '{inst} viral di media sosial',
    body: 'Post {inst} viral dan FOMO menyapu pasar. Volume melonjak 40x.',
    impact: 0.45,
    hype: 0.5,
    cls: ['meme', 'shitcoin'],
    macro: {},
    tags: ['Viral', 'Hype']
  },
  {
    id: 'community_raid',
    weight: 4,
    severity: 'med',
    scope: 'inst',
    title: 'Community raid {inst}',
    body: 'Komunitas {inst} melakukan buying masif. Denial, lalu rally.',
    impact: 0.25,
    hype: 0.3,
    cls: ['meme', 'shitcoin'],
    macro: {},
    tags: ['Hype', 'Komunitas']
  },
  {
    id: 'dev_dump',
    weight: 5,
    severity: 'high',
    scope: 'inst',
    title: 'Dev wallet {inst} jual agresif',
    body: 'Dom dev {inst} mulai menjual. Likuiditas menguap dari books.',
    impact: -0.5,
    hype: -0.45,
    cls: ['meme', 'shitcoin'],
    macro: {},
    tags: ['Dev', 'Dump']
  },
  {
    id: 'honeypot',
    weight: 2,
    severity: 'extreme',
    scope: 'inst',
    title: 'Terdeteksi honeypot di {inst}',
    body: 'Audit menemukan kode {inst} memblokir penjualan. Holder terkunci.',
    impact: -0.85,
    hype: -0.6,
    cls: ['shitcoin', 'meme'],
    macro: {},
    tags: ['Honeypot', 'Scam']
  },
  {
    id: 'earnings_beat',
    weight: 7,
    severity: 'med',
    scope: 'inst',
    title: '{inst} beat ekspektasi kuarter',
    body: 'Laba {inst} melampaui estimasi analis. Margin naik dan guidance naik.',
    impact: 0.075,
    hype: 0.05,
    cls: ['stock'],
    macro: {},
    tags: ['Laporan', 'Saham']
  },
  {
    id: 'earnings_miss',
    weight: 7,
    severity: 'med',
    scope: 'inst',
    title: '{inst} miss ekspektasi kuarter',
    body: 'Laba {inst} di bawah estimasi. Margin tertekan, guidance dipangkas.',
    impact: -0.09,
    hype: -0.05,
    cls: ['stock'],
    macro: {},
    tags: ['Laporan', 'Saham']
  },
  {
    id: 'ceo_exit',
    weight: 4,
    severity: 'med',
    scope: 'inst',
    title: 'CEO {inst} mengundurkan diri mendadak',
    body: 'Pengunduran diri mendadak. Investor kehilangan kepercayaan.',
    impact: -0.06,
    hype: -0.05,
    cls: ['stock'],
    macro: {},
    tags: ['Saham', 'Manajemen']
  },
  {
    id: 'contract_win',
    weight: 4,
    severity: 'low',
    scope: 'inst',
    title: '{inst} menang kontrak besar',
    body: 'Kontrak besar untuk {inst}. Backlog naik signifikan.',
    impact: 0.05,
    hype: 0.05,
    cls: ['stock'],
    macro: {},
    tags: ['Saham', 'Kontrak']
  },
  {
    id: 'bankruptcy',
    weight: 2,
    severity: 'extreme',
    scope: 'inst',
    title: '{inst} ajukan bankruptcy protection',
    body: 'Utang {inst} menumpuk. Equity praktis nol.',
    impact: -0.6,
    hype: -0.3,
    cls: ['stock'],
    macro: { risk: -0.1 },
    tags: ['Saham', 'Bangkrut']
  },
  {
    id: 'opec_cut',
    weight: 3,
    severity: 'med',
    scope: 'class',
    title: 'OPEC+ pangkas produksi',
    body: 'Kuota produksi dipangkas. Harga minyak melonjak.',
    impact: 0.08,
    hype: 0.05,
    cls: ['commodity'],
    macro: { inflation: 0.2 },
    tags: ['Komoditas', 'Energi']
  },
  {
    id: 'supply_disruption',
    weight: 3,
    severity: 'med',
    scope: 'class',
    title: 'Gangguan pasokan {tag}',
    body: 'Gangguan produksi {tag} mengetatkan pasar.',
    impact: 0.06,
    hype: 0,
    cls: ['commodity'],
    macro: { inflation: 0.15 },
    tags: ['Komoditas']
  },
  {
    id: 'cb_hawkish',
    weight: 5,
    severity: 'med',
    scope: 'macro',
    title: 'Bank sentral {ccy} lebih hawkish',
    body: 'Pernyataan {ccy} mengisyaratkan kenaikan suku bunga. Mata uang {ccy} menguat.',
    impact: -0.008,
    hype: 0,
    cls: ['forex'],
    macro: {},
    tags: ['Forex', 'Suku bunga']
  },
  {
    id: 'cb_dovish',
    weight: 5,
    severity: 'med',
    scope: 'macro',
    title: 'Bank sentral {ccy} lebih dovish',
    body: '{ccy} longgar dan dovish. Mata uang {ccy} melemah.',
    impact: 0.008,
    hype: 0,
    cls: ['forex'],
    macro: {},
    tags: ['Forex', 'Suku bunga']
  },
  {
    id: 'commodity_dump',
    weight: 3,
    severity: 'med',
    scope: 'class',
    title: 'Penjualan massal komoditas',
    body: 'Permintaan global melemah. Komoditas turun bersama risk-off.',
    impact: -0.05,
    hype: 0,
    cls: ['commodity'],
    macro: {},
    tags: ['Komoditas']
  }
];

const SECTOR_POOL = [
  'Technology',
  'Semiconductors',
  'Financials',
  'Healthcare',
  'Energy',
  'Consumer',
  'Industrials',
  'Materials',
  'Utilities',
  'Real Estate',
  'Crypto-adjacent',
  'Retail'
];

let evCounter = 0;

function pickInstrument(state: SimState, cls: AssetClass[]): string | null {
  const ids = state.order.filter((id) => cls.includes(state.instruments[id].cls));
  if (!ids.length) return null;
  return ids[Math.floor(Math.random() * ids.length)];
}

export function rollEvent(state: SimState, rng: RNG): GameEvent | null {
  const pending = generateEvent(state, rng);
  if (!pending) return null;
  applyEvent(state, pending);
  return pending.ev;
}

const TPL_BY_ID: Record<string, Template> = Object.fromEntries(T.map((t) => [t.id, t]));

/** pilih + isi event berikutnya TANPA efek samping — dipakai buat dibocorkan sebagai rumor dulu (Fase 3) */
export function generateEvent(state: SimState, rng: RNG): PendingEvent | null {
  const pool = T.filter((t) => {
    if (t.scope === 'inst') return t.cls.some((c) => state.order.some((id) => state.instruments[id].cls === c));
    if (t.scope === 'sector') return state.order.some((id) => state.instruments[id].cls === 'stock');
    return true;
  });
  if (!pool.length) return null;

  const weights = pool.map((t) => t.weight);
  const tpl = pool[rng.weightedIndex(weights)];

  const impact = tpl.impact * rng.float(0.6, 1.5) * 0.28 * (1 + state.chaos * 0.5);
  const bps = rng.pick([25, 50, 75, 100]);
  const ccy = rng.pick(CURRENCIES.filter((c) => c.code !== 'USD'));
  const sector = rng.pick(SECTOR_POOL);

  let instId: string | null = null;
  if (tpl.scope === 'inst') instId = pickInstrument(state, tpl.cls);

  const inst = instId ? state.instruments[instId] : null;
  const instName = inst ? inst.name : 'Aset';
  const instTag = inst ? inst.tag : 'Pasar';

  const fill = (s: string) =>
    s
      .replace('{bps}', String(bps))
      .replace('{hot}', rng.pick(['lebih tinggi', 'jauh lebih tinggi']))
      .replace('{inst}', instName)
      .replace('{sector}', sector)
      .replace('{ccy}', ccy.code)
      .replace('{tag}', instTag);

  evCounter += 1;
  const ev: GameEvent = {
    id: `ev${state.ticks}-${evCounter}`,
    t: state.simTime,
    title: fill(tpl.title),
    body: fill(tpl.body),
    severity: tpl.severity,
    tags: [...tpl.tags],
    impact,
    instId,
    sector: tpl.scope === 'sector' ? sector : null,
    cls: tpl.scope === 'inst' ? (inst?.cls ?? null) : tpl.cls[0] ?? null
  };

  return { ev, tplId: tpl.id, impact, bps, ccyCode: ccy.code, sector, instId, macro: tpl.macro };
}

/** terapkan efek samping event + masukkin ke feed berita */
export function applyEvent(state: SimState, pending: PendingEvent): void {
  const tpl = TPL_BY_ID[pending.tplId];
  const inst = pending.instId ? state.instruments[pending.instId] : null;
  const sector = pending.sector;
  const ccyCode = pending.ccyCode;
  const impact = pending.impact;
  const m = pending.macro;

  pending.ev.t = state.simTime;

  // cerita & chaos (Phase 11): beat cerita naik tiap event besar
  applyStoryBeat(state, impact, state.simTime);

  // apply macro effects
  if (m.rate) state.macro.rate = Math.max(0.25, state.macro.rate + m.rate);
  if (m.risk) state.macro.risk = clamp(state.macro.risk + m.risk, -1.5, 1.5);
  if (m.inflation) state.macro.inflation = clamp(state.macro.inflation + m.inflation, -1.2, 1.6);
  if (m.usd) state.macro.usd = clamp(state.macro.usd + m.usd, -1.5, 1.5);
  if (m.liquidity) state.macro.liquidity = clamp(state.macro.liquidity + m.liquidity, -1.5, 1.5);

  if (!tpl) {
    state.events.unshift(pending.ev);
    if (state.events.length > 300) state.events.length = 300;
    return;
  }

  if (tpl.id === 'cb_hawkish' || tpl.id === 'cb_dovish') {
    for (const id of state.order) {
      const i = state.instruments[id];
      if (i.cls === 'forex' && i.pair && ccyCode && i.pair.includes(ccyCode)) {
        i.pressure += impact * (i.pair[0] === ccyCode ? 1 : -1);
      }
    }
  } else if (tpl.scope === 'inst' && inst) {
    inst.pressure += impact;
    inst.fund *= 1 + impact * 0.35;
    inst.hype = clamp(inst.hype + tpl.hype, 0, 1.8);
    if (tpl.id === 'honeypot') inst.pressure += -0.3;
  } else if (tpl.scope === 'sector') {
    for (const id of state.order) {
      const i = state.instruments[id];
      if (i.cls === 'stock' && i.sector === sector) {
        i.pressure += impact;
        i.fund *= 1 + impact * 0.2;
      }
    }
  } else {
    for (const id of state.order) {
      const i = state.instruments[id];
      if (!tpl.cls.includes(i.cls)) continue;
      i.pressure += impact * (i.cls === 'index' ? 0.5 : 1);
      i.fund *= 1 + impact * 0.12;
      if (tpl.hype) i.hype = clamp(i.hype + tpl.hype * 0.4, 0, 1.8);
    }
  }

  state.events.unshift(pending.ev);
  if (state.events.length > 300) state.events.length = 300;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
