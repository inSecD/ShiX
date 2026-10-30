import type { WorldState } from './world';
import type { LifestyleState } from './lifestyle';
import type { HubState } from './hub';
import type { BusinessState } from './business';
import type { LifeState } from './life';
import type { EncounterState } from './encounter';
import type { QuestState } from './quest';

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

/** event yang udah digenerate tapi BELUM diterapkan (dibocorkan sebagai rumor dulu) */
export interface PendingEvent {
  ev: GameEvent;
  tplId: string;
  impact: number;
  bps: number;
  ccyCode: string | null;
  sector: string | null;
  instId: string | null;
  macro: Partial<MacroState>;
}

export interface RumorState {
  botId: string;
  text: string;
  tier: number;
  evId: string | null;
  at: number;
}

export interface ConvoState {
  botId: string;
  greeting: string;
  rumor: string | null;
  gain: number;
  at: number;
}

export interface SocialState {
  friendship: Record<string, number>;
  lastChat: Record<string, number>;
  met: string[];
  rumor: RumorState | null;
  lastConvo: ConvoState | null;
}

/** satu post di CT Feed — dibikin prosedural dari kejadian sim beneran */
export interface FeedPost {
  id: string;
  t: number;
  kind: 'event' | 'mover' | 'hype' | 'rumor' | 'you' | 'chat';
  authorId: string;
  name: string;
  emoji: string;
  /** handle ala X (@budi_trader) */
  handle: string;
  text: string;
  tag: string | null;
  /** mention instrument hasil parser post pemain (instId) */
  mention: string | null;
  likes: number;
  reactions: FeedReaction[];
  /** media post (chart koin / gambar prosedural) */
  media: PostMedia | null;
  /** udah di-like/di-repost pemain? */
  liked: boolean;
  reposted: boolean;
  reposts: number;
  replies: number;
  /** post balasan siapa (id) — tampil "membalas @" */
  replyTo: string | null;
}

/** media post: mini-chart koin atau gambar prosedural (deterministik dari seed) */
export type PostMedia =
  | { kind: 'chart'; instId: string; seed: string }
  | { kind: 'art'; seed: string; emoji: string };

/** balasan trader AI terhadap post (persona-flavored) */
export interface FeedReaction {
  name: string;
  emoji: string;
  text: string;
}

export interface FeedState {
  posts: FeedPost[];
  seq: number;
  /** kapan terakhir tiap jenis ngepost (tick) — buat cooldown anti-spam */
  lastByKind: Record<string, number>;
  /** id event terakhir yang udah diambil reaksinya, biar nggak dobel */
  lastEventId: string | null;
}

/** profil sosmed pemain — follower menentukan jangkauan & kepercayaan */
export interface ProfileState {
  followers: number;
  following: string[];
  /** 0..100 — makin tinggi makin sering post dapet engagement */
  fame: number;
  lastPostTick: number;
  lifetimeLikes: number;
  posts: number;
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
  history: number[];
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
  /** handle ala X (@budi_trader) */
  handle: string;
  /** berapa orang yang ngikutin akun ini — buat tampilan sosmed */
  followers: number;
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
  scenarioId: string | null;
  label: string;
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
  tokenCost: Record<string, number>;
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
  progress: Record<string, boolean>;
  world: WorldState;
  lifestyle: LifestyleState;
  hub: HubState;
  business: BusinessState;
  life: LifeState;
  encounter: EncounterState;
  quests: QuestState;
  social: SocialState;
  feed: FeedState;
  profile: ProfileState;
  pendingEvent: PendingEvent | null;
}
