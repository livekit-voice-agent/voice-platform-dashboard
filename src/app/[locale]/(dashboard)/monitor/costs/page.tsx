"use client";
import { useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  useCostSummary,
  usePricingSnapshot,
  type CostBreakdownItem,
  type PricingEntry,
} from "@/hooks/useMonitor";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUsd(value: number): string {
  if (value === 0) return "$0.000000";
  if (value < 0.0001) return `$${value.toFixed(8)}`;
  if (value < 0.01) return `$${value.toFixed(6)}`;
  return `$${value.toFixed(4)}`;
}

function formatUnitPrice(entry: PricingEntry): string {
  const p = entry.unit_price;
  switch (entry.unit_type) {
    case "per_token":
      return `$${(p * 1_000_000).toFixed(2)} / 1M tokens`;
    case "per_character":
      return `$${(p * 1_000).toFixed(4)} / 1K chars`;
    case "per_second":
      return `$${(p * 60).toFixed(4)} / min`;
    case "per_audio_token":
      return `$${(p * 1_000_000).toFixed(2)} / 1M audio tokens`;
    default:
      return `$${p}`;
  }
}

function componentLabel(c: string) {
  return c === "llm" ? "LLM" : c === "tts" ? "TTS" : c === "stt" ? "STT" : c.toUpperCase();
}

function componentBadge(c: string) {
  const map: Record<string, string> = {
    llm: "bg-blue-900/50 text-blue-300 border-blue-700",
    tts: "bg-purple-900/50 text-purple-300 border-purple-700",
    stt: "bg-teal-900/50 text-teal-300 border-teal-700",
  };
  return `text-xs px-2 py-0.5 rounded-full border font-medium ${map[c] ?? "bg-muted text-muted-foreground border-border"}`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `há ${h}h${m > 0 ? ` ${m}min` : ""}`;
  if (m > 0) return `há ${m}min`;
  return "agora";
}

// ── Provider price cards ───────────────────────────────────────────────────

function PriceCard({ entry }: { entry: PricingEntry }) {
  return (
    <a
      href={entry.source}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 hover:bg-accent/30 transition-colors group"
      title="Ver página de preços"
    >
      <div className="flex items-center gap-2 justify-between">
        <span className="text-xs font-mono text-muted-foreground">{entry.provider}</span>
        <span className={componentBadge(entry.component)}>{componentLabel(entry.component)}</span>
      </div>
      <div className="font-medium text-sm truncate text-foreground">{entry.model}</div>
      <div className="font-mono text-base text-primary font-semibold">{formatUnitPrice(entry)}</div>
      {entry.source && (
        <div className="text-xs text-muted-foreground group-hover:text-primary transition-colors mt-1 flex items-center gap-1">
          <ExternalLink className="h-3 w-3 shrink-0" />
          fonte
        </div>
      )}
    </a>
  );
}

// ── Cost breakdown table ───────────────────────────────────────────────────

function CostTable({ rows }: { rows: CostBreakdownItem[] }) {
  if (!rows.length) {
    return (
      <div className="text-center text-muted-foreground py-12 text-sm">
        Nenhum custo registrado no período. Os custos são calculados automaticamente ao receber métricas dos agentes.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-left">
            <th className="pb-2 pr-4 font-medium">Provider</th>
            <th className="pb-2 pr-4 font-medium">Modelo</th>
            <th className="pb-2 pr-4 font-medium">Tipo</th>
            <th className="pb-2 pr-4 font-medium">Preço unitário</th>
            <th className="pb-2 pr-4 font-medium text-right">Requests</th>
            <th className="pb-2 pr-4 font-medium text-right">Custo méd. est.</th>
            <th className="pb-2 font-medium text-right">Custo total est.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
              <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{r.provider}</td>
              <td className="py-2.5 pr-4 font-medium">{r.model}</td>
              <td className="py-2.5 pr-4">
                <span className={componentBadge(r.component)}>{componentLabel(r.component)}</span>
              </td>
              <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                {r.price_unit && r.price_per_unit != null
                  ? formatUnitPrice({
                      model: r.model,
                      provider: r.provider,
                      component: r.component,
                      unit_type: r.price_unit,
                      unit_price: r.price_per_unit,
                    })
                  : "—"}
                {r.price_source && (
                  <a
                    href={r.price_source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1.5 text-primary/60 hover:text-primary inline-flex items-center"
                    title="Ver fonte do preço"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                )}
              </td>
              <td className="py-2.5 pr-4 text-right font-mono">{r.request_count}</td>
              <td className="py-2.5 pr-4 text-right font-mono text-muted-foreground">
                {formatUsd(r.avg_cost_per_request)}
              </td>
              <td className="py-2.5 text-right font-mono font-semibold text-foreground">
                {formatUsd(r.total_cost_usd)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border">
            <td colSpan={6} className="pt-3 text-sm text-muted-foreground font-medium">Total estimado</td>
            <td className="pt-3 text-right font-mono font-bold text-lg text-primary">
              {formatUsd(rows.reduce((a, r) => a + r.total_cost_usd, 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Period selector ────────────────────────────────────────────────────────

type Period = "7d" | "30d" | "today";

function periodRange(p: Period): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  if (p === "today") {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    return { from, to };
  }
  const days = p === "7d" ? 7 : 30;
  const from = new Date(Date.now() - days * 86_400_000).toISOString();
  return { from, to };
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function CostsPage() {
  const [period, setPeriod] = useState<Period>("7d");
  const { from, to } = periodRange(period);

  const { data: costData, loading: costLoading, error: costError } = useCostSummary(from, to, 60_000);
  const { data: pricing, loading: pricingLoading } = usePricingSnapshot(300_000);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/monitor"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Custos por Provider</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Valores <strong>estimados</strong> — calculados com preços do{" "}
            <a
              href="https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              LiteLLM model_prices_and_context_window.json
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>{" "}
            fixados no momento do registro. Consulte cada provider para valores exatos.
          </p>
        </div>
      </div>

      {/* Pricing snapshot */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-base font-semibold">Preços atuais</h2>
          {!pricingLoading && pricing?.fetched_at && (
            <span className="text-xs text-muted-foreground">
              Atualizado {relativeTime(pricing.fetched_at)}
            </span>
          )}
          <a
            href="https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors flex items-center gap-1"
          >
            Fonte: litellm/model_prices_and_context_window.json
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
        {pricingLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse h-24" />
            ))}
          </div>
        ) : pricing?.prices.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {pricing.prices.map((entry, i) => (
              <PriceCard key={i} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-4">
            Carregando preços do LiteLLM...
          </div>
        )}
      </section>

      {/* Cost breakdown */}
      <section>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-base font-semibold">Gasto por período</h2>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {(["today", "7d", "30d"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  period === p
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "today" ? "Hoje" : p === "7d" ? "7 dias" : "30 dias"}
              </button>
            ))}
          </div>
          {costData && (
            <div className="ml-auto flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total estimado</span>
              <span className="font-mono font-bold text-xl text-primary">
                {formatUsd(costData.total_cost_usd)}
              </span>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          {costLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : costError ? (
            <div className="text-red-400 text-sm">Erro ao carregar custos: {costError}</div>
          ) : (
            <CostTable rows={costData?.breakdown ?? []} />
          )}
        </div>
      </section>
    </div>
  );
}
