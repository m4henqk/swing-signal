// ─────────────────────────────────────────────────────────────────────────────
// api.ts — data layer for Binance (public REST) + CoinGecko (free tier).
//
// Design rules implemented here:
//  • Every response is cached in localStorage with a timestamp + TTL.
//  • Reads are synchronous: a fresh cache hit never touches the network, and a
//    stale cache is served as a fallback when a fetch fails (offline support).
//  • HTTP 429 / network errors retry with exponential backoff before falling
//    back to cache.
//  • Base URLs are injectable per call (Binance is geo-blocked in some regions).
// ─────────────────────────────────────────────────────────────────────────────

import { config } from './config';
import type { CoinData, OHLCVData } from './types';

export type { CoinData, OHLCVData };

// ── Result wrapper ───────────────────────────────────────────────────────────

export interface ApiResult<T> {
  data: T;
  /** true when the fetch failed and an outdated cached copy was served */
  stale: boolean;
  /** timestamp (ms) of the underlying data, for "last updated X min ago" */
  updatedAt: number;
}

// ── localStorage cache ───────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number; // ms epoch when cached
  ttlMs: number;
}

const cacheKey = (key: string) => `${config.storageKeys.cache}${key}`;

/** Synchronously read a cache entry. Returns null when nothing is stored. */
export function cacheGet<T>(key: string): { data: T; timestamp: number; isStale: boolean } | null {
  try {
    const raw = localStorage.getItem(cacheKey(key));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry || typeof entry.timestamp !== 'number') return null;
    return {
      data: entry.data,
      timestamp: entry.timestamp,
      isStale: Date.now() - entry.timestamp > entry.ttlMs,
    };
  } catch {
    return null; // corrupted entry — treat as a miss
  }
}

/** Write a cache entry. Silently ignores quota / privacy-mode errors. */
export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttlMs };
    localStorage.setItem(cacheKey(key), JSON.stringify(entry));
  } catch {
    /* storage full or unavailable — cache is best-effort */
  }
}

/** Remove every SwingSignal cache entry (used by Settings → clear cache). */
export function clearCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(config.storageKeys.cache)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

// ── Fetch with exponential backoff ───────────────────────────────────────────

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * GET JSON with retry + exponential backoff (1 s → 2 s → 4 s).
 * Retries on HTTP 429 (honoring Retry-After when present) and network errors.
 * Throws the last error if all attempts fail.
 */
async function fetchJson<T>(url: string, attempts = 3): Promise<T> {
  let lastError: unknown = new Error('Request failed');

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url);

      if (res.status === 429) {
        const retryAfterHeader = res.headers.get('Retry-After');
        const retryAfter = retryAfterHeader
          ? Number(retryAfterHeader) * 1000
          : 1000 * 2 ** attempt;
        await sleep(Math.min(retryAfter, 10_000));
        continue; // same attempt budget still applies
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) await sleep(1000 * 2 ** attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generic "cache-first, network-second, stale-cache-fallback" pattern. */
async function cachedFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<ApiResult<T>> {
  const cached = cacheGet<T>(key);

  // Fresh cache hit → serve instantly, skip the network entirely.
  if (cached && !cached.isStale) {
    return { data: cached.data, stale: false, updatedAt: cached.timestamp };
  }

  try {
    const data = await fetcher();
    cacheSet(key, data, ttlMs);
    return { data, stale: false, updatedAt: Date.now() };
  } catch (err) {
    // Network failed → fall back to stale cache if we have one.
    if (cached) {
      return { data: cached.data, stale: true, updatedAt: cached.timestamp };
    }
    throw err;
  }
}

const num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0);

// ── CoinGecko: fundamentals (supply, market cap, FDV, ATH) ──────────────────

/**
 * One batched /coins/markets request covers the whole watchlist.
 * Cached for 24 h — supply data changes rarely.
 */
export async function getCoinData(
  coinIds: string[],
  baseUrl = config.coingeckoBaseUrl
): Promise<ApiResult<CoinData[]>> {
  if (coinIds.length === 0) {
    return { data: [], stale: false, updatedAt: Date.now() };
  }
  const key = `cg:markets:${[...coinIds].sort().join(',')}`;
  return cachedFetch(key, config.coinDataTtlMs, async () => {
    const url =
      `${baseUrl}/coins/markets?vs_currency=usd&ids=${coinIds.join(',')}` +
      `&order=market_cap_desc&per_page=250&page=1&sparkline=false` +
      `&price_change_percentage=24h`;
    const raw = await fetchJson<any[]>(url);
    return raw.map((c) => ({
      id: c.id,
      symbol: String(c.symbol ?? '').toUpperCase(),
      name: c.name ?? c.id,
      current_price: num(c.current_price),
      market_cap: num(c.market_cap),
      fully_diluted_valuation: num(c.fully_diluted_valuation),
      total_volume: num(c.total_volume),
      circulating_supply: num(c.circulating_supply),
      total_supply: num(c.total_supply),
      max_supply: num(c.max_supply),
      ath: num(c.ath),
      ath_change_percentage: num(c.ath_change_percentage),
      price_change_percentage_24h: num(c.price_change_percentage_24h),
    })) as CoinData[];
  });
}

// ── Binance: batched 24h tickers (price + 24h change) ────────────────────────

export interface Ticker24h {
  symbol: string; // e.g. BTCUSDT
  price: number;
  changePct24h: number;
  quoteVolume24h: number;
}

/**
 * One batched /ticker/24hr request covers the whole watchlist.
 * Prices are the fast-moving data → short TTL (the refresh interval).
 */
export async function get24hTickers(
  symbols: string[],
  baseUrl = config.binanceBaseUrl,
  ttlMs = 10 * 60 * 1000
): Promise<ApiResult<Ticker24h[]>> {
  if (symbols.length === 0) {
    return { data: [], stale: false, updatedAt: Date.now() };
  }
  const key = `bn:ticker24h:${[...symbols].sort().join(',')}`;
  return cachedFetch(key, ttlMs, async () => {
    // Binance expects symbols=["BTCUSDT","ETHUSDT"] URL-encoded
    const symbolsParam = encodeURIComponent(JSON.stringify(symbols));
    const raw = await fetchJson<any[]>(`${baseUrl}/api/v3/ticker/24hr?symbols=${symbolsParam}`);
    return raw.map((t) => ({
      symbol: t.symbol,
      price: parseFloat(t.lastPrice),
      changePct24h: parseFloat(t.priceChangePercent),
      quoteVolume24h: parseFloat(t.quoteVolume),
    }));
  });
}

// ── Binance: OHLCV candles ───────────────────────────────────────────────────

/**
 * Kline candles for the chart / stats. Binance returns arrays:
 * [openTime, open, high, low, close, volume, closeTime, ...]
 */
export async function getOHLCV(
  symbol: string,
  interval: string,
  limit: number,
  baseUrl = config.binanceBaseUrl,
  ttlMs = 10 * 60 * 1000
): Promise<ApiResult<OHLCVData[]>> {
  const key = `bn:klines:${symbol}:${interval}:${limit}`;
  return cachedFetch(key, ttlMs, async () => {
    const url = `${baseUrl}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const raw = await fetchJson<any[][]>(url);
    return raw.map((k) => ({
      timestamp: k[6] as number, // close time (ms) — candle "belongs" to its close
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  });
}
