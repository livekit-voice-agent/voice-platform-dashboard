"use client";

import { useCallback, useEffect, useState, use, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  conversationEventsApi,
  roomApi,
  type SessionEvent,
  type CallSession,
  type AgentConfigSnapshot,
  type LiveKitRoom,
} from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AutoRefreshSelector } from "@/components/auto-refresh-selector";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Loader2,
  RefreshCw,
  MessageSquare,
  Mic,
  Settings,
  Wrench,
  Activity,
  AlertTriangle,
  XCircle,
  Clock,
  User,
  Bot,
  Hash,
  Phone,
  Timer,
  FileText,
  Zap,
  PanelLeft,
  Radio,
  History,
  Download,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSessionCost, type SessionMetricCost } from "@/hooks/useMonitor";

// ─── Helpers ────────────────────────────────────────────────

function formatDate(val: string | undefined): string {
  if (!val) return "—";
  return new Date(val).toLocaleString();
}

function formatTime(val: string | undefined): string {
  if (!val) return "—";
  return new Date(val).toLocaleTimeString();
}

function parseMetadata(raw: string | null): Record<string, any> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Event type config ──────────────────────────────────────

const EVENT_TYPE_CONFIG: Record<
  string,
  { labelKey: string; icon: React.ElementType; color: string }
> = {
  USER_TRANSCRIPTION: {
    labelKey: "transcription",
    icon: Mic,
    color: "bg-blue-500/10 text-blue-600",
  },
  CONVERSATION_ITEM: {
    labelKey: "conversation",
    icon: MessageSquare,
    color: "bg-green-500/10 text-green-600",
  },
  TOOL_EXECUTED: {
    labelKey: "tool",
    icon: Wrench,
    color: "bg-purple-500/10 text-purple-600",
  },
  METRICS: {
    labelKey: "metrics",
    icon: Activity,
    color: "bg-amber-500/10 text-amber-600",
  },
  ERROR: {
    labelKey: "error",
    icon: AlertTriangle,
    color: "bg-red-500/10 text-red-600",
  },
  SESSION_CLOSED: {
    labelKey: "sessionClosed",
    icon: XCircle,
    color: "bg-gray-500/10 text-gray-600",
  },
  DTMF: {
    labelKey: "dtmf",
    icon: Hash,
    color: "bg-orange-500/10 text-orange-600",
  },
  FOLLOW_UP: {
    labelKey: "followUp",
    icon: Phone,
    color: "bg-cyan-500/10 text-cyan-600",
  },
};

function EventBadge({ eventType }: { eventType: string }) {
  const t = useTranslations("telephony.sessionDetail");
  const config = EVENT_TYPE_CONFIG[eventType] ?? {
    labelKey: eventType,
    icon: Activity,
    color: "bg-muted text-muted-foreground",
  };
  const Icon = config.icon;
  const label = EVENT_TYPE_CONFIG[eventType] ? t(config.labelKey) : config.labelKey;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ─── Status Badge ───────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    active: { bg: "bg-emerald-50", text: "text-emerald-700" },
    completed: { bg: "bg-blue-50", text: "text-blue-700" },
    created: { bg: "bg-amber-50", text: "text-amber-700" },
    error: { bg: "bg-red-50", text: "text-red-700" },
  };
  const s = map[status] ?? { bg: "bg-muted", text: "text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${s.bg} ${s.text}`}>
      {status}
    </span>
  );
}

// ─── Event payload preview ──────────────────────────────────

function EventPayloadPreview({ event }: { event: SessionEvent }) {
  const t = useTranslations("telephony.sessionDetail");
  const p = event.payload;

  switch (event.event_type) {
    case "USER_TRANSCRIPTION":
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm">&ldquo;{p.transcript}&rdquo;</span>
          {p.isFinal ? (
            <span className="inline-flex items-center rounded-full bg-foreground/10 px-1.5 py-0 text-[10px] font-medium">{t("final")}</span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0 text-[10px] font-medium text-muted-foreground">{t("partial")}</span>
          )}
          {p.language && (
            <span className="text-xs text-muted-foreground">
              [{p.language}]
            </span>
          )}
        </div>
      );

    case "CONVERSATION_ITEM":
      return (
        <div className="flex items-start gap-2">
          <span className="shrink-0 mt-0.5">
            {p.role === "user" ? (
              <User className="h-3.5 w-3.5 text-blue-500" />
            ) : (
              <Bot className="h-3.5 w-3.5 text-green-500" />
            )}
          </span>
          <span className="text-sm line-clamp-2">
            {p.textContent || (
              <span className="text-muted-foreground italic">{t("empty")}</span>
            )}
          </span>
          {p.interrupted && (
            <span className="inline-flex items-center rounded-full bg-red-50 px-1.5 py-0 text-[10px] font-medium text-red-600 shrink-0">
              {t("interrupted")}
            </span>
          )}
        </div>
      );

    case "TOOL_EXECUTED":
      return (
        <div className="space-y-1">
          {(p.calls ?? []).map((call: any, i: number) => (
            <div key={i} className="text-sm font-mono">
              <span className="text-purple-600 font-semibold">
                {call.name}
              </span>
              <span className="text-muted-foreground">
                (
                {typeof call.args === "string"
                  ? call.args
                  : JSON.stringify(call.args)}
                )
              </span>
            </div>
          ))}
        </div>
      );

    case "METRICS": {
      const type = p.type ?? "unknown";
      if (type === "tts_metrics") {
        return (
          <span className="text-sm text-muted-foreground">
            TTS — ttfb: {p.ttfbMs?.toFixed(0) ?? "?"}ms, duration:{" "}
            {p.durationMs?.toFixed(0) ?? "?"}ms, áudio:{" "}
            {p.audioDurationMs?.toFixed(0) ?? "?"}ms
          </span>
        );
      }
      if (type === "realtime_model_metrics" || type === "llm_metrics") {
        return (
          <span className="text-sm text-muted-foreground">
            LLM — ttft: {p.ttftMs?.toFixed(0) ?? "?"}ms, tokens:{" "}
            {p.inputTokens ?? "?"}→{p.outputTokens ?? "?"},{" "}
            {p.tokensPerSecond?.toFixed(1) ?? "?"}tok/s
          </span>
        );
      }
      if (type === "stt_metrics") {
        return (
          <span className="text-sm text-muted-foreground">
            STT — duration: {(p.durationMs ?? p.duration)?.toFixed(0) ?? "?"}ms
          </span>
        );
      }
      if (type === "eou_metrics") {
        return (
          <span className="text-sm text-muted-foreground">
            EOU — delay: {(p.endOfUtteranceDelayMs ?? p.endOfUtteranceDelay)?.toFixed(0) ?? "?"}ms
          </span>
        );
      }
      return (
        <span className="text-sm text-muted-foreground font-mono truncate">
          {JSON.stringify(p).substring(0, 120)}
        </span>
      );
    }

    case "ERROR":
      return (
        <span className="text-sm text-red-600">
          {p.message}{" "}
          <span className="text-muted-foreground">({p.source})</span>
        </span>
      );

    case "SESSION_CLOSED":
      return (
        <span className="text-sm">
          {t("reason")} <span className="font-medium">{p.reason}</span>
          {p.error && <span className="text-red-500 ml-2">({p.error})</span>}
        </span>
      );

    case "DTMF":
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-sm font-mono font-bold">
            {p.digit}
          </span>
          {p.participant_identity && (
            <span className="text-xs text-muted-foreground">
              {t("fromParticipant", { identity: p.participant_identity })}
            </span>
          )}
        </div>
      );

    case "FOLLOW_UP":
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm">
            {p.action === "end_call"
              ? t("endedNoResponse")
              : p.max > 0
                ? t("attemptWithMax", { count: p.count, max: p.max })
                : t("attempt", { count: p.count })}
          </span>
          <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium ${p.action === "end_call" ? "bg-red-50 text-red-600" : "bg-muted text-muted-foreground"}`}>
            {p.action === "end_call" ? t("closed") : t("asked")}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("afterSilence", { seconds: p.timeoutSeconds })}
          </span>
        </div>
      );

    default:
      return (
        <span className="text-sm text-muted-foreground font-mono truncate">
          {JSON.stringify(p).substring(0, 120)}
        </span>
      );
  }
}

// ─── Conversation Timeline (chat bubbles) ───────────────────

function ConversationTimeline({ events }: { events: SessionEvent[] }) {
  const t = useTranslations("telephony.sessionDetail");
  const filtered = events.filter(
    (e) => e.event_type === "CONVERSATION_ITEM"
  );

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">{t("noConversationItems")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-5">
      {filtered.map((ev) => {
        const isUser = ev.payload.role === "user";
        const text = ev.payload.textContent;

        if (!text) return null;

        return (
          <div
            key={ev.id}
            className={`flex ${isUser ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                isUser
                  ? "bg-muted text-foreground rounded-bl-sm"
                  : "bg-foreground text-background rounded-br-sm"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{text}</p>
              <p
                className={`text-[10px] mt-1 ${
                  isUser
                    ? "text-muted-foreground"
                    : "text-background/70"
                }`}
              >
                {formatTime(ev.occurred_at)}
                {ev.payload.interrupted && ` · ${t("interrupted")}`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Metrics Aggregation View ───────────────────────────────

function avg(items: Record<string, any>[], key: string): number {
  const nums = items.map((i) => i[key]).filter((n) => typeof n === "number");
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : NaN;
}

function sum(items: Record<string, any>[], key: string): number {
  return items
    .map((i) => i[key])
    .filter((n) => typeof n === "number")
    .reduce((a, b) => a + b, 0);
}

function MetricCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 hover:border-foreground/20 transition-colors">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tracking-tight mt-0.5">
        {isNaN(value) ? "—" : value.toFixed(0)}
        {unit && (
          <span className="text-xs font-normal text-muted-foreground ml-1">
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}

function MetricsView({ events }: { events: SessionEvent[] }) {
  const t = useTranslations("telephony.sessionDetail");
  const metricsEvents = events.filter((e) => e.event_type === "METRICS");
  const dtmfEvents = events.filter((e) => e.event_type === "DTMF");

  if (metricsEvents.length === 0 && dtmfEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Activity className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">{t("noMetrics")}</p>
      </div>
    );
  }

  // Group metrics by type
  const byType: Record<string, Record<string, any>[]> = {};
  for (const ev of metricsEvents) {
    const type = ev.payload.type ?? "unknown";
    if (!byType[type]) byType[type] = [];
    byType[type].push(ev.payload);
  }

  const metricTypeLabels: Record<string, string> = {
    tts_metrics: "tts",
    realtime_model_metrics: "llm",
    llm_metrics: "llm",
    stt_metrics: "stt",
    eou_metrics: "eou",
  };

  const dtmfSequence = dtmfEvents.map((e) => e.payload.digit).join(" → ");

  return (
    <div className="p-5 space-y-6">
      {dtmfEvents.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold mb-3">
            {t("dtmfTitle", { count: dtmfEvents.length })}
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label={t("totalDigits")}
              value={dtmfEvents.length}
              unit=""
            />
            <MetricCard
              label={t("uniqueDigits")}
              value={new Set(dtmfEvents.map((e) => e.payload.digit)).size}
              unit=""
            />
          </div>
          <div className="mt-3 rounded-lg border bg-card p-3">
            <p className="text-[11px] text-muted-foreground mb-1">{t("sequence")}</p>
            <p className="text-sm font-mono font-bold tracking-wider">
              {dtmfSequence}
            </p>
          </div>
        </div>
      )}

      {Object.entries(byType).map(([type, items]) => (
        <div key={type}>
          <h4 className="text-xs font-semibold mb-3">
            {metricTypeLabels[type] ? t(metricTypeLabels[type]) : type}{" "}
            <span className="text-muted-foreground font-normal">
              ({items.length} {t("samples")})
            </span>
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {type === "tts_metrics" && (
              <>
                <MetricCard label={t("avgTtfb")} value={avg(items, "ttfbMs")} unit="ms" />
                <MetricCard label={t("avgDuration")} value={avg(items, "durationMs")} unit="ms" />
                <MetricCard label="Áudio médio" value={avg(items, "audioDurationMs")} unit="ms" />
                <MetricCard label={t("totalCharacters")} value={sum(items, "charactersCount")} unit="" />
              </>
            )}
            {(type === "realtime_model_metrics" || type === "llm_metrics") && (
              <>
                <MetricCard label={t("avgTtft")} value={avg(items, "ttftMs")} unit="ms" />
                <MetricCard label={t("avgDuration")} value={avg(items, "durationMs")} unit="ms" />
                <MetricCard label={t("tokensIn")} value={sum(items, "inputTokens")} unit="" />
                <MetricCard label={t("tokensOut")} value={sum(items, "outputTokens")} unit="" />
                <MetricCard label={t("avgSpeed")} value={avg(items, "tokensPerSecond")} unit="tok/s" />
              </>
            )}
            {type === "stt_metrics" && (
              <MetricCard label={t("avgDuration")} value={avg(items, "durationMs")} unit="ms" />
            )}
            {type === "eou_metrics" && (
              <>
                <MetricCard label={t("avgEouDelay")} value={avg(items, "endOfUtteranceDelayMs")} unit="ms" />
                <MetricCard label="Transc. delay médio" value={avg(items, "transcriptionDelayMs")} unit="ms" />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Recording Player Card ───────────────────────────────────

function RecordingPlayerCard({ sessionId, initialUrl }: { sessionId: string; initialUrl: string | null }) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await roomApi.getRecordingUrl(sessionId);
      setUrl(result?.url ?? null);
    } catch {
      toast.error("Falha ao renovar URL de gravação");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-5 py-3.5 border-b bg-muted/40 flex items-center justify-between">
        <h2 className="text-xs font-semibold flex items-center gap-2">
          <Mic className="h-3.5 w-3.5 text-muted-foreground" />
          Gravação da Chamada
        </h2>
        {url && (
          <div className="flex items-center gap-2">
            <a
              href={url}
              download
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors"
            >
              <Download className="h-3 w-3" />
              Baixar
            </a>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Renovar URL (expira em 1h)"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
              Renovar URL
            </Button>
          </div>
        )}
      </div>
      <div className="p-5">
        {url ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Volume2 className="h-3.5 w-3.5" />
              <span>Áudio da chamada (URL válida por 1 hora)</span>
            </div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio
              controls
              src={url}
              className="w-full h-10 rounded-md"
              preload="metadata"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Mic className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma gravação disponível</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              A gravação é gerada automaticamente ao encerrar a chamada.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Agent Config Panel (expandable) ────────────────────────

function ConfigField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xs font-medium mt-0.5">{value ?? "—"}</p>
    </div>
  );
}

function AgentConfigPanel({ snapshot }: { snapshot: AgentConfigSnapshot }) {
  const [open, setOpen] = useState(false);

  const isElevenLabs = snapshot.tts?.provider === "elevenlabs";
  const voiceLabel = isElevenLabs
    ? `${snapshot.tts?.voiceId ?? "—"} (ElevenLabs)`
    : snapshot.voice ?? "—";

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 w-full text-left px-5 py-3.5 hover:bg-muted/30 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
          <Settings className="h-3.5 w-3.5 text-violet-600" />
        </div>
        <span className="text-xs font-medium">Configuração do Agent na Chamada</span>
        {!open && snapshot.model && (
          <span className="text-[11px] text-muted-foreground ml-auto">
            {snapshot.model} · {isElevenLabs ? "ElevenLabs" : (snapshot.voice ?? "—")}
          </span>
        )}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-4">
          {/* Core Settings */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ConfigField label="Model" value={snapshot.model} />
            <ConfigField label="Voice" value={voiceLabel} />
            <ConfigField label="Temperature" value={snapshot.temperature?.toString()} />
            <ConfigField label="Max Tokens" value={snapshot.maxTokens?.toString()} />
          </div>

          {/* TTS / STT */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ConfigField label="TTS Provider" value={snapshot.tts?.provider ?? "OpenAI Realtime"} />
            <ConfigField label="TTS Model" value={snapshot.tts?.model ?? "—"} />
            <ConfigField
              label="TTS Voice ID"
              value={
                snapshot.tts?.voiceId
                  ? `${String(snapshot.tts.voiceId).substring(0, 12)}…`
                  : "—"
              }
            />
            <ConfigField label="STT Provider" value={snapshot.stt?.provider ?? "built-in"} />
          </div>

          {/* Turn Detection & Session */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ConfigField label="Turn Detection" value={snapshot.turnDetection?.type ?? "—"} />
            <ConfigField label="Session Turn Detection" value={snapshot.sessionTurnDetection ?? "auto"} />
            <ConfigField label="Noise Cancellation" value={snapshot.noiseCancellation ? "Sim" : "Não"} />
            <ConfigField label="Persona" value={snapshot.persona} />
          </div>

          {/* Timeouts & Greeting */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ConfigField label="Timeout" value={snapshot.timeoutSeconds != null ? `${snapshot.timeoutSeconds}s` : "Sem limite"} />
            <ConfigField label="Duração Máx." value={snapshot.maxCallDurationSeconds != null ? `${snapshot.maxCallDurationSeconds}s` : "Sem limite"} />
            <ConfigField label="Greeting Mode" value={snapshot.greetingMode ?? "—"} />
            <ConfigField
              label="Greeting"
              value={
                snapshot.greetingMessage
                  ? snapshot.greetingMessage.length > 50
                    ? `${snapshot.greetingMessage.substring(0, 50)}…`
                    : snapshot.greetingMessage
                  : "—"
              }
            />
          </div>

          {/* Humanization */}
          {snapshot.humanization && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <ConfigField label="Fillers" value={snapshot.humanization.fillersEnabled ? "Sim" : "Não"} />
              <ConfigField label="Typing Sounds" value={snapshot.humanization.typingSounds ? "Sim" : "Não"} />
              <ConfigField label="Ambience" value={snapshot.humanization.ambience ? "Sim" : "Não"} />
            </div>
          )}

          {/* Tools */}
          {snapshot.tools && snapshot.tools.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Tools ({snapshot.tools.length})
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {snapshot.tools.map((tool) => (
                  <div
                    key={tool.name}
                    className="rounded-lg border bg-card p-2.5 flex items-center gap-2 hover:border-foreground/20 transition-colors"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50">
                      <Wrench className="h-3 w-3 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{tool.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {tool.type} — {tool.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const t = useTranslations("telephony.sessionDetail");
  const router = useRouter();
  const searchParams = useSearchParams();
  const originPage = parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const PAGE_SIZE = 30;
  const [session, setSession] = useState<CallSession | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<SessionEvent | null>(null);
  const [activeTab, setActiveTab] = useState("conversation");
  const [highlightedMetricId, setHighlightedMetricId] = useState<string | null>(null);
  const highlightedMetricRef = useRef<HTMLTableRowElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("room_sidebar_open") === "true" : false
  );
  const [sidebarRooms, setSidebarRooms] = useState<CallSession[]>([]);
  const [sidebarLive, setSidebarLive] = useState<Array<LiveKitRoom>>([]);

  // Cost data — session_id in AgentProviderMetric is the LiveKit room_name
  const { data: sessionCost, loading: loadingCost } = useSessionCost(session?.room_name ?? "");

  // Map each timeline event to its matching cost metric (sequential match by component type)
  const PAYLOAD_TYPE_TO_COMPONENT: Record<string, string> = {
    tts_metrics: 'tts',
    stt_metrics: 'stt',
    llm_metrics: 'llm',
    llm_turn_metrics: 'llm',
    realtime_model_metrics: 'realtime',
  };
  const eventCosts = useMemo<Record<string, { cost_usd: number | null; metric_id: string | null }>>(() => {
    if (!sessionCost?.metrics?.length || !events.length) return {};
    const byComponent: Record<string, typeof sessionCost.metrics> = {};
    for (const m of [...sessionCost.metrics].sort((a, b) => a.time.localeCompare(b.time))) {
      (byComponent[m.component] ??= []).push(m);
    }
    const counters: Record<string, number> = {};
    const result: Record<string, { cost_usd: number | null; metric_id: string | null }> = {};
    const sortedEvents = [...events].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    for (const ev of sortedEvents) {
      // The event_type in DB is "METRICS"; the specific type is in payload.type
      const payloadType = (ev.payload as any)?.type as string | undefined;
      const comp = payloadType ? PAYLOAD_TYPE_TO_COMPONENT[payloadType] : undefined;
      if (!comp) continue;
      const idx = counters[comp] ?? 0;
      counters[comp] = idx + 1;
      const matched = byComponent[comp]?.[idx];
      result[ev.id] = { cost_usd: matched?.cost_usd ?? null, metric_id: matched?.id ?? null };
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCost, events]);

  // Scroll highlighted metric row into view and auto-clear after 2s
  useEffect(() => {
    if (activeTab === 'costs' && highlightedMetricId && highlightedMetricRef.current) {
      highlightedMetricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setHighlightedMetricId(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [activeTab, highlightedMetricId]);

  const fetchSession = useCallback(async () => {
    try {
      const found = await roomApi.getSession(sessionId);
      setSession(found);
      if (!found) toast.error("Sessão não encontrada");
    } catch (err: any) {
      setSession(null);
      toast.error(err.message || "Falha ao carregar sessão");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const fetchEvents = useCallback(async (uuid: string) => {
    try {
      const data = await conversationEventsApi.bySession(uuid);
      setEvents(data);
    } catch (err: any) {
      toast.error(err.message || "Falha ao carregar eventos");
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);

    const init = async () => {
      let uuid = sessionId;

      if (!isUuid) {
        const found = await roomApi.getSessionByRoomName(sessionId);
        setSession(found);
        setLoading(false);
        if (found) {
          uuid = found.id;
          fetchEvents(uuid);
        } else {
          toast.error("Sessão não encontrada");
          setLoadingEvents(false);
        }
      } else {
        fetchSession();
        fetchEvents(uuid);
      }
    };

    init();
    roomApi.listSessions({ limit: PAGE_SIZE, offset: (originPage - 1) * PAGE_SIZE }).then(r => setSidebarRooms(r.data)).catch(() => {});
    roomApi.listLive().then(live => setSidebarLive(live.slice(0, 20))).catch(() => {});
  }, [fetchSession, fetchEvents, sessionId, originPage]);

  const handleRefresh = useCallback(() => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);
    if (isUuid) {
      fetchSession();
      fetchEvents(sessionId);
    } else if (session?.id) {
      fetchSession();
      fetchEvents(session.id);
    }
  }, [fetchSession, fetchEvents, sessionId, session]);

  const { autoRefreshInterval, setAutoRefreshInterval } = useAutoRefresh(handleRefresh);

  const meta = session ? parseMetadata(session.metadata) : null;

  // Count by type
  const countByType: Record<string, number> = {};
  for (const ev of events) {
    countByType[ev.event_type] = (countByType[ev.event_type] ?? 0) + 1;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-5">
        <Link href="/telephony/rooms">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Button>
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Sessão não encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-0">
      {/* Collapsible Sidebar */}
      <aside
        className={`flex-shrink-0 flex flex-col border-r bg-card transition-all duration-200 ${sidebarOpen ? "w-64" : "w-12"}`}
        style={{ minHeight: "calc(100vh - 64px)" }}
      >
        {/* Toggle button */}
        <div className={`flex items-center border-b h-12 px-2 ${sidebarOpen ? "justify-between" : "justify-center"}`}>
          {sidebarOpen && (
            <span className="text-xs font-medium text-muted-foreground pl-1">Rooms</span>
          )}
          <button
            onClick={() => {
              const next = !sidebarOpen;
              setSidebarOpen(next);
              localStorage.setItem("room_sidebar_open", String(next));
            }}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
          >
            <PanelLeft className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {sidebarOpen ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Back link — TOP */}
            <div className="border-b px-2 py-1.5">
              <button
                onClick={() => router.push(`/telephony/rooms`)}
                className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Voltar para Rooms</span>
              </button>
            </div>

            {/* Live rooms */}
            {sidebarLive.length > 0 && (
              <div className="flex-shrink-0">
                <div className="flex items-center gap-1.5 px-3 py-2">
                  <Radio className="h-3 w-3 text-emerald-500" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ao vivo</span>
                </div>
                {sidebarLive.slice(0, 5).map(r => (
                  <div key={r.name} className="px-2 py-1">
                    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer text-xs truncate">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="truncate">{r.name}</span>
                    </div>
                  </div>
                ))}
                <div className="border-t mx-3 my-1" />
              </div>
            )}

            {/* Recent sessions */}
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-1.5">
                <History className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Recentes</span>
              </div>
              <span className="text-[10px] text-muted-foreground/60 border rounded px-1.5 py-0.5">p.{originPage}</span>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {sidebarRooms.map(r => (
                <div
                  key={r.id}
                  onClick={() => router.push(`/telephony/rooms/${r.id}?page=${originPage}`)}
                  className={`flex items-start gap-2 rounded-md px-2 py-2 hover:bg-accent cursor-pointer transition-colors ${r.id === sessionId ? "bg-accent" : ""}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 mt-1.5 ${r.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate leading-tight">{r.room_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{r.agent_name || "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Collapsed: icon-only navigation */
          <div className="flex flex-col items-center gap-1 pt-2">
            <button
              onClick={() => router.push(`/telephony/rooms`)}
              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
              title="Voltar para Rooms"
            >
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-5 p-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold tracking-tight truncate">
            {session.room_name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {(session.agent_name || meta?.agent_name) && `${session.agent_name || meta?.agent_name} · `}
            {formatDate(session.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AutoRefreshSelector
            value={autoRefreshInterval}
            onChange={setAutoRefreshInterval}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => {
              setLoadingEvents(true);
              fetchEvents(session.id);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
              <Zap className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <span className="text-[11px] text-muted-foreground">Status</span>
          </div>
          <StatusBadge status={session.status} />
        </div>

        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
              <Bot className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <span className="text-[11px] text-muted-foreground">Agente</span>
          </div>
          <p className="text-sm font-medium truncate">
            {session.agent_name || meta?.agent_name || "—"}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
              {(() => {
                const dir = session.direction || meta?.direction;
                const isInbound = dir === "inbound";
                return isInbound ? (
                  <ArrowDownLeft className="h-3.5 w-3.5 text-violet-600" />
                ) : (
                  <ArrowUpRight className="h-3.5 w-3.5 text-violet-600" />
                );
              })()}
            </div>
            <span className="text-[11px] text-muted-foreground">Direção</span>
          </div>
          <p className="text-sm font-medium">
            {session.direction || meta?.direction || "—"}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
              <Timer className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <span className="text-[11px] text-muted-foreground">Duração</span>
          </div>
          <p className="text-sm font-semibold">
            {formatDuration(session.duration_seconds)}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50">
              <Activity className="h-3.5 w-3.5 text-sky-600" />
            </div>
            <span className="text-[11px] text-muted-foreground">Eventos</span>
          </div>
          <p className="text-xl font-semibold tracking-tight">{events.length}</p>
        </div>

        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50">
              <Phone className="h-3.5 w-3.5 text-orange-600" />
            </div>
            <span className="text-[11px] text-muted-foreground">De</span>
          </div>
          <p className="text-sm font-medium truncate">
            {session.phone_number || meta?.from_number || "—"}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-50">
              <Phone className="h-3.5 w-3.5 text-cyan-600" />
            </div>
            <span className="text-[11px] text-muted-foreground">Para</span>
          </div>
          <p className="text-sm font-medium truncate">
            {meta?.to_number || "—"}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-50">
              <Hash className="h-3.5 w-3.5 text-pink-600" />
            </div>
            <span className="text-[11px] text-muted-foreground">Canal</span>
          </div>
          <p className="text-sm font-medium truncate">
            {session.channel || meta?.channel || "—"}
          </p>
        </div>
      </div>

      {/* Call Summary */}
      {session.summary && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-muted/40">
            <h2 className="text-xs font-semibold flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Resumo da Chamada
            </h2>
          </div>
          <div className="p-5">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {typeof session.summary === 'object' && 'text' in session.summary
                ? (session.summary as { text: string }).text
                : JSON.stringify(session.summary)}
            </p>
          </div>
        </div>
      )}

      {/* Ticket - Extracted Fields */}
      {session.ticket && typeof session.ticket === 'object' && Object.keys(session.ticket).length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-muted/40">
            <h2 className="text-xs font-semibold flex items-center gap-2">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              Ticket — Campos Extraídos
            </h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(session.ticket as Record<string, any>).map(([key, value]) => (
                <div key={key} className="rounded-lg border bg-card p-3">
                  <p className="text-[11px] text-muted-foreground capitalize">
                    {key.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs font-medium mt-0.5">
                    {value === null || value === undefined
                      ? '—'
                      : typeof value === 'boolean'
                        ? (value ? 'Sim' : 'Não')
                        : String(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recording Player */}
      <RecordingPlayerCard sessionId={session.id} initialUrl={session.recording_url ?? null} />

      {/* Agent Config Snapshot */}
      {session.agent_config_snapshot && (
        <AgentConfigPanel snapshot={session.agent_config_snapshot} />
      )}

      {/* Event Type Summary */}
      {events.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(countByType).map(([type, count]) => {
            const config = EVENT_TYPE_CONFIG[type];
            return (
              <span
                key={type}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${config?.color ?? "bg-muted text-muted-foreground"}`}
              >
                {config ? t(config.labelKey) : type}: {count}
              </span>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v !== 'costs') setHighlightedMetricId(null); }}>
        <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-4">
          <TabsTrigger value="conversation" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2.5 pt-1.5 gap-1.5 text-xs">
            <MessageSquare className="h-3.5 w-3.5" />
            {t("conversation")}
          </TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2.5 pt-1.5 gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="metrics" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2.5 pt-1.5 gap-1.5 text-xs">
            <Activity className="h-3.5 w-3.5" />
            {t("metrics")}
          </TabsTrigger>
          <TabsTrigger value="costs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2.5 pt-1.5 gap-1.5 text-xs">
            <DollarSign className="h-3.5 w-3.5" />
            Custos
          </TabsTrigger>
        </TabsList>

        {/* ─── Conversation (chat-style) ─── */}
        <TabsContent value="conversation" className="mt-4">
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-muted/40">
              <h2 className="text-xs font-semibold flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                {t("conversation")}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Visualização estilo chat da interação entre usuário e agente.
              </p>
            </div>
            {loadingEvents ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ConversationTimeline events={events} />
            )}
          </div>
        </TabsContent>

        {/* ─── Full Timeline ─── */}
        <TabsContent value="timeline" className="mt-4">
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-muted/40">
              <h2 className="text-xs font-semibold flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Timeline Completa
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Todos os eventos da sessão em ordem cronológica.
              </p>
            </div>
            {/* Cost summary strip */}
            {sessionCost && sessionCost.total_cost_usd > 0 && (
              <div className="px-5 py-2.5 border-b bg-muted/10 flex items-center gap-4 flex-wrap text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                  <DollarSign className="h-3.5 w-3.5" />
                  Custo estimado: ${sessionCost.total_cost_usd.toFixed(6)}
                </span>
                {['llm', 'tts', 'stt', 'realtime'].map((comp) => {
                  const compTotal = sessionCost.metrics
                    .filter((m) => m.component === comp)
                    .reduce((s, m) => s + (m.cost_usd ?? 0), 0);
                  if (!compTotal) return null;
                  return (
                    <span key={comp} className="text-muted-foreground">
                      {comp.toUpperCase()}: ${compTotal.toFixed(6)}
                    </span>
                  );
                })}
              </div>
            )}
            {loadingEvents ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Clock className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum evento registrado</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Eventos aparecem aqui conforme a sessão progride.
                </p>
              </div>
            ) : (
              <>
                <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-[80px] text-xs font-medium whitespace-nowrap">Hora</TableHead>
                      <TableHead className="w-[130px] text-xs font-medium whitespace-nowrap">Tipo</TableHead>
                      <TableHead className="text-xs font-medium">Conteúdo</TableHead>
                      <TableHead className="sticky right-0 bg-muted/40 w-[100px] text-xs font-medium text-right whitespace-nowrap border-l">Custo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((ev) => (
                      <TableRow
                        key={ev.id}
                        className="cursor-pointer hover:bg-muted/50 group"
                        onClick={() => setSelectedEvent(ev)}
                      >
                        <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                          {formatTime(ev.occurred_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <EventBadge eventType={ev.event_type} />
                        </TableCell>
                        <TableCell>
                          <EventPayloadPreview event={ev} />
                        </TableCell>
                        <TableCell className="sticky right-0 bg-background group-hover:bg-muted/50 text-right border-l">
                          {eventCosts[ev.id]?.cost_usd != null ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setHighlightedMetricId(eventCosts[ev.id].metric_id);
                                setActiveTab('costs');
                              }}
                              title="Ver no tab Custos"
                              className="text-xs font-mono text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                            >
                              {eventCosts[ev.id].cost_usd! < 0.000001
                                ? '<$0.000001'
                                : `$${eventCosts[ev.id].cost_usd!.toFixed(6)}`}
                            </button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                <div className="border-t px-4 py-2.5 bg-muted/20 text-xs text-muted-foreground">
                  {events.length} {events.length === 1 ? "evento" : "eventos"}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ─── Metrics ─── */}
        <TabsContent value="metrics" className="mt-4">
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-muted/40">
              <h2 className="text-xs font-semibold flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                {t("metrics")}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                TTS, LLM, STT e EOU métricas coletadas durante a sessão.
              </p>
            </div>
            {loadingEvents ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <MetricsView events={events} />
            )}
          </div>
        </TabsContent>

        {/* ─── Custos ─── */}
        <TabsContent value="costs" className="mt-4">
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-muted/40">
              <h2 className="text-xs font-semibold flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                Custo Estimado da Sessão
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Valores aproximados calculados com preços LiteLLM fixados no momento do registro. Consulte os providers para valores exatos.
              </p>
            </div>
            {loadingCost ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !sessionCost || sessionCost.metrics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <DollarSign className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum custo registrado</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Os custos aparecem após o processamento das métricas da sessão.
                </p>
              </div>
            ) : (
              <>
                {/* Total cost card */}
                <div className="px-5 py-4 border-b bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Custo Total Estimado</p>
                      <p className="text-xl font-semibold tracking-tight">
                        {sessionCost.total_cost_usd < 0.0001 && sessionCost.total_cost_usd > 0
                          ? `< $0.0001`
                          : `$${sessionCost.total_cost_usd.toFixed(6)}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metrics table */}
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-xs font-medium">Hora</TableHead>
                      <TableHead className="text-xs font-medium">Provider</TableHead>
                      <TableHead className="text-xs font-medium">Modelo</TableHead>
                      <TableHead className="text-xs font-medium">Componente</TableHead>
                      <TableHead className="text-xs font-medium">Uso</TableHead>
                      <TableHead className="text-xs font-medium">Preço/Unidade</TableHead>
                      <TableHead className="text-xs font-medium text-right">Custo Est. (USD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionCost.metrics.map((m: SessionMetricCost) => {
                      const isHighlighted = m.id === highlightedMetricId;
                      return (
                      <TableRow
                        key={m.id}
                        ref={isHighlighted ? highlightedMetricRef : null}
                        className={`hover:bg-muted/50 transition-colors ${isHighlighted ? 'animate-[highlight-flash_2s_ease-out_forwards]' : ''}`}
                      >
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {formatTime(m.time)}
                        </TableCell>
                        <TableCell className="text-xs font-medium capitalize">{m.provider}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{m.model}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700">
                            {m.component.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.price_unit === "per_token"
                            ? `${(m.input_tokens ?? 0) + (m.output_tokens ?? 0)} tok`
                            : m.price_unit === "per_character"
                            ? `${m.characters_count ?? 0} chars`
                            : m.price_unit === "per_second"
                            ? `${((m.audio_duration_ms ?? 0) / 1000).toFixed(1)}s`
                            : m.price_unit === "per_audio_token"
                            ? `${m.output_tokens ?? 0} audio tok`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {m.price_per_unit != null
                            ? `$${m.price_per_unit.toExponential(3)}`
                            : "—"}
                          {m.price_source && (
                            <a
                              href={m.price_source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-1 text-blue-500 hover:underline text-[10px]"
                            >
                              ↗
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-right">
                          {m.cost_usd != null
                            ? m.cost_usd < 0.000001
                              ? "< $0.000001"
                              : `$${m.cost_usd.toFixed(6)}`
                            : "—"}
                        </TableCell>
                       </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="border-t px-4 py-2.5 bg-muted/20 text-xs text-muted-foreground">
                  {sessionCost.metrics.length} {sessionCost.metrics.length === 1 ? "métrica" : "métricas"}
                  {sessionCost.metrics[0]?.price_fetched_at && (
                    <span className="ml-2 opacity-60">
                      · Preços de {new Date(sessionCost.metrics[0].price_fetched_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Event Detail Dialog */}
      <Dialog
        open={!!selectedEvent}
        onOpenChange={() => setSelectedEvent(null)}
      >
        <DialogContent className="p-0 gap-0 sm:max-w-lg" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              {selectedEvent && (
                <EventBadge eventType={selectedEvent.event_type} />
              )}
              <span className="text-xs font-normal text-muted-foreground">
                {selectedEvent && formatTime(selectedEvent.occurred_at)}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 max-h-[60vh] overflow-y-auto">
            <pre className="rounded-lg bg-muted p-4 text-xs overflow-auto">
              {selectedEvent && JSON.stringify(selectedEvent.payload, null, 2)}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
      </div>{/* end main content */}
    </div>
  );
}
