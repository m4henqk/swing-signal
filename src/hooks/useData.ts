// ─────────────────────────────────────────────────────────────────────────────
// useData.ts — orchestrates all fetching for the watchlist.
//
//  • CoinGecko /coins/markets  → one batched request for fundamentals (24 h TTL)
//  • Binance /ticker/24hr      → one batched request for prices (refresh TTL)
//  • Binance /klines (1d)      → per-coin daily closes for stats
//
// Status pill logic: green = fresh fetch, yellow = stale cache served,
// red = error with nothing to show.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import { config } from '@/config';
import * as api from '@/api';
import type { CoinData, OHLCVData } from '@/api';
import type { AppSettings } from '@/types';

export type DataStatus = 'fresh' | 'stale' | 'error';

export interface UseDataResult {
  /** fundamentals keyed by CoinGecko id */
  coinDataById: Record<string, CoinData>;
  /** daily OHLCV keyed by CoinGecko id */
  ohlcvById: Record<string, OHLCVData[]>;
  /** live prices keyed by Binance symbol (BTCUSDT…) */
  tickerBySymbol: Record<string, api.Ticker24h>;
  isLoading: boolean;
  isRefreshing: boolean;
  status: DataStatus;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => void;
}

/** Maps watchlist symbols to CoinGecko ids for the batched fundamentals call. */
export const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  POL: 'polygon-ecosystem-token',
  LINK: 'chainlink',
  UNI: 'uniswap',
  ATOM: 'cosmos',
  LTC: 'litecoin',
  DOGE: 'dogecoin',
  SHIB: 'shiba-inu',
  TRX: 'tron',
  ETC: 'ethereum-classic',
  XLM: 'stellar',
  NEAR: 'near',
  ARB: 'arbitrum',
  OP: 'optimism',
  INJ: 'injective-protocol',
  APT: 'aptos',
  SUI: 'sui',
  TON: 'the-open-network',
  FIL: 'filecoin',
  AAVE: 'aave',
  MKR: 'maker',
  PEPE: 'pepe',
};

/** Resolves the Binance trading pair for a symbol (default USDT quote). */
export const binancePair = (symbol: string) => `${symbol.toUpperCase()}USDT`;
export { SYMBOL_TO_COINGECKO_ID };

export function useData(
  watchlist: Array<{ id: string; symbol: string; name: string }>,
  settings: AppSettings
): UseDataResult {
  const [coinDataById, setCoinDataById] = useState<Record<string, CoinData>>({});
  const [ohlcvById, setOhlcvById] = useState<Record<string, OHLCVData[]>>({});
  const [tickerBySymbol, setTickerBySymbol] = useState<Record<string, api.Ticker24h>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [status, setStatus] = useState<DataStatus>('fresh');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const inFlight = useRef(false);
  const hasDataRef = useRef(false);

  const fetchData = useCallback(
    async (manual: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;

      if (manual || !hasDataRef.current) setIsLoading(true);
      setIsRefreshing(true);
      setError(null);

      try {
        if (watchlist.length === 0) {
          setStatus('fresh');
          setLastUpdated(Date.now());
          hasDataRef.current = true;
          return;
        }

        const cgIds = watchlist.map(
          (c) => SYMBOL_TO_COINGECKO_ID[c.symbol] ?? c.id
        );
        const pairs = watchlist.map((c) => binancePair(c.symbol));
        const priceTtl = settings.refreshInterval * 60 * 1000;

        // Track whether any source had to serve stale cache
        let anyStale = false;
        let anySuccess = false;

        // 1) Fundamentals — one batched CoinGecko request (24 h TTL)
        let fundamentals: CoinData[] = [];
        try {
          const res = await api.getCoinData(cgIds, settings.coingeckoBaseUrl);
          fundamentals = res.data;
          anyStale = anyStale || res.stale;
          anySuccess = anySuccess || !res.stale;
        } catch (err) {
          console.warn('[useData] CoinGecko failed:', err);
        }

        // 2) Prices — one batched Binance ticker request (refresh TTL)
        let tickers: api.Ticker24h[] = [];
        try {
          const res = await api.get24hTickers(pairs, settings.binanceBaseUrl, priceTtl);
          tickers = res.data;
          anyStale = anyStale || res.stale;
          anySuccess = anySuccess || !res.stale;
        } catch (err) {
          console.warn('[useData] Binance tickers failed:', err);
        }

        // 3) Daily candles — per coin (cached per timeframe, 10 min TTL)
        const candleTtl = Math.min(priceTtl, 10 * 60 * 1000);
        const candleResults = await Promise.allSettled(
          watchlist.map((c) =>
            api.getOHLCV(binancePair(c.symbol), '1d', config.ohlcvLimit, settings.binanceBaseUrl, candleTtl)
          )
        );

        const candles: Record<string, OHLCVData[]> = {};
        watchlist.forEach((c, i) => {
          const r = candleResults[i];
          if (r.status === 'fulfilled') {
            candles[c.id] = r.value.data;
            anyStale = anyStale || r.value.stale;
            anySuccess = anySuccess || !r.value.stale;
          } else {
            console.warn(`[useData] klines failed for ${c.symbol}:`, r.reason);
            candles[c.id] = [];
          }
        });

        // Commit results
        const byId: Record<string, CoinData> = {};
        fundamentals.forEach((d) => (byId[d.id] = d));
        setCoinDataById(byId);

        const bySymbol: Record<string, api.Ticker24h> = {};
        tickers.forEach((t) => (bySymbol[t.symbol] = t));
        setTickerBySymbol(bySymbol);

        setOhlcvById(candles);
        setLastUpdated(Date.now());
        setStatus(anySuccess ? (anyStale ? 'stale' : 'fresh') : 'error');
        hasDataRef.current = true;

        if (!anySuccess) {
          setError('Could not reach Binance or CoinGecko. Showing cached data if available.');
        }
      } catch (err) {
        setStatus((prev) => (prev === 'fresh' ? 'error' : 'stale'));
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        inFlight.current = false;
      }
    },
    [watchlist, settings.refreshInterval, settings.binanceBaseUrl, settings.coingeckoBaseUrl]
  );

  // Initial load + periodic refresh (configurable 1–60 min)
  useEffect(() => {
    fetchData(false);
    const id = setInterval(() => fetchData(false), settings.refreshInterval * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchData, settings.refreshInterval]);

  return {
    coinDataById,
    ohlcvById,
    tickerBySymbol,
    isLoading,
    isRefreshing,
    status,
    error,
    lastUpdated,
    refresh: () => fetchData(true),
  };
}
