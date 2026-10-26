import type { SimState } from './types';
import { regimeInfo } from './engine';
import { clamp } from './events';
import { RNG } from './rng';

export type ScenarioTone = 'safe' | 'wild' | 'brutal';

export interface Scenario {
  id: string;
  icon: string;
  name: string;
  tagline: string;
  desc: string;
  /** starting macro regime the world is forced into */
  regime: string;
  /** equity target as a fraction of starting cash */
  targetPct: number;
  /** deadline in simulated days */
  days: number;
  startingCash: number;
  difficulty: 'easy' | 'normal' | 'brutal';
  maxLeverage: number;
  /** fractional price shock applied to every instrument at t0 (crash scenarios) */
  crash: number;
  /** extra hype injected into meme/shitcoin instruments */
  hype: number;
  tone: ScenarioTone;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'bull',
    icon: '🐂',
    name: 'Bull Run',
    tagline: 'Melt-Up · target besar',
    desc:
      'Risiko melonjak, likuiditas melimpah, semua aset meroket. Momentum jalan cepat — kejar equity 3x lipat ' +
      'sebelum siklus berbalik. Gampang naik, gampang juga kalap.',
    regime: 'Melt-Up',
    targetPct: 2.0,
    days: 10,
    startingCash: 50000,
    difficulty: 'easy',
    maxLeverage: 10,
    crash: 0,
    hype: 0.4,
    tone: 'wild'
  },
  {
    id: 'crash',
    icon: '📉',
    name: 'Flash Crash',
    tagline: 'Risk-Off · selamatkan modal',
    desc:
      'Pasar dibuka dengan semua aset anjlok mendadak. Likuiditas mengering dan volatilitas liar. Bertahan dari ' +
      'likuidasi lalu pulihkan +15% — short selling jadi senjata utama.',
    regime: 'Risk-Off',
    targetPct: 0.15,
    days: 7,
    startingCash: 100000,
    difficulty: 'normal',
    maxLeverage: 5,
    crash: 0.28,
    hype: 0,
    tone: 'brutal'
  },
  {
    id: 'chop',
    icon: '🌊',
    name: 'Sideways Grind',
    tagline: 'Chop · tanpa arah',
    desc:
      'Regime datar tanpa tren. Harga bolak-balik di range sempit, makanya cocok buat latihan mean reversion, ' +
      'limit order, dan fee management. Target santai tapi waktunya longgar.',
    regime: 'Chop',
    targetPct: 0.25,
    days: 14,
    startingCash: 100000,
    difficulty: 'normal',
    maxLeverage: 3,
    crash: 0,
    hype: 0,
    tone: 'safe'
  },
  {
    id: 'swan',
    icon: '🦢',
    name: 'Black Swan',
    tagline: 'Izzat · kiamat pasar',
    desc:
      'Skenario terberat. Semua aset ditembak turun ~45% sekaligus, risk off ekstrem, dan volatilitas maksimal. ' +
      'Naikkan +30% dari puing — hanya buat yang paham manajemen risiko.',
    regime: 'Izzat',
    targetPct: 0.3,
    days: 7,
    startingCash: 100000,
    difficulty: 'brutal',
    maxLeverage: 3,
    crash: 0.45,
    hype: 0,
    tone: 'brutal'
  },
  {
    id: 'degen',
    icon: '🎰',
    name: 'Degen Casino',
    tagline: 'Launchpad · all-in meme',
    desc:
      'Hype meme dan shitcoin dipompa ke maksimum. Koin baru meledak cepat di bonding curve, tapi rug pull dan ' +
      'honeypot juga makin sering. Target 5x lewat launchpad — murni judi terkontrol.',
    regime: 'Risk-On',
    targetPct: 4.0,
    days: 5,
    startingCash: 25000,
    difficulty: 'brutal',
    maxLeverage: 10,
    crash: 0,
    hype: 1.2,
    tone: 'wild'
  },
  {
    id: 'recovery',
    icon: '🌱',
    name: 'Recovery Run',
    tagline: 'Balik dari krisis',
    desc:
      'Pasar baru bangkit dari dasar. Regime Recovery dengan likuiditas pulih perlahan — jalur paling ramah ' +
      'pemula buat belajar riset posisi jangka panjang tanpa tekanan.',
    regime: 'Recovery',
    targetPct: 0.5,
    days: 12,
    startingCash: 100000,
    difficulty: 'easy',
    maxLeverage: 5,
    crash: 0.1,
    hype: 0.1,
    tone: 'safe'
  }
];

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/** Force the world into the scenario's starting condition at t0. */
export function applyScenario(sim: SimState, sc: Scenario): void {
  const rng = new RNG((sim.seed ^ 0x9e3779b9) >>> 0);
  const target = regimeInfo(sc.regime);

  sim.macro.regime = target.name;
  sim.macro.risk = clamp(target.risk, -1.6, 1.6);
  sim.macro.inflation = clamp(target.infl, -1.2, 1.6);
  sim.macro.liquidity = clamp(target.liq, -1.6, 1.6);
  sim.macro.usd = clamp(-target.risk * 0.35, -1.6, 1.6);

  for (const id of sim.order) {
    const inst = sim.instruments[id];
    if (!inst) continue;

    if (sc.crash > 0) {
      // higher-beta names get hit harder, with a little dispersion
      const betaAdj = 0.5 + inst.beta * 0.3;
      const drop = clamp(sc.crash * betaAdj * rng.float(0.7, 1.3), 0.03, 0.75);
      inst.price = Math.max(inst.price * (1 - drop), 1e-16);
      inst.anchor = Math.max(inst.anchor * (1 - drop * 0.7), 1e-16);
      inst.fund = Math.max(inst.fund * (1 - drop * 0.7), 1e-16);
      inst.open = inst.price;
      inst.hype = clamp(inst.hype + (rng.float(0.3, 0.9) * sc.crash) / 0.1, 0, 2);
      if (inst.candles.length) inst.candles[inst.candles.length - 1].c = inst.price;
      if (inst.daily.length) inst.daily[inst.daily.length - 1].c = inst.price;
    }

    if (sc.hype > 0 && (inst.cls === 'meme' || inst.cls === 'shitcoin')) {
      inst.hype = clamp(inst.hype + sc.hype, 0, 2);
      inst.hypeBase = clamp(inst.hypeBase + sc.hype * 0.25, 0, 2);
      inst.vol = inst.vol * (1 + sc.hype * 0.35);
    }
  }

  sim.equityCurve = [];
}
