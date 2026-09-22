// Type definitions for the crypto swing-trading dashboard

export interface PriceDataPoint {
  timestamp: number;
  close: number;
}

export interface WatchlistCoin {
  id: string;
  symbol: string;
  name: string;
}

export interface CoinStats {
  id: string;
  symbol: string;
  name: string;
  price: number;
  price24hChange: number;
  sma: number;
  stdDev: number;
  zScore: number;
  signal: 'buy' | 'neutral' | 'sell';
  threshold: number;
  trendWarning: boolean;
  trendDistance: number;
  ohlcv: OHLCVData[];
  coinData: CoinData | null;
  cacheStatus: 'fresh' | 'stale' | 'error';
}

export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  fully_diluted_valuation: number;
  total_volume: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  ath_change_percentage: number;
  price_change_percentage_24h: number;
}

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AppSettings {
  lookback: number;
  threshold: number;
  refreshInterval: number;
  theme: 'dark' | 'light';
  timeframe: string;
  binanceBaseUrl: string;
  coingeckoBaseUrl: string;
}

export interface ThresholdCrossing {
  timestamp: number;
  price: number;
  zScore: number;
  signal: 'buy' | 'sell';
}

export interface SignalHistory {
  [coinId: string]: ThresholdCrossing[];
}