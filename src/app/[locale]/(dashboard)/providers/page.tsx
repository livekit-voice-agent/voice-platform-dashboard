"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Power, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PROVIDERS,
  INDICATOR_MAP,
  getMonitoringEnabled,
  setMonitoringEnabled,
  type ProviderConfig,
  type StatuspageSummaryResponse,
  type StatuspageComponent,
} from "@/lib/provider-status";
import { API_BASE_URL } from "@/lib/api";
import { useAutoRefresh, type AutoRefreshInterval } from "@/hooks/useAutoRefresh";
import { AutoRefreshSelector } from "@/components/auto-refresh-selector";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderSummary {
  slug: string;
  indicator: string;
  description: string;
  updatedAt: string | null;
  components: StatuspageComponent[];
  error: boolean;
  latencyMs?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const COMPONENT_STATUS_STYLES: Record<string, string> = {
  operational: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  degraded_performance: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  partial_outage: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  major_outage: "bg-red-500/10 text-red-600 dark:text-red-400",
  under_maintenance: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

function componentStatusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchSummary(
  provider: ProviderConfig,
  signal?: AbortSignal
): Promise<ProviderSummary> {
  if (provider.type === "self-hosted") {
    return fetchSelfHostedSummary(provider.slug, signal);
  }
  try {
    const res = await fetch(provider.summaryApiUrl!, { signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: StatuspageSummaryResponse = await res.json();
    return {
      slug: provider.slug,
      indicator: data.status.indicator,
      description: data.status.description,
      updatedAt: data.page.updated_at,
      components: data.components.filter((c) => !c.name.startsWith("_")),
      error: false,
    };
  } catch {
    return {
      slug: provider.slug,
      indicator: "unknown",
      description: "Unable to fetch status",
      updatedAt: null,
      components: [],
      error: true,
    };
  }
}

async function fetchSelfHostedSummary(
  slug: string,
  signal?: AbortSignal
): Promise<ProviderSummary> {
  try {
    const res = await fetch(`${API_BASE_URL}/health/${slug}`, {
      signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: { status: "up" | "down"; latencyMs?: number; error?: string } =
      await res.json();
    return {
      slug,
      indicator: data.status === "up" ? "none" : "major",
      description: data.status === "up" ? "Operational" : `Down: ${data.error ?? "unreachable"}`,
      updatedAt: new Date().toISOString(),
      components: [],
      error: false,
      latencyMs: data.latencyMs,
    };
  } catch {
    return {
      slug,
      indicator: "unknown",
      description: "Unable to reach backend",
      updatedAt: null,
      components: [],
      error: true,
    };
  }
}

async function fetchAllSummaries(signal?: AbortSignal) {
  return Promise.all(
    PROVIDERS.map((p) => fetchSummary(p, signal))
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProvidersPage() {
  const t = useTranslations("providers");
  const tc = useTranslations("common");
  const [summaries, setSummaries] = useState<ProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(() => getMonitoringEnabled());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const controller = new AbortController();
    const data = await fetchAllSummaries(controller.signal);
    setSummaries(data);
    setLoading(false);
  }, [enabled]);

  const { autoRefreshInterval, setAutoRefreshInterval } = useAutoRefresh(
    refresh,
    enabled ? (10_000 as AutoRefreshInterval) : (0 as AutoRefreshInterval)
  );

  // Initial fetch
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
  }, [enabled, refresh]);

  const toggleMonitoring = () => {
    setEnabled((prev) => {
      const next = !prev;
      setMonitoringEnabled(next);
      if (!next) setAutoRefreshInterval(0 as AutoRefreshInterval);
      if (next) {
        setLoading(true);
        setAutoRefreshInterval(10_000 as AutoRefreshInterval);
      }
      return next;
    });
  };

  const toggleExpanded = (slug: string) =>
    setExpanded((prev) => ({ ...prev, [slug]: !prev[slug] }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("description")}</p>
        </div>

        <div className="flex items-center gap-2">
          <AutoRefreshSelector
            value={autoRefreshInterval}
            onChange={setAutoRefreshInterval}
          />
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-xs",
              enabled
                ? "text-emerald-600 border-emerald-300"
                : "text-muted-foreground"
            )}
            onClick={toggleMonitoring}
          >
            <Power className="h-3.5 w-3.5" />
            {enabled ? tc("on") : tc("off")}
          </Button>
        </div>
      </div>

      {/* Stale data banner (monitoring off but data exists) */}
      {!enabled && summaries.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-dashed px-4 py-2">
          <p className="text-xs text-muted-foreground">
            {t("monitoringPausedStale")}
          </p>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleMonitoring}>
            {t("resume")}
          </Button>
        </div>
      )}

      {/* Monitoring paused with no data */}
      {!enabled && summaries.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-muted-foreground">
              {t("monitoringPausedEmpty")}
            </p>
            <Button variant="outline" size="sm" onClick={toggleMonitoring}>
              {t("enable")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {enabled && loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROVIDERS.map((p) => (
            <Card key={p.slug} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-24 rounded bg-muted" />
                <div className="h-4 w-32 rounded bg-muted mt-1" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-20 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Provider cards — show when data exists (even if paused = stale) */}
      {(enabled || summaries.length > 0) && !loading && (
        <div className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 transition-opacity",
          !enabled && "opacity-60"
        )}>
          {PROVIDERS.map((providerConfig) => {
            const summary = summaries.find(
              (s) => s.slug === providerConfig.slug
            );
            const indicator = (summary?.indicator ?? "unknown") as
              | "none"
              | "minor"
              | "major"
              | "critical"
              | "unknown";
            const visual = INDICATOR_MAP[indicator];
            const isExpanded = expanded[providerConfig.slug] ?? false;
            const Icon = providerConfig.icon;
            const isSelfHosted = providerConfig.type === "self-hosted";
            const initials = providerConfig.name.slice(0, 2).toUpperCase();

            return (
              <div key={providerConfig.slug} className="rounded-lg border bg-card overflow-hidden hover:border-foreground/20 transition-colors">
                <div className="px-4 py-3.5">
                  {/* Header row: avatar + name + status */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground shrink-0">
                        {initials}
                      </span>
                      <div>
                        <span className="text-sm font-medium leading-tight block">{providerConfig.name}</span>
                        {isSelfHosted && (
                          <span className="text-[10px] text-muted-foreground">Self-hosted</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0",
                        indicator === "none" &&
                          "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400",
                        indicator === "minor" &&
                          "border-yellow-200 bg-yellow-50 text-yellow-600 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400",
                        indicator === "major" &&
                          "border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400",
                        indicator === "critical" &&
                          "border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400",
                        indicator === "unknown" &&
                          "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-400"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          visual.dotColor
                        )}
                      />
                      {visual.label}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground mb-2.5 line-clamp-2">
                    {summary?.description ?? "—"}
                  </p>

                  {/* Info row: latency + updated */}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    {isSelfHosted && summary?.latencyMs != null && (
                      <span className="inline-flex items-center gap-1">
                        <Gauge className="h-3 w-3" />
                        {t("latency", { ms: summary.latencyMs })}
                      </span>
                    )}
                    <span>{t("updated", { time: timeAgo(summary?.updatedAt ?? null) })}</span>
                  </div>
                </div>

                {/* Components toggle — statuspage providers only */}
                {!isSelfHosted && summary && summary.components.length > 0 && (
                  <div className="border-t">
                    <button
                      onClick={() => toggleExpanded(providerConfig.slug)}
                      aria-expanded={isExpanded}
                      className="w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors text-left"
                    >
                      {isExpanded
                        ? t("hideComponents")
                        : t("showComponents", { count: summary.components.length })}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-1">
                        {summary.components.map((comp) => (
                          <div
                            key={comp.id}
                            className="flex items-center justify-between text-xs py-0.5"
                          >
                            <span className="text-muted-foreground truncate mr-2">
                              {comp.name}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                COMPONENT_STATUS_STYLES[comp.status] ??
                                  "bg-muted text-muted-foreground"
                              )}
                            >
                              {componentStatusLabel(comp.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Footer link */}
                <div className="border-t px-4 py-2 bg-muted/20">
                  {providerConfig.statusPageUrl ? (
                    <a
                      href={providerConfig.statusPageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {t("viewStatusPage")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {t("checkedViaBackend")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
