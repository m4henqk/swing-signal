import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { config, AppConfig } from '@/config';
import { AppSettings } from '@/types';

interface SettingsModalProps {
  settings: AppSettings;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  settings, 
  onSettingsChange, 
  isOpen, 
  onOpenChange 
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Lookback */}
          <div className="space-y-2">
            <Label htmlFor="lookback">Lookback Period</Label>
            <Select 
              value={settings.lookback.toString()} 
              onValueChange={(value) => onSettingsChange({ lookback: parseInt(value) })}
            >
              <SelectTrigger id="lookback">
                <SelectValue placeholder="Select lookback" />
              </SelectTrigger>
              <SelectContent>
                {config.lookbackOptions.map(option => (
                  <SelectItem key={option} value={option.toString()}>
                    {option} periods
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Threshold */}
          <div className="space-y-2">
            <Label htmlFor="threshold">Z-Score Threshold</Label>
            <Select 
              value={settings.threshold.toString()} 
              onValueChange={(value) => onSettingsChange({ threshold: parseFloat(value) })}
            >
              <SelectTrigger id="threshold">
                <SelectValue placeholder="Select threshold" />
              </SelectTrigger>
              <SelectContent>
                {config.thresholdOptions.map(option => (
                  <SelectItem key={option} value={option.toString()}>
                    {option} SD
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Refresh Interval */}
          <div className="space-y-2">
            <Label htmlFor="refreshInterval">Refresh Interval (minutes)</Label>
            <Select 
              value={settings.refreshInterval.toString()} 
              onValueChange={(value) => onSettingsChange({ refreshInterval: parseInt(value) })}
            >
              <SelectTrigger id="refreshInterval">
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                {config.refreshIntervalOptions.map(option => (
                  <SelectItem key={option} value={option.toString()}>
                    {option} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Theme */}
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select 
              value={settings.theme} 
              onValueChange={(value) => onSettingsChange({ theme: value as 'dark' | 'light' })}
            >
              <SelectTrigger id="theme">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* API Base URLs */}
          <div className="space-y-2">
            <Label htmlFor="binanceBaseUrl">Binance API Base URL</Label>
            <Input
              id="binanceBaseUrl"
              value={settings.binanceBaseUrl}
              onChange={(e) => onSettingsChange({ binanceBaseUrl: e.target.value })}
              placeholder="https://api.binance.com"
              className="text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Change if Binance is geo-blocked in your region
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coingeckoBaseUrl">CoinGecko API Base URL</Label>
            <Input
              id="coingeckoBaseUrl"
              value={settings.coingeckoBaseUrl}
              onChange={(e) => onSettingsChange({ coingeckoBaseUrl: e.target.value })}
              placeholder="https://api.coingecko.com/api/v3"
              className="text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};