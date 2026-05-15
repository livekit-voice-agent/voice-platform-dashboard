"use client";
import Link from "next/link";
import {
  useMonitorAgents,
  useMonitorProviders,
  type AgentHealth,
  type ProviderHealth,
} from "@/hooks/useMonitor";

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { dot: string; badge: string; label: string }> = {
  healthy:  { dot: "bg-green-500",  badge: "bg-green-900/60 text-green-300 border border-green-700",  label: "Saudável"   },
  degraded: { dot: "bg-yellow-400", badge: "bg-yellow-900/60 text-yellow-300 border border-yellow-700", label: "Degradado" },
  critical: { dot: "bg-red-500",    badge: "bg-red-900/60 text-red-300 border border-red-700",    label: "Crítico"    },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function latencyColor(ms: number) {
  if (ms < 1500) return "text-green-400";
  if (ms < 3000) return "text-yellow-400";
  return "text-red-400";
}

function SkeletonCard() {
  return (
    <div className="bg-card rounded-xl p-4 border border-border animate-pulse">
      <div className="h-4 bg-muted rounded w-2/3 mb-3" />
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-3 bg-muted rounded" />)}
      </div>
    </div>
  );
}

// ── Metric row with tooltip explanation ────────────────────────────────────

function MetricRow({ label, tooltip, value, valueClass = "" }: {
  label: string;
  tooltip: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <>
      <span
        className="text-muted-foreground cursor-help border-b border-dashed border-muted-foreground/40 w-fit"
        title={tooltip}
      >
        {label}
      </span>
      <span className={`font-mono text-right ${valueClass}`}>{value}</span>
    </>
  );
}

// ── Agent Card ─────────────────────────────────────────────────────────────

function AgentCard({ a }: { a: AgentHealth }) {
  const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.healthy;
  const hasHighP95 = a.p95_e2e_ms > a.avg_e2e_ms * 2;

  return (
    <Link
      href={`/monitor/agents/${a.agent_name}`}
      className="bg-card rounded-xl p-4 hover:bg-accent/40 transition-colors border border-border block group"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
        <span className="font-semibold truncate flex-1 group-hover:text-primary transition-colors">
          {a.agent_name}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>

      {/* Metrics */}
      <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-2">
        <MetricRow
          label="E2E médio"
          tooltip="Latência ponta a ponta média por turno: tempo desde o fim da fala do usuário até o início do áudio de resposta (EOU + LLM + TTS)"
          value={`${a.avg_e2e_ms}ms`}
          valueClass={latencyColor(a.avg_e2e_ms)}
        />
        <MetricRow
          label="P95 E2E"
          tooltip="95% das chamadas ficaram abaixo desse valor. Se muito acima da média, indica picos esporádicos de lentidão."
          value={`${a.p95_e2e_ms}ms`}
          valueClass={hasHighP95 ? "text-amber-400 font-semibold" : latencyColor(a.p95_e2e_ms)}
        />
        <MetricRow
          label="Sessões (24h)"
          tooltip="Número de chamadas únicas com métricas registradas nas últimas 24 horas"
          value={a.sessions}
        />
        <MetricRow
          label="Erros (24h)"
          tooltip="Erros capturados pelo agente nas últimas 24 horas (timeouts, falhas de STT/LLM/TTS, etc.)"
          value={a.errors_24h}
          valueClass={a.errors_24h > 0 ? "text-red-400" : "text-green-400"}
        />
      </div>

      {/* Footer hint */}
      <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground group-hover:text-foreground/60 transition-colors flex items-center gap-1">
        <span>Ver detalhes →</span>
        {hasHighP95 && (
          <span className="ml-auto text-amber-400 font-medium">⚠ P95 elevado</span>
        )}
      </div>
    </Link>
  );
}

// ── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({ agents }: { agents: AgentHealth[] }) {
  const healthy  = agents.filter((a) => a.status === "healthy").length;
  const degraded = agents.filter((a) => a.status === "degraded").length;
  const critical = agents.filter((a) => a.status === "critical").length;

  return (
    <div className="flex flex-wrap gap-3">
      <Chip label="Total" value={agents.length} color="text-foreground" />
      <Chip label="Saudáveis" value={healthy}  color="text-green-400"  />
      <Chip label="Degradados" value={degraded} color="text-yellow-400" />
      <Chip label="Críticos"  value={critical}  color="text-red-400"   />
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-muted/40 border border-border rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold font-mono ${color}`}>{value}</span>
    </div>
  );
}

// ── Provider component badge ────────────────────────────────────────────────

const COMPONENT_LABEL: Record<string, string> = {
  LLM: "LLM · Linguagem",
  TTS: "TTS · Síntese de voz",
  STT: "STT · Reconhecimento de voz",
};

// ── Page ──────────────────────────────────────────────────────────────────

export default function MonitorOverviewPage() {
  const { data: agents, loading, error } = useMonitorAgents();
  const { data: providers, loading: loadingProviders, error: providerError } = useMonitorProviders();

  return (
    <div className="p-6 space-y-10 max-w-7xl">

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Monitor de Agentes</h1>
        <p className="text-sm text-muted-foreground">
          Saúde em tempo real dos agentes de voz, latência por etapa e status dos provedores de IA.
          Atualizado automaticamente a cada 10 segundos.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-4 py-3 flex items-center gap-2">
          <span className="text-red-500">✕</span>
          Erro ao carregar agentes: {error}
        </div>
      )}

      {/* Agents section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <h2 className="text-base font-semibold">Agentes</h2>
            <p className="text-xs text-muted-foreground">
              Clique num agente para ver gráficos de latência, erros e anomalias detalhadas
            </p>
          </div>
          {!loading && <div className="sm:ml-auto"><SummaryBar agents={agents} /></div>}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : agents.length === 0 ? (
          <div className="bg-muted/20 border border-border rounded-xl p-8 text-center space-y-2">
            <p className="text-muted-foreground font-medium">Nenhum agente com dados nas últimas 24h</p>
            <p className="text-xs text-muted-foreground">
              Verifique se o coletor de métricas está conectado ao agente e se há chamadas acontecendo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((a: AgentHealth) => <AgentCard key={a.agent_name} a={a} />)}
          </div>
        )}
      </section>

      {/* Legend */}
      <section className="bg-muted/20 border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Glossário de Métricas
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs">
          {[
            ["E2E (End-to-End)", "Tempo total de resposta: do fim da fala do usuário até o início do áudio. Soma EOU + LLM + TTS."],
            ["P95", "Percentil 95 — 95% das chamadas ficam abaixo desse valor. Indica o pior caso típico, excluindo outliers extremos."],
            ["EOU delay", "End-of-Utterance: tempo para o agente detectar que o usuário parou de falar."],
            ["LLM TTFT", "Time-to-First-Token: tempo do LLM para começar a gerar texto após receber o prompt."],
            ["TTS TTFB", "Time-to-First-Byte: tempo do sintetizador de voz para começar a gerar áudio."],
            ["Anomalia", "Turno onde o E2E foi > 3× a média global — indica pico anormal de lentidão em uma chamada."],
          ].map(([term, def]) => (
            <div key={term} className="flex gap-2">
              <dt className="font-semibold text-foreground/80 shrink-0 w-32">{term}</dt>
              <dd className="text-muted-foreground">{def}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Providers section */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Provedores de IA</h2>
          <p className="text-xs text-muted-foreground">
            Latência e disponibilidade de cada serviço externo usado pelos agentes (LLM, TTS, STT)
          </p>
        </div>

        {providerError && (
          <div className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-4 py-2">
            Erro ao carregar providers: {providerError}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-muted-foreground text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Provider</th>
                <th className="px-4 py-3 text-left font-medium">Modelo</th>
                <th
                  className="px-4 py-3 text-left font-medium cursor-help"
                  title="LLM = modelo de linguagem | TTS = síntese de voz | STT = reconhecimento de voz"
                >
                  Tipo ↗
                </th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th
                  className="px-4 py-3 text-left font-medium cursor-help"
                  title="Latência média de resposta deste provider na última hora"
                >
                  Latência média ↗
                </th>
                <th
                  className="px-4 py-3 text-left font-medium cursor-help"
                  title="Número de requisições feitas ao provider na última hora"
                >
                  Req / hora ↗
                </th>
                <th
                  className="px-4 py-3 text-left font-medium cursor-help"
                  title="Requisições que falharam (timeout, erro HTTP, etc.) na última hora"
                >
                  Erros / hora ↗
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingProviders ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground text-sm">
                    Carregando providers...
                  </td>
                </tr>
              ) : providers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground text-sm">
                    Nenhum provider com dados disponíveis
                  </td>
                </tr>
              ) : (
                providers.map((p: ProviderHealth, i: number) => {
                  const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.healthy;
                  return (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-semibold">{p.provider}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{p.model}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-muted/60 rounded px-2 py-0.5 text-muted-foreground">
                          {COMPONENT_LABEL[p.component] ?? p.component}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-mono font-semibold ${latencyColor(p.avg_latency_ms)}`}>
                        {p.avg_latency_ms}ms
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.requests_1h}</td>
                      <td className={`px-4 py-3 font-mono ${p.errors_1h > 0 ? "text-red-400 font-semibold" : "text-muted-foreground"}`}>
                        {p.errors_1h}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
