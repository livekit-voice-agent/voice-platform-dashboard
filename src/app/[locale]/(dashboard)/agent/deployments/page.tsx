"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  agentConfigApi,
  deployApi,
  type AgentDeployment,
  type DeploymentStatus,
  type DeployConfig,
  type DeployHealthResponse,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Rocket,
  Activity,
  Square,
  AlertTriangle,
  Loader2,
  Settings2,
  RefreshCw,
  ArrowLeft,
  FileText,
  CloudUpload,
  Server,
} from "lucide-react";
import { toast } from "sonner";

function StatusBadge({ status }: { status: DeploymentStatus }) {
  const t = useTranslations("deployments");
  const config: Record<
    DeploymentStatus,
    {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
      icon?: React.ReactNode;
    }
  > = {
    BUILDING: {
      label: t("statusBuilding"),
      variant: "secondary",
      icon: <Loader2 className="mr-1 h-3 w-3 animate-spin" />,
    },
    PUSHING: {
      label: t("statusPushing"),
      variant: "secondary",
      icon: <Loader2 className="mr-1 h-3 w-3 animate-spin" />,
    },
    DEPLOYING: {
      label: t("statusDeploying"),
      variant: "secondary",
      icon: <Loader2 className="mr-1 h-3 w-3 animate-spin" />,
    },
    RUNNING: {
      label: t("statusRunning"),
      variant: "default",
      icon: <Activity className="mr-1 h-3 w-3" />,
    },
    FAILED: {
      label: t("statusFailed"),
      variant: "destructive",
      icon: <AlertTriangle className="mr-1 h-3 w-3" />,
    },
    STOPPED: {
      label: t("statusStopped"),
      variant: "outline",
      icon: <Square className="mr-1 h-3 w-3" />,
    },
  };

  const c = config[status];
  return (
    <Badge variant={c.variant} className="text-xs">
      {c.icon}
      {c.label}
    </Badge>
  );
}

export default function DeploymentsPage() {
  const t = useTranslations("deployments");
  const tc = useTranslations("common");
  const [agents, setAgents] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [deployments, setDeployments] = useState<AgentDeployment[]>([]);
  const [loading, setLoading] = useState(false);
  const [logsDialog, setLogsDialog] = useState<AgentDeployment | null>(null);

  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [deployConfig, setDeployConfig] = useState<DeployConfig | null>(null);
  const [configForm, setConfigForm] = useState({
    registry_url: "",
    registry_namespace: "",
    deploy_controller_url: "",
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // K8s health monitoring
  const [k8sHealth, setK8sHealth] = useState<DeployHealthResponse | null>(null);
  const [deployingToK8s, setDeployingToK8s] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      const list = await agentConfigApi.listAgents();
      setAgents(list);
      if (list.length > 0 && !selectedAgent) {
        setSelectedAgent(list[0]);
      }
    } catch {
      toast.error(t("toastLoadAgentsError"));
    }
  }, [selectedAgent]);

  const loadDeployments = useCallback(
    async (agentName: string) => {
      if (!agentName) return;
      setLoading(true);
      try {
        const result = await deployApi.getDeployments(agentName);
        setDeployments(result);
      } catch {
        setDeployments([]);
        toast.error(t("toastLoadDeploymentsError"));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadConfig = useCallback(async () => {
    try {
      const config = await deployApi.getConfig();
      setDeployConfig(config);
      setConfigForm({
        registry_url: config.registry_url,
        registry_namespace: config.registry_namespace,
        deploy_controller_url: config.deploy_controller_url,
      });
    } catch {

    }
  }, []);

  const pollK8sHealth = useCallback(async (agentName: string) => {
    if (!agentName) return;
    try {
      const health = await deployApi.getHealth(agentName);
      setK8sHealth(health);
    } catch {
      // silently ignore polling errors
    }
  }, []);

  // Start/stop polling when selected agent changes
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (selectedAgent) {
      pollK8sHealth(selectedAgent);
      pollingRef.current = setInterval(() => {
        pollK8sHealth(selectedAgent);
      }, 10_000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedAgent, pollK8sHealth]);

  useEffect(() => {
    loadAgents();
    loadConfig();
  }, [loadAgents, loadConfig]);

  useEffect(() => {
    if (selectedAgent) {
      loadDeployments(selectedAgent);
    }
  }, [selectedAgent, loadDeployments]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const updated = await deployApi.updateConfig(configForm);
      setDeployConfig(updated);
      toast.success(t("toastConfigSaved"));
      setConfigDialogOpen(false);
    } catch {
      toast.error(t("toastConfigSaveError"));
    } finally {
      setSavingConfig(false);
    }
  };

  const handleStopDeployment = async (agentName: string) => {
    try {
      await deployApi.stopDeployment(agentName);
      toast.success(t("toastDeploymentStopped"));
      await loadDeployments(agentName);
      await pollK8sHealth(agentName);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toastStopError")
      );
    }
  };

  const handleDeployToK8s = async (agentName: string) => {
    setDeployingToK8s(true);
    try {
      await deployApi.deployToK8s(agentName);
      toast.success(t("toastK8sDeployed"));
      await loadDeployments(agentName);
      await pollK8sHealth(agentName);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toastK8sDeployError")
      );
    } finally {
      setDeployingToK8s(false);
    }
  };

  const totalDeploys = deployments.length;
  const runningDeploys = deployments.filter(
    (d) => d.status === "RUNNING"
  ).length;
  const failedDeploys = deployments.filter(
    (d) => d.status === "FAILED"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/agent">
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3 sm:text-3xl">
              <Rocket className="h-7 w-7 sm:h-8 sm:w-8" />
              {t("title")}
            </h1>
          </div>
          <p className="text-muted-foreground ml-11 text-sm">
            {t("description")}
          </p>
        </div>
        <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="mr-2 h-4 w-4" />
              {t("deployConfig")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("deployConfigTitle")}</DialogTitle>
              <DialogDescription>
                {t("deployConfigDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="registryUrl">{t("registryUrl")}</Label>
                <Input
                  id="registryUrl"
                  value={configForm.registry_url}
                  onChange={(e) =>
                    setConfigForm((f) => ({
                      ...f,
                      registry_url: e.target.value,
                    }))
                  }
                  placeholder="docker.io"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registryNamespace">{t("registryNamespace")}</Label>
                <Input
                  id="registryNamespace"
                  value={configForm.registry_namespace}
                  onChange={(e) =>
                    setConfigForm((f) => ({
                      ...f,
                      registry_namespace: e.target.value,
                    }))
                  }
                  placeholder="your-namespace"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deployControllerUrl">
                  {t("backendUrl")}
                </Label>
                <Input
                  id="deployControllerUrl"
                  value={configForm.deploy_controller_url}
                  onChange={(e) =>
                    setConfigForm((f) => ({
                      ...f,
                      deploy_controller_url: e.target.value,
                    }))
                  }
                  placeholder="http://localhost:4000"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSaveConfig} disabled={savingConfig}>
                {savingConfig ? tc("saving") : t("saveConfig")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Agent Selector + Stats */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder={t("selectAnAgent")} />
          </SelectTrigger>
          <SelectContent>
            {agents.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadDeployments(selectedAgent)}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {tc("refresh")}
        </Button>

        <div className="flex items-center gap-4 ml-auto text-sm">
          <span className="text-muted-foreground">
            {t("totalLabel")} <strong>{totalDeploys}</strong>
          </span>
          <span className="text-green-600">
            {t("runningLabel")} <strong>{runningDeploys}</strong>
          </span>
          <span className="text-red-600">
            {t("failedLabel")} <strong>{failedDeploys}</strong>
          </span>
        </div>
      </div>

      {/* K8s Status Card */}
      {selectedAgent && k8sHealth && (
        <Card className="border-dashed">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="h-4 w-4" />
              {t("k8sStatus")}
              {k8sHealth.healthy ? (
                <Badge variant="default" className="text-xs">
                  <Activity className="mr-1 h-3 w-3" />
                  {t("k8sStatusRunning")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {t("k8sStatusUnknown")}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-xs text-muted-foreground flex flex-wrap gap-4">
            {k8sHealth.pod_name && (
              <span>
                Pod: <code>{k8sHealth.pod_name}</code>
              </span>
            )}
            {k8sHealth.version && (
              <span>Version: v{k8sHealth.version}</span>
            )}
            {k8sHealth.k8s?.status && (
              <span>
                K8s: <strong>{k8sHealth.k8s.status}</strong>
              </span>
            )}
            {k8sHealth.message && (
              <span className="italic">{k8sHealth.message}</span>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deployments Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("deploymentsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : deployments.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">{t("tableVersion")}</TableHead>
                    <TableHead>{t("tableImageTag")}</TableHead>
                    <TableHead className="w-[120px]">{t("tableStatus")}</TableHead>
                    <TableHead className="w-[120px]">{t("tablePod")}</TableHead>
                    <TableHead className="w-[160px]">{t("tableCreated")}</TableHead>
                    <TableHead className="w-[160px]">{t("tableActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deployments.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Badge variant="secondary">v{d.version}</Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs text-muted-foreground truncate max-w-[250px] block">
                          {d.image_tag}
                        </code>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={d.status} />
                      </TableCell>
                      <TableCell>
                        {d.pod_name ? (
                          <code className="text-xs text-muted-foreground">
                            {d.pod_name}
                          </code>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {/* Deploy to K8s — available for RUNNING (built+pushed) deployments */}
                          {d.status === "RUNNING" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={deployingToK8s}
                              onClick={() => handleDeployToK8s(d.agent_name)}
                              title={t("deployToK8s")}
                            >
                              {deployingToK8s ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CloudUpload className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                          {d.status === "RUNNING" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-destructive hover:text-destructive"
                              onClick={() =>
                                handleStopDeployment(d.agent_name)
                              }
                            >
                              <Square className="h-3 w-3" />
                            </Button>
                          )}
                          {d.build_logs && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => setLogsDialog(d)}
                            >
                              <FileText className="h-3 w-3" />
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
              {selectedAgent
                ? t("noDeploymentsForAgent", { agent: selectedAgent })
                : t("selectAgentPrompt")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Build Logs Dialog */}
      <Dialog
        open={!!logsDialog}
        onOpenChange={(open) => !open && setLogsDialog(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {t("buildLogsTitle", { name: logsDialog?.agent_name ?? "", version: logsDialog?.version ?? 0 })}
            </DialogTitle>
            <DialogDescription>
              {logsDialog?.error_message && (
                <span className="text-destructive">
                  {t("errorPrefix", { message: logsDialog.error_message })}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh]">
            <pre className="text-xs font-mono bg-muted p-4 rounded-md whitespace-pre-wrap">
              {logsDialog?.build_logs || t("noBuildLogs")}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
