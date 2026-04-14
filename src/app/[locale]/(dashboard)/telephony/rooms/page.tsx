"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  roomApi,
  agentConfigApi,
  type LiveKitRoom,
  type CallSession,
  type ListSessionsParams,
} from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoRefreshSelector } from "@/components/auto-refresh-selector";
import { useAutoRefresh, type AutoRefreshInterval } from "@/hooks/useAutoRefresh";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  DoorOpen,
  Globe,
  History,
  Loader2,
  Phone,
  Radio,
  Search,
  Timer,
  Trash2,
  Users,
  X,
} from "lucide-react";

function formatDate(val: string | number | undefined): string {
  if (!val) return "—";
  const date =
    typeof val === "number"
      ? new Date(val > 1e12 ? val : val * 1000)
      : new Date(val);
  return date.toLocaleString();
}

function parseMetadata(raw: string): Record<string, any> | null {
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

function ChannelBadge({ channel }: { channel: string }) {
  if (!channel || channel === "—") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const isSip = channel.toLowerCase().includes("sip");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
        isSip
          ? "border-violet-200 bg-violet-50 text-violet-700"
          : "border-sky-200 bg-sky-50 text-sky-700"
      }`}
    >
      {isSip ? (
        <Phone className="h-2.5 w-2.5" />
      ) : (
        <Globe className="h-2.5 w-2.5" />
      )}
      {channel}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        {status}
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {status}
      </span>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px]">
      {status}
    </Badge>
  );
}

export default function RoomsPage() {
  const [liveRooms, setLiveRooms] = useState<LiveKitRoom[]>([]);
  const [sessions, setSessions] = useState<CallSession[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [deleteConfirmRoom, setDeleteConfirmRoom] = useState<string | null>(
    null
  );
  const [activeTab, setActiveTab] = useState("live");
  const router = useRouter();
  const t = useTranslations("telephony.rooms");
  const tc = useTranslations("common");

  // Filter state
  const [agents, setAgents] = useState<string[]>([]);
  const [filterTicketField, setFilterTicketField] = useState("");
  const [filterTicketValue, setFilterTicketValue] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterHasTicket, setFilterHasTicket] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);

  useEffect(() => {
    agentConfigApi.listAgents().then(setAgents).catch(() => {});
  }, []);

  const buildFilterParams = useCallback((): ListSessionsParams | undefined => {
    const params: ListSessionsParams = {};
    if (filterTicketField) params.ticketField = filterTicketField;
    if (filterTicketValue) params.ticketValue = filterTicketValue;
    if (filterAgent) params.agentName = filterAgent;
    if (filterStatus) params.status = filterStatus;
    if (filterHasTicket) params.hasTicket = true;

    return Object.keys(params).length > 0 ? params : undefined;
  }, [filterTicketField, filterTicketValue, filterAgent, filterStatus, filterHasTicket]);

  const fetchLiveRooms = useCallback(async () => {
    try {
      const data = await roomApi.listLive();
      setLiveRooms(data);
    } catch (err: any) {
      toast.error(err.message || t("toastLiveRoomsError"));
    } finally {
      setLoadingLive(false);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const params = buildFilterParams();
      const data = await roomApi.listSessions(params);
      setSessions(data);
      setFiltersApplied(!!params);
    } catch (err: any) {
      toast.error(err.message || t("toastSessionsError"));
    } finally {
      setLoadingSessions(false);
    }
  }, [buildFilterParams]);

  const handleRefresh = useCallback(() => {
    if (activeTab === "live") fetchLiveRooms();
    else fetchSessions();
  }, [activeTab, fetchLiveRooms, fetchSessions]);

  const { autoRefreshInterval, setAutoRefreshInterval } = useAutoRefresh(handleRefresh);

  useEffect(() => {
    fetchLiveRooms();
    fetchSessions();
  }, [fetchLiveRooms, fetchSessions]);

  useEffect(() => {
    if (activeTab === "live") {
      setLoadingLive(true);
      fetchLiveRooms();
    } else {
      setLoadingSessions(true);
      fetchSessions();
    }
  }, [activeTab]);

  const handleDeleteRoom = async (roomName: string) => {
    try {
      await roomApi.deleteLive(roomName);
      toast.success(t("toastRoomDeleted", { roomName }));
      setDeleteConfirmRoom(null);
      fetchLiveRooms();
    } catch (err: any) {
      toast.error(err.message || t("toastRoomDeleteError"));
    }
  };

  const totalParticipants = useMemo(
    () => liveRooms.reduce((sum, r) => sum + r.numParticipants, 0),
    [liveRooms]
  );

  const avgDuration = useMemo(() => {
    const completed = sessions.filter((s) => s.duration_seconds != null);
    if (completed.length === 0) return "—";
    const avg = completed.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0) / completed.length;
    return formatDuration(Math.round(avg));
  }, [sessions]);

  return (
    <div className="space-y-6">
      {/* ─── Page Header ─── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("description")}
          </p>
        </div>
        <AutoRefreshSelector
          value={autoRefreshInterval}
          onChange={(v) => setAutoRefreshInterval(v as AutoRefreshInterval)}
        />
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
              <Radio className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{t("liveRooms")}</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{liveRooms.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50">
              <Users className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{t("tableParticipants")}</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{totalParticipants}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{t("callHistory")}</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{sessions.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-50">
              <Timer className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{t("tableDuration")} (avg)</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{avgDuration}</p>
        </div>
      </div>

      {/* ─── Underline Tabs ─── */}
      <div>
        <div className="flex items-center gap-1 border-b">
          <button
            onClick={() => setActiveTab("live")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "live"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground/80"
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            {t("liveRooms")}
            {liveRooms.length > 0 && (
              <span className="ml-1 inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                {liveRooms.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "history"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground/80"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            {t("callHistory")}
          </button>
        </div>

        {/* ─── Live Rooms Tab ─── */}
        {activeTab === "live" && (
          <div className="rounded-b-lg border border-t-0 overflow-hidden">
            {loadingLive ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : liveRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <DoorOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">{t("noActiveRooms")}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {t("roomsAppearHere")}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs font-medium">{t("tableRoomName")}</TableHead>
                    <TableHead className="text-xs font-medium">{t("tableSid")}</TableHead>
                    <TableHead className="text-xs font-medium">{t("tableParticipants")}</TableHead>
                    <TableHead className="text-xs font-medium">{t("tableCreated")}</TableHead>
                    <TableHead className="text-xs font-medium">{t("tableRecording")}</TableHead>
                    <TableHead className="text-xs font-medium w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liveRooms.map((room) => (
                    <TableRow key={room.sid} className="group">
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="font-medium text-sm">{room.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {room.sid}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground/60" />
                          <span className="text-sm">{room.numParticipants}</span>
                          {room.maxParticipants > 0 && (
                            <span className="text-muted-foreground text-xs">
                              / {room.maxParticipants}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(room.creationTime)}</TableCell>
                      <TableCell>
                        {room.activeRecording ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            <span className="h-1 w-1 rounded-full bg-emerald-500" />
                            {t("recording")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {t("notRecording")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setDeleteConfirmRoom(room.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {/* ─── Call History Tab ─── */}
        {activeTab === "history" && (
          <div>
            {/* Inline Filters */}
            <div className="rounded-none border border-t-0 bg-muted/30 px-4 py-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[130px]">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    {t("agentFilter")}
                  </label>
                  <Select value={filterAgent} onValueChange={(v) => setFilterAgent(v === "_all" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={tc("all")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">{tc("all")}</SelectItem>
                      {agents.map((a) => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[110px]">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    {t("statusFilter")}
                  </label>
                  <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === "_all" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={tc("all")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">{tc("all")}</SelectItem>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="created">created</SelectItem>
                      <SelectItem value="completed">completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[130px]">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    {t("ticketField")}
                  </label>
                  <Input
                    placeholder={t("ticketFieldPlaceholder")}
                    value={filterTicketField}
                    onChange={(e) => setFilterTicketField(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex-1 min-w-[110px]">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    {t("value")}
                  </label>
                  <Input
                    placeholder={t("valuePlaceholder")}
                    value={filterTicketValue}
                    onChange={(e) => setFilterTicketValue(e.target.value)}
                    className="h-8 text-xs"
                    disabled={!filterTicketField}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setLoadingSessions(true);
                      fetchSessions();
                    }}
                  >
                    <Search className="mr-1 h-3 w-3" />
                    {t("search")}
                  </Button>
                  {filtersApplied && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setFilterTicketField("");
                        setFilterTicketValue("");
                        setFilterAgent("");
                        setFilterStatus("");
                        setFilterHasTicket(false);
                        setFiltersApplied(false);
                        setLoadingSessions(true);
                        roomApi.listSessions().then(setSessions).catch(() => {}).finally(() => setLoadingSessions(false));
                      }}
                    >
                      <X className="mr-1 h-3 w-3" />
                      {t("clear")}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* History Table */}
            <div className="rounded-b-lg border border-t-0 overflow-hidden">
              {loadingSessions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {filtersApplied ? t("noSessionsFiltered") : t("noCallSessions")}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {filtersApplied ? t("adjustFilters") : t("sessionsAppearHere")}
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-xs font-medium">{t("tableRoomName")}</TableHead>
                        <TableHead className="text-xs font-medium">{t("tableStatus")}</TableHead>
                        <TableHead className="text-xs font-medium">{t("tableAgent")}</TableHead>
                        <TableHead className="text-xs font-medium">{t("tableFrom")}</TableHead>
                        <TableHead className="text-xs font-medium">{t("tableTicket")}</TableHead>
                        <TableHead className="text-xs font-medium">{t("tableDuration")}</TableHead>
                        <TableHead className="text-xs font-medium">Canal</TableHead>
                        <TableHead className="text-xs font-medium">{t("tableCreated")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((session) => {
                        const meta = parseMetadata(session.metadata);
                        const channel = session.channel || meta?.channel || "—";
                        const ticketKeys = session.ticket && typeof session.ticket === "object"
                          ? Object.entries(session.ticket)
                              .filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== "null")
                              .map(([k]) => k)
                          : [];
                        return (
                          <TableRow
                            key={session.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/telephony/rooms/${session.id}`)}
                          >
                            <TableCell className="font-medium text-sm">
                              {session.room_name}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={session.status} />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {session.agent_name || meta?.agent_name || "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {session.phone_number || meta?.from_number || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {ticketKeys.length > 0 ? (
                                  ticketKeys.slice(0, 3).map((key) => (
                                    <span
                                      key={key}
                                      className="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground cursor-pointer hover:border-foreground/30 hover:text-foreground transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setFilterTicketField(key);
                                        setFilterTicketValue("");
                                        setLoadingSessions(true);
                                        roomApi.listSessions({ ticketField: key }).then(setSessions).catch(() => {}).finally(() => {
                                          setLoadingSessions(false);
                                          setFiltersApplied(true);
                                        });
                                      }}
                                    >
                                      #{key}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-muted-foreground/50 text-xs">—</span>
                                )}
                                {ticketKeys.length > 3 && (
                                  <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    +{ticketKeys.length - 3}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {formatDuration(session.duration_seconds)}
                            </TableCell>
                            <TableCell>
                              <ChannelBadge channel={channel} />
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(session.created_at)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {/* Footer count */}
                  <div className="flex items-center justify-between border-t px-4 py-2.5 bg-muted/20">
                    <span className="text-xs text-muted-foreground">
                      {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
                      {filtersApplied && ` (${t("filterActive")})`}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmRoom}
        onOpenChange={() => setDeleteConfirmRoom(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteRoomTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteRoomConfirmation", { roomName: deleteConfirmRoom ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmRoom(null)}
            >
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteConfirmRoom && handleDeleteRoom(deleteConfirmRoom)
              }
            >
              {t("deleteRoom")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
