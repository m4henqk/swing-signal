import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { config } from '@/config';
import type { OHLCVData, AppSettings } from '@/types';
import {
  rollingStats,
  findCrossings,
  formatZScore,
  getSignalLabel,
  getSignalHex,
  signalFor,
  getSignalColor,
} from '@/stats';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming cn for conditional class merging

interface CandlestickChartProps {
  candles: OHLCVData[];
  coinSymbol: string;
  coinName: string;
  settings: AppSettings;
  timeframe: string; // e.g., '1d', '4h'
  onTimeframeChange: (timeframe: string) => void;
  isLoadingCandles: boolean;
  errorMessage: string | null;
}

interface ChartHoverInfo {
  x: number;
  y: number;
  data: OHLCVData;
  sma: number | null;
  stdDev: number | null;
  zScore: number | null;
  // Removed signal: string | null; as it can be derived from zScore
}

/**
 * Renders an interactive candlestick chart using SVG. Features include:
 * - Candlesticks (OHLCV)
 * - Rolling Simple Moving Average (SMA) line
 * - Rolling ±Threshold &times; Standard Deviation bands
 * - Markers for past threshold crossings
 * - Zoom and pan controls
 * - Hover tooltip displaying detailed candle info and stats
 * - Timeframe selector
 */
export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  candles,
  coinSymbol,
  coinName,
  settings,
  timeframe,
  onTimeframeChange,
  isLoadingCandles,
  errorMessage,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 360 }); // Default width
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 1 }); // 0-1 range for visible data
  const [hoverInfo, setHoverInfo] = useState<ChartHoverInfo | null>(null);

  const { lookback, threshold } = settings;

  // --- Dimension recalculation on resize ---
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions((prev) => ({ width: rect.width, height: prev.height }));
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // --- Data preparation for visible range ---
  const visibleCandles = useMemo(() => {
    if (candles.length === 0) return [];
    const startIndex = Math.floor(visibleRange.start * candles.length);
    const endIndex = Math.ceil(visibleRange.end * candles.length);
    return candles.slice(startIndex, endIndex);
  }, [candles, visibleRange]);

  const allCloses = useMemo(() => candles.map((c) => c.close), [candles]);
  const allTimestamps = useMemo(() => candles.map((c) => c.timestamp), [candles]);

  const { rollingPoints, crossings } = useMemo(() => {
    if (candles.length === 0) return { rollingPoints: [], crossings: [] };
    const closes = candles.map((c) => c.close);
    const timestamps = candles.map((c) => c.timestamp);

    // Full rolling stats for lines
    const rollingPoints = rollingStats(closes, lookback);

    // Crossings for markers
    const crossings = findCrossings(closes, timestamps, lookback, threshold);

    return { rollingPoints, crossings };
  }, [candles, lookback, threshold]);

  const visibleRollingPoints = useMemo(() => {
    if (rollingPoints.length === 0) return [];
    const startIndex = Math.floor(visibleRange.start * rollingPoints.length);
    const endIndex = Math.ceil(visibleRange.end * rollingPoints.length);
    return rollingPoints.slice(startIndex, endIndex);
  }, [rollingPoints, visibleRange]);

  const visibleCrossings = useMemo(() => {
    if (crossings.length === 0) return [];
    const startIndex = Math.floor(visibleRange.start * candles.length);
    const endIndex = Math.ceil(visibleRange.end * candles.length);
    return crossings.filter((c) => c.index >= startIndex && c.index < endIndex);
  }, [crossings, candles, visibleRange]);

  // --- Chart scaling ---
  const padding = { left: 40, right: 20, top: 20, bottom: 40 };
  const chartWidth = dimensions.width - padding.left - padding.right;
  const chartHeight = dimensions.height - padding.top - padding.bottom;

  const getPriceRange = useCallback((data: OHLCVData[]) => {
    if (data.length === 0) return { min: 0, max: 1, range: 1 };
    let min = Infinity,
      max = -Infinity;
    for (const d of data) {
      min = Math.min(min, d.low);
      max = Math.max(max, d.high);
    }
    return { min, max, range: max - min || 1 };
  }, []);

  const priceRange = useMemo(() => getPriceRange(visibleCandles), [visibleCandles, getPriceRange]);

  const yScale = useCallback(
    (price: number) =>
      padding.top + chartHeight - ((price - priceRange.min) / priceRange.range) * chartHeight,
    [chartHeight, padding.top, priceRange.min, priceRange.range]
  );

  const xScale = useCallback(
    (index: number) => {
      if (visibleCandles.length === 0) return padding.left;
      const candleSpacing = chartWidth / (visibleCandles.length - (visibleCandles.length > 1 ? 1 : 0));
      return padding.left + index * candleSpacing;
    },
    [chartWidth, padding.left, visibleCandles.length]
  );

  const candleBodyWidth = useMemo(
    () => Math.max(1, chartWidth / Math.max(1, visibleCandles.length) - 1),
    [chartWidth, visibleCandles.length]
  );

  // --- Zoom & Pan controls ---
  const handleZoom = useCallback(
    (factor: number) => {
      const newRange = Math.max(0.05, Math.min(1, visibleRange.end - visibleRange.start) * factor);
      const center = (visibleRange.start + visibleRange.end) / 2;
      const newStart = Math.max(0, center - newRange / 2);
      const newEnd = Math.min(1, center + newRange / 2);
      setVisibleRange({ start: newStart, end: newEnd });
    },
    [visibleRange]
  );

  const handlePan = useCallback(
    (delta: number) => {
      const currentRange = visibleRange.end - visibleRange.start;
      const newStart = Math.max(0, Math.min(1 - currentRange, visibleRange.start + delta * 0.1));
      setVisibleRange({ start: newStart, end: newStart + currentRange });
    },
    [visibleRange]
  );

  const handleResetZoom = useCallback(() => {
    setVisibleRange({ start: 0, end: 1 });
  }, []);

  // --- Hover / Tooltip logic ---
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (visibleCandles.length === 0) return;
      const svgRect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - svgRect.left;

      // Find nearest candle by X position
      let closestCandleIndex = -1;
      let minDistance = Infinity;

      for (let i = 0; i < visibleCandles.length; i++) {
        const xPos = xScale(i) + candleBodyWidth / 2;
        const dist = Math.abs(xPos - mouseX);
        if (dist < minDistance) {
          minDistance = dist;
          closestCandleIndex = i;
        }
      }

      if (closestCandleIndex !== -1) {
        const candle = visibleCandles[closestCandleIndex];
        const overallIndex = Math.floor(visibleRange.start * candles.length) + closestCandleIndex;
        const rollingPt = rollingPoints[overallIndex];

        setHoverInfo({
          x: xScale(closestCandleIndex) + candleBodyWidth / 2,
          y: e.clientY - svgRect.top, // Use mouse Y for tooltip placement
          data: candle,
          sma: rollingPt?.sma ?? null,
          stdDev: rollingPt?.stdDev ?? null,
          zScore: rollingPt?.zScore ?? null,
        });
      } else {
        setHoverInfo(null);
      }
    },
    [visibleCandles, xScale, candleBodyWidth, candles.length, visibleRange, rollingPoints, threshold]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverInfo(null);
  }, []);

  if (isLoadingCandles) {
    return (
      <Card className="flex h-full flex-col">
        <CardHeader>
          <CardTitle>Chart: {coinName || 'Loading...'}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">Loading chart data...</p>
        </CardContent>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card className="flex h-full flex-col">
        <CardHeader>
          <CardTitle>Chart: {coinName || 'Error'}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center p-6 text-center text-sm text-destructive">
          <p>{errorMessage}</p>
        </CardContent>
      </Card>
    );
  }

  if (candles.length === 0) {
    return (
      <Card className="flex h-full flex-col">
        <CardHeader>
          <CardTitle>Chart: {coinName || 'No Data'}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">No chart data available for {coinName}.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">
          Chart: <span className="text-primary">{coinName}</span>
        </CardTitle>
        <div className="flex items-center gap-1.5">
          {/* Timeframe selector */}
          <Select value={timeframe} onValueChange={onTimeframeChange}>
            <SelectTrigger className="h-9 w-20 rounded-xl px-3 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {config.chartTimeframes.map((tf) => (
                <SelectItem key={tf.value} value={tf.value}>
                  {tf.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Zoom/Pan buttons */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => handlePan(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pan left</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => handleZoom(1.2)}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom in</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => handleZoom(0.8)}>
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom out</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={handleResetZoom}>
                <Maximize className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset zoom</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => handlePan(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pan right</TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-6 pt-0">
        <div ref={containerRef} className="relative h-full w-full">
          <svg
            width={dimensions.width}
            height={dimensions.height}
            className="block overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Grid lines */}
            <g stroke="hsl(var(--muted-foreground)/0.1)" strokeWidth="0.5">
              {[0, 25, 50, 75, 100].map((percent) => (
                <line
                  key={`h-grid-${percent}`}
                  x1={padding.left}
                  y1={padding.top + (percent / 100) * chartHeight}
                  x2={padding.left + chartWidth}
                  y2={padding.top + (percent / 100) * chartHeight}
                />
              ))}
            </g>

            {/* Price labels (Y-axis) */}
            {[0, 25, 50, 75, 100].map((percent) => {
              const price = priceRange.min + (percent / 100) * priceRange.range;
              return (
                <text
                  key={`price-label-${percent}`}
                  x={padding.left - 5}
                  y={yScale(price) + 4}
                  fontSize="10"
                  textAnchor="end"
                  fill="hsl(var(--muted-foreground))"
                >
                  {price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </text>
              );
            })}

            {/* Debug: show visibleCandles count */}
            <text x={padding.left} y={20} fontSize="12" fill="red">
              {`Debug: ${visibleCandles.length} candles, w: ${chartWidth}, spacing: ${candleBodyWidth.toFixed(1)}`}
            </text>

            {/* Debug: show first candle position */}
            <circle cx={xScale(0)} cy={padding.top + chartHeight / 2} r="5" fill="blue" />
            <circle cx={xScale(visibleCandles.length - 1)} cy={padding.top + chartHeight / 2} r="5" fill="green" />

            {/* Candlesticks */}
            {visibleCandles.map((candle, i) => {
              const x = xScale(i);
              const openY = yScale(candle.open);
              const closeY = yScale(candle.close);
              const highY = yScale(candle.high);
              const lowY = yScale(candle.low);

              const isGreen = candle.close >= candle.open;
              const candleColor = isGreen ? 'hsl(var(--emerald-500))' : 'hsl(var(--rose-500))';

              return (
                <g key={candle.timestamp}>
                  {/* Wick */}
                  <line
                    x1={x + candleBodyWidth / 2}
                    y1={highY}
                    x2={x + candleBodyWidth / 2}
                    y2={lowY}
                    stroke={candleColor}
                    strokeWidth="1"
                  />
                  {/* Body */}
                  <rect
                    x={x}
                    y={Math.min(openY, closeY)}
                    width={candleBodyWidth}
                    height={Math.max(1, Math.abs(openY - closeY))}
                    fill={candleColor}
                    rx="0.5" ry="0.5"
                  />
                </g>
              );
            })}

            {/* Rolling SMA line */}
            {visibleRollingPoints.length > 0 && (
              <polyline
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="1.5"
                points={visibleRollingPoints
                  .map((pt, i) => (pt ? `${xScale(i)},${yScale(pt.sma)}` : ''))
                  .filter(Boolean)
                  .join(' ')}
              />
            )}

            {/* Rolling Upper Band line (+threshold*stdDev) */}
            {visibleRollingPoints.length > 0 && (
              <polyline
                fill="none"
                stroke="hsl(var(--rose-400))"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.6"
                points={visibleRollingPoints
                  .map((pt, i) => (pt ? `${xScale(i)},${yScale(pt.sma + threshold * pt.stdDev)}` : ''))
                  .filter(Boolean)
                  .join(' ')}
              />
            )}

            {/* Rolling Lower Band line (-threshold*stdDev) */}
            {visibleRollingPoints.length > 0 && (
              <polyline
                fill="none"
                stroke="hsl(var(--emerald-400))"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.6"
                points={visibleRollingPoints
                  .map((pt, i) => (pt ? `${xScale(i)},${yScale(pt.sma - threshold * pt.stdDev)}` : ''))
                  .filter(Boolean)
                  .join(' ')}
              />
            )}

            {/* Threshold Crossing Markers */}
            {visibleCrossings.map((crossing) => {
              const x = xScale(crossing.index - Math.floor(visibleRange.start * candles.length));
              const y = yScale(crossing.price);
              const color = getSignalHex(signalFor(crossing.zScore, threshold)); // Corrected
              return (
                <TooltipProvider key={`crossing-${crossing.timestamp}`}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <circle
                        cx={x + candleBodyWidth / 2}
                        cy={y}
                        r="3"
                        fill={color}
                        stroke="hsl(var(--background))"
                        strokeWidth="1.5"
                        className="cursor-help"
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <p className="font-semibold">{format(crossing.timestamp, 'MMM d, yyyy')}</p>
                      <p>Entered {getSignalLabel(signalFor(crossing.zScore, threshold))}</p> {/* Corrected */}
                      <p className="font-mono">Z: {formatZScore(crossing.zScore)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </svg>

          {/* Floating Hover Tooltip */}
          {hoverInfo && (
            <div
              className="absolute z-30 rounded-lg border border-border bg-popover p-2 text-xs shadow-md"
              style={{
                left: hoverInfo.x + 10,
                top: hoverInfo.y - 10,
                transform: 'translateY(-100%)', // Position above mouse
                pointerEvents: 'none', // Allow mouse events to pass through to SVG
              }}
            >
              <p className="font-semibold text-primary">{format(hoverInfo.data.timestamp, 'MMM dd, HH:mm')}</p>
              <p>O: {hoverInfo.data.open.toFixed(2)}</p>
              <p>H: {hoverInfo.data.high.toFixed(2)}</p>
              <p>L: {hoverInfo.data.low.toFixed(2)}</p>
              <p>C: {hoverInfo.data.close.toFixed(2)}</p>
              {hoverInfo.sma && (
                <p>
                  SMA({lookback}): {hoverInfo.sma.toFixed(2)}
                </p>
              )}
              {hoverInfo.zScore !== null && (
                <p>
                  Z-score: <span className={cn(getSignalColor(signalFor(hoverInfo.zScore, threshold)))}>{formatZScore(hoverInfo.zScore)}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
