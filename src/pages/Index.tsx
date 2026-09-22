import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Watchlist } from '@/components/Watchlist';
import { CandlestickChart } from '@/components/CandlestickChart';
import { SignalPanel } from '@/components/SignalPanel';
import { FundamentalsCard } from '@/components/FundamentalsCard';
import { SettingsModal } from '@/components/SettingsModal';
import { useData } from '@/hooks/useData';
import { AppSettings } from '@/types';
import { config } from '@/config';
import { useToast } from '@/hooks/use-toast';
import { CoinStats } from '@/types';
import { rollingStats, signalFor } from '@/stats';

const INITIAL_SETTINGS: AppSettings = {
  lookback: config.lookbackOptions[0],
  threshold: config.thresholdOptions[0],
  refreshInterval: config.refreshIntervalOptions[0],
  binanceBaseUrl: config.binanceApiBaseUrl,
  coingeckoBaseUrl: config.coingeckoApiBaseUrl,
};

const Index: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const storedSettings = localStorage.getItem('appSettings');
      return storedSettings ? JSON.parse(storedSettings) : INITIAL_SETTINGS;
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
      return INITIAL_SETTINGS;
    }
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const storedTheme = localStorage.getItem('theme');
      return storedTheme === 'light' ? 'light' : 'dark';
    } catch (error) {
      console.error('Failed to load theme from localStorage:', error);
      return 'dark'; // Default to dark on error
    }
  });
  const [watchlist, setWatchlist] = useState<{
    id: string;
    symbol: string;
    name: string;
  }[]>(() => {
    try {
      const storedWatchlist = localStorage.getItem('watchlist');
      return storedWatchlist ? JSON.parse(storedWatchlist) : [];
    } catch (error) {
      console.error('Failed to load watchlist from localStorage:', error);
      return [];
    }
  });
  const [selectedCoinId, setSelectedCoinId] = useState<string | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const { toast } = useToast();

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    try {
      localStorage.setItem('theme', theme);
    } catch (error) {
      console.error('Failed to save theme to localStorage:', error);
    }
  }, [theme]);

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem('appSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  }, [settings]);

  // Persist watchlist
  useEffect(() => {
    try {
      localStorage.setItem('watchlist', JSON.stringify(watchlist));
    } catch (error) {
      console.error('Failed to save watchlist to localStorage:', error);
    }
    // If selected coin is removed from watchlist, clear selection
    if (selectedCoinId && !watchlist.some((coin) => coin.id === selectedCoinId)) {
      setSelectedCoinId(null);
    }
    // If no coin is selected and watchlist has items, select the first one
    if (!selectedCoinId && watchlist.length > 0) {
      setSelectedCoinId(watchlist[0].id);
    }
  }, [watchlist, selectedCoinId]);

  // Custom hook for data fetching
  const {
    coinDataById,
    ohlcvById,
    tickerBySymbol,
    status,
    lastUpdated,
    refresh,
    isLoading,
    isRefreshing,
    error,
  } = useData(watchlist, settings);

  // Helper to compute CoinStats for a coin if not provided directly (or if we want to compute Z-score here)
  // Actually, SignalPanel and Watchlist need CoinStats.
  // Watchlist needs: price, change24h, zScore, signal.
  // SignalPanel needs: zScore, signal, price.
  // FundamentalsCard needs: coinData.

  // Let's construct a map of CoinStats from the fetched data.
  const coinStatsMap = React.useMemo(() => {
    const map: Record<string, CoinStats> = {};
    watchlist.forEach((coin) => {
      const ticker = tickerBySymbol[coin.symbol]; // symbol is uppercase in watchlist usually
      const ohlcv = ohlcvById[coin.id] || [];
      const price = ticker?.lastPrice ? parseFloat(ticker.lastPrice) : 0;
      const change24h = ticker?.priceChangePercent ? parseFloat(ticker.priceChangePercent) : 0;

      // Compute Z-score from OHLCV
      let zScore: number | null = null;
      if (ohlcv.length > 0) {
        const closes = ohlcv.map(c => c.close);
        const stats = rollingStats(closes, settings.lookback);
        const lastStat = stats[stats.length - 1];
        if (lastStat && lastStat.stdDev > 0) {
           zScore = (price - lastStat.sma) / lastStat.stdDev;
        }
      }

      map[coin.id] = {
        price,
        change24h,
        zScore,
        signal: signalFor(zScore, settings.threshold),
      };
    });
    return map;
  }, [watchlist, tickerBySymbol, ohlcvById, settings.lookback, settings.threshold]);


  const selectedCoinData = selectedCoinId ? coinDataById[selectedCoinId] : null;
  const selectedCoinStats = selectedCoinId ? coinStatsMap[selectedCoinId] : null;
  const selectedCoinOHLCV = selectedCoinId ? ohlcvById[selectedCoinId] : [];
  const selectedCoinInfo = watchlist.find((coin) => coin.id === selectedCoinId);

  const handleAddCoin = async (symbol: string) => {
    // Check if coin already exists
    if (watchlist.some((coin) => coin.symbol === symbol)) {
      toast({
        title: 'Coin already in watchlist',
        description: `${symbol} is already in your watchlist.`,
        variant: 'info',
      });
      return;
    }
    
    // We need to map symbol to ID. 
    // We can use a hardcoded list or fetch from CoinGecko.
    // For now, let's assume the user enters a valid CoinGecko ID if it's not in our map.
    // But we stored watchlist with ID. 
    // Wait, useData exports SYMBOL_TO_COINGECKO_ID.
    
    // Let's import it or use a simple heuristic if not found.
    // Actually, we can just try to add it with the symbol as ID if we can't find it?
    // No, we need a proper ID.
    
    // For simplicity, let's check if we have a mapping in useData.
    // We can't easily import it here unless we export it from hooks/useData.
    // Let's rely on the user entering the ID or symbol.
    // Actually, let's just use the symbol as the ID for now if we can't find it? No.
    
    // Let's assume we will fetch the ID from CoinGecko or we have a map.
    // I will check if SYMBOL_TO_COINGECKO_ID is exported from useData.ts
    // grep showed: export const SYMBOL_TO_COINGECKO_ID
    // So I can import it.
    
    const { SYMBOL_TO_COINGECKO_ID } = await import('@/hooks/useData');
    const coinGeckoId = SYMBOL_TO_COINGECKO_ID[symbol.toUpperCase()];

    if (!coinGeckoId) {
      toast({
        title: 'Invalid Symbol',
        description: `Could not find CoinGecko ID for ${symbol}. Please use a supported symbol (e.g. BTC, ETH).`,
        variant: 'destructive',
      });
      throw new Error(`Invalid symbol: ${symbol}`);
    }

    const newCoin = { id: coinGeckoId, symbol: symbol.toUpperCase(), name: symbol.toUpperCase() }; // Name might be updated later
    setWatchlist((prev) => [...prev, newCoin]);
    if (!selectedCoinId) {
      setSelectedCoinId(coinGeckoId);
    }
    toast({
      title: 'Coin Added',
      description: `${symbol} has been added to your watchlist.`,
    });
  };

  const handleRemoveCoin = (id: string) => {
    const coin = watchlist.find(c => c.id === id);
    setWatchlist((prev) => prev.filter((coin) => coin.id !== id));
    toast({
      title: 'Coin Removed',
      description: `${coin?.symbol} removed from watchlist.`,
    });
  };

  const handleSelectCoin = (id: string) => {
    setSelectedCoinId(id);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
  };

  const handleTimeframeChange = (newTimeframe: string) => {
    setSettings((prev) => ({ ...prev, timeframe: newTimeframe }));
  };

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground antialiased">
      <Header
        status={status}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        lastRefresh={lastUpdated}
        onRefresh={refresh}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        theme={theme}
        onThemeChange={handleThemeChange}
      />

      <main className="container grid flex-1 grid-cols-1 gap-6 py-6 lg:grid-cols-3 xl:grid-cols-4">
        {/* Left Sidebar: Watchlist */}
        <aside className="lg:col-span-1">
          <div className="sticky top-20 h-[calc(100vh-100px)]">
            <Watchlist
              watchlist={watchlist}
              coinStats={coinStatsMap}
              onAddCoin={handleAddCoin}
              onRemoveCoin={handleRemoveCoin}
              onSelectCoin={handleSelectCoin}
              selectedCoinId={selectedCoinId}
              settings={settings}
            />
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="grid gap-6 lg:col-span-2 xl:col-span-3">
          {/* Candlestick Chart */}
          <CandlestickChart
            candles={selectedCoinOHLCV}
            coinSymbol={selectedCoinInfo?.symbol || ''}
            coinName={selectedCoinInfo?.name || ''}
            settings={settings}
            timeframe={settings.timeframe || config.chartTimeframes[0].value} // Default timeframe if not set
            onTimeframeChange={handleTimeframeChange}
            isLoadingCandles={isLoading && selectedCoinOHLCV.length === 0}
            errorMessage={error}
          />

          {/* Bottom Panels (Signal & Fundamentals) */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <SignalPanel coinStats={selectedCoinStats} settings={settings} />
            <FundamentalsCard
              coinData={selectedCoinData}
              price={selectedCoinStats?.price || 0}
            />
          </div>
        </section>
      </main>

      <SettingsModal
        settings={settings}
        onSettingsChange={setSettings}
        isOpen={isSettingsModalOpen}
        onOpenChange={setIsSettingsModalOpen}
      />
    </div>
  );
};

export default Index;
