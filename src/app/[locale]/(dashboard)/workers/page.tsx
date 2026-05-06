"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  agentWorkerApi,
  agentVersionApi,
  deployApi,
  type AgentVersionSummary,
  type DeployHealthResponse,
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
  CloudUpload,
  Cpu,
  FlaskConical,
  Loader2,
  PlayCircle,
  RefreshCw,
  Server,
  Square,
  CircleStop,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

const truncateText = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max)}...` : text;

export default function WorkersPage() {
  const t = useTranslations("workers");
  const tc = useTranslations("common");
  const router = useRouter();

  const [availableWorkers, setAvailableWorkers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // K8s deployment state
  const [k8sHealth, setK8sHealth] = useState<Record<string, DeployHealthResponse>>({});
  const [k8sActionLoading, setK8sActionLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const k8sIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // K8s deploy version picker dialog
  const [deployK8sDialogOpen, setDeployK8sDialogOpen] = useState(false);
  const [deployK8sAgent, setDeployK8sAgent] = useState("");
  const [deployK8sVersion, setDeployK8sVersion] = useState<string>("draft");
  const [deployK8sVersions, setDeployK8sVersions] = useState<AgentVersionSummary[]>([]);
  const [loadingDeployK8sVersions, setLoadingDeployK8sVersions] = useState(false);

  // Test version picker dialog
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testDialogAgent, setTestDialogAgent] = useState("");
  const [testDialogVersion, setTestDialogVersion] = useState<string>("draft");
  const [testDialogVersions, setTestDialogVersions] = useState<AgentVersionSummary[]>([]);
  const [loadingTestVersions, setLoadingTestVersions] = useState(false);

  const loadAvailableWorkers = useCallback(async () => {
    try {
      const list = await agentWorkerApi.available();
      setAvailableWorkers(list);
    } catch {
      setAvailableWorkers([]);
    }
  }, []);

  useEffect(() => {
    loadAvailableWorkers().finally(() => setLoading(false));
  }, [loadAvailableWorkers]);

  const loadK8sHealth = useCallback(async (agents: string[]) => {
    if (agents.length === 0) return;
    const results = await Promise.allSettled(
      agents.map((name) => deployApi.getHealth(name).then((h) => ({ name, h })))
    );
    const updates: Record<string, DeployHealthResponse> = {};
    for (const r of results) {
      if (r.status === "fulfilled") updates[r.value.name] = r.value.h;
    }
    setK8sHealth((prev) => ({ ...prev, ...updates }));
  }, []);

  useEffect(() => {
    if (availableWorkers.length === 0) return;
    loadK8sHealth(availableWorkers);
    k8sIntervalRef.current = setInterval(() => loadK8sHealth(availableWorkers), 10000);
    return () => {
      if (k8sIntervalRef.current) clearInterval(k8sIntervalRef.current);
    };
  }, [availableWorkers, loadK8sHealth]);

  const handleDeployToK8s = async (agentName: string) => {
    setK8sActionLoading(agentName);
    try {
      const version = deployK8sVersion === "draft" ? undefined : Number(deployK8sVersion);
      await deployApi.deployToK8s(agentName, version);
      toast.success(t("toastK8sDeployed", { name: agentName }));
      setTimeout(() => loadK8sHealth([agentName]), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toastK8sDeployError"));
    } finally {
      setK8sActionLoading(null);
    }
  };

  const openDeployK8sDialog = async (agentName: string) => {
    setDeployK8sAgent(agentName);
    setDeployK8sVersion("draft");
    setDeployK8sDialogOpen(true);
    setLoadingDeployK8sVersions(true);
    try {
      const versions = await agentVersionApi.list(agentName);
      setDeployK8sVersions(versions);
    } catch {
      setDeployK8sVersions([]);
    } finally {
      setLoadingDeployK8sVersions(false);
    }
  };

  const openTestDialog = async (agentName: string) => {
    setTestDialogAgent(agentName);
    setTestDialogVersion("draft");
    setTestDialogOpen(true);
    setLoadingTestVersions(true);
    try {
      const versions = await agentVersionApi.list(agentName);
      setTestDialogVersions(versions);
    } catch {
      setTestDialogVersions([]);
    } finally {
      setLoadingTestVersions(false);
    }
  };

  const confirmTest = () => {
    setTestDialogOpen(false);
    const versionParam = testDialogVersion === "draft" ? "" : `&version=${testDialogVersion}`;
    router.push(`/agent/test?agent=${encodeURIComponent(testDialogAgent)}${versionParam}` as any);
  };

  const handleStopK8s = async (agentName: string) => {
    setK8sActionLoading(agentName);
    try {
      await deployApi.stopDeployment(agentName);
      toast.success(t("toastK8sStopped", { name: agentName }));
      setTimeout(() => loadK8sHealth([agentName]), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toastK8sStopError"));
    } finally {
      setK8sActionLoading(null);
    }
  };

  const handleDeleteDeployment = async (agentName: string) => {
    setDeleteLoading(agentName);
    try {
      await deployApi.deleteDeployment(agentName);
      toast.success(t("toastDeploymentDeleted", { name: agentName }));
      setK8sHealth((prev) => {
        const next = { ...prev };
        delete next[agentName];
        return next;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toastDeploymentDeleteError"));
    } finally {
      setDeleteLoading(null);
    }
  };

  // Stats based on K8s deployments
  const stats = useMemo(() => {
    const total = availableWorkers.length;
    const running = Object.values(k8sHealth).filter((h) => h.k8s?.status === "running").length;
    const stopped = Object.values(k8sHealth).filter((h) => h.status === "STOPPED").length;
    return { total, running, stopped };
  }, [availableWorkers, k8sHealth]);

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
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => loadAvailableWorkers()}
        >
          <RefreshCw className="h-3 w-3" />
          {tc("refresh")}
        </Button>
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
          <p className="text-[11px] text-muted-foreground mt-0.5">{t("filesDiscovered", { count: availableWorkers.length })}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
              <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{t("running")}</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{stats.running}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">K8s running</p>
        </div>
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-orange-50">
              <CircleStop className="h-3.5 w-3.5 text-orange-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{t("stopped")}</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{stats.stopped}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">K8s stopped</p>
        </div>
      </div>

      {/* Deployments Table */}
      {availableWorkers.length > 0 ? (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-medium">{t("tableAgent")}</TableHead>
                <TableHead className="text-xs font-medium w-[120px]">{t("k8sStatus")}</TableHead>
                <TableHead className="text-xs font-medium w-[160px]">{t("k8sImage")}</TableHead>
                <TableHead className="w-[220px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {availableWorkers.map((name) => {
                const health = k8sHealth[name];
                const k8s = health?.k8s;
                const isStopped = !k8s && health?.status === "STOPPED";
                const isDeployed = !!k8s;
                const isLoading = k8sActionLoading === name;
                const isDeleting = deleteLoading === name;
                return (
                  <TableRow
                    key={name}
                    className="group cursor-pointer hover:bg-muted/50"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button")) return;
                      router.push(`/agent?agent=${encodeURIComponent(name)}&tab=deploy` as any);
                    }}
                  >
                    <TableCell className="font-medium text-sm">{name}</TableCell>
                    <TableCell>
                      {k8s ? (
                        (() => {
                          const s = k8s.status ?? "deployed";
                          return (
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                              s === "running"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : s === "pending"
                                ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                                : "border-blue-200 bg-blue-50 text-blue-700"
                            }`}>
                              {s === "running" && (
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              )}
                              {s}
                            </span>
                          );
                        })()
                      ) : isStopped ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-600">
                          <CircleStop className="h-2.5 w-2.5" />
                          stopped
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                          {t("k8sNotDeployed")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {k8s?.image ? (
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground truncate max-w-[150px]" title={k8s.image}>
                          {k8s.image.split("/").pop()}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-violet-200 bg-card text-xs text-violet-600 hover:bg-violet-50 hover:border-violet-400 transition-colors"
                          onClick={() => openTestDialog(name)}
                          title={t("testLocal")}
                        >
                          <FlaskConical className="h-3.5 w-3.5" />
                          {t("testLocal")}
                        </button>
                        {!isDeployed && !isStopped ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-[11px]"
                            onClick={() => openDeployK8sDialog(name)}
                            disabled={isLoading}
                          >
                            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudUpload className="h-3 w-3" />}
                            {t("deployToK8s")}
                          </Button>
                        ) : isStopped ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-[11px] text-orange-600 hover:text-orange-700 hover:border-orange-200"
                            onClick={() => openDeployK8sDialog(name)}
                            disabled={isLoading}
                          >
                            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudUpload className="h-3 w-3" />}
                            {t("redeployToK8s")}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-[11px] text-red-600 hover:text-red-600 hover:border-red-200"
                            onClick={() => handleStopK8s(name)}
                            disabled={isLoading || isDeleting}
                          >
                            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
                            {t("stopK8s")}
                          </Button>
                        )}
                        {k8s && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteDeployment(name)}
                            disabled={isDeleting || isLoading}
                            title={t("deleteDeployment")}
                          >
                            {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="border-t px-4 py-2.5 bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {availableWorkers.length} {availableWorkers.length === 1 ? "agent" : "agents"}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Server className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{t("noAgentsForK8s")}</p>
        </div>
      )}

      {/* Deploy to K8s version picker dialog */}
      <Dialog open={deployK8sDialogOpen} onOpenChange={setDeployK8sDialogOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                <CloudUpload className="h-3.5 w-3.5 text-blue-600" />
              </span>
              Deploy {deployK8sAgent} to Kubernetes
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Choose which config version the agent will use in the cluster.
            </DialogDescription>
          </DialogHeader>
          <div className="p-5 space-y-3">
            <label className="text-xs font-medium mb-1 block">{t("configVersion")}</label>
            <div className="space-y-2">
              <label
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors overflow-hidden ${deployK8sVersion === "draft" ? "border-foreground/30 bg-muted/40" : "hover:bg-muted/30"}`}
                onClick={() => setDeployK8sVersion("draft")}
              >
                <input type="radio" name="deploy-k8s-version" checked={deployK8sVersion === "draft"} onChange={() => setDeployK8sVersion("draft")} className="accent-foreground" />
                <div className="min-w-0 overflow-hidden">
                  <span className="text-xs font-medium">{t("currentDraft")}</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Auto-publish current draft on deploy</p>
                </div>
              </label>
              {loadingDeployK8sVersions ? (
                <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("loadingVersions")}
                </div>
              ) : (
                deployK8sVersions.map((v) => (
                  <label
                    key={v.version}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors overflow-hidden ${deployK8sVersion === String(v.version) ? "border-foreground/30 bg-muted/40" : "hover:bg-muted/30"}`}
                    onClick={() => setDeployK8sVersion(String(v.version))}
                  >
                    <input type="radio" name="deploy-k8s-version" checked={deployK8sVersion === String(v.version)} onChange={() => setDeployK8sVersion(String(v.version))} className="accent-foreground" />
                    <div className="min-w-0">
                      <span className="text-xs font-medium">v{v.version}</span>
                      {v.description && <p className="text-[11px] text-muted-foreground mt-0.5">{truncateText(v.description, 40)}</p>}
                      <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(v.created_at).toLocaleDateString()}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDeployK8sDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setDeployK8sDialogOpen(false); handleDeployToK8s(deployK8sAgent); }}>
              <CloudUpload className="h-3 w-3" />
              {deployK8sVersion === "draft" ? "Deploy with draft" : `Deploy v${deployK8sVersion}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test version picker dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
                <FlaskConical className="h-3.5 w-3.5 text-violet-600" />
              </span>
              Test {testDialogAgent}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Choose which config version to use in the test session.
            </DialogDescription>
          </DialogHeader>
          <div className="p-5 space-y-3">
            <label className="text-xs font-medium mb-1 block">{t("configVersion")}</label>
            <div className="space-y-2">
              <label
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors overflow-hidden ${testDialogVersion === "draft" ? "border-foreground/30 bg-muted/40" : "hover:bg-muted/30"}`}
                onClick={() => setTestDialogVersion("draft")}
              >
                <input type="radio" name="test-version" checked={testDialogVersion === "draft"} onChange={() => setTestDialogVersion("draft")} className="accent-foreground" />
                <div className="min-w-0 overflow-hidden">
                  <span className="text-xs font-medium">{t("currentDraft")}</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Use current draft configuration</p>
                </div>
              </label>
              {loadingTestVersions ? (
                <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("loadingVersions")}
                </div>
              ) : (
                testDialogVersions.map((v) => (
                  <label
                    key={v.version}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors overflow-hidden ${testDialogVersion === String(v.version) ? "border-foreground/30 bg-muted/40" : "hover:bg-muted/30"}`}
                    onClick={() => setTestDialogVersion(String(v.version))}
                  >
                    <input type="radio" name="test-version" checked={testDialogVersion === String(v.version)} onChange={() => setTestDialogVersion(String(v.version))} className="accent-foreground" />
                    <div className="min-w-0">
                      <span className="text-xs font-medium">v{v.version}</span>
                      {v.description && <p className="text-[11px] text-muted-foreground mt-0.5">{truncateText(v.description, 40)}</p>}
                      <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(v.created_at).toLocaleDateString()}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setTestDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button size="sm" className="h-8 gap-1.5 text-xs bg-violet-600 hover:bg-violet-700" onClick={confirmTest}>
              <FlaskConical className="h-3 w-3" />
              {testDialogVersion === "draft" ? "Test with draft" : `Test v${testDialogVersion}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
