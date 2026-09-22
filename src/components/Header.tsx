import React, { useState } from 'react';
import { Settings, RefreshCw, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from './ThemeToggle';
import { SettingsModal } from './SettingsModal';
import type { AppSettings } from '@/types';
import type { DataStatus } from '@/hooks/useData';

interface HeaderProps {
  settings: AppSettings;
  onSettingsChange: (patch: Partial<AppSettings>) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  status: DataStatus;
  lastUpdated: number | null;
}

/** "X min ago" helper — the offline indicator the spec asks for. */
export const formatLastUpdated = (ts: number | null): string => {
  if (!ts) return 'never';
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ${mins % 60} min ago`;
  return `${Math.floor(hrs / 24)} d ago`;
};

const STATUS_META: Record<DataStatus, { dot: string; ring: string; label: string }> = {
  fresh: { dot: 'bg-emerald-500', ring: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', label: 'Live' },
  stale: { dot: 'bg-amber-500', ring: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', label: 'Cached' },
  error: { dot: 'bg-rose-500', ring: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', label: 'Offline' },
};

export const Header: React.FC<HeaderProps> = ({
  settings,
  onSettingsChange,
  isRefreshing,
  onRefresh,
  status,
  lastUpdated,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const meta = STATUS_META[status];

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-5 w-5" strokeLinecap="round">
              <path d="M7 20v-7" />
              <path d="M12 20V5" />
              <path d="M17 20v-9" />
              <path d="M4.5 9.5 8 6.5l4 3 5-4.5" opacity="0.65" />
            </svg>
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-semibold tracking-tight sm:text-lg">SwingSignal</h1>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Mean-reversion z-scores for swing traders
            </p>
          </div>
        </div>

        {/* Status + controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Status pill: green = fresh, yellow = stale, red = error */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.ring}`}
                data-testid="status-pill"
              >
                <CircleDot className={`h-3 w-3 ${meta.dot} ${isRefreshing ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">{meta.label}</span>
                <span className="text-muted-foreground font-normal">· {formatLastUpdated(lastUpdated)}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="max-w-56 text-xs">
                {status === 'fresh' && 'Data freshly fetched from Binance + CoinGecko.'}
                {status === 'stale' && 'Network unreachable — showing cached data.'}
                {status === 'error' && 'No connection and no usable cache yet.'}
                {' '}Last updated {formatLastUpdated(lastUpdated)}. Refreshes every {settings.refreshInterval} min.
              </p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={onRefresh}
                disabled={isRefreshing}
                aria-label="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh now</TooltipContent>
          </Tooltip>

          <ThemeToggle theme={settings.theme} onChange={(theme) => onSettingsChange({ theme })} />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={() => setSettingsOpen(true)}
                aria-label="Open settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>

          <SettingsModal
            settings={settings}
            onSettingsChange={onSettingsChange}
            isOpen={settingsOpen}
            onOpenChange={setSettingsOpen}
          />
        </div>
      </div>
    </header>
  );
};
