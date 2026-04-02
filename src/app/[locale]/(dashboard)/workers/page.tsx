"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  agentWorkerApi,
  agentVersionApi,
  type WorkerStatusEntry,
  type AgentVersionSummary,
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
import { Label } from "@/components/ui/label";
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
  const t = useTranslations("workers");
  const tc = useTranslations("common");
  const [workerStatuses, setWorkerStatuses] = useState<
    Record<string, WorkerStatusEntry>
  >({});
  const [availableWorkers, setAvailableWorkers] = useState<string[]>([]);
  const [workerActionLoading, setWorkerActionLoading] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  // Spawn dialog state
  const [spawnDialogOpen, setSpawnDialogOpen] = useState(false);
  const [spawnAgent, setSpawnAgent] = useState<string>("");
  const [spawnVersion, setSpawnVersion] = useState<string>("draft");
  const [spawnVersions, setSpawnVersions] = useState<AgentVersionSummary[]>([]);
  const [loadingSpawnVersions, setLoadingSpawnVersions] = useState(false);

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

  const openSpawnDialog = async (agentName: string) => {
    setSpawnAgent(agentName);
    setSpawnVersion("draft");
    setSpawnDialogOpen(true);
    setLoadingSpawnVersions(true);
    try {
      const versions = await agentVersionApi.list(agentName);
      setSpawnVersions(versions);
    } catch {
      setSpawnVersions([]);
    } finally {
      setLoadingSpawnVersions(false);
    }
  };

  const handleSpawn = async () => {
    setSpawnDialogOpen(false);
    setWorkerActionLoading(spawnAgent);
    try {
      const version = spawnVersion === "draft" ? undefined : spawnVersion;
      await agentWorkerApi.spawn(spawnAgent, version);
      toast.success(t("toastSpawned", { name: spawnAgent, version: spawnVersion === "draft" ? "draft" : `v${spawnVersion}` }));
      setTimeout(() => loadWorkerStatus(), 1000);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toastSpawnError")
      );
    } finally {
      setWorkerActionLoading(null);
    }
  };

  const handleKill = async (agentName: string) => {
    setWorkerActionLoading(agentName);
    try {
      await agentWorkerApi.kill(agentName);
      toast.success(t("toastKilled", { name: agentName }));
      setTimeout(() => loadWorkerStatus(), 1000);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toastKillError")
      );
    } finally {
      setWorkerActionLoading(null);
    }
  };

  const handleRestart = async (agentName: string) => {
    setWorkerActionLoading(agentName);
    try {
      await agentWorkerApi.restart(agentName);
      toast.success(t("toastRestarted", { name: agentName }));
      setTimeout(() => loadWorkerStatus(), 1000);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toastRestartError")
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
        <p className="text-muted-foreground">{t("loadingWorkers")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3 sm:text-3xl">
            <Cpu className="h-7 w-7 sm:h-8 sm:w-8" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("description")}
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
          {tc("refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("totalWorkers")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("filesDiscovered", { count: availableWorkers.length })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("running")}</CardDescription>
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
            <CardDescription>{t("stopped")}</CardDescription>
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t("workerProcesses")}</CardTitle>
          <CardDescription>
            {t("workerProcessesDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totalCount > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("tableAgent")}</TableHead>
                    <TableHead className="w-[100px]">{t("tableStatus")}</TableHead>
                    <TableHead className="w-[90px]">{t("tableVersion")}</TableHead>
                    <TableHead className="w-[110px]">{t("tableAutoStart")}</TableHead>
                    <TableHead className="w-[180px] text-right">
                      {t("tableActions")}
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
                          {status.running ? t("statusRunning") : t("statusStopped")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {status.running && status.version ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {status.version === "draft" ? t("draft") : `v${status.version}`}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={status.auto_start ? "default" : "outline"}
                        >
                          {status.auto_start ? t("autoStartOn") : t("autoStartOff")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!status.running && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openSpawnDialog(name)}
                              disabled={workerActionLoading === name}
                              title={t("spawn")}
                            >
                              <Play className="mr-1 h-4 w-4" />
                              {t("spawn")}
                            </Button>
                          )}
                          {status.running && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleKill(name)}
                                disabled={workerActionLoading === name}
                                className="text-destructive hover:text-destructive"
                                title={t("kill")}
                              >
                                <Square className="mr-1 h-4 w-4" />
                                {t("kill")}
                              </Button>
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
              {t("noWorkersDiscovered")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Spawn dialog with version selector */}
      <Dialog open={spawnDialogOpen} onOpenChange={setSpawnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("spawnWorkerTitle", { name: spawnAgent })}</DialogTitle>
            <DialogDescription>
              {t("spawnWorkerDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("configVersion")}</Label>
            <Select value={spawnVersion} onValueChange={setSpawnVersion}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectVersion")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">
                  {t("currentDraft")}
                </SelectItem>
                {loadingSpawnVersions ? (
                  <SelectItem value="_loading" disabled>
                    {t("loadingVersions")}
                  </SelectItem>
                ) : (
                  spawnVersions.map((v) => (
                    <SelectItem key={v.version} value={String(v.version)}>
                      v{v.version}{v.description ? ` — ${v.description}` : ""}{" "}
                      ({new Date(v.created_at).toLocaleDateString()})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpawnDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleSpawn}>
              <Play className="h-4 w-4 mr-1" />
              {spawnVersion === "draft" ? t("spawnDraft") : t("spawnVersion", { version: spawnVersion })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
