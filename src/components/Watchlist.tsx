import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Search } from 'lucide-react';
import { WatchlistCoin, CoinStats } from '@/types';
import { getSignalLabel, getSignalColor } from '@/stats';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SYMBOL_TO_COINGECKO_ID } from '@/hooks/useData';

interface WatchlistProps {
  watchlist: WatchlistCoin[];
  coinStats: Record<string, CoinStats>;
  onAddCoin: (symbol: string) => Promise<void>;
  onRemoveCoin: (symbol: string) => void;
  onSelectCoin: (id: string) => void;
  selectedCoinId: string | null;
  settings: any;
}

const POPULAR_COINS = Object.keys(SYMBOL_TO_COINGECKO_ID).sort();

export const Watchlist: React.FC<WatchlistProps> = ({
  watchlist,
  coinStats,
  onAddCoin,
  onRemoveCoin,
  onSelectCoin,
  selectedCoinId,
  settings
}) => {
  const [newSymbol, setNewSymbol] = useState('');
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const { toast } = useToast();

  const handleAddCoin = async (symbol: string) => {
    if (!symbol) return;
    
    try {
      await onAddCoin(symbol);
      setNewSymbol('');
      setIsSelectOpen(false);
      toast({
        title: "Coin added",
        description: `${symbol} has been added to your watchlist`,
      });
    } catch (error) {
      toast({
        title: "Error adding coin",
        description: error instanceof Error ? error.message : "Failed to add coin",
        variant: "destructive",
      });
    }
  };

  const handleSelectChange = (value: string) => {
    if (value === 'custom') {
      setIsSelectOpen(true);
    } else {
      handleAddCoin(value);
    }
  };

  if (watchlist.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="mb-4 space-y-2">
          <label className="text-sm font-medium">Add a coin</label>
          <Select onValueChange={handleSelectChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a coin to add..." />
            </SelectTrigger>
            <SelectContent>
              {POPULAR_COINS.map((symbol) => (
                <SelectItem key={symbol} value={symbol}>
                  {symbol}
                </SelectItem>
              ))}
              <SelectItem value="custom">
                <div className="flex items-center">
                  <Search className="mr-2 h-4 w-4" />
                  Search by symbol...
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          
          {isSelectOpen && (
            <form onSubmit={(e) => { e.preventDefault(); handleAddCoin(newSymbol); }} className="flex space-x-2 mt-2">
              <Input
                placeholder="Enter symbol (e.g., BTC)"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                className="flex-1"
              />
              <Button type="submit" variant="default" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center text-center py-8 border-2 border-dashed rounded-lg">
          <div>
            <div className="w-20 h-20 mx-auto mb-4 text-muted-foreground/50">
              <Plus className="h-8 w-8" />
            </div>
            <h3 className="font-semibold mb-2">Your watchlist is empty</h3>
            <p className="text-sm text-muted-foreground">
              Add coins to track their swing trading signals
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Add a coin</label>
        <Select onValueChange={handleSelectChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a coin to add..." />
          </SelectTrigger>
          <SelectContent>
            {POPULAR_COINS.filter(symbol => !watchlist.some(c => c.symbol === symbol)).map((symbol) => (
              <SelectItem key={symbol} value={symbol}>
                {symbol}
              </SelectItem>
            ))}
            <SelectItem value="custom">
              <div className="flex items-center">
                <Search className="mr-2 h-4 w-4" />
                Search by symbol...
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        
        {isSelectOpen && (
          <form onSubmit={(e) => { e.preventDefault(); handleAddCoin(newSymbol); setIsSelectOpen(false); }} className="flex space-x-2 mt-2">
            <Input
              placeholder="Enter symbol (e.g., BTC)"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              className="flex-1"
            />
            <Button type="submit" variant="default" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
      
      <div className="space-y-2">
        {watchlist.map(coin => {
          const stats = coinStats[coin.id];
          const isSelected = selectedCoinId === coin.id;
          
          return (
            <div 
              key={coin.id} 
              onClick={() => onSelectCoin(coin.id)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                isSelected 
                  ? 'bg-primary/10 border border-primary/30' 
                  : 'bg-muted/50 hover:bg-muted'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded">
                  <span className="text-primary font-medium text-sm">{coin.symbol}</span>
                </div>
                <div>
                  <p className="font-medium text-sm">{coin.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ${stats?.price ? stats.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '—'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 text-xs">
                {stats && (
                  <>
                    <Badge 
                      variant="secondary"
                      className={`${getSignalColor(stats.signal)} bg-opacity-20`}
                    >
                      {getSignalLabel(stats.signal)}
                    </Badge>
                    
                    <span className="whitespace-nowrap">
                      {stats.price24hChange >= 0 ? '+' : ''}
                      {stats.price24hChange.toFixed(2)}%
                    </span>
                  </>
                )}
              </div>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={(e) => { e.stopPropagation(); onRemoveCoin(coin.id); }}
                aria-label="Remove coin"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground/50 hover:text-destructive" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
