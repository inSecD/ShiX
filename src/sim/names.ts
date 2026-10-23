import { RNG } from './rng';
import type { AssetClass } from './types';

export interface NamedSeed {
  real: string;
  fake: string;
  ticker: string;
  cls: AssetClass;
  tag?: string;
  cap?: number;
  price?: number;
  vol?: number;
}

export const CRYPTO_SEEDS: NamedSeed[] = [
  { real: 'Bitcoin', fake: 'Binoin', ticker: 'BN', cls: 'crypto', tag: 'L1', cap: 1.9e12, price: 61000, vol: 0.028 },
  { real: 'Ethereum', fake: 'Efhereum', ticker: 'EF', cls: 'crypto', tag: 'L1', cap: 4.4e11, price: 3200, vol: 0.034 },
  { real: 'Solana', fake: 'Solena', ticker: 'SLN', cls: 'crypto', tag: 'L1', cap: 9.1e10, price: 148, vol: 0.048 },
  { real: 'XRP', fake: 'Ripplx', ticker: 'RPX', cls: 'crypto', tag: 'Payments', cap: 5.5e10, price: 0.62, vol: 0.036 },
  { real: 'Cardano', fake: 'Cardn', ticker: 'CDN', cls: 'crypto', tag: 'L1', cap: 1.5e10, price: 0.41, vol: 0.04 },
  { real: 'Dogecoin', fake: 'Dogicoin', ticker: 'DGE', cls: 'meme', tag: 'Meme', cap: 1.6e10, price: 0.135, vol: 0.07 },
  { real: 'Shiba Inu', fake: 'Shibainu', ticker: 'SHB', cls: 'meme', tag: 'Meme', cap: 1.1e10, price: 0.0000185, vol: 0.085 },
  { real: 'Pepe', fake: 'Pepeu', ticker: 'PEP', cls: 'meme', tag: 'Meme', cap: 4.6e9, price: 0.0000092, vol: 0.1 },
  { real: 'Bonk', fake: 'Bonku', ticker: 'BNK', cls: 'meme', tag: 'Meme', cap: 2.1e9, price: 0.0000245, vol: 0.11 },
  { real: 'dogwifhat', fake: 'Dogwifhat', ticker: 'WIF', cls: 'meme', tag: 'Meme', cap: 4.8e8, price: 2.4, vol: 0.12 },
  { real: 'Floki', fake: 'Floke', ticker: 'FLO', cls: 'meme', tag: 'AI', cap: 1.7e9, price: 0.19, vol: 0.095 },
  { real: 'Pepe the Frog', fake: 'Frogu', ticker: 'FRG', cls: 'meme', tag: 'Meme', cap: 6.5e8, price: 0.000042, vol: 0.13 },
  { real: 'Polygon', fake: 'Polygonn', ticker: 'PLG', cls: 'crypto', tag: 'L2', cap: 7.2e9, price: 0.58, vol: 0.046 },
  { real: 'Avalanche', fake: 'Avalnch', ticker: 'AVX', cls: 'crypto', tag: 'L1', cap: 1.5e10, price: 27.5, vol: 0.052 },
  { real: 'Chainlink', fake: 'Chainlnk', ticker: 'CHL', cls: 'crypto', tag: 'Oracle', cap: 8.6e9, price: 13.2, vol: 0.042 },
  { real: 'Uniswap', fake: 'Uniswapx', ticker: 'UNX', cls: 'crypto', tag: 'DEX', cap: 1.1e10, price: 8.6, vol: 0.055 },
  { real: 'Litecoin', fake: 'Litecon', ticker: 'LTC', cls: 'crypto', tag: 'Payments', cap: 7.4e9, price: 71.5, vol: 0.033 },
  { real: 'Tron', fake: 'Tronn', ticker: 'TRX', cls: 'crypto', tag: 'Payments', cap: 2.6e10, price: 0.128, vol: 0.038 },
  { real: 'BNB', fake: 'Binan Coin', ticker: 'BNC', cls: 'crypto', tag: 'Exchange', cap: 9.4e10, price: 585, vol: 0.031 },
  { real: 'Sui', fake: 'Suii', ticker: 'SUI', cls: 'crypto', tag: 'L1', cap: 1.6e10, price: 1.42, vol: 0.062 },
  { real: 'ApeCoin', fake: 'Apecon', ticker: 'APC', cls: 'meme', tag: 'Meme', cap: 1.2e9, price: 0.0092, vol: 0.098 },
  { real: 'Internet Computer', fake: 'Internet Computr', ticker: 'ICP', cls: 'crypto', tag: 'L1', cap: 5.2e9, price: 8.1, vol: 0.058 },
  { real: 'Cosmos', fake: 'Cosmos', ticker: 'COS', cls: 'crypto', tag: 'L1', cap: 3.1e9, price: 6.4, vol: 0.049 },
  { real: 'Near Protocol', fake: 'Nera Protocol', ticker: 'NEA', cls: 'crypto', tag: 'L1', cap: 4.4e9, price: 3.7, vol: 0.055 },
  { real: 'Injective', fake: 'Injectiv', ticker: 'INJ', cls: 'crypto', tag: 'DeFi', cap: 2.2e9, price: 16.8, vol: 0.073 },
  { real: 'Arbitrum', fake: 'Arbitrm', ticker: 'ARB', cls: 'crypto', tag: 'L2', cap: 3.3e9, price: 0.62, vol: 0.066 },
  { real: 'Optimism', fake: 'Optimsm', ticker: 'OPM', cls: 'crypto', tag: 'L2', cap: 2.1e9, price: 1.42, vol: 0.068 },
  { real: 'VeChain', fake: 'VeChan', ticker: 'VET', cls: 'crypto', tag: 'Supply', cap: 2.6e9, price: 0.031, vol: 0.057 },
  { real: 'Fantom', fake: 'Fantm', ticker: 'FTM', cls: 'crypto', tag: 'L1', cap: 1.7e9, price: 0.52, vol: 0.069 },
  { real: 'Aptos', fake: 'Aptoss', ticker: 'APT', cls: 'crypto', tag: 'L1', cap: 4.1e9, price: 5.9, vol: 0.071 },
  { real: 'Stellar', fake: 'Stelar', ticker: 'STR', cls: 'crypto', tag: 'Payments', cap: 2.2e9, price: 0.104, vol: 0.044 },
  { real: 'Hedera', fake: 'Hedra', ticker: 'HDR', cls: 'crypto', tag: 'L1', cap: 3.2e9, price: 0.081, vol: 0.061 },
  { real: 'Algorand', fake: 'Algornd', ticker: 'ALG', cls: 'crypto', tag: 'L1', cap: 1.4e9, price: 0.19, vol: 0.053 },
  { real: 'Filecoin', fake: 'Filecon', ticker: 'FLC', cls: 'crypto', tag: 'Storage', cap: 3.4e9, price: 3.1, vol: 0.067 },
  { real: 'Render', fake: 'Rendor', ticker: 'RND', cls: 'crypto', tag: 'AI', cap: 3.1e9, price: 5.4, vol: 0.083 },
  { real: 'Fetch.ai', fake: 'Fetch.ai', ticker: 'FET', cls: 'crypto', tag: 'AI', cap: 1.7e9, price: 1.31, vol: 0.089 },
  { real: 'Celestia', fake: 'Celstia', ticker: 'CLS', cls: 'crypto', tag: 'Infra', cap: 1.6e9, price: 3.9, vol: 0.094 },
  { real: 'Arbitrum', fake: 'Arbitrm', ticker: 'ARB2', cls: 'crypto', tag: 'L2', cap: 3.3e9, price: 0.61, vol: 0.067 },
  { real: 'Litecoin Cash', fake: 'Litecon Csh', ticker: 'LCC', cls: 'crypto', tag: 'Payments', cap: 4.1e7, price: 0.000031, vol: 0.12 }
];

export const MEME_SEEDS: NamedSeed[] = [
  { real: 'Dogecoin', fake: 'Dogicoin', ticker: 'DGE', cls: 'meme', tag: 'Meme', cap: 1.6e10, price: 0.135, vol: 0.07 },
  { real: 'Shiba Inu', fake: 'Shibainu', ticker: 'SHB', cls: 'meme', tag: 'Meme', cap: 1.1e10, price: 0.0000185, vol: 0.085 },
  { real: 'Pepe', fake: 'Pepeu', ticker: 'PEP', cls: 'meme', tag: 'Meme', cap: 4.6e9, price: 0.0000092, vol: 0.1 },
  { real: 'Bonk', fake: 'Bonku', ticker: 'BNK', cls: 'meme', tag: 'Meme', cap: 2.1e9, price: 0.0000245, vol: 0.11 },
  { real: 'dogwifhat', fake: 'Dogwifhat', ticker: 'WIF', cls: 'meme', tag: 'Meme', cap: 4.8e8, price: 2.4, vol: 0.12 }
];

export const MEME_WORD_A = [
  'Doge', 'Shib', 'Pepe', 'Chad', 'Wojak', 'Bonk', 'Floki', 'Elon', 'Musk', 'Based', 'Ape',
  'Turbo', 'Giga', 'Rocket', 'Moon', 'Baby', 'Hyper', 'Lunar', 'Solar', 'Cafe', 'Cat', 'Dog',
  'Inu', 'Cheems', 'Pop', 'Kek', 'Nyancat', 'Silly', 'Dank', 'Copypasta', 'Buffalo', 'Banana'
];

export const MEME_WORD_B = [
  'coin', 'inu', 'u', 'x', '2', 'jet', 'fire', 'moon', 'cash', 'gold', 'max', 'pro', 'ster',
  'world', 'verse', 'rush', 'king', 'globe', 'wave', 'club', 'baby', 'grandma', 'buff'
];

const SHIT_PRE = [
  'Kwo', 'Flum', 'Zop', 'Bru', 'Xen', 'Yolo', 'Pump', 'Doge', 'Wojak', 'Chad', 'Moon', 'Rocket',
  'Giga', 'Turbo', 'Baby', 'Hyper', 'Quantum', 'Cyber', 'Nova', 'Astro', 'Lunar', 'Solar',
  'Zen', 'Krypto', 'Meta', 'Brain', 'Based', 'Ret', 'Mol', 'Giga', 'Milky', 'Cat', 'Doge'
];

const SHIT_MID = ['ko', 'ra', 'mi', 'ne', 'tu', 'la', 'pi', 're', 'so', 'vi', 'za', 'do', 'nu', 'fa', 'hu', 'ke', 'lo', 'xa'];

const SHIT_SUF = [
  'ron', 'bit', 'coin', 'x', 'inu', 'verse', 'zilla', 'token', 'chain', 'swap', 'fi', 'cash',
  'werk', 'pump', 'moon', 'gold', 'sol', 'inu', 'ai', '2', 'fun', 'max', 'net', 'dao'
];

const STOCK_PRE = [
  'Nova', 'Zen', 'Heli', 'Veri', 'Quant', 'Krio', 'Orb', 'Axi', 'Lumi', 'Data', 'Neo', 'Cryo',
  'Volt', 'Aur', 'Nex', 'Omni', 'Tek', 'Bio', 'Stel', 'Core', 'Vex', 'Arq', 'Lun', 'Tera',
  'Nimb', 'Zeph', 'Solv', 'Ferr', 'Mir', 'Cali', 'Aero', 'Delta', 'Ecto', 'Flux', 'Grav',
  'Helm', 'Ioni', 'Juno', 'Kinet', 'Pharm', 'Retai', 'Solar', 'Urba'
];

const STOCK_SUF = [
  'Dynamics', 'Systems', 'Labs', 'Technologies', 'Holdings', 'Group', 'Corp', 'Industries',
  'Bio', 'Energy', 'Semis', 'Capital', 'Pharma', 'Motors', 'Media', 'Logistics', 'Robotics',
  'Analytics', 'Networks', 'Materials', 'Metals', 'Airlines', 'Retail', 'Bank', 'Insurance',
  'Foods', 'Mining', 'Solar', 'Naturals', 'Realty', 'Ventures'
];

export const SECTORS = [
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

export interface Currency {
  code: string;
  fake: string;
  rate: number;
  baseRate: number;
  volatility: number;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', fake: 'Dolar', rate: 1, baseRate: 5.25, volatility: 0 },
  { code: 'EUR', fake: 'Euro', rate: 1.08, baseRate: 3.5, volatility: 0.004 },
  { code: 'GBP', fake: 'Ginja', rate: 1.27, baseRate: 4.6, volatility: 0.0045 },
  { code: 'JPY', fake: 'Yena', rate: 0.0067, baseRate: 0.75, volatility: 0.005 },
  { code: 'CHF', fake: 'Frank', rate: 1.12, baseRate: 1.25, volatility: 0.0035 },
  { code: 'AUD', fake: 'Austral', rate: 0.66, baseRate: 4.1, volatility: 0.006 },
  { code: 'CAD', fake: 'Kanada', rate: 0.74, baseRate: 4.75, volatility: 0.0042 },
  { code: 'NZD', fake: 'Selandia', rate: 0.61, baseRate: 4.9, volatility: 0.0062 },
  { code: 'CNY', fake: 'Yuan', rate: 0.138, baseRate: 3.05, volatility: 0.0025 },
  { code: 'KRW', fake: 'Won', rate: 0.00073, baseRate: 3.35, volatility: 0.0055 },
  { code: 'INR', fake: 'Indu', rate: 0.012, baseRate: 6.5, volatility: 0.0042 },
  { code: 'BRL', fake: 'Real', rate: 0.185, baseRate: 9.8, volatility: 0.008 },
  { code: 'MXN', fake: 'Peso', rate: 0.058, baseRate: 7.4, volatility: 0.0072 },
  { code: 'SGD', fake: 'Singapor', rate: 0.74, baseRate: 3.4, volatility: 0.0032 },
  { code: 'HKD', fake: 'Hongkong', rate: 0.128, baseRate: 4.9, volatility: 0.0028 },
  { code: 'ZAR', fake: 'Rand', rate: 0.054, baseRate: 7.1, volatility: 0.0088 },
  { code: 'TRY', fake: 'Lira', rate: 0.029, baseRate: 24, volatility: 0.014 },
  { code: 'NOK', fake: 'Norway', rate: 0.093, baseRate: 4.45, volatility: 0.0055 },
  { code: 'SEK', fake: 'Swedia', rate: 0.094, baseRate: 3.9, volatility: 0.005 },
  { code: 'IDR', fake: 'Rupiah', rate: 0.000061, baseRate: 6.1, volatility: 0.0062 },
  { code: 'THB', fake: 'Bath', rate: 0.028, baseRate: 2.4, volatility: 0.0055 },
  { code: 'PHP', fake: 'Piso', rate: 0.0175, baseRate: 4.8, volatility: 0.0052 },
  { code: 'ARS', fake: 'Peso Arg', rate: 0.00095, baseRate: 42, volatility: 0.019 }
];

export const COMMODITY_SEEDS: NamedSeed[] = [
  { real: 'Gold', fake: 'Emas', ticker: 'XAU', cls: 'commodity', tag: 'Precious', price: 2310, vol: 0.009 },
  { real: 'Silver', fake: 'Perak', ticker: 'XAG', cls: 'commodity', tag: 'Precious', price: 29.4, vol: 0.016 },
  { real: 'Crude Oil', fake: 'Minyak', ticker: 'WTI', cls: 'commodity', tag: 'Energy', price: 78.5, vol: 0.022 },
  { real: 'Brent Crude', fake: 'Minyak Brnt', ticker: 'BRN', cls: 'commodity', tag: 'Energy', price: 82.7, vol: 0.021 },
  { real: 'Natural Gas', fake: 'Gas Alam', ticker: 'NG', cls: 'commodity', tag: 'Energy', price: 2.71, vol: 0.034 },
  { real: 'Copper', fake: 'Tembaga', ticker: 'HG', cls: 'commodity', tag: 'Metals', price: 4.12, vol: 0.019 },
  { real: 'Nickel', fake: 'Nikel', ticker: 'NI', cls: 'commodity', tag: 'Metals', price: 16800, vol: 0.026 },
  { real: 'Wheat', fake: 'Gandum', ticker: 'WHT', cls: 'commodity', tag: 'Softs', price: 612, vol: 0.017 },
  { real: 'Corn', fake: 'Jagung', ticker: 'CRN', cls: 'commodity', tag: 'Softs', price: 448, vol: 0.015 },
  { real: 'Coffee', fake: 'Kopi', ticker: 'KOF', cls: 'commodity', tag: 'Softs', price: 214, vol: 0.026 },
  { real: 'Sugar', fake: 'Gula', ticker: 'SGR', cls: 'commodity', tag: 'Softs', price: 19.2, vol: 0.02 },
  { real: 'Cocoa', fake: 'Kakao', ticker: 'COC', cls: 'commodity', tag: 'Softs', price: 8400, vol: 0.03 }
];

export const INDEX_SEEDS: NamedSeed[] = [
  { real: 'S&P 500', fake: 'SPX 500', ticker: 'SPX', cls: 'index', tag: 'Broad', price: 5320, vol: 0.007 },
  { real: 'Nasdaq 100', fake: 'NSQ 100', ticker: 'NSQ', cls: 'index', tag: 'Tech', price: 18400, vol: 0.009 },
  { real: 'Dow Jones', fake: 'Dow Jones', ticker: 'DJI', cls: 'index', tag: 'Blue Chip', price: 39400, vol: 0.006 },
  { real: 'Russell 2000', fake: 'RSL 2000', ticker: 'RSL', cls: 'index', tag: 'Small Cap', price: 2050, vol: 0.011 },
  { real: 'Crypto Total Cap', fake: 'Kripto Total', ticker: 'KTOT', cls: 'index', tag: 'Crypto', price: 2.31e12, vol: 0.03 },
  { real: 'Fear & Greed Index', fake: 'Takut & Greed', ticker: 'FNG', cls: 'index', tag: 'Sentiment', price: 62, vol: 0.03 }
];

export function makeMemeName(rng: RNG): { name: string; ticker: string } {
  const a = rng.pick(MEME_WORD_A);
  const b = rng.pick(MEME_WORD_B);
  const name = a + b;
  let ticker = (a[0] + b.slice(0, 2)).toUpperCase();
  if (rng.chance(0.4)) ticker += rng.int(2, 9);
  return { name, ticker };
}

export function makeShitName(rng: RNG): { name: string; ticker: string } {
  const name = rng.pick(SHIT_PRE) + rng.pick(SHIT_MID) + rng.pick(SHIT_SUF);
  let ticker = name.slice(0, 4).toUpperCase();
  if (rng.chance(0.35)) ticker += rng.int(2, 9);
  return { name, ticker };
}

export function makeStockName(rng: RNG): { name: string; ticker: string } {
  const name = `${rng.pick(STOCK_PRE)} ${rng.pick(STOCK_SUF)}`;
  const ticker = name
    .split(' ')
    .map((w) => w.replace(/[^A-Za-z]/g, ''))
    .join('')
    .slice(0, 4)
    .toUpperCase();
  return { name, ticker: ticker || 'XXXX' };
}

export function makeForexName(base: Currency, quote: Currency): { name: string; ticker: string } {
  return { name: `${base.fake}/${quote.fake}`, ticker: `${base.code}${quote.code}` };
}

export const MEME_TAG_POOL = ['AI', 'RWA', 'Gaming', 'DeFi', 'Meme', 'DePIN', 'Privacy', 'ZK', 'Meme', 'Meme'];
