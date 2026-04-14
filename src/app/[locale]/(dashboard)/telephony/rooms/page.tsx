"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DoorOpen,
  Filter,
  History,
  Radio,
  Search,
  Trash2,
  Loader2,
  RefreshCw,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <AutoRefreshSelector
          value={autoRefreshInterval}
          onChange={(v) => setAutoRefreshInterval(v as AutoRefreshInterval)}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="live" className="gap-2">
            <Radio className="h-4 w-4" />
            {t("liveRooms")}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            {t("callHistory")}
          </TabsTrigger>
        </TabsList>

        {/* ─── Live Rooms ─── */}
        <TabsContent value="live">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <DoorOpen className="h-5 w-5" />
                    {t("activeRooms")}
                  </CardTitle>
                  <CardDescription>
                    {t("activeRoomsDescription")}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLoadingLive(true);
                    fetchLiveRooms();
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {tc("refresh")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingLive ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : liveRooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <DoorOpen className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">{t("noActiveRooms")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("roomsAppearHere")}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("tableRoomName")}</TableHead>
                      <TableHead>{t("tableSid")}</TableHead>
                      <TableHead>{t("tableParticipants")}</TableHead>
                      <TableHead>{t("tablePublishers")}</TableHead>
                      <TableHead>{t("tableCreated")}</TableHead>
                      <TableHead>{t("tableRecording")}</TableHead>
                      <TableHead className="text-right">{t("tableActions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liveRooms.map((room) => (
                      <TableRow key={room.sid}>
                        <TableCell className="font-medium">
                          {room.name}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {room.sid}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{room.numParticipants}</span>
                            {room.maxParticipants > 0 && (
                              <span className="text-muted-foreground">
                                / {room.maxParticipants}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{room.numPublishers}</TableCell>
                        <TableCell>{formatDate(room.creationTime)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              room.activeRecording ? "default" : "secondary"
                            }
                          >
                            {room.activeRecording ? t("recording") : t("notRecording")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirmRoom(room.name)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Call History ─── */}
        <TabsContent value="history">
          {/* Filter Bar */}
          <Card className="mb-4">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t("filters")}</span>
                {filtersApplied && (
                  <Badge variant="secondary" className="text-xs">{t("filterActive")}</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t("ticketField")}</label>
                  <Input
                    placeholder={t("ticketFieldPlaceholder")}
                    value={filterTicketField}
                    onChange={(e) => setFilterTicketField(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t("value")}</label>
                  <Input
                    placeholder={t("valuePlaceholder")}
                    value={filterTicketValue}
                    onChange={(e) => setFilterTicketValue(e.target.value)}
                    className="h-8 text-sm"
                    disabled={!filterTicketField}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t("agentFilter")}</label>
                  <Select value={filterAgent} onValueChange={(v) => setFilterAgent(v === "_all" ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm">
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
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t("statusFilter")}</label>
                  <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === "_all" ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm">
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
                <div className="flex items-end gap-2">
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setLoadingSessions(true);
                      fetchSessions();
                    }}
                  >
                    <Search className="mr-1 h-3.5 w-3.5" />
                    {t("search")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
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
                    <X className="mr-1 h-3.5 w-3.5" />
                    {t("clear")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    {t("callSessions")}
                    {filtersApplied && (
                      <Badge variant="outline" className="text-xs font-normal">
                        {t("results", { count: sessions.length })}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {t("callSessionsDescription")}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLoadingSessions(true);
                    fetchSessions();
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {tc("refresh")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSessions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <History className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    {filtersApplied ? t("noSessionsFiltered") : t("noCallSessions")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {filtersApplied
                      ? t("adjustFilters")
                      : t("sessionsAppearHere")}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("tableRoomName")}</TableHead>
                      <TableHead>{t("tableStatus")}</TableHead>
                      <TableHead>{t("tableAgent")}</TableHead>
                      <TableHead>{t("tableFrom")}</TableHead>
                      <TableHead>{t("tableTicket")}</TableHead>
                      <TableHead>{t("tableDuration")}</TableHead>
                      <TableHead>{t("tableCreated")}</TableHead>
                      <TableHead>Channel ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => {
                      const meta = parseMetadata(session.metadata);
                      const channelId = meta?.channel_id || meta?.channelId || "—";
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
                          <TableCell className="font-medium">
                            {session.room_name}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                session.status === "active"
                                  ? "default"
                                  : session.status === "completed"
                                    ? "secondary"
                                    : session.status === "created"
                                      ? "outline"
                                      : "outline"
                              }
                            >
                              {session.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{session.agent_name || meta?.agent_name || "—"}</TableCell>
                          <TableCell>{session.phone_number || meta?.from_number || "—"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {ticketKeys.length > 0 ? (
                                ticketKeys.slice(0, 3).map((key) => (
                                  <Badge
                                    key={key}
                                    variant="outline"
                                    className="text-xs cursor-pointer hover:bg-primary/10"
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
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                              {ticketKeys.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{ticketKeys.length - 3}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{formatDuration(session.duration_seconds)}</TableCell>
                          <TableCell>
                            {formatDate(session.created_at)}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-muted-foreground">
                              {channelId}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
