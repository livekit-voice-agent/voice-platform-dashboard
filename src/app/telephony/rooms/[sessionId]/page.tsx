"use client";

import { useCallback, useEffect, useState, use } from "react";
import {
  conversationEventsApi,
  roomApi,
  type SessionEvent,
  type CallSession,
} from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  MessageSquare,
  Mic,
  Wrench,
  Activity,
  AlertTriangle,
  XCircle,
  Clock,
  User,
  Bot,
} from "lucide-react";
import Link from "next/link";

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

// ─── Event type config ──────────────────────────────────────

const EVENT_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  USER_TRANSCRIPTION: {
    label: "Transcrição",
    icon: Mic,
    color: "bg-blue-500/10 text-blue-600",
  },
  CONVERSATION_ITEM: {
    label: "Conversa",
    icon: MessageSquare,
    color: "bg-green-500/10 text-green-600",
  },
  TOOL_EXECUTED: {
    label: "Tool",
    icon: Wrench,
    color: "bg-purple-500/10 text-purple-600",
  },
  METRICS: {
    label: "Métricas",
    icon: Activity,
    color: "bg-amber-500/10 text-amber-600",
  },
  ERROR: {
    label: "Erro",
    icon: AlertTriangle,
    color: "bg-red-500/10 text-red-600",
  },
  SESSION_CLOSED: {
    label: "Encerramento",
    icon: XCircle,
    color: "bg-gray-500/10 text-gray-600",
  },
};

function EventBadge({ eventType }: { eventType: string }) {
  const config = EVENT_TYPE_CONFIG[eventType] ?? {
    label: eventType,
    icon: Activity,
    color: "bg-muted text-muted-foreground",
  };
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// ─── Event payload preview ──────────────────────────────────

function EventPayloadPreview({ event }: { event: SessionEvent }) {
  const p = event.payload;

  switch (event.event_type) {
    case "USER_TRANSCRIPTION":
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm">&ldquo;{p.transcript}&rdquo;</span>
          {p.isFinal ? (
            <Badge variant="default" className="text-[10px] px-1.5 py-0">
              final
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              parcial
            </Badge>
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
              <span className="text-muted-foreground italic">vazio</span>
            )}
          </span>
          {p.interrupted && (
            <Badge
              variant="destructive"
              className="text-[10px] px-1.5 py-0 shrink-0"
            >
              interrompido
            </Badge>
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
          Razão: <span className="font-medium">{p.reason}</span>
          {p.error && <span className="text-red-500 ml-2">({p.error})</span>}
        </span>
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
  const conversationEvents = events.filter(
    (e) =>
      e.event_type === "CONVERSATION_ITEM" ||
      e.event_type === "USER_TRANSCRIPTION"
  );

  // Keep only final USER_TRANSCRIPTION and all CONVERSATION_ITEM
  const filtered: SessionEvent[] = [];
  for (const ev of conversationEvents) {
    if (ev.event_type === "USER_TRANSCRIPTION" && !ev.payload.isFinal) continue;
    filtered.push(ev);
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Nenhum item de conversa</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filtered.map((ev) => {
        const isUser =
          ev.event_type === "USER_TRANSCRIPTION" ||
          ev.payload.role === "user";
        const text =
          ev.event_type === "USER_TRANSCRIPTION"
            ? ev.payload.transcript
            : ev.payload.textContent;

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
                  : "bg-primary text-primary-foreground rounded-br-sm"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{text}</p>
              <p
                className={`text-[10px] mt-1 ${
                  isUser
                    ? "text-muted-foreground"
                    : "text-primary-foreground/70"
                }`}
              >
                {formatTime(ev.occurred_at)}
                {ev.payload.interrupted && " · interrompido"}
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
    <div className="rounded-md border bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">
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
  const metricsEvents = events.filter((e) => e.event_type === "METRICS");

  if (metricsEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Activity className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Nenhuma métrica coletada</p>
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
    tts_metrics: "TTS (Text-to-Speech)",
    realtime_model_metrics: "LLM (Modelo de Linguagem)",
    llm_metrics: "LLM (Modelo de Linguagem)",
    stt_metrics: "STT (Speech-to-Text)",
    eou_metrics: "EOU (End of Utterance)",
  };

  return (
    <div className="space-y-6">
      {Object.entries(byType).map(([type, items]) => (
        <div key={type}>
          <h4 className="text-sm font-semibold mb-3">
            {metricTypeLabels[type] ?? type}{" "}
            <span className="text-muted-foreground font-normal">
              ({items.length} amostras)
            </span>
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {type === "tts_metrics" && (
              <>
                <MetricCard
                  label="TTFB médio"
                  value={avg(items, "ttfbMs")}
                  unit="ms"
                />
                <MetricCard
                  label="Duração média"
                  value={avg(items, "durationMs")}
                  unit="ms"
                />
                <MetricCard
                  label="Áudio médio"
                  value={avg(items, "audioDurationMs")}
                  unit="ms"
                />
                <MetricCard
                  label="Caracteres (total)"
                  value={sum(items, "charactersCount")}
                  unit=""
                />
              </>
            )}
            {(type === "realtime_model_metrics" || type === "llm_metrics") && (
              <>
                <MetricCard
                  label="TTFT médio"
                  value={avg(items, "ttftMs")}
                  unit="ms"
                />
                <MetricCard
                  label="Duração média"
                  value={avg(items, "durationMs")}
                  unit="ms"
                />
                <MetricCard
                  label="Tokens In (total)"
                  value={sum(items, "inputTokens")}
                  unit=""
                />
                <MetricCard
                  label="Tokens Out (total)"
                  value={sum(items, "outputTokens")}
                  unit=""
                />
                <MetricCard
                  label="Velocidade média"
                  value={avg(items, "tokensPerSecond")}
                  unit="tok/s"
                />
              </>
            )}
            {type === "stt_metrics" && (
              <MetricCard
                label="Duração média"
                value={avg(items, "durationMs")}
                unit="ms"
              />
            )}
            {type === "eou_metrics" && (
              <>
                <MetricCard
                  label="EOU delay médio"
                  value={avg(items, "endOfUtteranceDelayMs")}
                  unit="ms"
                />
                <MetricCard
                  label="Transc. delay médio"
                  value={avg(items, "transcriptionDelayMs")}
                  unit="ms"
                />
              </>
            )}
          </div>
        </div>
      ))}
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
  const [session, setSession] = useState<CallSession | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<SessionEvent | null>(null);
  const [activeTab, setActiveTab] = useState("conversation");

  const fetchSession = useCallback(async () => {
    try {
      const sessions = await roomApi.listSessions();
      const found = sessions.find((s: CallSession) => s.id === sessionId);
      setSession(found ?? null);
    } catch (err: any) {
      toast.error(err.message || "Falha ao carregar sessão");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await conversationEventsApi.bySession(sessionId);
      setEvents(data);
    } catch (err: any) {
      toast.error(err.message || "Falha ao carregar eventos");
    } finally {
      setLoadingEvents(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
    fetchEvents();
  }, [fetchSession, fetchEvents]);

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
      <div className="space-y-6">
        <Link href="/telephony/rooms">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Sessão não encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/telephony/rooms">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Sessão: {session.room_name}
          </h1>
          <p className="text-muted-foreground text-sm">
            {meta?.agent_name && `Agente: ${meta.agent_name} · `}
            {formatDate(session.created_at)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoadingEvents(true);
            fetchEvents();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Session Info Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge
              variant={
                session.status === "created"
                  ? "default"
                  : session.status === "completed"
                    ? "secondary"
                    : "outline"
              }
              className="mt-1"
            >
              {session.status}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total Eventos</p>
            <p className="text-2xl font-bold">{events.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">De</p>
            <p className="text-sm font-medium mt-1">
              {meta?.from_number || "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Para</p>
            <p className="text-sm font-medium mt-1">
              {meta?.to_number || "—"}
            </p>
          </CardContent>
        </Card>
      </div>

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
                {config?.label ?? type}: {count}
              </span>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="conversation" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversa
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2">
            <Clock className="h-4 w-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="metrics" className="gap-2">
            <Activity className="h-4 w-4" />
            Métricas
          </TabsTrigger>
        </TabsList>

        {/* ─── Conversation (chat-style) ─── */}
        <TabsContent value="conversation">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversa
              </CardTitle>
              <CardDescription>
                Visualização estilo chat da interação entre usuário e agente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEvents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ConversationTimeline events={events} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Full Timeline ─── */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Timeline Completa
              </CardTitle>
              <CardDescription>
                Todos os eventos da sessão em ordem cronológica.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEvents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    Nenhum evento registrado
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Eventos aparecem aqui conforme a sessão progride.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Hora</TableHead>
                      <TableHead className="w-[140px]">Tipo</TableHead>
                      <TableHead>Conteúdo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((ev) => (
                      <TableRow
                        key={ev.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedEvent(ev)}
                      >
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {formatTime(ev.occurred_at)}
                        </TableCell>
                        <TableCell>
                          <EventBadge eventType={ev.event_type} />
                        </TableCell>
                        <TableCell>
                          <EventPayloadPreview event={ev} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Metrics ─── */}
        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Métricas de Performance
              </CardTitle>
              <CardDescription>
                TTS, LLM, STT e EOU métricas coletadas durante a sessão.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEvents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <MetricsView events={events} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Event Detail Dialog */}
      <Dialog
        open={!!selectedEvent}
        onOpenChange={() => setSelectedEvent(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent && (
                <EventBadge eventType={selectedEvent.event_type} />
              )}
              <span className="text-muted-foreground text-sm font-normal">
                {selectedEvent && formatTime(selectedEvent.occurred_at)}
              </span>
            </DialogTitle>
          </DialogHeader>
          <pre className="rounded-md bg-muted p-4 text-xs overflow-auto max-h-96">
            {selectedEvent && JSON.stringify(selectedEvent.payload, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
