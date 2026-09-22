import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getSignalLabel, getSignalColor } from '@/stats';
import { CoinStats } from '@/types';
import { formatZScore } from '@/stats';

interface SignalPanelProps {
  coinStats: CoinStats | null;
  settings: {
    lookback: number;
    threshold: number;
  };
}

export const SignalPanel: React.FC<SignalPanelProps> = ({ coinStats, settings }) => {
  const { lookback, threshold } = settings;
  if (!coinStats) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Signal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Select a coin to view signal</p>
        </CardContent>
      </Card>
    );
  }

  const { zScore, signal, sma, stdDev, price, trendWarning, trendDistance } = coinStats;
  
  // Generate z-score meter positions
  const zScorePosition = ((zScore + 3) / 6) * 100; // Map -3 to +3 to 0-100%
  
  // Generate signal explanation
  const getSignalExplanation = () => {
    const formattedZ = formatZScore(zScore);
    const formattedSMA = sma.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    
    if (signal === 'buy') {
      return `${coinStats.symbol} is ${Math.abs(zScore).toFixed(1)} SD below its ${lookback}-day average — historically stretched; this is where mean-reversion entries are considered.`;
    } else if (signal === 'sell') {
      return `${coinStats.symbol} is ${zScore.toFixed(1)} SD above its ${lookback}-day average — historically stretched; consider caution or profit-taking.`;
    } else {
      return `${coinStats.symbol} is within normal range of its ${lookback}-day average. Mean reversion signals are not triggered.`;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Signal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Z-score meter */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>-3</span>
            <span>0</span>
            <span>+3</span>
          </div>
          
          <div className="relative h-8 bg-muted/30 rounded-full overflow-hidden">
            {/* Threshold lines */}
            <div 
              className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500/50" 
              style={{ left: `${((threshold + 3) / 6) * 100}%` }}
            />
            <div 
              className="absolute left-0 top-0 bottom-0 w-0.5 bg-green-500/50" 
              style={{ left: `${((-threshold + 3) / 6) * 100}%` }}
            />
            
            {/* Z-score indicator */}
            <div 
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-lg"
              style={{ 
                backgroundColor: signal === 'buy' ? '#22c55e' : signal === 'sell' ? '#ef4444' : '#eab308',
                left: `${zScorePosition}%`
              }}
            />
          </div>
          
          <div className="flex justify-between text-xs mt-1">
            <span className={signal === 'buy' ? 'text-green-400' : ''}>Buy</span>
            <span className={signal === 'sell' ? 'text-red-400' : ''}>Sell</span>
          </div>
        </div>
        
        {/* Current zone badge */}
        <div className="flex items-center justify-between">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="secondary"
                  className={`${getSignalColor(signal)} bg-opacity-20 text-sm`}
                >
                  {getSignalLabel(signal)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {signal === 'buy' && 'Price is statistically below average - potential entry point'}
                  {signal === 'sell' && 'Price is statistically above average - potential exit point'}
                  {signal === 'neutral' && 'Price is within normal range'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <div className="text-right">
            <p className="font-mono text-sm">Z: {formatZScore(zScore)}</p>
            <p className="text-xs text-muted-foreground">
              σ: {stdDev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </p>
          </div>
        </div>
        
        {/* Signal explanation */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-muted-foreground italic cursor-help">
                {getSignalExplanation()}
              </p>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">
                <strong>How it works:</strong> The z-score measures how many standard deviations 
                the current price is from the {lookback}-day simple moving average. 
                A z-score above +{threshold} or below -{threshold} indicates the price is 
                statistically stretched.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* Trend warning */}
        {trendWarning && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-600">
              ⚠️ Strong trend detected: Price is {trendDistance.toFixed(1)}% from the 200-period SMA. 
              Mean reversion is riskier against trends.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};