"use client";
import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AgentHealth {
  agent_name: string;
  status: "healthy" | "degraded" | "critical";
  errors_24h: number;
  avg_e2e_ms: number;
  p95_e2e_ms: number;
  sessions: number;
}

export interface ProviderHealth {
  provider: string;
  model: string;
  component: string;
  status: "healthy" | "degraded" | "critical";
  avg_latency_ms: number;
  requests_1h: number;
  errors_1h: number;
}

export interface LatencyBucket {
  bucket: string;
  avg_eou_ms: number;
  avg_llm_ms: number;
  avg_tts_ms: number;
  avg_e2e_ms: number;
  p95_e2e_ms: number;
  max_e2e_ms: number;
  stddev_e2e_ms: number;
  turn_count: number;
  has_anomaly: boolean;
}

export interface AgentError {
  error_type: string;
  component?: string;
  count: number;
}

export interface AnomalyTurn {
  session_id: string;
  time: string;
  e2e_ms: number;
  eou_delay_ms: number | null;
  llm_ttft_ms: number | null;
  tts_ttfb_ms: number | null;
}

export interface AnomalyResponse {
  global_avg_ms: number;
  threshold_ms: number;
  turns: AnomalyTurn[];
}

// ── Cost types ─────────────────────────────────────────────────────────────

export interface CostBreakdownItem {
  provider: string;
  model: string;
  component: string;
  price_unit: string | null;
  price_per_unit: number | null;
  price_source: string | null;
  total_cost_usd: number;
  request_count: number;
  avg_cost_per_request: number;
}

export interface CostSummary {
  total_cost_usd: number;
  fetched_at: string | null;
  breakdown: CostBreakdownItem[];
}

export interface SessionMetricCost {
  id: string;
  time: string;
  provider: string;
  model: string;
  component: string;
  input_tokens: number | null;
  output_tokens: number | null;
  audio_duration_ms: number | null;
  characters_count: number | null;
  cost_usd: number | null;
  price_per_unit: number | null;
  price_unit: string | null;
  price_source: string | null;
  price_fetched_at: string | null;
  request_id: string | null;
}

export interface SessionCost {
  session_id: string;
  total_cost_usd: number;
  metrics: SessionMetricCost[];
}

export interface PricingEntry {
  provider: string;
  model: string;
  component: string;
  unit_type: string;
  unit_price: number;
  source?: string;
}

export interface PricingSnapshot {
  fetched_at: string | null;
  prices: PricingEntry[];
}

// ── Fetcher ────────────────────────────────────────────────────────────────

async function fetchMonitor<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useMonitorAgents(refreshMs = 10_000) {
  const [data, setData] = useState<AgentHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await fetchMonitor<AgentHealth[]>("/monitor/agents", signal);
      setData(result);
      setError(null);
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    const id = refreshMs > 0 ? setInterval(() => load(ctrl.signal), refreshMs) : undefined;
    return () => {
      ctrl.abort();
      if (id) clearInterval(id);
    };
  }, [load, refreshMs]);

  return { data, loading, error, reload: () => load() };
}

export function useMonitorProviders(refreshMs = 15_000) {
  const [data, setData] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await fetchMonitor<ProviderHealth[]>("/monitor/providers", signal);
      setData(result);
      setError(null);
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    const id = refreshMs > 0 ? setInterval(() => load(ctrl.signal), refreshMs) : undefined;
    return () => {
      ctrl.abort();
      if (id) clearInterval(id);
    };
  }, [load, refreshMs]);

  return { data, loading, error };
}

export function useAgentLatency(name: string, bucketMin = 5, refreshMs = 30_000) {
  const [data, setData] = useState<LatencyBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!name) return;
    try {
      const result = await fetchMonitor<LatencyBucket[]>(
        `/monitor/agents/${encodeURIComponent(name)}/latency?bucket_minutes=${bucketMin}`,
        signal,
      );
      setData(result);
      setError(null);
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [name, bucketMin]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    const id = refreshMs > 0 ? setInterval(() => load(ctrl.signal), refreshMs) : undefined;
    return () => {
      ctrl.abort();
      if (id) clearInterval(id);
    };
  }, [load, refreshMs]);

  return { data, loading, error };
}

export function useAgentErrors(name: string, hours = 24, refreshMs = 30_000) {
  const [data, setData] = useState<AgentError[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!name) return;
    try {
      const result = await fetchMonitor<AgentError[]>(
        `/monitor/agents/${encodeURIComponent(name)}/errors?hours=${hours}`,
        signal,
      );
      setData(result);
      setError(null);
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [name, hours]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    const id = refreshMs > 0 ? setInterval(() => load(ctrl.signal), refreshMs) : undefined;
    return () => {
      ctrl.abort();
      if (id) clearInterval(id);
    };
  }, [load, refreshMs]);

  return { data, loading, error };
}

export function useAgentAnomalies(name: string, hours = 24, refreshMs = 30_000) {
  const [data, setData] = useState<AnomalyResponse>({ global_avg_ms: 0, threshold_ms: 0, turns: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!name) return;
    try {
      const result = await fetchMonitor<AnomalyResponse>(
        `/monitor/agents/${encodeURIComponent(name)}/anomalies?hours=${hours}`,
        signal,
      );
      setData(result);
      setError(null);
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [name, hours]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    const id = refreshMs > 0 ? setInterval(() => load(ctrl.signal), refreshMs) : undefined;
    return () => {
      ctrl.abort();
      if (id) clearInterval(id);
    };
  }, [load, refreshMs]);

  return { data, loading, error };
}

export function useCostSummary(from?: string, to?: string, refreshMs = 60_000) {
  const [data, setData] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString() ? `?${params}` : "";
      const result = await fetchMonitor<CostSummary>(`/monitor/costs/summary${qs}`, signal);
      setData(result);
      setError(null);
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    const id = refreshMs > 0 ? setInterval(() => load(ctrl.signal), refreshMs) : undefined;
    return () => {
      ctrl.abort();
      if (id) clearInterval(id);
    };
  }, [load, refreshMs]);

  return { data, loading, error, reload: () => load() };
}

export function useSessionCost(sessionId: string) {
  const [data, setData] = useState<SessionCost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!sessionId) return;
    try {
      const result = await fetchMonitor<SessionCost>(
        `/monitor/costs/session/${encodeURIComponent(sessionId)}`,
        signal,
      );
      setData(result);
      setError(null);
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  return { data, loading, error };
}

export function usePricingSnapshot(refreshMs = 300_000) {
  const [data, setData] = useState<PricingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await fetchMonitor<PricingSnapshot>("/monitor/pricing", signal);
      setData(result);
      setError(null);
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    const id = refreshMs > 0 ? setInterval(() => load(ctrl.signal), refreshMs) : undefined;
    return () => {
      ctrl.abort();
      if (id) clearInterval(id);
    };
  }, [load, refreshMs]);

  return { data, loading, error, reload: () => load() };
}
