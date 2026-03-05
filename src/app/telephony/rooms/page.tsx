"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  roomApi,
  type LiveKitRoom,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DoorOpen,
  History,
  Radio,
  Trash2,
  Loader2,
  RefreshCw,
  Users,
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

export default function RoomsPage() {
  const [liveRooms, setLiveRooms] = useState<LiveKitRoom[]>([]);
  const [sessions, setSessions] = useState<CallSession[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [deleteConfirmRoom, setDeleteConfirmRoom] = useState<string | null>(
    null
  );
  const [activeTab, setActiveTab] = useState("live");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLiveRooms = useCallback(async () => {
    try {
      const data = await roomApi.listLive();
      setLiveRooms(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load live rooms");
    } finally {
      setLoadingLive(false);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await roomApi.listSessions();
      setSessions(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load call sessions");
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveRooms();
    fetchSessions();
  }, [fetchLiveRooms, fetchSessions]);

  // Auto-refresh live rooms every 10s when on the Live tab
  useEffect(() => {
    if (activeTab === "live") {
      intervalRef.current = setInterval(fetchLiveRooms, 10000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeTab, fetchLiveRooms]);

  const handleDeleteRoom = async (roomName: string) => {
    try {
      await roomApi.deleteLive(roomName);
      toast.success(`Room "${roomName}" deleted`);
      setDeleteConfirmRoom(null);
      fetchLiveRooms();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete room");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rooms</h1>
          <p className="text-muted-foreground">
            View live LiveKit rooms and call session history.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="live" className="gap-2">
            <Radio className="h-4 w-4" />
            Live Rooms
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Call History
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
                    Active Rooms
                  </CardTitle>
                  <CardDescription>
                    Rooms currently active on LiveKit. Auto-refreshes every 10
                    seconds.
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
                  Refresh
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
                  <p className="text-muted-foreground">No active rooms</p>
                  <p className="text-sm text-muted-foreground">
                    Rooms appear here when participants join.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room Name</TableHead>
                      <TableHead>SID</TableHead>
                      <TableHead>Participants</TableHead>
                      <TableHead>Publishers</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Recording</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
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
                            {room.activeRecording ? "Recording" : "No"}
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Call Sessions
                  </CardTitle>
                  <CardDescription>
                    Recent call sessions stored in the database.
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
                  Refresh
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
                  <p className="text-muted-foreground">No call sessions</p>
                  <p className="text-sm text-muted-foreground">
                    Sessions appear here when rooms are created via the API.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => {
                      const meta = parseMetadata(session.metadata);
                      return (
                        <TableRow key={session.id}>
                          <TableCell className="font-medium">
                            {session.room_name}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                session.status === "created"
                                  ? "default"
                                  : session.status === "completed"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {session.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{meta?.agent_name || "—"}</TableCell>
                          <TableCell>{meta?.from_number || "—"}</TableCell>
                          <TableCell>{meta?.to_number || "—"}</TableCell>
                          <TableCell>
                            {formatDate(session.created_at)}
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
            <DialogTitle>Delete Room</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete room &quot;{deleteConfirmRoom}
              &quot;? All participants will be disconnected immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmRoom(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteConfirmRoom && handleDeleteRoom(deleteConfirmRoom)
              }
            >
              Delete Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
