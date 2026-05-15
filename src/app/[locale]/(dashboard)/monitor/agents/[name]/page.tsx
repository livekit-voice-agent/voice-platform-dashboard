"use client";
import { use } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, Cell, CartesianGrid,
} from "recharts";
import {
  useAgentLatency,
  useAgentErrors,
  useAgentAnomalies,
  type LatencyBucket,
  type AgentError,
  type AnomalyTurn,
} from "@/hooks/useMonitor";

function KpiCard({
  label,
  value,
  unit = "",
  tooltip,
  valueClass = "text-foreground",
  sub,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  tooltip: string;
  valueClass?: string;
  sub?: string;
}) {
  return (
    <div
      className="bg-card border border-border rounded-xl p-4 space-y-1 cursor-help"
      title={tooltip}
    >
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className={`text-2xl font-bold font-mono ${valueClass}`}>
        {value}
        {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function SkeletonChart() {
  return (
    <div className="h-64 bg-muted/20 rounded-lg animate-pulse flex items-center justify-center text-muted-foreground text-sm">
      Carregando gráfico…
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────

function LatencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const isAnomaly = payload[0]?.payload?.has_anomaly;
  const turnCount = payload[0]?.payload?.turn_count ?? 0;

  // Debug: uncomment to inspect in browser console
  // console.log("[LatencyTooltip] payload[0]:", JSON.stringify(payload[0], null, 2));

  const descriptions: Record<string, string> = {
    avg_eou_ms: "EOU delay",
    avg_llm_ms: "LLM TTFT",
    avg_tts_ms: "TTS TTFB",
  };

  // Recharts stacked bars: value can be [base, top], a number, or a string from API
  const getValue = (entry: any): number => {
    const v = entry.value;
    if (Array.isArray(v)) return Number(v[1]) - Number(v[0]);
    const n = Number(v);
    if (!isNaN(n) && n !== 0) return n;
    // fallback: direct access from raw data point
    return Number(entry.payload?.[entry.dataKey]) || 0;
  };

  const bottleneck = isAnomaly
    ? payload.reduce((max: any, entry: any) => (!max || getValue(entry) > getValue(max) ? entry : max), null)
    : null;

  const total = payload.reduce((sum: number, e: any) => sum + getValue(e), 0);

  return (
    <div className="bg-white border border-gray-200 shadow-xl rounded-xl p-3.5 text-xs space-y-2 min-w-[220px]">
      <p className="text-gray-500 font-medium">
        {label ? new Date(String(label)).toLocaleString("pt-BR") : ""}
      </p>
      {isAnomaly && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-2.5 py-2 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-red-500 font-bold text-[11px]">⚠</span>
            <span className="text-red-600 font-semibold">Anomalia — E2E &gt; 3× a média</span>
          </div>
          {bottleneck && (
            <p className="text-red-500 pl-4">
              Gargalo: <span className="font-bold">{descriptions[bottleneck.dataKey] ?? bottleneck.name}</span>
              {" "}({total > 0 ? Math.round((getValue(bottleneck) / total) * 100) : 0}% do E2E)
            </p>
          )}
        </div>
      )}
      <div className="space-y-1.5">
        {payload.map((entry: any) => {
          const isBottleneck = bottleneck?.dataKey === entry.dataKey;
          const val = getValue(entry);
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          return (
            <div key={entry.dataKey} className={`flex items-center justify-between gap-4 rounded px-1.5 py-0.5 ${isBottleneck ? "bg-red-50" : ""}`}>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: entry.color }} />
                <span className={isBottleneck ? "text-red-600 font-semibold" : "text-gray-500"}>
                  {descriptions[entry.dataKey] ?? entry.name}
                </span>
                {isBottleneck && <span className="text-red-400 text-[10px]">↑ maior</span>}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-gray-400 text-[10px] tabular-nums">{pct}%</span>
                <span className={`font-mono font-semibold tabular-nums ${isBottleneck ? "text-red-600" : "text-gray-800"}`}>
                  {val}ms
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="pt-1.5 border-t border-gray-100 flex items-center justify-between">
        <span className="text-gray-400">E2E total</span>
        <span className="font-mono font-semibold text-gray-700 tabular-nums">{total}ms</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-400">turnos neste intervalo</span>
        <span className="font-mono font-semibold text-gray-600">{turnCount}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function AgentDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);

  const { data: latency, loading: loadingLat, error: latencyError } = useAgentLatency(name);
  const { data: errors, loading: loadingErrors, error: errorsError } = useAgentErrors(name);
  const { data: anomalyData, loading: loadingAnomalies } = useAgentAnomalies(name);
  const anomalies = anomalyData.turns;
  const avgOverall = anomalyData.global_avg_ms;

  const hasAnomalyBuckets = latency.some((b) => b.has_anomaly);

  const p95Max = latency.length > 0 ? Math.max(...latency.map((b) => b.p95_e2e_ms ?? 0)) : 0;
  const totalTurns = latency.reduce((s, b) => s + (b.turn_count ?? 0), 0);
  const totalErrors = errors.reduce((s, e) => s + e.count, 0);

  return (
    <div className="p-6 space-y-8 max-w-7xl">

      {/* Breadcrumb + header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/monitor" className="hover:text-foreground transition-colors">
            Monitor
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
          {hasAnomalyBuckets && (
            <span className="text-xs bg-amber-700 text-white border border-amber-600 rounded-full px-3 py-1 font-semibold shadow-sm">
              ⚠ Anomalias detectadas nas últimas 24h
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Métricas coletadas automaticamente a cada turno de conversa. Atualização a cada 30s.
        </p>
      </div>

      {/* Error banners */}
      {(latencyError || errorsError) && (
        <div className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-4 py-3 flex items-center gap-2">
          <span>✕</span> Erro ao carregar dados: {latencyError ?? errorsError}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="E2E Médio"
          value={avgOverall || "—"}
          unit={avgOverall ? "ms" : ""}
          tooltip="Latência ponta a ponta média: tempo desde o fim da fala do usuário até o início do áudio de resposta. Soma de EOU + LLM + TTS."
          valueClass={avgOverall > 3000 ? "text-red-400" : avgOverall > 1500 ? "text-yellow-400" : "text-green-400"}
          sub="EOU + LLM + TTS"
        />
        <KpiCard
          label="P95 E2E"
          value={p95Max || "—"}
          unit={p95Max ? "ms" : ""}
          tooltip="Percentil 95 do E2E: 95% das chamadas ficaram abaixo desse valor. Mostra o pior caso típico excluindo os 5% mais lentos."
          valueClass={p95Max > avgOverall * 2 ? "text-amber-700" : "text-foreground"}
          sub={p95Max > avgOverall * 2 ? "⚠ Atenção — P95 acima de 2× a média (limiar de anomalia: 3×)" : "Pior caso típico"}
        />
        <KpiCard
          label="Turnos (24h)"
          value={totalTurns}
          tooltip="Número total de turnos de conversa processados nas últimas 24 horas. Cada turno é uma resposta do agente."
        />
        <KpiCard
          label="Erros (24h)"
          value={totalErrors}
          tooltip="Total de erros capturados pelo agente nas últimas 24 horas: timeouts, falhas de STT, LLM, TTS, detecção de interrupção, etc."
          valueClass={totalErrors > 0 ? "text-red-400" : "text-green-400"}
          sub={totalErrors === 0 ? "Nenhum erro ✓" : "Ver detalhes abaixo"}
        />
      </div>

      {/* Latency chart */}
      <section className="bg-card rounded-xl p-5 border border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex-1">
            <h2 className="text-base font-semibold">Latência por Etapa — últimas 24h</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Cada barra representa um intervalo de 5 minutos. As barras estão empilhadas mostrando quanto cada etapa contribui para o tempo total de resposta.
            </p>
          </div>
          {avgOverall > 0 && (
            <div className="flex flex-wrap gap-3 text-xs shrink-0">
              <div className="bg-muted/40 border border-border rounded-lg px-3 py-1.5">
                <span className="text-muted-foreground">Média E2E </span>
                <span className="font-mono font-semibold">{avgOverall}ms</span>
              </div>
              {p95Max > 0 && (
                <div className={`border rounded-lg px-3 py-1.5 ${p95Max > avgOverall * 2 ? "bg-amber-50 border-amber-300" : "bg-muted/40 border-border"}`}>
                  <span className="text-muted-foreground">P95 </span>
                  <span className={`font-mono font-semibold ${p95Max > avgOverall * 2 ? "text-amber-700" : ""}`}>{p95Max}ms</span>
                  {p95Max > avgOverall * 2 && (
                    <span className="text-amber-600 text-[10px] ml-1.5">⚠ &gt;2× média</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {loadingLat ? (
          <SkeletonChart />
        ) : latency.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            Nenhum dado de latência disponível ainda
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={latency} margin={{ left: 0, right: 8, top: 8 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="0" />
                <XAxis
                  dataKey="bucket"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) =>
                    v ? new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""
                  }
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  unit="ms"
                  width={52}
                />
                <Tooltip content={<LatencyTooltip />} cursor={{ fill: "#f8fafc", radius: 4 }} />
                <Legend
                  iconType="square"
                  iconSize={10}
                  formatter={(value) => {
                    const labels: Record<string, string> = {
                      "EOU delay":  "EOU delay",
                      "LLM (TTFT)": "LLM TTFT",
                      "TTS (TTFB)": "TTS TTFB",
                    };
                    return <span className="text-xs text-gray-500">{labels[value] ?? value}</span>;
                  }}
                />
                {avgOverall > 0 && (
                  <ReferenceLine
                    y={avgOverall * 3}
                    stroke="#ef4444"
                    strokeDasharray="5 4"
                    strokeWidth={1.5}
                    label={{ value: "limite anomalia (3×)", fill: "#ef4444", fontSize: 10, position: "insideTopRight" }}
                  />
                )}
                <Bar dataKey="avg_eou_ms" stackId="a" name="EOU delay" fill="#818cf8">
                  {latency.map((entry, i) => (
                    <Cell key={i} fill={entry.has_anomaly ? "#4f46e5" : "#818cf8"} />
                  ))}
                </Bar>
                <Bar dataKey="avg_llm_ms" stackId="a" name="LLM (TTFT)" fill="#34d399">
                  {latency.map((entry, i) => (
                    <Cell key={i} fill={entry.has_anomaly ? "#059669" : "#34d399"} />
                  ))}
                </Bar>
                <Bar dataKey="avg_tts_ms" stackId="a" name="TTS (TTFB)" fill="#fb923c" radius={[4, 4, 0, 0]}>
                  {latency.map((entry, i) => (
                    <Cell key={i} fill={entry.has_anomaly ? "#ea580c" : "#fb923c"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Chart legend with definitions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-100">
              {[
                { color: "#818cf8", name: "EOU delay", def: "Tempo para detectar que o usuário parou de falar. Alta EOU indica lentidão no VAD (Voice Activity Detection)." },
                { color: "#34d399", name: "LLM TTFT", def: "Time-to-First-Token: tempo do modelo de linguagem para começar a gerar resposta após receber o prompt." },
                { color: "#fb923c", name: "TTS TTFB", def: "Time-to-First-Byte: tempo do sintetizador de voz para começar a gerar áudio após receber o texto." },
              ].map((item) => (
                <div key={item.name} className="flex gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0 mt-0.5" style={{ background: item.color }} />
                  <div>
                    <p className="font-semibold text-gray-700">{item.name}</p>
                    <p className="text-gray-400 leading-relaxed">{item.def}</p>
                  </div>
                </div>
              ))}
            </div>

            {hasAnomalyBuckets && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-700">
                <span className="text-red-500 font-bold mt-0.5">⚠</span>
                <p><span className="font-bold">Barras mais escuras</span> indicam buckets com anomalia: pelo menos um turno naquele intervalo teve E2E acima de 3× a média global. A linha tracejada vermelha marca esse limite.</p>
              </div>
            )}
          </>
        )}
      </section>

      {/* Errors section */}
      <section className="bg-card rounded-xl p-5 border border-border">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Erros Frequentes — últimas 24h</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Erros capturados automaticamente pelo agente: falhas de timeout, STT, LLM, TTS, interrupções, etc. Agrupados por tipo.
          </p>
        </div>

        {loadingErrors ? (
          <div className="space-y-2 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-8 bg-muted/40 rounded" />)}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Tipo de Erro</th>
                  <th
                    className="px-4 py-3 text-left font-medium cursor-help"
                    title="Componente do agente que gerou o erro (ex: AdaptiveInterruptionDetector, LLM, TTS)"
                  >
                    Componente ↗
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Ocorrências</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {errors.map((e: AgentError, i: number) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-red-400 font-mono text-xs">{e.error_type}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {e.component ? (
                        <span className="bg-muted/60 rounded px-2 py-0.5">{e.component}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold font-mono ${e.count >= 10 ? "text-red-400" : e.count >= 3 ? "text-yellow-400" : "text-foreground"}`}>
                        {e.count}×
                      </span>
                    </td>
                  </tr>
                ))}
                {errors.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                      <span className="text-green-400 font-medium">✓ Nenhum erro nas últimas 24h</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Anomaly drill-down */}
      <section className="bg-card rounded-xl p-5 border border-amber-200">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-amber-700 flex items-center gap-2">
            <span>⚠</span> Chamadas com Anomalia de Latência — últimas 24h
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Turnos onde o <strong className="text-foreground">E2E total &gt; 3× a média global</strong> do período.
            {avgOverall > 0 && (
              <span className="ml-1">
                Referência atual: <span className="font-mono font-semibold text-foreground">{avgOverall}ms</span> em média
                {" "}→ limite de anomalia em <span className="font-mono font-semibold text-amber-700">{avgOverall * 3}ms</span>.
              </span>
            )}
            {" "}Use para identificar quais chamadas tiveram lentidão anormal e em qual etapa.
          </p>
        </div>

        {loadingAnomalies ? (
          <div className="space-y-2 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-8 bg-muted/40 rounded" />)}
          </div>
        ) : anomalies.length === 0 ? (
          <p className="text-green-400 font-medium text-sm">✓ Nenhuma anomalia nas últimas 24h</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-amber-200">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 text-xs text-muted-foreground">
                <tr>
                  <th
                    className="px-3 py-3 text-left font-medium cursor-help"
                    title="ID da sessão / chamada onde a anomalia ocorreu"
                  >
                    Chamada ↗
                  </th>
                  <th className="px-3 py-3 text-left font-medium">Horário</th>
                  <th
                    className="px-3 py-3 text-left font-medium cursor-help"
                   title={`Quantas vezes acima da média global (${avgOverall}ms) ficou este turno`}
                  >
                   Desvio ↗
                  </th>
                  <th
                   className="px-3 py-3 text-left font-medium cursor-help"
                   title="E2E total = EOU delay + LLM TTFT + TTS TTFB. Latência ponta a ponta daquele turno."
                  >
                    E2E total ↗
                  </th>
                  <th
                    className="px-3 py-3 text-left font-medium cursor-help"
                    title="EOU delay: tempo para detectar o fim da fala do usuário. Alta EOU indica lentidão na detecção de silêncio."
                  >
                    EOU delay ↗
                  </th>
                  <th
                    className="px-3 py-3 text-left font-medium cursor-help"
                    title="LLM TTFT (Time-to-First-Token): tempo do modelo de linguagem para começar a gerar resposta."
                  >
                    LLM TTFT ↗
                  </th>
                  <th
                    className="px-3 py-3 text-left font-medium cursor-help"
                    title="TTS TTFB (Time-to-First-Byte): tempo do sintetizador de voz para começar a gerar áudio."
                  >
                    TTS TTFB ↗
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {anomalies.map((a: AnomalyTurn, i: number) => {
                  // Find dominant component
                  const dominant = [
                    { key: "EOU", val: a.eou_delay_ms },
                    { key: "LLM", val: a.llm_ttft_ms },
                    { key: "TTS", val: a.tts_ttfb_ms },
                  ].sort((x, y) => (y.val ?? 0) - (x.val ?? 0))[0];

                  return (
                    <tr key={i} className="hover:bg-amber-50 transition-colors group">
                      <td className="px-3 py-2.5 font-mono text-xs text-amber-700 max-w-[200px]" title={a.session_id}>
                        <Link
                          href={`/telephony/rooms/${a.session_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate block hover:text-amber-900 hover:underline transition-colors"
                          title={`Abrir detalhes da chamada: ${a.session_id}`}
                        >
                          {a.session_id} ↗
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(a.time).toLocaleString("pt-BR")}
                      </td>
                      {/* Desvio da média */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {avgOverall > 0 ? (() => {
                          const mult = a.e2e_ms / avgOverall;
                          const color = mult >= 6 ? "text-red-600" : mult >= 4 ? "text-orange-600" : "text-amber-700";
                          return (
                            <span className={`font-mono font-bold text-sm ${color}`} title={`${avgOverall}ms esperado → ${a.e2e_ms}ms real`}>
                              {mult.toFixed(1)}×
                            </span>
                          );
                        })() : "—"}
                        {avgOverall > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground font-mono">
                            +{a.e2e_ms - avgOverall}ms
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-amber-700 whitespace-nowrap">
                        {a.e2e_ms}ms
                        <span className="ml-1.5 text-xs font-normal text-amber-500">
                          ↳ {dominant.key}
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 font-mono text-xs ${dominant.key === "EOU" ? "text-amber-700 font-semibold" : "text-muted-foreground"}`}>
                        {a.eou_delay_ms != null ? `${a.eou_delay_ms}ms` : "—"}
                      </td>
                      <td className={`px-3 py-2.5 font-mono text-xs ${dominant.key === "LLM" ? "text-amber-700 font-semibold" : "text-muted-foreground"}`}>
                        {a.llm_ttft_ms != null ? `${a.llm_ttft_ms}ms` : "—"}
                      </td>
                      <td className={`px-3 py-2.5 font-mono text-xs ${dominant.key === "TTS" ? "text-amber-700 font-semibold" : "text-muted-foreground"}`}>
                        {a.tts_ttfb_ms != null ? `${a.tts_ttfb_ms}ms` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {anomalies.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            <strong className="text-foreground">Desvio</strong>: quantas vezes acima da média global ({avgOverall}ms) aquele turno ficou — e o excesso em ms.
            {" "}<strong className="text-foreground">↳ EOU/LLM/TTS</strong>: etapa dominante (maior contribuinte) da anomalia.
          </p>
        )}
      </section>
    </div>
  );
}
