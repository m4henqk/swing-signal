// ─────────────────────────────────────────────────────────────────────────────
// stats.ts — pure statistical functions. No I/O, no React, no side effects.
// Everything the strategy needs: SMA, standard deviation, z-score, signal
// zones, rolling series for charting, and threshold-crossing detection.
// ─────────────────────────────────────────────────────────────────────────────

export interface PriceDataPoint {
  timestamp: number; // ms epoch
  close: number;
}

export type Signal = 'buy' | 'neutral' | 'sell';

export interface StatsResult {
  sma: number;
  stdDev: number;
  zScore: number;
  signal: Signal;
  threshold: number;
  lookback: number;
}

// ── Core math ────────────────────────────────────────────────────────────────

/** Arithmetic mean of a numeric window. */
export const mean = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
};

/** Population standard deviation of a numeric window given its mean. */
export const stdDev = (values: number[], mu?: number): number => {
  if (values.length === 0) return 0;
  const m = mu ?? mean(values);
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

/**
 * Simple Moving Average over the trailing `period` closes.
 * Returns null when there is not enough data yet.
 */
export const smaAt = (closes: number[], index: number, period: number): number | null => {
  if (index < period - 1) return null;
  const window = closes.slice(index - period + 1, index + 1);
  return mean(window);
};

/**
 * Z-score at `index`: (close − SMA) ÷ σ over the trailing `period` closes.
 * Returns null when there is not enough data (or σ is 0).
 */
export const zScoreAt = (closes: number[], index: number, period: number): number | null => {
  if (index < period - 1) return null;
  const window = closes.slice(index - period + 1, index + 1);
  const m = mean(window);
  const sd = stdDev(window, m);
  if (sd === 0) return null;
  return (closes[index] - m) / sd;
};

/** Signal zone for a z-score: z ≤ −t → buy, z ≥ +t → sell, else neutral. */
export const signalFor = (z: number, threshold: number): Signal => {
  if (z <= -threshold) return 'buy';
  if (z >= threshold) return 'sell';
  return 'neutral';
};

// ── Composite calculations ──────────────────────────────────────────────────

/**
 * Full stats snapshot for a coin: SMA / σ / z-score / signal zone, using the
 * last `lookback` daily closes and the live price as "current".
 */
export const computeStats = (
  closes: number[],
  currentPrice: number,
  lookback: number,
  threshold: number
): StatsResult => {
  if (closes.length < lookback) {
    throw new Error(`Not enough data: need ${lookback} closes, have ${closes.length}`);
  }
  const window = closes.slice(-lookback);
  const sma = mean(window);
  const sd = stdDev(window, sma);
  const zScore = sd === 0 ? 0 : (currentPrice - sma) / sd;
  return { sma, stdDev: sd, zScore, signal: signalFor(zScore, threshold), threshold, lookback };
};

/**
 * Rolling SMA / σ / z-score for every candle (null until enough history).
 * Used by the chart to draw the SMA line and the ±threshold·σ bands.
 */
export interface RollingPoint {
  sma: number;
  stdDev: number;
  zScore: number;
}

export const rollingStats = (closes: number[], period: number): (RollingPoint | null)[] => {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const window = closes.slice(i - period + 1, i + 1);
    const m = mean(window);
    const sd = stdDev(window, m);
    if (sd === 0) return null;
    return { sma: m, stdDev: sd, zScore: (closes[i] - m) / sd };
  });
};

// ── Threshold crossings (strategy back-review) ──────────────────────────────

export interface ThresholdCrossing {
  timestamp: number;
  index: number;
  price: number;
  zScore: number;
  signal: Signal; // zone entered at the crossing
}

/**
 * Finds candles where the z-score *entered* a signal zone (crossed ±threshold)
 * — i.e. how the strategy would have fired in the past. Consecutive candles
 * inside the same zone are not repeated; only the entry crossing is marked.
 */
export const findCrossings = (
  closes: number[],
  timestamps: number[],
  period: number,
  threshold: number
): ThresholdCrossing[] => {
  const zSeries = rollingStats(closes, period);
  const crossings: ThresholdCrossing[] = [];
  let currentZone: Signal = 'neutral';

  zSeries.forEach((pt, i) => {
    if (!pt) return;
    const zone = signalFor(pt.zScore, threshold);
    if (zone !== 'neutral' && zone !== currentZone) {
      crossings.push({
        timestamp: timestamps[i],
        index: i,
        price: closes[i],
        zScore: pt.zScore,
        signal: zone,
      });
    }
    currentZone = zone;
  });

  return crossings;
};

/**
 * Trend warning: distance of the live price from the 200-period SMA.
 * If price is more than 10% away, mean reversion is fighting a strong trend.
 */
export const trendWarning = (
  closes: number[],
  currentPrice: number,
  longPeriod = 200
): { isWarning: boolean; distancePct: number; sma: number | null } => {
  if (closes.length < longPeriod) return { isWarning: false, distancePct: 0, sma: null };
  const sma = mean(closes.slice(-longPeriod));
  if (sma === 0) return { isWarning: false, distancePct: 0, sma };
  const distancePct = Math.abs((currentPrice - sma) / sma) * 100;
  return { isWarning: distancePct > 10, distancePct, sma };
};

// ── Presentation helpers ────────────────────────────────────────────────────

/** "+2.31" / "−1.05" style z-score label. */
export const formatZScore = (z: number): string => {
  const sign = z > 0 ? '+' : z < 0 ? '−' : '';
  return `${sign}${Math.abs(z).toFixed(2)}`;
};

export const getSignalLabel = (signal: Signal): string => {
  switch (signal) {
    case 'buy':
      return 'Buy zone';
    case 'sell':
      return 'Sell / caution';
    default:
      return 'Neutral';
  }
};

/** Tailwind text-color class for a signal zone (muted green/red, never neon). */
export const getSignalColor = (signal: Signal): string => {
  switch (signal) {
    case 'buy':
      return 'text-emerald-500 dark:text-emerald-400';
    case 'sell':
      return 'text-rose-500 dark:text-rose-400';
    default:
      return 'text-amber-500 dark:text-amber-400';
  }
};

/** Solid background hex for chart markers / meter dots. */
export const getSignalHex = (signal: Signal): string => {
  switch (signal) {
    case 'buy':
      return '#10b981';
    case 'sell':
      return '#f43f5e';
    default:
      return '#f59e0b';
  }
};

/**
 * Plain-English one-liner, e.g. "BTC is 2.3 SD below its 20-day average —
 * historically stretched; this is where mean-reversion entries are considered."
 */
export const signalSentence = (
  symbol: string,
  zScore: number,
  lookback: number,
  threshold: number,
  timeframeLabel = 'day'
): string => {
  const abs = Math.abs(zScore).toFixed(1);
  const dir = zScore < 0 ? 'below' : 'above';
  if (zScore <= -threshold) {
    return `${symbol} is ${abs} SD ${dir} its ${lookback}-${timeframeLabel} average — historically stretched; this is where mean-reversion entries are considered.`;
  }
  if (zScore >= threshold) {
    return `${symbol} is ${abs} SD ${dir} its ${lookback}-${timeframeLabel} average — historically stretched; treat longs with caution or consider taking profits.`;
  }
  if (zScore < 0) {
    return `${symbol} is ${abs} SD ${dir} its ${lookback}-${timeframeLabel} average — mildly stretched, but not yet at the −${threshold} SD threshold.`;
  }
  if (zScore > 0) {
    return `${symbol} is ${abs} SD ${dir} its ${lookback}-${timeframeLabel} average — mildly stretched, but not yet at the +${threshold} SD threshold.`;
  }
  return `${symbol} is trading right at its ${lookback}-${timeframeLabel} average — no statistically meaningful stretch right now.`;
};
