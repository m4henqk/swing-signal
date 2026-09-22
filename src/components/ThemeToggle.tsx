import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ThemeToggleProps {
  theme: 'dark' | 'light';
  onChange: (theme: 'dark' | 'light') => void;
}

/** Dark mode default with a light toggle — wired to persisted settings. */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onChange }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-xl"
        onClick={() => onChange(theme === 'dark' ? 'light' : 'dark')}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun className="h-4 w-4 text-amber-400" />
        ) : (
          <Moon className="h-4 w-4 text-indigo-500" />
        )}
      </Button>
    </TooltipTrigger>
    <TooltipContent>Switch to {theme === 'dark' ? 'light' : 'dark'} mode</TooltipContent>
  </Tooltip>
);
