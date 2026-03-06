"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  agentConfigApi,
  agentWorkerApi,
  agentKnowledgeApi,
  agentToolsApi,
  roomApi,
  deployApi,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type AgentKnowledgeItem,
  type AgentTool,
  type ToolType,
  type RuntimeConfig,
  type AgentDeployment,
  type DeploymentStatus,
  type DeployHealthResponse,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  Save,
  Bot,
  PhoneCall,
  ExternalLink,
  Copy,
  Check,
  Upload,
  Trash2,
  FileText,
  BookOpen,
  AlertTriangle,
  Plus,
  ChevronsUpDown,
  RefreshCw,
  Settings2,
  Mic,
  Timer,
  MessageSquare,
  Rocket,
  Square,
  Activity,
  Loader2,
  History,
  Wrench,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Globe,
  Braces,
  List,
  Code,
  PlusCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEFAULT_AGENT = "captador-agent";

function DeployStatusBadge({ status }: { status: DeploymentStatus }) {
  const config: Record<
    DeploymentStatus,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon?: React.ReactNode }
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

export default function AgentPage() {
  const [agents, setAgents] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState(DEFAULT_AGENT);
  const [newAgentName, setNewAgentName] = useState("");
  const [showNewAgentInput, setShowNewAgentInput] = useState(false);

  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [availableWorkers, setAvailableWorkers] = useState<string[]>([]);

  const [autoStart, setAutoStart] = useState(false);

  const [instructionsExpanded, setInstructionsExpanded] = useState(false);

  const [restarting, setRestarting] = useState(false);

  const ELEVENLABS_VOICES = [
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", desc: "Calm, warm female" },
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", desc: "Soft, young female" },
    { id: "ErXwobaYiN019PkySvjV", name: "Antoni", desc: "Well-rounded male" },
    { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", desc: "Deep, young male" },
    { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", desc: "Young female" },
    { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", desc: "Crisp male" },
    { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", desc: "Raspy male" },
    { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", desc: "Strong female" },
    { id: "ODq5zmih8GrVes37Dizd", name: "Patrick", desc: "Natural male" },
    { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", desc: "Deep male" },
  ];

  const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
    model: "gpt-4o-mini-realtime-preview",
    voice: "coral",
    temperature: 0.3,
    maxTokens: 600,
    turnDetection: {
      type: "server_vad" as const,
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
      create_response: true,
      interrupt_response: true,
    },
    noiseCancellation: true,
    humanization: {
      fillersEnabled: false,
      typingSounds: false,
      ambience: false,
    },
    persona: "sales",
    timeoutSeconds: null,
    maxCallDurationSeconds: null,
    greetingMessage: null,
    tts: {
      provider: "elevenlabs",
      model: "eleven_multilingual_v2",
      voiceId: "ODq5zmih8GrVes37Dizd",
      language: "pt",
      stability: 0.5,
      similarityBoost: 0.75,
      speed: 1.0,
    },
  };
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>(DEFAULT_RUNTIME_CONFIG);
  const [runtimeExpanded, setRuntimeExpanded] = useState(false);
  const [customVoiceId, setCustomVoiceId] = useState("");

  const isCustomElevenLabsVoice =
    runtimeConfig.tts?.voiceId != null &&
    !ELEVENLABS_VOICES.some((v) => v.id === runtimeConfig.tts?.voiceId);

  const [knowledgeItems, setKnowledgeItems] = useState<AgentKnowledgeItem[]>(
    []
  );
  const [uploading, setUploading] = useState(false);
  const [summarize, setSummarize] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomResponse, setRoomResponse] = useState<CreateRoomResponse | null>(
    null
  );
  const [copiedToken, setCopiedToken] = useState(false);
  const [roomForm, setRoomForm] = useState<CreateRoomRequest>({
    agent_name: DEFAULT_AGENT,
    from_number: "5562981724199",
    to_number: "5562981724198",
    channel: "whatsapp",
    direction: "inbound",
    customer_name: "João Silva",
    enable_webrtc: true,
  });

  const [deploying, setDeploying] = useState(false);
  const [latestDeployment, setLatestDeployment] =
    useState<AgentDeployment | null>(null);
  const [deployHealth, setDeployHealth] =
    useState<DeployHealthResponse | null>(null);
  const [loadingDeploy, setLoadingDeploy] = useState(false);

  // ─── Tools state ─────────────────────────────────────────────
  const [agentTools, setAgentTools] = useState<AgentTool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [toolDialogOpen, setToolDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<AgentTool | null>(null);
  const [savingTool, setSavingTool] = useState(false);
  const [deletingToolId, setDeletingToolId] = useState<string | null>(null);
  const [seedingTools, setSeedingTools] = useState(false);
  const TOOL_TYPES: { value: ToolType; label: string; desc: string }[] = [
    { value: "TRANSFER_CALL", label: "Transfer Call", desc: "Transfers the call to another department" },
    { value: "END_CALL", label: "End Call", desc: "Ends the current call" },
    { value: "HTTP_REQUEST", label: "HTTP Request", desc: "Makes an HTTP request to an external API" },
  ];
  const [toolForm, setToolForm] = useState<{
    name: string;
    type: ToolType;
    description: string;
    parameters: string;
    config: string;
    enabled: boolean;
    sort_order: number;
  }>({
    name: "",
    type: "TRANSFER_CALL",
    description: "",
    parameters: "{}",
    config: "{}",
    enabled: true,
    sort_order: 0,
  });

  // Form builder mode state
  type ParamRow = { key: string; type: string; description: string; required: boolean; values: string };
  type ConfigField = { key: string; value: string };
  const [paramsMode, setParamsMode] = useState<"json" | "form">("json");
  const [configMode, setConfigMode] = useState<"json" | "form">("json");
  const [paramRows, setParamRows] = useState<ParamRow[]>([]);
  const [configFields, setConfigFields] = useState<ConfigField[]>([]);

  // ─── Form <-> JSON sync helpers ─────────────────────────────
  /** Safely parse a value that may be an object, a JSON string, or a double-encoded JSON string */
  const safeParseObj = (v: unknown): Record<string, any> => {
    if (typeof v === "object" && v !== null && !Array.isArray(v)) return v as Record<string, any>;
    if (typeof v === "string") {
      try {
        const parsed = JSON.parse(v);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed;
        // double-encoded: JSON.parse returned a string → parse again
        if (typeof parsed === "string") {
          try {
            const parsed2 = JSON.parse(parsed);
            if (typeof parsed2 === "object" && parsed2 !== null && !Array.isArray(parsed2)) return parsed2;
          } catch { /* not double-encoded */ }
        }
      } catch { /* not valid JSON */ }
    }
    return {};
  };

  /** Convert any value to a pretty JSON string for the textarea */
  const toJsonString = (v: unknown): string => {
    if (typeof v === "string") {
      // If it's already a valid JSON string representing an object, format it
      try {
        const parsed = JSON.parse(v);
        if (typeof parsed === "object" && parsed !== null) return JSON.stringify(parsed, null, 2);
        // double-encoded
        if (typeof parsed === "string") {
          try {
            const parsed2 = JSON.parse(parsed);
            if (typeof parsed2 === "object" && parsed2 !== null) return JSON.stringify(parsed2, null, 2);
          } catch { /* */ }
        }
        return v;
      } catch {
        return v;
      }
    }
    if (typeof v === "object" && v !== null) return JSON.stringify(v, null, 2);
    return "{}";
  };

  const jsonToParamRows = (json: string): ParamRow[] => {
    try {
      const obj = safeParseObj(json);
      return Object.entries(obj).map(([key, val]: [string, any]) => ({
        key,
        type: val?.type || "string",
        description: val?.description || "",
        required: val?.required ?? false,
        values: Array.isArray(val?.values) ? val.values.join(", ") : "",
      }));
    } catch {
      return [];
    }
  };

  const paramRowsToJson = (rows: ParamRow[]): string => {
    const obj: Record<string, any> = {};
    for (const row of rows) {
      if (!row.key.trim()) continue;
      const entry: Record<string, any> = { type: row.type, description: row.description, required: row.required };
      if (row.type === "enum" && row.values.trim()) {
        entry.values = row.values.split(",").map((v) => v.trim()).filter(Boolean);
      }
      obj[row.key.trim()] = entry;
    }
    return JSON.stringify(obj, null, 2);
  };

  const jsonToConfigFields = (json: string): ConfigField[] => {
    try {
      const obj = safeParseObj(json);
      return Object.entries(obj).map(([key, value]) => ({
        key,
        value: typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? ""),
      }));
    } catch {
      return [];
    }
  };

  const configFieldsToJson = (fields: ConfigField[]): string => {
    const obj: Record<string, any> = {};
    for (const f of fields) {
      if (!f.key.trim()) continue;
      try {
        obj[f.key.trim()] = JSON.parse(f.value);
      } catch {
        obj[f.key.trim()] = f.value;
      }
    }
    return JSON.stringify(obj, null, 2);
  };

  const switchParamsMode = (mode: "json" | "form") => {
    if (mode === "form") {
      setParamRows(jsonToParamRows(toolForm.parameters));
    } else {
      setToolForm((p) => ({ ...p, parameters: paramRowsToJson(paramRows) }));
    }
    setParamsMode(mode);
  };

  const switchConfigMode = (mode: "json" | "form") => {
    if (mode === "form") {
      setConfigFields(jsonToConfigFields(toolForm.config));
    } else {
      setToolForm((p) => ({ ...p, config: configFieldsToJson(configFields) }));
    }
    setConfigMode(mode);
  };

  const getExampleParamRow = (type: ToolType): ParamRow => {
    switch (type) {
      case "HTTP_REQUEST":
        return { key: "param_name", type: "string", description: "Describe what this parameter is for", required: true, values: "" };
      case "TRANSFER_CALL":
        return { key: "department", type: "enum", description: "Department to transfer to", required: true, values: "sales, support, billing" };
      case "END_CALL":
        return { key: "reason", type: "enum", description: "Reason for ending the call", required: true, values: "completed, no_interest, callback_requested" };
      default:
        return { key: "", type: "string", description: "", required: false, values: "" };
    }
  };

  const getExampleParamRows = (type: ToolType): ParamRow[] => {
    switch (type) {
      case "HTTP_REQUEST":
        return [
          { key: "name", type: "string", description: "Full name of the customer", required: true, values: "" },
          { key: "email", type: "string", description: "Customer email address", required: true, values: "" },
          { key: "message", type: "string", description: "Additional notes or message", required: false, values: "" },
        ];
      case "TRANSFER_CALL":
        return [
          { key: "department", type: "enum", description: "Department to transfer to", required: true, values: "sales, support, billing" },
          { key: "customer_name", type: "string", description: "Name of the caller", required: true, values: "" },
          { key: "urgency", type: "enum", description: "Priority level", required: false, values: "low, medium, high" },
        ];
      case "END_CALL":
        return [
          { key: "reason", type: "enum", description: "Reason for ending the call", required: true, values: "completed, no_interest, callback_requested" },
        ];
      default:
        return [{ key: "", type: "string", description: "", required: false, values: "" }];
    }
  };

  const getExampleConfigFields = (type: ToolType): ConfigField[] => {
    switch (type) {
      case "HTTP_REQUEST":
        return [
          { key: "url", value: "https://api.example.com/endpoint" },
          { key: "method", value: "POST" },
          { key: "headers", value: '{"Authorization":"Bearer token"}' },
          { key: "waitMessage", value: "One moment while I check that for you." },
        ];
      case "TRANSFER_CALL":
        return [
          { key: "waitMessage", value: "One moment while I process the transfer." },
          { key: "transferMessage", value: "Transferring you now to the responsible department." },
          { key: "shutdownReason", value: "sip-call-transferred" },
          { key: "simulatedDelayMs", value: "3000" },
        ];
      case "END_CALL":
        return [];
      default:
        return [{ key: "", value: "" }];
    }
  };

  const PLAYGROUND_URL =
    "https://agents-playground.livekit.io/#cam=1&mic=1&screen=1&video=1&audio=1&chat=1&theme_color=cyan";

  const loadAgents = useCallback(async () => {
    try {
      const list = await agentConfigApi.listAgents();
      setAgents(list.length > 0 ? list : [DEFAULT_AGENT]);
    } catch {
      setAgents([DEFAULT_AGENT]);
    }
  }, []);

  const loadWorkerStatus = useCallback(async () => {

  }, []);

  const loadAvailableWorkers = useCallback(async () => {
    try {
      const list = await agentWorkerApi.available();
      setAvailableWorkers(list);
    } catch {
      setAvailableWorkers([]);
    }
  }, []);

  const loadConfig = useCallback(
    async (agentName: string) => {
      setLoading(true);
      try {
        const config = await agentConfigApi.get(agentName);
        setInstructions(config.raw_instructions ?? config.instructions);
        setAutoStart(config.auto_start ?? false);
        setRuntimeConfig(config.runtime_config ?? DEFAULT_RUNTIME_CONFIG);
        setLastUpdated(config.updated_at);
      } catch {
        setInstructions("");
        setAutoStart(false);
        setLastUpdated(null);
        toast.error("Failed to load agent configuration");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadKnowledge = useCallback(async (agentName: string) => {
    try {
      const items = await agentKnowledgeApi.list(agentName);
      setKnowledgeItems(items);
    } catch {
      setKnowledgeItems([]);
    }
  }, []);

  const loadDeployStatus = useCallback(async (agentName: string) => {
    setLoadingDeploy(true);
    try {
      const deployment = await deployApi.getLatestDeployment(agentName);
      setLatestDeployment(deployment);

      if (deployment && deployment.status === "RUNNING" && deployment.pod_name) {
        try {
          const health = await deployApi.getHealth(agentName);
          setDeployHealth(health);
        } catch {
          setDeployHealth(null);
        }
      } else {
        setDeployHealth(null);
      }
    } catch {
      setLatestDeployment(null);
      setDeployHealth(null);
    } finally {
      setLoadingDeploy(false);
    }
  }, []);

  const loadTools = useCallback(async (agentName: string) => {
    setLoadingTools(true);
    try {
      const items = await agentToolsApi.list(agentName);
      setAgentTools(items);
    } catch {
      setAgentTools([]);
    } finally {
      setLoadingTools(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
    loadWorkerStatus();
    loadAvailableWorkers();
  }, [loadAgents, loadWorkerStatus, loadAvailableWorkers]);

  useEffect(() => {
    loadConfig(selectedAgent);
    loadKnowledge(selectedAgent);
    loadTools(selectedAgent);
    loadDeployStatus(selectedAgent);
    setRoomForm((prev) => ({ ...prev, agent_name: selectedAgent }));
  }, [selectedAgent, loadConfig, loadKnowledge, loadTools, loadDeployStatus]);

  const handleAgentChange = (value: string) => {
    if (value === "__new__") {
      setShowNewAgentInput(true);
      return;
    }
    setShowNewAgentInput(false);
    setSelectedAgent(value);
  };

  const handleCreateAgent = async () => {
    const name = newAgentName.trim();
    if (!name) return;
    setShowNewAgentInput(false);
    setNewAgentName("");
    if (!agents.includes(name)) {
      setAgents((prev) => [...prev, name]);
    }
    setSelectedAgent(name);
    // Auto-seed default tools for new agents
    try {
      await agentToolsApi.seed(name);
    } catch {
      // Ignore — tools will be seeded on first save
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const config = await agentConfigApi.update(instructions, selectedAgent, {
        auto_start: autoStart,
        runtime_config: runtimeConfig,
      });
      setLastUpdated(config.updated_at);
      toast.success("Configuration saved!");
    } catch {
      toast.error("Failed to save instructions");
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await agentWorkerApi.restart(selectedAgent);
      toast.success(`Worker "${selectedAgent}" restarted!`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to restart worker"
      );
    } finally {
      setRestarting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "txt" && ext !== "pdf") {
      toast.error("Only .txt and .pdf files are supported");
      return;
    }

    setUploading(true);
    try {
      await agentKnowledgeApi.upload(file, selectedAgent, summarize);
      toast.success(
        `File "${file.name}" uploaded${summarize ? " and summarized" : ""}!`
      );
      await loadKnowledge(selectedAgent);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload file"
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    setDeletingId(id);
    try {
      await agentKnowledgeApi.delete(id);
      toast.success("Knowledge item removed");
      setKnowledgeItems((prev) => prev.filter((k) => k.id !== id));
    } catch {
      toast.error("Failed to delete knowledge item");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateRoom = async () => {
    setCreatingRoom(true);
    try {
      const response = await roomApi.create(roomForm);
      setRoomResponse(response);
      toast.success("Test room created!");
    } catch {
      toast.error("Failed to create test room");
    } finally {
      setCreatingRoom(false);
    }
  };

  // ─── Tool handlers ──────────────────────────────────────────
  const resetToolForm = () => {
    setToolForm({
      name: "",
      type: "TRANSFER_CALL",
      description: "",
      parameters: "{}",
      config: "{}",
      enabled: true,
      sort_order: 0,
    });
    setEditingTool(null);
    setParamsMode("json");
    setConfigMode("json");
    setParamRows([]);
    setConfigFields([]);
  };

  const openToolDialogForCreate = () => {
    resetToolForm();
    setToolDialogOpen(true);
  };

  const openToolDialogForEdit = (tool: AgentTool) => {
    setEditingTool(tool);
    setToolForm({
      name: tool.name,
      type: tool.type,
      description: tool.description,
      parameters: toJsonString(tool.parameters),
      config: toJsonString(tool.config),
      enabled: tool.enabled,
      sort_order: tool.sort_order,
    });
    setToolDialogOpen(true);
  };

  const handleSaveTool = async () => {
    setSavingTool(true);
    try {
      // Sync form builder to JSON before saving
      const paramsJson = paramsMode === "form" ? paramRowsToJson(paramRows) : toolForm.parameters;
      const configJson = configMode === "form" ? configFieldsToJson(configFields) : toolForm.config;

      let parsedParams: Record<string, any> = {};
      let parsedConfig: Record<string, any> = {};
      try {
        parsedParams = JSON.parse(paramsJson || "{}");
      } catch {
        toast.error("Invalid JSON in Parameters field");
        setSavingTool(false);
        return;
      }
      try {
        parsedConfig = JSON.parse(configJson || "{}");
      } catch {
        toast.error("Invalid JSON in Config field");
        setSavingTool(false);
        return;
      }

      if (editingTool) {
        await agentToolsApi.update(editingTool.id, {
          name: toolForm.name,
          type: toolForm.type,
          description: toolForm.description,
          parameters: parsedParams,
          config: parsedConfig,
          enabled: toolForm.enabled,
          sort_order: toolForm.sort_order,
        });
        toast.success(`Tool "${toolForm.name}" updated!`);
      } else {
        await agentToolsApi.create({
          agent_name: selectedAgent,
          name: toolForm.name,
          type: toolForm.type,
          description: toolForm.description,
          parameters: parsedParams,
          config: parsedConfig,
          enabled: toolForm.enabled,
          sort_order: toolForm.sort_order,
        });
        toast.success(`Tool "${toolForm.name}" created!`);
      }
      setToolDialogOpen(false);
      resetToolForm();
      await loadTools(selectedAgent);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save tool");
    } finally {
      setSavingTool(false);
    }
  };

  const handleDeleteTool = async (id: string) => {
    setDeletingToolId(id);
    try {
      await agentToolsApi.delete(id);
      toast.success("Tool removed");
      setAgentTools((prev) => prev.filter((t) => t.id !== id));
    } catch {
      toast.error("Failed to delete tool");
    } finally {
      setDeletingToolId(null);
    }
  };

  const handleToggleTool = async (tool: AgentTool) => {
    try {
      await agentToolsApi.update(tool.id, { enabled: !tool.enabled });
      setAgentTools((prev) =>
        prev.map((t) => (t.id === tool.id ? { ...t, enabled: !t.enabled } : t))
      );
      toast.success(`Tool "${tool.name}" ${tool.enabled ? "disabled" : "enabled"}`);
    } catch {
      toast.error("Failed to toggle tool");
    }
  };

  const handleSeedTools = async () => {
    setSeedingTools(true);
    try {
      const result = await agentToolsApi.seed(selectedAgent);
      if (result.seeded > 0) {
        toast.success(`${result.seeded} default tool(s) created!`);
      } else {
        toast.info("Default tools already exist for this agent");
      }
      await loadTools(selectedAgent);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to seed tools");
    } finally {
      setSeedingTools(false);
    }
  };

  const handleCopyToken = async (token: string) => {
    await navigator.clipboard.writeText(token);
    setCopiedToken(true);
    toast.success("Token copied to clipboard!");
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleOpenDialog = () => {
    setRoomResponse(null);
    setCopiedToken(false);
    setRoomDialogOpen(true);
  };

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const result = await deployApi.triggerDeploy(selectedAgent);
      toast.success(
        `Deploy v${result.version} started for "${selectedAgent}"!`
      );
      setLatestDeployment({
        id: result.deploymentId,
        agent_name: result.agent_name,
        version: result.version,
        image_tag: result.image_tag,
        status: result.status,
        build_logs: null,
        pod_name: null,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to trigger deploy"
      );
    } finally {
      setDeploying(false);
    }
  };

  const handleStopDeploy = async () => {
    try {
      await deployApi.stopDeployment(selectedAgent);
      toast.success("Deployment stopped");
      await loadDeployStatus(selectedAgent);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to stop deployment"
      );
    }
  };

  // Poll deploy status while BUILDING / PUSHING / DEPLOYING
  useEffect(() => {
    if (
      !latestDeployment ||
      !["BUILDING", "PUSHING", "DEPLOYING"].includes(latestDeployment.status)
    )
      return;

    const interval = setInterval(async () => {
      await loadDeployStatus(selectedAgent);
    }, 5000);

    return () => clearInterval(interval);
  }, [latestDeployment?.status, selectedAgent, loadDeployStatus]);

  // Poll health every 30s when RUNNING
  useEffect(() => {
    if (!latestDeployment || latestDeployment.status !== "RUNNING") return;

    const interval = setInterval(async () => {
      try {
        const health = await deployApi.getHealth(selectedAgent);
        setDeployHealth(health);
      } catch {
        setDeployHealth(null);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [latestDeployment?.status, selectedAgent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3 sm:text-3xl">
            <Bot className="h-7 w-7 sm:h-8 sm:w-8" />
            Agent Configuration
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Edit instructions and knowledge base for your voice agent.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Agent</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={selectedAgent} onValueChange={handleAgentChange}>
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
                <SelectItem value="__new__">
                  <span className="flex items-center gap-2">
                    <Plus className="h-3 w-3" />
                    Create new agent
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {showNewAgentInput && (
              <div className="flex items-center gap-2">
                <Input
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="agent-name"
                  className="w-[200px]"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateAgent()}
                />
                <Button size="sm" onClick={handleCreateAgent}>
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowNewAgentInput(false);
                    setNewAgentName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="config">
            <Settings2 className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="knowledge">
            <BookOpen className="h-4 w-4" />
            Knowledge
          </TabsTrigger>
          <TabsTrigger value="tools">
            <Wrench className="h-4 w-4" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="deploy">
            <Rocket className="h-4 w-4" />
            Deploy
          </TabsTrigger>
          <TabsTrigger value="test">
            <PhoneCall className="h-4 w-4" />
            Test
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Instructions</CardTitle>
              <CardDescription>
                Define how the agent should behave during voice calls. Changes take
                effect on the next call without restarting the worker.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="instructions">Agent Instructions</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInstructionsExpanded((v) => !v)}
                    className="h-7 px-2 text-xs text-muted-foreground"
                  >
                    <ChevronsUpDown className="mr-1 h-3 w-3" />
                    {instructionsExpanded ? "Collapse" : "Expand"}
                  </Button>
                </div>
                <div
                  className={`relative ${
                    !instructionsExpanded ? "max-h-[400px]" : ""
                  }`}
                >
                  <Textarea
                    id="instructions"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    rows={instructionsExpanded ? 40 : 16}
                    className={`font-mono text-sm resize-none ${
                      !instructionsExpanded ? "max-h-[400px]" : ""
                    }`}
                    placeholder="You are a helpful voice assistant..."
                  />
                  {!instructionsExpanded && instructions.length > 800 && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none rounded-b-md" />
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  {lastUpdated && (
                    <span>
                      Last updated: {new Date(lastUpdated).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoStart"
                      checked={autoStart}
                      onChange={(e) => setAutoStart(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="autoStart" className="text-sm cursor-pointer">
                      Auto-start worker
                    </Label>
                  </div>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRestart}
                    disabled={restarting}
                  >
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${restarting ? "animate-spin" : ""}`}
                    />
                    {restarting ? "Restarting..." : "Restart Worker"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />
                    Runtime Configuration
                  </CardTitle>
                  <CardDescription>
                    Model, voice, VAD, humanization, timeouts and greeting. Applied
                    on the next call or after restarting the worker.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRuntimeExpanded((v) => !v)}
                  className="h-7 px-2 text-xs text-muted-foreground"
                >
                  <ChevronsUpDown className="mr-1 h-3 w-3" />
                  {runtimeExpanded ? "Collapse" : "Expand"}
                </Button>
              </div>
            </CardHeader>
            {runtimeExpanded && (
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Mic className="h-4 w-4" /> Model &amp; Voice
                  </Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Choose the LLM model and TTS engine. OpenAI Voice uses the built-in Realtime voice.
                    ElevenLabs uses OpenAI for reasoning (text-only) and ElevenLabs for speech output.
                  </p>

                  <div className="space-y-1">
                    <Label htmlFor="rt-model-provider" className="text-xs text-muted-foreground">
                      Model &amp; TTS Engine
                    </Label>
                    <Select
                      value={`${runtimeConfig.model ?? "gpt-4o-mini-realtime-preview"}::${runtimeConfig.tts?.provider ?? "openai_realtime"}`}
                      onValueChange={(v) => {
                        const [model, provider] = v.split("::");
                        setRuntimeConfig((prev) => ({
                          ...prev,
                          model,
                          tts: { ...prev.tts, provider },
                        }));
                      }}
                    >
                      <SelectTrigger id="rt-model-provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o-mini-realtime-preview::openai_realtime">
                          gpt-4o-mini-realtime — OpenAI Voice
                        </SelectItem>
                        <SelectItem value="gpt-4o-realtime-preview::openai_realtime">
                          gpt-4o-realtime — OpenAI Voice
                        </SelectItem>
                        <SelectItem value="gpt-4o-mini-realtime-preview::elevenlabs">
                          gpt-4o-mini-realtime — ElevenLabs Voice
                        </SelectItem>
                        <SelectItem value="gpt-4o-realtime-preview::elevenlabs">
                          gpt-4o-realtime — ElevenLabs Voice
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {runtimeConfig.tts?.provider === "elevenlabs" ? (
                    <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          ElevenLabs TTS Settings
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Configure voice synthesis. The agent uses OpenAI Realtime for STT &amp; reasoning and ElevenLabs for speech output.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor="rt-11l-voice" className="text-xs text-muted-foreground">
                            Voice
                          </Label>
                          <Select
                            value={
                              isCustomElevenLabsVoice
                                ? "__custom__"
                                : (runtimeConfig.tts?.voiceId ?? "ODq5zmih8GrVes37Dizd")
                            }
                            onValueChange={(v) => {
                              if (v === "__custom__") {
                                setCustomVoiceId(runtimeConfig.tts?.voiceId ?? "");
                              } else {
                                setRuntimeConfig((prev) => ({
                                  ...prev,
                                  tts: { ...prev.tts, voiceId: v },
                                }));
                                setCustomVoiceId("");
                              }
                            }}
                          >
                            <SelectTrigger id="rt-11l-voice">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ELEVENLABS_VOICES.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.name} — {v.desc}
                                </SelectItem>
                              ))}
                              <SelectItem value="__custom__">Custom Voice ID</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">
                            Pre-built voices or paste a custom voice ID from your ElevenLabs library.
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="rt-11l-model" className="text-xs text-muted-foreground">
                            TTS Model
                          </Label>
                          <Select
                            value={runtimeConfig.tts?.model ?? "eleven_multilingual_v2"}
                            onValueChange={(v) =>
                              setRuntimeConfig((prev) => ({
                                ...prev,
                                tts: { ...prev.tts, model: v },
                              }))
                            }
                          >
                            <SelectTrigger id="rt-11l-model">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="eleven_multilingual_v2">eleven_multilingual_v2</SelectItem>
                              <SelectItem value="eleven_turbo_v2_5">eleven_turbo_v2_5</SelectItem>
                              <SelectItem value="eleven_turbo_v2">eleven_turbo_v2</SelectItem>
                              <SelectItem value="eleven_flash_v2_5">eleven_flash_v2_5</SelectItem>
                              <SelectItem value="eleven_flash_v2">eleven_flash_v2</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">
                            Multilingual v2 = best quality. Flash/Turbo = lower latency.
                          </p>
                        </div>
                      </div>

                      {(isCustomElevenLabsVoice || customVoiceId !== "" ||
                        (!ELEVENLABS_VOICES.some((v) => v.id === runtimeConfig.tts?.voiceId) && runtimeConfig.tts?.voiceId)) && (
                        <div className="space-y-1">
                          <Label htmlFor="rt-11l-custom-voice" className="text-xs text-muted-foreground">
                            Custom Voice ID
                          </Label>
                          <Input
                            id="rt-11l-custom-voice"
                            type="text"
                            placeholder="Enter ElevenLabs voice ID..."
                            value={runtimeConfig.tts?.voiceId ?? customVoiceId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomVoiceId(val);
                              setRuntimeConfig((prev) => ({
                                ...prev,
                                tts: { ...prev.tts, voiceId: val },
                              }));
                            }}
                            className="font-mono text-sm"
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label htmlFor="rt-11l-lang" className="text-xs text-muted-foreground">
                          Language
                        </Label>
                        <Select
                          value={runtimeConfig.tts?.language ?? "pt"}
                          onValueChange={(v) =>
                            setRuntimeConfig((prev) => ({
                              ...prev,
                              tts: { ...prev.tts, language: v },
                            }))
                          }
                        >
                          <SelectTrigger id="rt-11l-lang">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pt">Português</SelectItem>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Español</SelectItem>
                            <SelectItem value="fr">Français</SelectItem>
                            <SelectItem value="de">Deutsch</SelectItem>
                            <SelectItem value="it">Italiano</SelectItem>
                            <SelectItem value="ja">日本語</SelectItem>
                            <SelectItem value="ko">한국어</SelectItem>
                            <SelectItem value="zh">中文</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                          Primary language for speech synthesis. Affects pronunciation and accent.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor="rt-11l-stability" className="text-xs text-muted-foreground">
                            Stability ({runtimeConfig.tts?.stability?.toFixed(2) ?? "0.50"})
                          </Label>
                          <input
                            id="rt-11l-stability"
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={runtimeConfig.tts?.stability ?? 0.5}
                            onChange={(e) =>
                              setRuntimeConfig((prev) => ({
                                ...prev,
                                tts: { ...prev.tts, stability: parseFloat(e.target.value) },
                              }))
                            }
                            className="w-full accent-primary h-2 cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>More expressive</span>
                            <span>More consistent</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="rt-11l-similarity" className="text-xs text-muted-foreground">
                            Similarity ({runtimeConfig.tts?.similarityBoost?.toFixed(2) ?? "0.75"})
                          </Label>
                          <input
                            id="rt-11l-similarity"
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={runtimeConfig.tts?.similarityBoost ?? 0.75}
                            onChange={(e) =>
                              setRuntimeConfig((prev) => ({
                                ...prev,
                                tts: { ...prev.tts, similarityBoost: parseFloat(e.target.value) },
                              }))
                            }
                            className="w-full accent-primary h-2 cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>More varied</span>
                            <span>More faithful</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="rt-11l-speed" className="text-xs text-muted-foreground">
                            Speed ({runtimeConfig.tts?.speed?.toFixed(1) ?? "1.0"})
                          </Label>
                          <input
                            id="rt-11l-speed"
                            type="range"
                            min={0.5}
                            max={2}
                            step={0.1}
                            value={runtimeConfig.tts?.speed ?? 1.0}
                            onChange={(e) =>
                              setRuntimeConfig((prev) => ({
                                ...prev,
                                tts: { ...prev.tts, speed: parseFloat(e.target.value) },
                              }))
                            }
                            className="w-full accent-primary h-2 cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>0.5× slower</span>
                            <span>2.0× faster</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* OpenAI Realtime voice selector */
                    <div className="space-y-1">
                      <Label htmlFor="rt-voice" className="text-xs text-muted-foreground">
                        Voice (OpenAI)
                      </Label>
                      <Select
                        value={runtimeConfig.voice ?? "coral"}
                        onValueChange={(v) =>
                          setRuntimeConfig((prev) => ({ ...prev, voice: v }))
                        }
                      >
                        <SelectTrigger id="rt-voice">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "coral",
                            "alloy",
                            "ash",
                            "ballad",
                            "echo",
                            "fable",
                            "nova",
                            "onyx",
                            "sage",
                            "shimmer",
                            "verse",
                          ].map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Temperature & Max Tokens */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="rt-temp" className="text-xs text-muted-foreground">
                      Temperature
                    </Label>
                    <Input
                      id="rt-temp"
                      type="number"
                      step={0.1}
                      min={0}
                      max={2}
                      value={runtimeConfig.temperature ?? 0.3}
                      onChange={(e) =>
                        setRuntimeConfig((prev) => ({
                          ...prev,
                          temperature: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Randomness of responses. Lower = more focused. Higher = more creative.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="rt-tokens" className="text-xs text-muted-foreground">
                      Max Output Tokens
                    </Label>
                    <Input
                      id="rt-tokens"
                      type="number"
                      step={100}
                      min={100}
                      max={4096}
                      value={runtimeConfig.maxTokens ?? 600}
                      onChange={(e) =>
                        setRuntimeConfig((prev) => ({
                          ...prev,
                          maxTokens: parseInt(e.target.value) || 600,
                        }))
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Max tokens per response. Keep low for faster, shorter replies.
                    </p>
                  </div>
                </div>

                {/* Persona */}
                <div className="space-y-1">
                  <Label htmlFor="rt-persona" className="text-xs text-muted-foreground">
                    Persona
                  </Label>
                  <Select
                    value={runtimeConfig.persona ?? "sales"}
                    onValueChange={(v) =>
                      setRuntimeConfig((prev) => ({ ...prev, persona: v }))
                    }
                  >
                    <SelectTrigger id="rt-persona">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                      <SelectItem value="corporate">Corporate</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Defines the agent&apos;s communication style and tone of voice.
                  </p>
                </div>

                {/* Noise Cancellation */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="rt-noise"
                      checked={runtimeConfig.noiseCancellation ?? true}
                      onChange={(e) =>
                        setRuntimeConfig((prev) => ({
                          ...prev,
                          noiseCancellation: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="rt-noise" className="text-sm cursor-pointer">
                      Noise Cancellation
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Filters background noise from the caller&apos;s audio for clearer speech recognition.
                  </p>
                </div>

                {/* Greeting Message */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> Greeting Message
                  </Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    The first message the agent speaks when a call starts. Leave empty to let the agent decide.
                  </p>
                  <Textarea
                    value={runtimeConfig.greetingMessage ?? ""}
                    onChange={(e) =>
                      setRuntimeConfig((prev) => ({
                        ...prev,
                        greetingMessage: e.target.value || null,
                      }))
                    }
                    rows={3}
                    className="font-mono text-sm resize-none"
                    placeholder="Seja bem-vindo à central da Claro. Pra eu te atender direitinho, me diz por favor o seu nome."
                  />
                </div>

                {/* Turn Detection (VAD) */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Turn Detection (VAD)</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Voice Activity Detection — controls when the agent detects the user has stopped speaking and can respond.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Type selector */}
                    <div className="space-y-1">
                      <Label htmlFor="rt-vad-type" className="text-xs text-muted-foreground">
                        Type
                      </Label>
                      <Select
                        value={runtimeConfig.turnDetection?.type ?? "server_vad"}
                        onValueChange={(v) => {
                          const newType = v as "server_vad" | "semantic_vad";
                          setRuntimeConfig((prev) => ({
                            ...prev,
                            turnDetection: {
                              type: newType,
                              create_response: prev.turnDetection?.create_response ?? true,
                              interrupt_response: prev.turnDetection?.interrupt_response ?? true,
                              ...(newType === "server_vad"
                                ? {
                                    threshold: 0.5,
                                    prefix_padding_ms: 300,
                                    silence_duration_ms: 500,
                                  }
                                : {
                                    eagerness: "auto" as const,
                                  }),
                            },
                          }));
                        }}
                      >
                        <SelectTrigger id="rt-vad-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="server_vad">server_vad</SelectItem>
                          <SelectItem value="semantic_vad">semantic_vad</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* === server_vad fields === */}
                    {(runtimeConfig.turnDetection?.type ?? "server_vad") === "server_vad" && (
                      <>
                        <div className="space-y-1">
                          <Label htmlFor="rt-vad-threshold" className="text-xs text-muted-foreground">
                            Threshold
                          </Label>
                          <Input
                            id="rt-vad-threshold"
                            type="number"
                            step={0.05}
                            min={0}
                            max={1}
                            value={runtimeConfig.turnDetection?.threshold ?? 0.5}
                            onChange={(e) =>
                              setRuntimeConfig((prev) => ({
                                ...prev,
                                turnDetection: {
                                  ...prev.turnDetection,
                                  threshold: parseFloat(e.target.value) || 0.5,
                                },
                              }))
                            }
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Voice activation threshold (0.0–1.0).
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="rt-vad-prefix" className="text-xs text-muted-foreground">
                            Prefix Padding (ms)
                          </Label>
                          <Input
                            id="rt-vad-prefix"
                            type="number"
                            step={50}
                            min={0}
                            max={5000}
                            value={runtimeConfig.turnDetection?.prefix_padding_ms ?? 300}
                            onChange={(e) =>
                              setRuntimeConfig((prev) => ({
                                ...prev,
                                turnDetection: {
                                  ...prev.turnDetection,
                                  prefix_padding_ms: parseInt(e.target.value) || 300,
                                },
                              }))
                            }
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Audio before speech detection to include.
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="rt-vad-silence" className="text-xs text-muted-foreground">
                            Silence (ms)
                          </Label>
                          <Input
                            id="rt-vad-silence"
                            type="number"
                            step={50}
                            min={100}
                            max={5000}
                            value={runtimeConfig.turnDetection?.silence_duration_ms ?? 500}
                            onChange={(e) =>
                              setRuntimeConfig((prev) => ({
                                ...prev,
                                turnDetection: {
                                  ...prev.turnDetection,
                                  silence_duration_ms: parseInt(e.target.value) || 500,
                                },
                              }))
                            }
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Wait time after silence before responding.
                          </p>
                        </div>
                      </>
                    )}

                    {/* === semantic_vad fields === */}
                    {runtimeConfig.turnDetection?.type === "semantic_vad" && (
                      <div className="space-y-1">
                        <Label htmlFor="rt-vad-eagerness" className="text-xs text-muted-foreground">
                          Eagerness
                        </Label>
                        <Select
                          value={runtimeConfig.turnDetection?.eagerness ?? "auto"}
                          onValueChange={(v) =>
                            setRuntimeConfig((prev) => ({
                              ...prev,
                              turnDetection: {
                                ...prev.turnDetection,
                                eagerness: v as "auto" | "low" | "medium" | "high",
                              },
                            }))
                          }
                        >
                          <SelectTrigger id="rt-vad-eagerness">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">auto</SelectItem>
                            <SelectItem value="low">low</SelectItem>
                            <SelectItem value="medium">medium</SelectItem>
                            <SelectItem value="high">high</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                          How eagerly the model responds to detected speech.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Shared fields: create_response & interrupt_response */}
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="rt-vad-create-response"
                        checked={runtimeConfig.turnDetection?.create_response ?? true}
                        onChange={(e) =>
                          setRuntimeConfig((prev) => ({
                            ...prev,
                            turnDetection: {
                              ...prev.turnDetection,
                              create_response: e.target.checked,
                            },
                          }))
                        }
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="rt-vad-create-response" className="text-xs">
                        Create Response
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="rt-vad-interrupt-response"
                        checked={runtimeConfig.turnDetection?.interrupt_response ?? true}
                        onChange={(e) =>
                          setRuntimeConfig((prev) => ({
                            ...prev,
                            turnDetection: {
                              ...prev.turnDetection,
                              interrupt_response: e.target.checked,
                            },
                          }))
                        }
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="rt-vad-interrupt-response" className="text-xs">
                        Interrupt Response
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Humanization */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Humanization</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Add human-like behaviors to make the agent sound more natural.
                  </p>
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="rt-fillers"
                        checked={runtimeConfig.humanization?.fillersEnabled ?? false}
                        onChange={(e) =>
                          setRuntimeConfig((prev) => ({
                            ...prev,
                            humanization: {
                              ...prev.humanization,
                              fillersEnabled: e.target.checked,
                            },
                          }))
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                      <Label htmlFor="rt-fillers" className="text-sm cursor-pointer">
                        Fillers <span className="text-[10px] text-muted-foreground">(uhm, hmm…)</span>
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="rt-typing"
                        checked={runtimeConfig.humanization?.typingSounds ?? false}
                        onChange={(e) =>
                          setRuntimeConfig((prev) => ({
                            ...prev,
                            humanization: {
                              ...prev.humanization,
                              typingSounds: e.target.checked,
                            },
                          }))
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                      <Label htmlFor="rt-typing" className="text-sm cursor-pointer">
                        Typing sounds <span className="text-[10px] text-muted-foreground">(keyboard clicks)</span>
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="rt-ambience"
                        checked={runtimeConfig.humanization?.ambience ?? false}
                        onChange={(e) =>
                          setRuntimeConfig((prev) => ({
                            ...prev,
                            humanization: {
                              ...prev.humanization,
                              ambience: e.target.checked,
                            },
                          }))
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                      <Label htmlFor="rt-ambience" className="text-sm cursor-pointer">
                        Office ambience <span className="text-[10px] text-muted-foreground">(background noise)</span>
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Timeouts */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Timer className="h-4 w-4" /> Timeouts
                  </Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Automatic call termination rules. Leave empty to disable.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label
                        htmlFor="rt-timeout"
                        className="text-xs text-muted-foreground"
                      >
                        Inactivity timeout (seconds)
                      </Label>
                      <Input
                        id="rt-timeout"
                        type="number"
                        min={0}
                        max={7200}
                        value={runtimeConfig.timeoutSeconds ?? ""}
                        onChange={(e) =>
                          setRuntimeConfig((prev) => ({
                            ...prev,
                            timeoutSeconds: e.target.value
                              ? parseInt(e.target.value)
                              : null,
                          }))
                        }
                        placeholder="Disabled"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="rt-maxduration"
                        className="text-xs text-muted-foreground"
                      >
                        Max call duration (seconds)
                      </Label>
                      <Input
                        id="rt-maxduration"
                        type="number"
                        min={0}
                        max={14400}
                        value={runtimeConfig.maxCallDurationSeconds ?? ""}
                        onChange={(e) =>
                          setRuntimeConfig((prev) => ({
                            ...prev,
                            maxCallDurationSeconds: e.target.value
                              ? parseInt(e.target.value)
                              : null,
                          }))
                        }
                        placeholder="Disabled"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to disable. Inactivity timeout ends the call after
                    silence; max duration is a hard limit.
                  </p>
                </div>

                <div className="flex justify-end pt-2 border-t">
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Saving..." : "Save Configuration"}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Knowledge Base
                  </CardTitle>
                  <CardDescription>
                    Upload TXT or PDF files to enrich the agent&apos;s context.
                    Knowledge is automatically appended to instructions.
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  {knowledgeItems.length}{" "}
                  {knowledgeItems.length === 1 ? "file" : "files"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-dashed p-4 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="knowledge-file"
                    />
                    <Label
                      htmlFor="knowledge-file"
                      className="cursor-pointer inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                      {uploading ? "Uploading..." : "Choose file (.txt, .pdf)"}
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="summarize"
                      checked={summarize}
                      onChange={(e) => setSummarize(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="summarize" className="text-sm cursor-pointer">
                      Summarize before saving
                    </Label>
                  </div>
                </div>

                {summarize && (
                  <div className="flex items-start gap-2 rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3 text-sm text-yellow-700 dark:text-yellow-400">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      The file will be summarized via AI (gpt-4o-mini) before saving.
                      This reduces tokens and improves real-time performance, but
                      some details may be simplified.
                    </span>
                  </div>
                )}
              </div>

              {knowledgeItems.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead className="w-[100px]">Size</TableHead>
                        <TableHead className="w-[100px]">Type</TableHead>
                        <TableHead className="w-[140px]">Date</TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {knowledgeItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[200px]">
                                {item.file_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {item.char_count.toLocaleString()} chars
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={item.summarized ? "default" : "outline"}
                              className="text-xs"
                            >
                              {item.summarized ? "Summarized" : "Original"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(item.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteKnowledge(item.id)}
                              disabled={deletingId === item.id}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No knowledge files uploaded yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tools Tab ──────────────────────────────────────── */}
        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Agent Tools
                  </CardTitle>
                  <CardDescription>
                    Define which tools (functions) the agent can call during a conversation.
                    Tools are loaded dynamically from the database when the worker starts a new session.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSeedTools}
                    disabled={seedingTools}
                  >
                    {seedingTools ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3 w-3" />
                    )}
                    Seed Defaults
                  </Button>
                  <Button size="sm" onClick={openToolDialogForCreate}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add Tool
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTools ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : agentTools.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No tools configured for this agent.</p>
                  <p className="text-xs mt-1">
                    Click &quot;Seed Defaults&quot; to add the standard transfer &amp; end call tools,
                    or &quot;Add Tool&quot; to create a custom one.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="hidden md:table-cell">Description</TableHead>
                      <TableHead className="w-[80px]">Enabled</TableHead>
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentTools.map((tool, idx) => (
                      <TableRow key={tool.id}>
                        <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                        <TableCell className="font-mono text-sm">{tool.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {tool.type === "TRANSFER_CALL" && "Transfer"}
                            {tool.type === "END_CALL" && "End Call"}
                            {tool.type === "HTTP_REQUEST" && (
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" /> HTTP
                              </span>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[300px] truncate">
                          {tool.description}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleToggleTool(tool)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title={tool.enabled ? "Disable" : "Enable"}
                          >
                            {tool.enabled ? (
                              <ToggleRight className="h-5 w-5 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-5 w-5" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => openToolDialogForEdit(tool)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteTool(tool.id)}
                              disabled={deletingToolId === tool.id}
                            >
                              {deletingToolId === tool.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Tool Create/Edit Dialog */}
          <Dialog open={toolDialogOpen} onOpenChange={(open) => { setToolDialogOpen(open); if (!open) resetToolForm(); }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTool ? "Edit Tool" : "Add Tool"}</DialogTitle>
                <DialogDescription>
                  {editingTool
                    ? "Update the tool configuration."
                    : "Define a new tool that the agent can call during conversations."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <Label htmlFor="tool-name" className="text-sm">Name</Label>
                  <Input
                    id="tool-name"
                    value={toolForm.name}
                    onChange={(e) => {
                      const sanitized = e.target.value
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/[\s.:]+/g, '_')
                        .replace(/[^a-zA-Z0-9_-]/g, '')
                        .replace(/_+/g, '_');
                      setToolForm((p) => ({ ...p, name: sanitized }));
                    }}
                    placeholder="e.g. check_availability"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Only letters, numbers, underscores and hyphens allowed (pattern: ^[a-zA-Z0-9_-]+$).
                  </p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="tool-type" className="text-sm">Type</Label>
                  <Select
                    value={toolForm.type}
                    onValueChange={(v) => setToolForm((p) => ({ ...p, type: v as ToolType }))}
                  >
                    <SelectTrigger id="tool-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TOOL_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <div className="flex flex-col">
                            <span>{t.label}</span>
                            <span className="text-xs text-muted-foreground">{t.desc}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="tool-desc" className="text-sm">Description</Label>
                  <Textarea
                    id="tool-desc"
                    value={toolForm.description}
                    onChange={(e) => setToolForm((p) => ({ ...p, description: e.target.value }))}
                    rows={2}
                    placeholder="Describe what this tool does — the LLM uses this to decide when to call it."
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Parameters</Label>
                    <div className="flex items-center gap-1">
                      {paramsMode === "json" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground"
                          onClick={() => {
                            try {
                              const parsed = JSON.parse(toolForm.parameters || "{}");
                              setToolForm((p) => ({ ...p, parameters: JSON.stringify(parsed, null, 2) }));
                            } catch {
                              toast.error("Invalid JSON — cannot format");
                            }
                          }}
                        >
                          <Braces className="mr-1 h-3 w-3" />
                          Format
                        </Button>
                      )}
                      <div className="flex items-center rounded-md border bg-muted/30">
                        <Button
                          type="button"
                          variant={paramsMode === "json" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-6 px-2 text-xs rounded-r-none"
                          onClick={() => switchParamsMode("json")}
                        >
                          <Code className="mr-1 h-3 w-3" />
                          JSON
                        </Button>
                        <Button
                          type="button"
                          variant={paramsMode === "form" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-6 px-2 text-xs rounded-l-none"
                          onClick={() => switchParamsMode("form")}
                        >
                          <List className="mr-1 h-3 w-3" />
                          Form
                        </Button>
                      </div>
                    </div>
                  </div>

                  {paramsMode === "json" ? (
                    <Textarea
                      id="tool-params"
                      value={toolForm.parameters}
                      onChange={(e) => setToolForm((p) => ({ ...p, parameters: e.target.value }))}
                      rows={6}
                      className="font-mono text-xs"
                      placeholder='{"param_name": {"type": "string", "description": "...", "required": true}}'
                    />
                  ) : (
                    <div className="space-y-2 rounded-md border p-3">
                      {paramRows.length === 0 && (
                        <div className="text-center py-2 space-y-1.5">
                          <p className="text-xs text-muted-foreground">No parameters yet.</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-3 text-xs"
                            onClick={() => setParamRows(getExampleParamRows(toolForm.type))}
                          >
                            Load Example for {toolForm.type === "HTTP_REQUEST" ? "HTTP Request" : toolForm.type === "TRANSFER_CALL" ? "Transfer Call" : "End Call"}
                          </Button>
                        </div>
                      )}
                      {paramRows.map((row, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_100px_1fr_70px_auto] gap-2 items-start">
                          <div>
                            <Input
                              value={row.key}
                              onChange={(e) => {
                                const next = [...paramRows];
                                next[idx] = { ...next[idx], key: e.target.value };
                                setParamRows(next);
                              }}
                              placeholder="name"
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <Select
                              value={row.type}
                              onValueChange={(v) => {
                                const next = [...paramRows];
                                next[idx] = { ...next[idx], type: v };
                                setParamRows(next);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="string">string</SelectItem>
                                <SelectItem value="number">number</SelectItem>
                                <SelectItem value="boolean">boolean</SelectItem>
                                <SelectItem value="enum">enum</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Input
                              value={row.description}
                              onChange={(e) => {
                                const next = [...paramRows];
                                next[idx] = { ...next[idx], description: e.target.value };
                                setParamRows(next);
                              }}
                              placeholder="Description"
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="flex items-center justify-center h-8">
                            <input
                              type="checkbox"
                              checked={row.required}
                              onChange={(e) => {
                                const next = [...paramRows];
                                next[idx] = { ...next[idx], required: e.target.checked };
                                setParamRows(next);
                              }}
                              className="h-3.5 w-3.5 rounded border-border"
                            />
                            <span className="text-[10px] text-muted-foreground ml-1">Req</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setParamRows((r) => r.filter((_, i) => i !== idx))}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                          {row.type === "enum" && (
                            <div className="col-span-5">
                              <Input
                                value={row.values}
                                onChange={(e) => {
                                  const next = [...paramRows];
                                  next[idx] = { ...next[idx], values: e.target.value };
                                  setParamRows(next);
                                }}
                                placeholder="Comma-separated values, e.g.: option_a, option_b, option_c"
                                className="h-7 text-xs"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-xs"
                        onClick={() => setParamRows((r) => [...r, getExampleParamRow(toolForm.type)])}
                      >
                        <PlusCircle className="mr-1 h-3 w-3" />
                        Add Parameter
                      </Button>
                    </div>
                  )}

                  <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground space-y-1.5">
                    <p className="font-medium">Define the parameters the LLM will extract from the conversation to pass to this tool.</p>
                    <p>Each key is a parameter name. The value is an object with:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li><code className="text-[11px] bg-muted px-1 rounded">type</code> — <code className="text-[11px] bg-muted px-1 rounded">string</code>, <code className="text-[11px] bg-muted px-1 rounded">number</code>, <code className="text-[11px] bg-muted px-1 rounded">boolean</code> or <code className="text-[11px] bg-muted px-1 rounded">enum</code></li>
                      <li><code className="text-[11px] bg-muted px-1 rounded">description</code> — text that helps the LLM understand what to fill in</li>
                      <li><code className="text-[11px] bg-muted px-1 rounded">required</code> — <code className="text-[11px] bg-muted px-1 rounded">true</code> or <code className="text-[11px] bg-muted px-1 rounded">false</code></li>
                      <li><code className="text-[11px] bg-muted px-1 rounded">values</code> — array of options (only for <code className="text-[11px] bg-muted px-1 rounded">enum</code>)</li>
                    </ul>
                    {toolForm.type === "HTTP_REQUEST" && (
                      <p className="mt-1">For <strong>HTTP Request</strong>, these parameters will be sent as the request body.</p>
                    )}
                    {toolForm.type === "TRANSFER_CALL" && (
                      <p className="mt-1">For <strong>Transfer Call</strong>, the agent collects this data from the caller before transferring.</p>
                    )}
                    {toolForm.type === "END_CALL" && (
                      <p className="mt-1">For <strong>End Call</strong>, typically a <code className="text-[11px] bg-muted px-1 rounded">reason</code> (enum) parameter with the possible termination reasons.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Config</Label>
                    <div className="flex items-center gap-1">
                      {configMode === "json" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground"
                          onClick={() => {
                            try {
                              const parsed = JSON.parse(toolForm.config || "{}");
                              setToolForm((p) => ({ ...p, config: JSON.stringify(parsed, null, 2) }));
                            } catch {
                              toast.error("Invalid JSON — cannot format");
                            }
                          }}
                        >
                          <Braces className="mr-1 h-3 w-3" />
                          Format
                        </Button>
                      )}
                      <div className="flex items-center rounded-md border bg-muted/30">
                        <Button
                          type="button"
                          variant={configMode === "json" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-6 px-2 text-xs rounded-r-none"
                          onClick={() => switchConfigMode("json")}
                        >
                          <Code className="mr-1 h-3 w-3" />
                          JSON
                        </Button>
                        <Button
                          type="button"
                          variant={configMode === "form" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-6 px-2 text-xs rounded-l-none"
                          onClick={() => switchConfigMode("form")}
                        >
                          <List className="mr-1 h-3 w-3" />
                          Form
                        </Button>
                      </div>
                    </div>
                  </div>

                  {configMode === "json" ? (
                    <Textarea
                      id="tool-config"
                      value={toolForm.config}
                      onChange={(e) => setToolForm((p) => ({ ...p, config: e.target.value }))}
                      rows={5}
                      className="font-mono text-xs"
                      placeholder={toolForm.type === "HTTP_REQUEST"
                        ? '{"url": "https://api.example.com/endpoint", "method": "POST"}'
                        : toolForm.type === "TRANSFER_CALL"
                        ? '{"waitMessage": "One moment...", "transferMessage": "Transferring..."}'
                        : '{}'}
                    />
                  ) : (
                    <div className="space-y-2 rounded-md border p-3">
                      {configFields.length === 0 && (
                        <div className="text-center py-2 space-y-1.5">
                          <p className="text-xs text-muted-foreground">No config fields yet.</p>
                          {(toolForm.type === "HTTP_REQUEST" || toolForm.type === "TRANSFER_CALL") && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-3 text-xs"
                              onClick={() => setConfigFields(getExampleConfigFields(toolForm.type))}
                            >
                              Load Example for {toolForm.type === "HTTP_REQUEST" ? "HTTP Request" : "Transfer Call"}
                            </Button>
                          )}
                        </div>
                      )}
                      {configFields.map((field, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-start">
                          <Input
                            value={field.key}
                            onChange={(e) => {
                              const next = [...configFields];
                              next[idx] = { ...next[idx], key: e.target.value };
                              setConfigFields(next);
                            }}
                            placeholder="key"
                            className="h-8 text-xs font-mono"
                          />
                          <Input
                            value={field.value}
                            onChange={(e) => {
                              const next = [...configFields];
                              next[idx] = { ...next[idx], value: e.target.value };
                              setConfigFields(next);
                            }}
                            placeholder="value"
                            className="h-8 text-xs font-mono"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setConfigFields((f) => f.filter((_, i) => i !== idx))}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-xs"
                        onClick={() => setConfigFields((f) => [...f, { key: "", value: "" }])}
                      >
                        <PlusCircle className="mr-1 h-3 w-3" />
                        Add Field
                      </Button>
                    </div>
                  )}

                  <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground space-y-1.5">
                    <p className="font-medium">Internal configuration for the tool behavior (not visible to the LLM).</p>
                    {toolForm.type === "HTTP_REQUEST" && (
                      <>
                        <p>Available fields for <strong>HTTP Request</strong>:</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          <li><code className="text-[11px] bg-muted px-1 rounded">url</code> — External API URL (required)</li>
                          <li><code className="text-[11px] bg-muted px-1 rounded">method</code> — <code className="text-[11px] bg-muted px-1 rounded">GET</code>, <code className="text-[11px] bg-muted px-1 rounded">POST</code>, <code className="text-[11px] bg-muted px-1 rounded">PUT</code>, <code className="text-[11px] bg-muted px-1 rounded">DELETE</code> (default: POST)</li>
                          <li><code className="text-[11px] bg-muted px-1 rounded">headers</code> — Object with additional HTTP headers</li>
                          <li><code className="text-[11px] bg-muted px-1 rounded">waitMessage</code> — Phrase the agent speaks while waiting for the response</li>
                        </ul>
                      </>
                    )}
                    {toolForm.type === "TRANSFER_CALL" && (
                      <>
                        <p>Available fields for <strong>Transfer Call</strong>:</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          <li><code className="text-[11px] bg-muted px-1 rounded">waitMessage</code> — Phrase spoken while processing the transfer</li>
                          <li><code className="text-[11px] bg-muted px-1 rounded">transferMessage</code> — Phrase spoken when the transfer begins</li>
                          <li><code className="text-[11px] bg-muted px-1 rounded">shutdownReason</code> — Reason sent when ending the session (default: sip-call-transferred)</li>
                          <li><code className="text-[11px] bg-muted px-1 rounded">simulatedDelayMs</code> — Simulated processing delay in ms (default: 3000)</li>
                        </ul>
                      </>
                    )}
                    {toolForm.type === "END_CALL" && (
                      <p>For <strong>End Call</strong>, usually no extra config is needed. The agent ends the call after the final message.</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="tool-enabled"
                      checked={toolForm.enabled}
                      onChange={(e) => setToolForm((p) => ({ ...p, enabled: e.target.checked }))}
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="tool-enabled" className="text-sm cursor-pointer">Enabled</Label>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="tool-order" className="text-sm">Order</Label>
                      <Input
                        id="tool-order"
                        type="number"
                        min={0}
                        value={toolForm.sort_order}
                        onChange={(e) => setToolForm((p) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                        className="w-20"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">Display order. Tools with lower numbers appear first in the agent&apos;s tool list.</p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setToolDialogOpen(false); resetToolForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleSaveTool} disabled={savingTool || !toolForm.name || !toolForm.description}>
                  {savingTool ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingTool ? (
                    "Update Tool"
                  ) : (
                    "Create Tool"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="deploy" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Rocket className="h-5 w-5" />
                    Deployment
                  </CardTitle>
                  <CardDescription>
                    Build a Docker image and deploy this agent as a pod via the
                    backend-deploy-controller.
                  </CardDescription>
                </div>
                {latestDeployment && (
                  <DeployStatusBadge status={latestDeployment.status} />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingDeploy ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading deployment status...
                </div>
              ) : latestDeployment ? (
                <div className="rounded-md border bg-muted/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Latest Version</span>
                    <Badge variant="secondary">v{latestDeployment.version}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Image</span>
                    <code className="text-xs text-muted-foreground max-w-[300px] truncate">
                      {latestDeployment.image_tag}
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status</span>
                    <DeployStatusBadge status={latestDeployment.status} />
                  </div>
                  {latestDeployment.pod_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Pod</span>
                      <code className="text-xs text-muted-foreground">
                        {latestDeployment.pod_name}
                      </code>
                    </div>
                  )}
                  {latestDeployment.error_message && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                      <p className="text-sm text-destructive flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        {latestDeployment.error_message}
                      </p>
                    </div>
                  )}
                  {deployHealth && latestDeployment.status === "RUNNING" && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Health</span>
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${
                            deployHealth.healthy ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                        <span className="text-xs text-muted-foreground">
                          {deployHealth.healthy ? "Healthy" : "Unhealthy"}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Created:{" "}
                      {new Date(latestDeployment.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No deployments yet. Click &quot;Deploy Agent&quot; to create the
                  first deployment.
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleDeploy}
                  disabled={
                    deploying ||
                    (latestDeployment != null &&
                      ["BUILDING", "PUSHING", "DEPLOYING"].includes(
                        latestDeployment.status
                      ))
                  }
                >
                  {deploying ||
                  (latestDeployment != null &&
                    ["BUILDING", "PUSHING", "DEPLOYING"].includes(
                      latestDeployment.status
                    )) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {latestDeployment?.status === "BUILDING"
                        ? "Building..."
                        : latestDeployment?.status === "PUSHING"
                          ? "Pushing..."
                          : latestDeployment?.status === "DEPLOYING"
                            ? "Deploying..."
                            : "Starting..."}
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2 h-4 w-4" />
                      Deploy Agent
                      {latestDeployment
                        ? ` (v${latestDeployment.version + 1})`
                        : ""}
                    </>
                  )}
                </Button>

                {latestDeployment?.status === "RUNNING" && (
                  <Button variant="destructive" size="sm" onClick={handleStopDeploy}>
                    <Square className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadDeployStatus(selectedAgent)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>

                <a href="/agent/deployments" className="ml-auto">
                  <Button variant="ghost" size="sm">
                    <History className="mr-2 h-4 w-4" />
                    View History
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Test Room</CardTitle>
                  <CardDescription>
                    Create a test room to try the voice agent in the LiveKit
                    playground.
                  </CardDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={PLAYGROUND_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Playground
                  </a>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Create a room and use the token in the LiveKit Agents Playground
                  to test your agent.
                </p>
                <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={handleOpenDialog}>
                      <PhoneCall className="mr-2 h-4 w-4" />
                      Create Test Room
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                      <DialogTitle>Create Test Room</DialogTitle>
                      <DialogDescription>
                        Configure the room parameters and create a test session.
                      </DialogDescription>
                    </DialogHeader>

                    {!roomResponse ? (
                      <>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="agent_name">Agent Name</Label>
                              <Select
                                value={roomForm.agent_name}
                                onValueChange={(value) =>
                                  setRoomForm({ ...roomForm, agent_name: value })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select agent" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableWorkers.map((name) => (
                                    <SelectItem key={name} value={name}>
                                      {name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="customer_name">Customer Name</Label>
                              <Input
                                id="customer_name"
                                value={roomForm.customer_name}
                                onChange={(e) =>
                                  setRoomForm({
                                    ...roomForm,
                                    customer_name: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="from_number">From Number</Label>
                              <Input
                                id="from_number"
                                value={roomForm.from_number}
                                onChange={(e) =>
                                  setRoomForm({
                                    ...roomForm,
                                    from_number: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="to_number">To Number</Label>
                              <Input
                                id="to_number"
                                value={roomForm.to_number}
                                onChange={(e) =>
                                  setRoomForm({
                                    ...roomForm,
                                    to_number: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="channel">Channel</Label>
                              <Input
                                id="channel"
                                value={roomForm.channel}
                                onChange={(e) =>
                                  setRoomForm({
                                    ...roomForm,
                                    channel: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="direction">Direction</Label>
                              <Input
                                id="direction"
                                value={roomForm.direction}
                                onChange={(e) =>
                                  setRoomForm({
                                    ...roomForm,
                                    direction: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={handleCreateRoom}
                            disabled={creatingRoom}
                          >
                            <PhoneCall className="mr-2 h-4 w-4" />
                            {creatingRoom ? "Creating..." : "Create Room"}
                          </Button>
                        </DialogFooter>
                      </>
                    ) : (
                      <div className="space-y-4 py-4">
                        <div className="rounded-md border bg-muted/50 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Room Name</span>
                            <Badge variant="secondary">
                              {roomResponse.room_name}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Session ID</span>
                            <code className="text-xs text-muted-foreground">
                              {roomResponse.sessionId}
                            </code>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Server URL</span>
                            <code className="text-xs text-muted-foreground">
                              {roomResponse.url}
                            </code>
                          </div>
                          <div className="space-y-2">
                            <span className="text-sm font-medium">Token</span>
                            <div className="flex items-center gap-2">
                              <code className="text-xs text-muted-foreground break-all flex-1 bg-muted p-2 rounded max-h-20 overflow-auto">
                                {roomResponse.token}
                              </code>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleCopyToken(roomResponse.token)
                                }
                              >
                                {copiedToken ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <DialogFooter className="gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setRoomResponse(null)}
                          >
                            Create Another
                          </Button>
                          <Button asChild>
                            <a
                              href={PLAYGROUND_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open Playground
                            </a>
                          </Button>
                        </DialogFooter>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
