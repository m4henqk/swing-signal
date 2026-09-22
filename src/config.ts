// ─────────────────────────────────────────────────────────────────────────────
// Central configuration: every URL, default, and storage key lives here.
// Change values below to retune the whole app — nothing else hardcodes them.
// ─────────────────────────────────────────────────────────────────────────────

export interface AppConfig {
  /** Default API endpoints (Binance is geo-blocked in some regions — user can override in Settings) */
  binanceBaseUrl: string;
  coingeckoBaseUrl: string;

  // Strategy defaults
  defaultLookback: number;
  defaultThreshold: number;
  defaultRefreshInterval: number; // minutes

  // Options surfaced in Settings
  lookbackOptions: number[];
  thresholdOptions: number[];
  refreshIntervalOptions: number[];

  // Chart timeframe options (label shown, Binance interval, seconds per candle)
  chartTimeframes: {
    label: string;
    value: string;
    seconds: number;
  }[];

  // Default UI theme
  theme: 'dark' | 'light';

  // localStorage keys
  storageKeys: {
    watchlist: string;
    settings: string;
    /** Prefix for all cache entries: `${prefix}${key}` */
    cache: string;
  };

  /** Cache TTL for CoinGecko fundamentals in ms (supply changes rarely: 24 h) */
  coinDataTtlMs: number;

  /** How many daily candles to fetch for stats (enough for the 200 lookback) */
  ohlcvLimit: number;
  /** How many candles to fetch for the interactive chart */
  chartCandleLimit: number;
}

export const config: AppConfig = {
  binanceBaseUrl: 'https://api.binance.com',
  coingeckoBaseUrl: 'https://api.coingecko.com/api/v3',

  defaultLookback: 20,
  defaultThreshold: 2.0,
  defaultRefreshInterval: 10,

  lookbackOptions: [20, 50, 100, 200],
  thresholdOptions: [1.5, 2.0, 2.5, 3.0],
  refreshIntervalOptions: [1, 5, 10, 15, 30, 60],

  chartTimeframes: [
    { label: '1D', value: '1d', seconds: 86_400 },
    { label: '4H', value: '4h', seconds: 14_400 },
    { label: '12H', value: '12h', seconds: 43_200 },
  ],

  theme: 'dark',

  storageKeys: {
    watchlist: 'swingsignal-watchlist',
    settings: 'swingsignal-settings',
    cache: 'swingsignal-cache:',
  },

  coinDataTtlMs: 24 * 60 * 60 * 1000, // 24 h

  ohlcvLimit: 200,
  chartCandleLimit: 180,
};
