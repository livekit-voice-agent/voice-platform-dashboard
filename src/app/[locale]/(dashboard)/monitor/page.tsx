"use client";
import Link from "next/link";
import {
  useMonitorAgents,
  useMonitorProviders,
  type AgentHealth,
  type ProviderHealth,
} from "@/hooks/useMonitor";

const STATUS_DOT: Record<string, string> = {
  healthy: "bg-green-500",
  degraded: "bg-yellow-500",
  critical: "bg-red-500",
};
const STATUS_BADGE: Record<string, string> = {
  healthy: "bg-green-900 text-green-300",
  degraded: "bg-yellow-900 text-yellow-300",
  critical: "bg-red-900 text-red-300",
};

export default function MonitorOverviewPage() {
  const { data: agents, loading, error } = useMonitorAgents();
  const { data: providers, error: providerError } = useMonitorProviders();

  if (loading) return <div className="p-8 text-muted-foreground">Carregando...</div>;
  if (error) return <div className="p-8 text-red-400">Erro: {error}</div>;

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Monitor de Agentes</h1>

      <section>
        <h2 className="text-base font-semibold text-muted-foreground mb-3">
          Agentes ({agents.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a: AgentHealth) => (
            <Link
              key={a.agent_name}
              href={`/monitor/agents/${a.agent_name}`}
              className="bg-card rounded-xl p-4 hover:bg-accent transition border border-border block"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[a.status] ?? "bg-gray-500"}`} />
                <span className="font-medium truncate">{a.agent_name}</span>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded ${STATUS_BADGE[a.status] ?? ""}`}>
                  {a.status}
                </span>
              </div>
              <div className="text-sm text-muted-foreground grid grid-cols-2 gap-1">
                <span>Erros/h</span>
                <span className="font-mono">{a.errors_1h}</span>
                <span>E2E médio</span>
                <span className="font-mono">{a.avg_e2e_ms}ms</span>
              </div>
            </Link>
          ))}
          {agents.length === 0 && (
            <p className="text-muted-foreground col-span-3">
              Nenhum agente com dados nas últimas 24h.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-muted-foreground mb-3">Providers</h2>
        {providerError && (
          <div className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-4 py-2 mb-3">
            Erro ao carregar providers: {providerError}
          </div>
        )}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground uppercase text-xs">
              <tr>
                {["Provider", "Modelo", "Componente", "Status", "Latência Média", "Req/h", "Erros/h"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {providers.map((p: ProviderHealth, i: number) => (
                <tr key={i} className="hover:bg-accent/50">
                  <td className="px-4 py-2 font-medium">{p.provider}</td>
                  <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{p.model}</td>
                  <td className="px-4 py-2 text-muted-foreground">{p.component}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGE[p.status] ?? ""}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono">{p.avg_latency_ms}ms</td>
                  <td className="px-4 py-2">{p.requests_1h}</td>
                  <td className="px-4 py-2 text-red-400">{p.errors_1h}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
