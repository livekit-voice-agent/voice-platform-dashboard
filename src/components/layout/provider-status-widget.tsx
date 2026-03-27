"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROVIDERS, INDICATOR_MAP } from "@/lib/provider-status";
import { useProviderStatus } from "@/hooks/useProviderStatus";

export function ProviderStatusWidget() {
  const { statuses, loading, enabled, toggle, hasIssues } =
    useProviderStatus();
  const t = useTranslations("providers");

  const hasData = statuses.length > 0;

  return (
    <div
      data-slot="provider-status-widget"
      className="border-t px-4 py-3 space-y-2"
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <Link
          href="/providers"
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("title")}
          {!enabled && hasData && (
            <span className="ml-1 text-[10px] italic text-muted-foreground/60">
              {t("paused")}
            </span>
          )}
        </Link>
        <button
          onClick={toggle}
          className={cn(
            "rounded p-1 transition-colors",
            enabled
              ? "text-emerald-500 hover:bg-emerald-500/10"
              : "text-muted-foreground hover:bg-muted"
          )}
          title={enabled ? t("pauseMonitoring") : t("resumeMonitoring")}
        >
          <Power className="h-3 w-3" />
        </button>
      </div>

      {/* Status content */}
      {!hasData && !enabled ? (
        <p className="text-[11px] text-muted-foreground italic">
          {t("monitoringPaused")}
        </p>
      ) : loading && !hasData ? (
        <div className="flex items-center gap-1.5">
          {PROVIDERS.map((p) => (
            <div
              key={p.slug}
              className="h-2 w-2 rounded-full bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : !hasIssues ? (
        <Link
          href="/providers"
          className={cn("flex items-center gap-1.5 group", !enabled && "opacity-50")}
        >
          <span className="relative flex h-2 w-2">
            {enabled && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 group-hover:underline">
            {t("allOperational")}
          </span>
        </Link>
      ) : (
        <Link href="/providers" className={cn("space-y-1 group", !enabled && "opacity-50")}>
          {statuses.map((s) => {
            const provider = PROVIDERS.find((p) => p.slug === s.slug);
            if (!provider) return null;
            const visual = INDICATOR_MAP[s.indicator];
            return (
              <div key={s.slug} className="flex items-center gap-2">
                <span
                  className={cn("h-2 w-2 rounded-full shrink-0", visual.dotColor)}
                  title={`${provider.name}: ${visual.label}`}
                />
                <span className="text-[11px] text-muted-foreground truncate group-hover:underline">
                  {provider.name}
                </span>
                {s.indicator !== "none" && s.indicator !== "unknown" && (
                  <span className={cn("text-[10px] font-medium ml-auto shrink-0", visual.color)}>
                    {visual.label}
                  </span>
                )}
              </div>
            );
          })}
        </Link>
      )}
    </div>
  );
}
