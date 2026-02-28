"use client";

import { useEffect, useState, useCallback } from "react";
import {
  agentWorkerApi,
  type WorkerStatusEntry,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  Play,
  Square,
  Cpu,
  CircleDot,
  CircleOff,
} from "lucide-react";
import { toast } from "sonner";

export default function WorkersPage() {
  const [workerStatuses, setWorkerStatuses] = useState<
    Record<string, WorkerStatusEntry>
  >({});
  const [availableWorkers, setAvailableWorkers] = useState<string[]>([]);
  const [workerActionLoading, setWorkerActionLoading] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const loadWorkerStatus = useCallback(async () => {
    try {
      const status = await agentWorkerApi.status();
      setWorkerStatuses(status.workers);
    } catch {
      setWorkerStatuses({});
    }
  }, []);

  const loadAvailableWorkers = useCallback(async () => {
    try {
      const list = await agentWorkerApi.available();
      setAvailableWorkers(list);
    } catch {
      setAvailableWorkers([]);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadWorkerStatus(), loadAvailableWorkers()]).finally(() =>
      setLoading(false)
    );
  }, [loadWorkerStatus, loadAvailableWorkers]);

  const handleSpawn = async (agentName: string) => {
    setWorkerActionLoading(agentName);
    try {
      await agentWorkerApi.spawn(agentName);
      toast.success(`Worker "${agentName}" spawned!`);
      setTimeout(() => loadWorkerStatus(), 1000);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to spawn worker"
      );
    } finally {
      setWorkerActionLoading(null);
    }
  };

  const handleKill = async (agentName: string) => {
    setWorkerActionLoading(agentName);
    try {
      await agentWorkerApi.kill(agentName);
      toast.success(`Worker "${agentName}" killed!`);
      setTimeout(() => loadWorkerStatus(), 1000);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to kill worker"
      );
    } finally {
      setWorkerActionLoading(null);
    }
  };

  const handleRestart = async (agentName: string) => {
    setWorkerActionLoading(agentName);
    try {
      await agentWorkerApi.restart(agentName);
      toast.success(`Worker "${agentName}" restarted!`);
      setTimeout(() => loadWorkerStatus(), 1000);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to restart worker"
      );
    } finally {
      setWorkerActionLoading(null);
    }
  };

  const runningCount = Object.values(workerStatuses).filter(
    (s) => s.running
  ).length;
  const totalCount = Object.keys(workerStatuses).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading workers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Cpu className="h-8 w-8" />
            Workers
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage agent worker processes. Spawn, kill and restart workers.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            loadWorkerStatus();
            loadAvailableWorkers();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Workers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {availableWorkers.length} file{availableWorkers.length !== 1 ? "s" : ""} discovered
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Running</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CircleDot className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{runningCount}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Stopped</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CircleOff className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {totalCount - runningCount}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Worker Processes</CardTitle>
          <CardDescription>
            Workers with auto-start enabled will spawn on API boot and
            auto-restart on crash. Toggle auto-start in the Agent configuration
            page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totalCount > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[110px]">Auto-start</TableHead>
                    <TableHead className="w-[90px]">File</TableHead>
                    <TableHead className="w-[180px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(workerStatuses).map(([name, status]) => (
                    <TableRow key={name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${
                              status.running ? "bg-green-500" : "bg-gray-300"
                            }`}
                          />
                          <span className="font-medium">{name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            status.running ? "default" : "destructive"
                          }
                        >
                          {status.running ? "Running" : "Stopped"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={status.auto_start ? "default" : "outline"}
                        >
                          {status.auto_start ? "On" : "Off"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            status.hasFile ? "secondary" : "destructive"
                          }
                        >
                          {status.hasFile ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!status.running && status.hasFile && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSpawn(name)}
                              disabled={workerActionLoading === name}
                              title="Spawn"
                            >
                              <Play className="mr-1 h-4 w-4" />
                              Spawn
                            </Button>
                          )}
                          {status.running && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRestart(name)}
                                disabled={workerActionLoading === name}
                                title="Restart"
                              >
                                <RefreshCw
                                  className={`mr-1 h-4 w-4 ${
                                    workerActionLoading === name
                                      ? "animate-spin"
                                      : ""
                                  }`}
                                />
                                Restart
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleKill(name)}
                                disabled={workerActionLoading === name}
                                className="text-destructive hover:text-destructive"
                                title="Kill"
                              >
                                <Square className="mr-1 h-4 w-4" />
                                Kill
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No workers discovered. Create a worker file in the{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                src/agent-worker/workers/
              </code>{" "}
              directory and configure an agent with auto-start.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
