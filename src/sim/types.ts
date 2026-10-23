import type { WorldState } from './world';

export type AssetClass =
  | 'crypto'
  | 'meme'
  | 'shitcoin'
  | 'stock'
  | 'forex'
  | 'commodity'
  | 'index';

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface GarchParams {
  w: number;
  a: number;
  b: number;
  s2: number;
}

export interface Instrument {
  id: string;
  name: string;
  cls: AssetClass;
  sector: string;
  tag: string;
  pair: [string, string] | null;
  price: number;
  open: number;
  anchor: number;
  anchor0: number;
  fund: number;
  vol: number;
  garch: GarchParams;
  liquidity: number;
  beta: number;
  drift: number;
  hype: number;
  mcap: number;
  supply: number;
  funding: number;
  pressure: number;
  openInterest: number;
  candles: Candle[];
  daily: Candle[];
  lastVol: number;
  launchId: string | null;
  listedAt: number;
  momentum: number;
  revStrength: number;
  hypeBase: number;
  lastReturn: number;
}

export interface SpotHolding {
  instId: string;
  qty: number;
  avgCost: number;
  openedAt: number;
}

export interface Position {
  id: string;
  instId: string;
  side: 'long' | 'short';
  qty: number;
  entry: number;
  lev: number;
  margin: number;
  openedAt: number;
  liqPrice: number;
  fees: number;
  fundingPaid: number;
  tp: number | null;
  sl: number | null;
  trail: number | null;
  trailPeak: number;
}

export type OrderType = 'market' | 'limit' | 'stop' | 'stop-limit';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'open' | 'filled' | 'cancelled' | 'rejected' | 'triggered';

export interface Order {
  id: string;
  instId: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  price: number | null;
  stopPrice: number | null;
  lev: number;
  tif: 'GTC' | 'IOC';
  status: OrderStatus;
  createdAt: number;
  filledQty: number;
  avgFill: number;
  note: string;
}

export type Severity = 'low' | 'med' | 'high' | 'extreme';

export interface GameEvent {
  id: string;
  t: number;
  title: string;
  body: string;
  severity: Severity;
  tags: string[];
  impact: number;
  instId: string | null;
  sector: string | null;
  cls: AssetClass | null;
}

export interface LaunchToken {
  id: string;
  name: string;
  ticker: string;
  kind: 'meme' | 'shitcoin';
  tags: string[];
  createdAt: number;
  price: number;
  reserve: number;
  supply: number;
  k: number;
  price0: number;
  progress: number;
  lpLocked: number;
  devTokens: number;
  devSold: number;
  honeypot: boolean;
  rug: boolean;
  hype: number;
  owner: 'player' | 'ai';
  marketing: number;
  graduated: boolean;
  instId: string | null;
  inflow: number;
  distribute: number;
}

export interface MacroState {
  risk: number;
  inflation: number;
  rate: number;
  usd: number;
  liquidity: number;
  regime: string;
}

export interface Fill {
  id: string;
  t: number;
  instId: string;
  side: OrderSide;
  qty: number;
  price: number;
  fee: number;
  pnl: number;
  kind:
    | 'open'
    | 'close'
    | 'liquidate'
    | 'launch'
    | 'rug'
    | 'fee'
    | 'tp'
    | 'sl'
    | 'trail'
    | 'spot-buy'
    | 'spot-sell';
  note: string;
}

export type BotStrategy = 'momentum' | 'contrarian' | 'degen' | 'quant' | 'whale' | 'panic';

export interface BotHolding {
  instId: string;
  qty: number;
  entry: number;
}

export interface Bot {
  id: string;
  name: string;
  emoji: string;
  strategy: BotStrategy;
  startEquity: number;
  cash: number;
  holdings: BotHolding[];
  equity: number;
  pnlPct: number;
  lastTrade: number;
  trades: number;
}

export interface Challenge {
  dayKey: string;
  seed: number;
  startEquity: number;
  targetPct: number;
  startTick: number;
  deadlineTick: number;
  done: boolean;
  won: boolean;
  bestPct: number;
  finalPct: number | null;
  attempts: number;
  streak: number;
  rewarded: boolean;
}

export interface Settings {
  seed: number;
  startingCash: number;
  difficulty: 'easy' | 'normal' | 'brutal';
  maxLeverage: number;
  feeTaker: number;
  feeMaker: number;
  slippageEnabled: boolean;
  sound: boolean;
}

export interface SimState {
  seed: number;
  rngState: number;
  simTime: number;
  ticks: number;
  macro: MacroState;
  sectorHeat: Record<string, number>;
  instruments: Record<string, Instrument>;
  order: string[];
  positions: Record<string, Position>;
  spotHoldings: Record<string, SpotHolding>;
  orders: Record<string, Order>;
  events: GameEvent[];
  fills: Fill[];
  tokens: Record<string, LaunchToken>;
  tokenOrder: string[];
  tokenHoldings: Record<string, number>;
  cash: number;
  locked: number;
  realized: number;
  equityCurve: number[];
  hypeIndex: number;
  nextTokenAt: number;
  nextEventAt: number;
  bots: Bot[];
  challenge: Challenge | null;
  notices: string[];
  world: WorldState;
}
