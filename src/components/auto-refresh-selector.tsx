"use client";

import { RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUTO_REFRESH_OPTIONS, type AutoRefreshInterval } from "@/hooks/useAutoRefresh";
import { cn } from "@/lib/utils";

interface AutoRefreshSelectorProps {
  value: AutoRefreshInterval;
  onChange: (value: AutoRefreshInterval) => void;
  className?: string;
}

export function AutoRefreshSelector({ value, onChange, className }: AutoRefreshSelectorProps) {
  const isActive = value > 0;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <RefreshCw
        className={cn(
          "h-3.5 w-3.5 text-muted-foreground transition-all",
          isActive && "animate-spin text-primary"
        )}
        style={isActive ? { animationDuration: `${value}ms` } : undefined}
      />
      <Select
        value={String(value)}
        onValueChange={(v) => onChange(Number(v) as AutoRefreshInterval)}
      >
        <SelectTrigger className="h-8 w-[90px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AUTO_REFRESH_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
