import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';
import { WatchlistCoin, CoinStats } from '@/types';
import { getSignalLabel, getSignalColor } from '@/stats';
import { useToast } from '@/hooks/use-toast';

interface WatchlistProps {
  watchlist: WatchlistCoin[];
  coinStats: Record<string, CoinStats>;
  onAddCoin: (symbol: string) => Promise<void>;
  onRemoveCoin: (symbol: string) => void;
  settings: any;
}

export const Watchlist: React.FC<WatchlistProps> = ({
  watchlist,
  coinStats,
  onAddCoin,
  onRemoveCoin,
  settings
}) => {
  const [newSymbol, setNewSymbol] = useState('');
  const { toast } = useToast();

  const handleAddCoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = newSymbol.trim().toUpperCase();
    if (!symbol) return;
    
    try {
      await onAddCoin(symbol);
      setNewSymbol('');
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

  if (watchlist.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 mx-auto mb-4 text-muted-foreground/50">
          <Plus className="h-6 w-6" />
        </div>
        <h3 className="font-semibold mb-2">Your watchlist is empty</h3>
        <p className="text-sm text-muted-foreground">
          Add coins to track their swing trading signals
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAddCoin} className="flex space-x-2">
        <Input
          placeholder="Enter coin symbol (e.g., BTC)"
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="default" size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </form>
      
      <div className="space-y-2">
        {watchlist.map(coin => {
          const stats = coinStats[coin.id];
          if (!stats) return null;
          
          return (
            <div key={coin.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded">
                  <span className="text-primary font-medium text-sm">{coin.symbol}</span>
                </div>
                <div>
                  <p className="font-medium text-sm">{coin.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ${stats.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 text-xs">
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
              </div>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onRemoveCoin(coin.id)}
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