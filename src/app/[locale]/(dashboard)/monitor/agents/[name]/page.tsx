"use client";
import { use } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  useAgentLatency,
  useAgentErrors,
  type LatencyBucket,
  type AgentError,
} from "@/hooks/useMonitor";

export default function AgentDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);

  const { data: latency, loading: loadingLat, error: latencyError } = useAgentLatency(name);
  const { data: errors, error: errorsError } = useAgentErrors(name);

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/monitor" className="text-muted-foreground hover:text-foreground">
          ← Monitor
        </Link>
        <h1 className="text-2xl font-bold">{name}</h1>
      </div>

      {(latencyError || errorsError) && (
        <div className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-4 py-2">
          Erro ao carregar dados: {latencyError ?? errorsError}
        </div>
      )}

      <section className="bg-card rounded-xl p-5 border border-border">
        <h2 className="text-base font-semibold text-muted-foreground mb-4">
          Latência por Etapa (ms) — últimas 24h
        </h2>
        {loadingLat ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Carregando...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={latency} margin={{ left: 0, right: 8 }}>
              <XAxis
                dataKey="bucket"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                tickFormatter={(v: string) =>
                  v ? new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""
                }
              />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} unit="ms" width={55} />
              <Tooltip
                contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                labelFormatter={(v) => new Date(String(v)).toLocaleString("pt-BR")}
              />
              <Legend />
              <Bar dataKey="avg_eou_ms" stackId="a" name="EOU delay" fill="#6366f1" />
              <Bar dataKey="avg_llm_ms" stackId="a" name="LLM (TTFT)" fill="#22c55e" />
              <Bar dataKey="avg_tts_ms" stackId="a" name="TTS (TTFB)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="bg-card rounded-xl p-5 border border-border">
        <h2 className="text-base font-semibold text-muted-foreground mb-4">
          Erros Frequentes (24h)
        </h2>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase">
            <tr>
              {["Tipo de Erro", "Componente", "Ocorrências"].map((h) => (
                <th key={h} className="px-4 py-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {errors.map((e: AgentError, i: number) => (
              <tr key={i}>
                <td className="px-4 py-2 text-red-400 font-mono text-xs">{e.error_type}</td>
                <td className="px-4 py-2 text-muted-foreground">{e.component ?? "—"}</td>
                <td className="px-4 py-2 font-semibold">{e.count}</td>
              </tr>
            ))}
            {errors.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">
                  Nenhum erro nas últimas 24h ✓
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
