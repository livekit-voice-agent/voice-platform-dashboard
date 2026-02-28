"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  agentConfigApi,
  deployApi,
  type AgentDeployment,
  type DeploymentStatus,
  type DeployConfig,
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
} from "lucide-react";
import { toast } from "sonner";

function StatusBadge({ status }: { status: DeploymentStatus }) {
  const config: Record<
    DeploymentStatus,
    {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
      icon?: React.ReactNode;
    }
  > = {
    BUILDING: {
      label: "Building",
      variant: "secondary",
      icon: <Loader2 className="mr-1 h-3 w-3 animate-spin" />,
    },
    PUSHING: {
      label: "Pushing",
      variant: "secondary",
      icon: <Loader2 className="mr-1 h-3 w-3 animate-spin" />,
    },
    DEPLOYING: {
      label: "Deploying",
      variant: "secondary",
      icon: <Loader2 className="mr-1 h-3 w-3 animate-spin" />,
    },
    RUNNING: {
      label: "Running",
      variant: "default",
      icon: <Activity className="mr-1 h-3 w-3" />,
    },
    FAILED: {
      label: "Failed",
      variant: "destructive",
      icon: <AlertTriangle className="mr-1 h-3 w-3" />,
    },
    STOPPED: {
      label: "Stopped",
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
  const [agents, setAgents] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [deployments, setDeployments] = useState<AgentDeployment[]>([]);
  const [loading, setLoading] = useState(false);
  const [logsDialog, setLogsDialog] = useState<AgentDeployment | null>(null);

  // Config dialog
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [deployConfig, setDeployConfig] = useState<DeployConfig | null>(null);
  const [configForm, setConfigForm] = useState({
    registry_url: "",
    registry_namespace: "",
    deploy_controller_url: "",
  });
  const [savingConfig, setSavingConfig] = useState(false);

  const loadAgents = useCallback(async () => {
    try {
      const list = await agentConfigApi.listAgents();
      setAgents(list);
      if (list.length > 0 && !selectedAgent) {
        setSelectedAgent(list[0]);
      }
    } catch {
      toast.error("Failed to load agents");
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
        toast.error("Failed to load deployments");
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
      // Config not yet created — that's ok
    }
  }, []);

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
      toast.success("Deploy configuration saved!");
      setConfigDialogOpen(false);
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleStopDeployment = async (agentName: string) => {
    try {
      await deployApi.stopDeployment(agentName);
      toast.success("Deployment stopped");
      await loadDeployments(agentName);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to stop deployment"
      );
    }
  };

  // Summary stats
  const totalDeploys = deployments.length;
  const runningDeploys = deployments.filter(
    (d) => d.status === "RUNNING"
  ).length;
  const failedDeploys = deployments.filter(
    (d) => d.status === "FAILED"
  ).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/agent">
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Rocket className="h-8 w-8" />
              Deployment History
            </h1>
          </div>
          <p className="text-muted-foreground ml-11">
            View all deployments, versions, and build logs.
          </p>
        </div>
        <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="mr-2 h-4 w-4" />
              Deploy Config
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deploy Configuration</DialogTitle>
              <DialogDescription>
                Configure Docker registry and backend-deploy-controller URL.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="registryUrl">Registry URL</Label>
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
                <Label htmlFor="registryNamespace">Registry Namespace</Label>
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
                  Backend Deploy Controller URL
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
                {savingConfig ? "Saving..." : "Save Configuration"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Agent Selector + Stats */}
      <div className="flex items-center gap-4">
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select an agent" />
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
          Refresh
        </Button>

        <div className="flex items-center gap-4 ml-auto text-sm">
          <span className="text-muted-foreground">
            Total: <strong>{totalDeploys}</strong>
          </span>
          <span className="text-green-600">
            Running: <strong>{runningDeploys}</strong>
          </span>
          <span className="text-red-600">
            Failed: <strong>{failedDeploys}</strong>
          </span>
        </div>
      </div>

      {/* Deployments Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Deployments</CardTitle>
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
                    <TableHead className="w-[80px]">Version</TableHead>
                    <TableHead>Image Tag</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[120px]">Pod</TableHead>
                    <TableHead className="w-[160px]">Created</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
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
                ? `No deployments found for "${selectedAgent}".`
                : "Select an agent to view deployments."}
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
              Build Logs — {logsDialog?.agent_name} v{logsDialog?.version}
            </DialogTitle>
            <DialogDescription>
              {logsDialog?.error_message && (
                <span className="text-destructive">
                  Error: {logsDialog.error_message}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh]">
            <pre className="text-xs font-mono bg-muted p-4 rounded-md whitespace-pre-wrap">
              {logsDialog?.build_logs || "No build logs available."}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
