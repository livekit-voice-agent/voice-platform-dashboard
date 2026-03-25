import { useCallback, useEffect, useRef, useState } from "react";
import {
  PROVIDERS,
  DEFAULT_POLL_INTERVAL,
  getMonitoringEnabled,
  setMonitoringEnabled,
  type ProviderConfig,
  type ProviderStatus,
  type StatuspageStatusResponse,
} from "@/lib/provider-status";
import { API_BASE_URL } from "@/lib/api";

async function fetchStatuspageStatus(
  apiUrl: string,
  slug: string,
  signal?: AbortSignal
): Promise<ProviderStatus> {
  try {
    const res = await fetch(apiUrl, { signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: StatuspageStatusResponse = await res.json();
    return {
      slug,
      indicator: data.status.indicator,
      description: data.status.description,
      updatedAt: data.page.updated_at,
    };
  } catch {
    return { slug, indicator: "unknown", description: "Unable to fetch status", updatedAt: null };
  }
}

async function fetchSelfHostedStatus(
  slug: string,
  signal?: AbortSignal
): Promise<ProviderStatus> {
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
      latencyMs: data.latencyMs,
    };
  } catch {
    return { slug, indicator: "unknown", description: "Unable to reach backend", updatedAt: null };
  }
}

async function fetchProviderStatus(
  provider: ProviderConfig,
  signal?: AbortSignal
): Promise<ProviderStatus> {
  if (provider.type === "self-hosted") {
    return fetchSelfHostedStatus(provider.slug, signal);
  }
  return fetchStatuspageStatus(provider.statusApiUrl!, provider.slug, signal);
}

async function fetchAllStatuses(signal?: AbortSignal): Promise<ProviderStatus[]> {
  return Promise.all(
    PROVIDERS.map((p) => fetchProviderStatus(p, signal))
  );
}

export function useProviderStatus(pollInterval = DEFAULT_POLL_INTERVAL) {
  const [enabled, setEnabled] = useState<boolean>(() => getMonitoringEnabled());
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const results = await fetchAllStatuses(signal);
    if (mountedRef.current) {
      setStatuses(results);
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    refresh(controller.signal);

    const id =
      pollInterval > 0
        ? globalThis.setInterval(() => refresh(controller.signal), pollInterval)
        : undefined;

    return () => {
      mountedRef.current = false;
      controller.abort();
      if (id) globalThis.clearInterval(id);
    };
  }, [enabled, pollInterval, refresh]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      setMonitoringEnabled(next);
      if (next) setLoading(true);
      return next;
    });
  }, []);

  const hasIssues = statuses.some(
    (s) => s.indicator !== "none" && s.indicator !== "unknown"
  );

  return { statuses, loading, enabled, toggle, hasIssues, refresh };
}
