import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { CoinData } from '@/types';

interface FundamentalsCardProps {
  coinData: CoinData | null;
  price: number;
}

const formatNumber = (num: number): string => {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
};

const formatSupply = (num: number): string => {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toLocaleString();
};

export const FundamentalsCard: React.FC<FundamentalsCardProps> = ({ coinData, price }) => {
  if (!coinData) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Fundamentals</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Select a coin to view fundamentals</p>
        </CardContent>
      </Card>
    );
  }

  const { 
    circulating_supply, 
    total_supply, 
    max_supply, 
    market_cap, 
    fully_diluted_valuation, 
    total_volume,
    ath,
    ath_change_percentage,
  } = coinData;

  // Calculate supply metrics
  const hasMaxSupply = max_supply && max_supply > 0;
  const effectiveMaxSupply = hasMaxSupply ? max_supply : total_supply;
  const releasedPercent = effectiveMaxSupply > 0 ? (circulating_supply / effectiveMaxSupply) * 100 : 0;
  const remainingPercent = 100 - releasedPercent;

  // Calculate liquidity ratio (24h volume / market cap)
  const liquidityRatio = market_cap > 0 ? (total_volume / market_cap) * 100 : 0;

  // Calculate distance from ATH
  const distanceFromATH = ath > 0 ? ((price - ath) / ath) * 100 : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Fundamentals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Supply Bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span>Circulating</span>
            <span>Total</span>
            {hasMaxSupply && <span>Max</span>}
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden relative">
            <div 
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${releasedPercent}%` }}
            />
            {hasMaxSupply && (
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-background"
                style={{ left: `${releasedPercent}%` }}
              />
            )}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{formatSupply(circulating_supply)}</span>
            <span>{formatSupply(total_supply)}</span>
            {hasMaxSupply && <span>{formatSupply(max_supply)}</span>}
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground mt-1 cursor-help">
                  {hasMaxSupply 
                    ? `${releasedPercent.toFixed(1)}% released, ${remainingPercent.toFixed(1)}% still to come (dilution risk)`
                    : `${releasedPercent.toFixed(1)}% of total supply in circulation`}
                </p>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  <strong>Supply Bar:</strong> Shows how much of the total/max supply is currently in circulation. 
                  A low percentage means more tokens may enter the market (dilution risk), 
                  potentially putting downward pressure on price.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Market Cap vs FDV */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Market Cap</p>
            <p className="font-mono text-sm">{formatNumber(market_cap)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">FDV</p>
            <p className="font-mono text-sm">{formatNumber(fully_diluted_valuation || 0)}</p>
          </div>
        </div>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-muted-foreground cursor-help">
                {fully_diluted_valuation && market_cap > 0 
                  ? `FDV/Market Cap: ${(fully_diluted_valuation / market_cap).toFixed(2)}x`
                  : 'FDV data unavailable'}
              </p>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">
                <strong>Market Cap vs FDV:</strong> Market Cap = Price × Circulating Supply. 
                FDV (Fully Diluted Valuation) = Price × Max/Total Supply. 
                A high FDV/Market Cap ratio means significant future token unlocks could dilute existing holders.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Liquidity */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span>24h Volume / Market Cap</span>
            <span className={liquidityRatio >= 5 ? 'text-green-400' : 'text-amber-400'}>
              {liquidityRatio.toFixed(2)}%
            </span>
          </div>
          <Progress value={Math.min(liquidityRatio, 100)} className="h-2" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground mt-1 cursor-help">
                  {liquidityRatio >= 5 ? 'Healthy liquidity' : 'Low liquidity - wider spreads, higher slippage'}
                </p>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  <strong>Liquidity Ratio:</strong> 24h trading volume divided by market cap. 
                  Above ~5% is generally healthy — it means the asset trades actively relative to its size. 
                  Low ratios indicate thin markets with higher slippage and wider spreads.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Distance from ATH */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span>Distance from ATH</span>
            <span className={distanceFromATH >= 0 ? 'text-green-400' : 'text-red-400'}>
              {distanceFromATH >= 0 ? '+' : ''}{distanceFromATH.toFixed(2)}%
            </span>
          </div>
          <Progress 
            value={Math.min(Math.max((distanceFromATH + 100) / 2, 0), 100)} 
            className="h-2"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground mt-1 cursor-help">
                  ATH: {formatNumber(ath)} ({ath_change_percentage >= 0 ? '+' : ''}{ath_change_percentage.toFixed(2)}%)
                </p>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  <strong>All-Time High:</strong> The highest price ever reached. 
                  Distance from ATH shows how far the current price is from its peak. 
                  Large drawdowns may present opportunities but also indicate changed fundamentals.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
};