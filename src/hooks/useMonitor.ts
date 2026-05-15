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
