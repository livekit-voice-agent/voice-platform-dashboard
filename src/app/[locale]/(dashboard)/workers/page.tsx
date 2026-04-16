"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  agentWorkerApi,
  agentVersionApi,
  type WorkerStatusEntry,
  type AgentVersionSummary,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
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
  Cpu,
  Loader2,
  Play,
  PlayCircle,
  RefreshCw,
  Square,
  CircleStop,
} from "lucide-react";
import { toast } from "sonner";

function StatusBadge({ running }: { running: boolean }) {
  if (running) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Running
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
      Stopped
    </span>
  );
}

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

  const stats = useMemo(() => {
    const total = Object.keys(workerStatuses).length;
    const running = Object.values(workerStatuses).filter((s) => s.running).length;
    return { total, running, stopped: total - running };
  }, [workerStatuses]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => {
              loadWorkerStatus();
              loadAvailableWorkers();
            }}
          >
            <RefreshCw className="h-3 w-3" />
            {tc("refresh")}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50">
              <Cpu className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{t("totalWorkers")}</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{stats.total}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {t("filesDiscovered", { count: availableWorkers.length })}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
              <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{t("running")}</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{stats.running}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50">
              <CircleStop className="h-3.5 w-3.5 text-red-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{t("stopped")}</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{stats.stopped}</p>
        </div>
      </div>

      {/* Table */}
      {stats.total > 0 ? (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-medium">{t("tableAgent")}</TableHead>
                <TableHead className="text-xs font-medium w-[100px]">{t("tableStatus")}</TableHead>
                <TableHead className="text-xs font-medium w-[90px]">{t("tableVersion")}</TableHead>
                <TableHead className="text-xs font-medium w-[100px]">{t("tableAutoStart")}</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(workerStatuses).map(([name, status]) => (
                <TableRow key={name} className="group">
                  <TableCell className="font-medium text-sm">{name}</TableCell>
                  <TableCell>
                    <StatusBadge running={status.running} />
                  </TableCell>
                  <TableCell>
                    {status.running && status.version ? (
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
                        {status.version === "draft" ? t("draft") : `v${status.version}`}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {status.auto_start ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        On
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                        Off
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!status.running && (
                        <button
                          className="p-1 rounded hover:bg-emerald-50"
                          onClick={() => openSpawnDialog(name)}
                          disabled={workerActionLoading === name}
                          title={t("spawn")}
                        >
                          <Play className="h-3.5 w-3.5 text-emerald-600" />
                        </button>
                      )}
                      {status.running && (
                        <button
                          className="p-1 rounded hover:bg-red-50"
                          onClick={() => handleKill(name)}
                          disabled={workerActionLoading === name}
                          title={t("kill")}
                        >
                          <Square className="h-3.5 w-3.5 text-red-400" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t px-4 py-2.5 bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {stats.total} {stats.total === 1 ? "worker" : "workers"}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Cpu className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{t("noWorkersDiscovered")}</p>
        </div>
      )}

      {/* Spawn dialog */}
      <Dialog open={spawnDialogOpen} onOpenChange={setSpawnDialogOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                <Play className="h-3.5 w-3.5 text-emerald-600" />
              </span>
              {t("spawnWorkerTitle", { name: spawnAgent })}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {t("spawnWorkerDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="p-5 space-y-3">
            <label className="text-xs font-medium mb-1 block">{t("configVersion")}</label>
            {/* Version radio cards */}
            <div className="space-y-2">
              <label
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${spawnVersion === "draft" ? "border-foreground/30 bg-muted/40" : "hover:bg-muted/30"}`}
                onClick={() => setSpawnVersion("draft")}
              >
                <input type="radio" name="spawn-version" checked={spawnVersion === "draft"} onChange={() => setSpawnVersion("draft")} className="accent-foreground" />
                <div>
                  <span className="text-xs font-medium">{t("currentDraft")}</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Use current draft configuration</p>
                </div>
              </label>
              {loadingSpawnVersions ? (
                <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("loadingVersions")}
                </div>
              ) : (
                spawnVersions.map((v) => (
                  <label
                    key={v.version}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${spawnVersion === String(v.version) ? "border-foreground/30 bg-muted/40" : "hover:bg-muted/30"}`}
                    onClick={() => setSpawnVersion(String(v.version))}
                  >
                    <input type="radio" name="spawn-version" checked={spawnVersion === String(v.version)} onChange={() => setSpawnVersion(String(v.version))} className="accent-foreground" />
                    <div>
                      <span className="text-xs font-medium">v{v.version}{v.description ? ` — ${v.description}` : ""}</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(v.created_at).toLocaleDateString()}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSpawnDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSpawn}>
              <Play className="h-3 w-3" />
              {spawnVersion === "draft" ? t("spawnDraft") : t("spawnVersion", { version: spawnVersion })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
