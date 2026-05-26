"use client";

import React from "react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import {
  agentConfigApi,
  agentKnowledgeApi,
  agentToolsApi,
  agentVersionApi,
  deployApi,
  type AgentKnowledgeItem,
  type AgentTool,
  type ToolType,
  type RuntimeConfig,
  type SileroVadConfig,
  type ExtractionField,
  type AgentVersionSummary,
  type AgentDeployment,
  type DeploymentStatus,
  type DeployHealthResponse,
  type OpenAIModelGroup,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ExpandableTextarea } from "@/components/ui/expandable-textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  Loader2,
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
  Tag,
  RotateCcw,
  Activity,
  Heart,
  Zap,
  SlidersHorizontal,
  Keyboard,
  Volume2,
  Brain,
  FileOutput,
  ChevronDown,
  MessageCircle,
  Headphones,
  Info,
  CloudUpload,
  HardDrive,
  Server,
  CheckCircle2,
  XCircle,
  Clock,
  Square,
  CircleStop,
  Terminal,
  FlaskConical,
  ArrowRightLeft,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwitchDispatchRulesDialog } from "@/components/switch-dispatch-rules-dialog";

const LAST_AGENT_KEY = "voice-platform:lastAgent";

function DeployStatusBadge({ status }: { status: import("@/lib/api").DeploymentStatus }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    BUILDING: { label: "Building", className: "border-amber-200 bg-amber-50 text-amber-700", icon: <Loader2 className="h-2.5 w-2.5 animate-spin" /> },
    PUSHING:  { label: "Pushing",  className: "border-blue-200 bg-blue-50 text-blue-700",   icon: <Loader2 className="h-2.5 w-2.5 animate-spin" /> },
    DEPLOYING:{ label: "Deploying",className: "border-purple-200 bg-purple-50 text-purple-700", icon: <Loader2 className="h-2.5 w-2.5 animate-spin" /> },
    RUNNING:  { label: "Running",  className: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> },
    FAILED:   { label: "Failed",   className: "border-red-200 bg-red-50 text-red-700",      icon: <XCircle className="h-2.5 w-2.5" /> },
    STOPPED:  { label: "Stopped",  className: "border-zinc-200 bg-zinc-50 text-zinc-500",   icon: null },
  };
  const s = map[status] ?? { label: status, className: "border-zinc-200 bg-zinc-50 text-zinc-500", icon: null };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${s.className}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

const CONFIG_SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "instructions", label: "Instructions", icon: MessageSquare },
  { id: "model-voice", label: "Model & Voice", icon: Mic },
  { id: "stt", label: "Speech-to-Text", icon: Headphones },
  { id: "greeting", label: "Greeting", icon: MessageCircle },
  { id: "turn-detection", label: "Turn Detection", icon: Activity },
  { id: "interruption", label: "Interruptions", icon: Zap },
  { id: "humanization", label: "Humanization", icon: Heart },
  { id: "timeouts", label: "Timeouts", icon: Timer },
  { id: "extraction", label: "Extraction", icon: FileText },
  { id: "advanced", label: "Advanced", icon: SlidersHorizontal },
];

function AgentPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [agents, setAgents] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [newAgentName, setNewAgentName] = useState("");
  const [showNewAgentInput, setShowNewAgentInput] = useState(false);
  const [configSection, setConfigSection] = useState("instructions");

  const [rawInstructions, setRawInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const t = useTranslations("agent");
  const tc = useTranslations("common");
  const truncateText = (text: string, max: number) =>
    text.length > max ? `${text.slice(0, max)}...` : text;

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

  const DEEPGRAM_STT_MODELS = [
    { value: "nova-3-general", label: "Nova 3 General (Recomendado — pt-BR)" },
    { value: "nova-3", label: "Nova 3" },
    { value: "nova-2-conversationalai", label: "Nova 2 ConversationalAI (EN only)" },
    { value: "nova-2-phonecall", label: "Nova 2 Phonecall (EN only)" },
    { value: "nova-2-general", label: "Nova 2 General" },
    { value: "nova-3-medical", label: "Nova 3 Medical" },
  ];

  const OPENAI_WHISPER_MODELS = [
    { value: "whisper-1", label: "Whisper-1" },
  ];

  const CARTESIA_MODELS = [
    { value: "sonic-2", label: t("cartesiaRecommended") },
    { value: "sonic-3", label: "Sonic 3 (Alta qualidade)" },
    { value: "sonic-lite", label: "Sonic Lite (Rápido)" },
    { value: "sonic-turbo", label: "Sonic Turbo (Mais rápido)" },
  ];

  const TTS_DEFAULTS: Record<string, NonNullable<RuntimeConfig["tts"]>> = {
    elevenlabs: {
      provider: "elevenlabs",
      model: "eleven_multilingual_v2",
      voiceId: "ODq5zmih8GrVes37Dizd",
      language: "pt",
      stability: 0.5,
      similarityBoost: 0.75,
      speed: 1.0,
    },
    openai_tts: { provider: "openai_tts", model: "tts-1", voiceId: "coral", language: "en" },
    cartesia: { provider: "cartesia", model: "sonic-2", voiceId: "", language: "pt" },
    openai_realtime: { provider: "openai_realtime" },
  };

  const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
    model: "gpt-4o-mini-realtime-preview",
    voice: "coral",
    temperature: 0.3,
    maxTokens: 600,
    turnDetection: {
      type: "semantic_vad" as const,
      eagerness: "medium",
      create_response: true,
      interrupt_response: true,
    },
    noiseCancellation: true,
    humanization: {
      fillersEnabled: false,
      typingSounds: false,
      typingVolume: 0.4,
      ambience: false,
      ambienceSource: "office_ambience_1",
      ambienceVolume: 0.5,
    },
    persona: "sales",
    timeoutSeconds: null,
    maxCallDurationSeconds: null,
    greetingMessage: null,
    greetingMode: null,
    greetingDelayMs: null,
    tts: {
      provider: "elevenlabs",
      model: "eleven_multilingual_v2",
      voiceId: "ODq5zmih8GrVes37Dizd",
      language: "pt",
      stability: 0.5,
      similarityBoost: 0.75,
      speed: 1.0,
    },
    stt: null,
    injectSessionContext: false,
    sessionTurnDetection: null,
    pipelineTurnDetector: "turn_detector_model",
    useSileroVad: true,
    endpointing: {
      minDelay: 500,
      maxDelay: 3000,
    },
    interruption: {
      enabled: true,
      mode: "adaptive",
      minDuration: 500,
      minWords: 1,
      falseInterruptionTimeout: 2000,
      resumeFalseInterruption: true,
    },
    extractionFields: [],
    inputAudioTranscription: {
      model: "gpt-4o-mini-transcribe",
      language: "pt",
    },
    // [DISABLED] STT final timeout
    // sttFinalTimeoutMs: null,
    followUpTimeoutSeconds: null,
    followUpMessage: null,
    followUpMode: null,
    maxFollowUps: null,
    followUpGracePeriodMs: null,
  };
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>(DEFAULT_RUNTIME_CONFIG);
  const [runtimeExpanded, setRuntimeExpanded] = useState(true);
  // Tracks when user explicitly chose "Custom Voice ID" in ElevenLabs voice selector
  const [isCustomVoiceMode, setIsCustomVoiceMode] = useState(false);

  // Dynamic OpenAI model list (fetched once on mount; falls back to static list on error)
  const [openAIModels, setOpenAIModels] = useState<OpenAIModelGroup | null>(null);
  useEffect(() => {
    agentConfigApi.getOpenAIModels().then(setOpenAIModels).catch(() => {});
  }, []);

  // True if the model is a non-realtime pipeline model
  const isPipelineMode = !((runtimeConfig.model ?? "").includes("realtime"));

  const isCustomElevenLabsVoice =
    runtimeConfig.tts?.voiceId != null &&
    runtimeConfig.tts.voiceId !== "" &&
    !ELEVENLABS_VOICES.some((v) => v.id === runtimeConfig.tts?.voiceId);

  // Combined flag: show custom input when user chose custom mode OR when a non-preset voiceId is saved
  const showCustomVoiceInput = isCustomVoiceMode || isCustomElevenLabsVoice;

  const [knowledgeItems, setKnowledgeItems] = useState<AgentKnowledgeItem[]>(
    []
  );
  const [uploading, setUploading] = useState(false);
  const [summarize, setSummarize] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteKnowledgeId, setPendingDeleteKnowledgeId] = useState<string | null>(null);
  const [pendingDeleteToolId, setPendingDeleteToolId] = useState<string | null>(null);
  const [deleteAgentConfirm, setDeleteAgentConfirm] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState(false);
  const [switchAgentDialogOpen, setSwitchAgentDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Tools state ─────────────────────────────────────────────
  const [agentTools, setAgentTools] = useState<AgentTool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [toolDialogOpen, setToolDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<AgentTool | null>(null);
  const [savingTool, setSavingTool] = useState(false);
  const [deletingToolId, setDeletingToolId] = useState<string | null>(null);
  const [seedingTools, setSeedingTools] = useState(false);
  const [editExtractionIdx, setEditExtractionIdx] = useState<number | null>(null);
  const TOOL_TYPES: { value: ToolType; label: string; desc: string }[] = [
    { value: "HTTP_REQUEST", label: t("toolTypeHttp"), desc: "Makes an HTTP request to an external API" },
    { value: "PRE_CALL", label: t("toolTypePreCall"), desc: "HTTP webhook executed before the call starts" },
    { value: "POST_CALL", label: t("toolTypePostCall"), desc: "HTTP webhook executed after the call ends" },
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
    type: "HTTP_REQUEST",
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

  // ─── Versions state ──────────────────────────────────────────
  const [versions, setVersions] = useState<AgentVersionSummary[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishDescription, setPublishDescription] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [deletingVersionNum, setDeletingVersionNum] = useState<number | null>(null);
  const [viewingVersion, setViewingVersion] = useState<any | null>(null);
  const [restoreConfirmVersion, setRestoreConfirmVersion] = useState<AgentVersionSummary | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") ?? "config");

  // Sync URL when tab or agent changes
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}` as any, { scroll: false });
  }, [searchParams, pathname, router]);

  // ─── Deploy tab state ────────────────────────────────────────
  const [latestDeployment, setLatestDeployment] = useState<AgentDeployment | null>(null);
  const [loadingDeploy, setLoadingDeploy] = useState(false);
  const [deleteDeployLoading, setDeleteDeployLoading] = useState(false);
  const [buildLoading, setBuildLoading] = useState(false);
  const [prebuiltImage, setPrebuiltImage] = useState<string | null>(null);
  const [prebuiltLoading, setPrebuiltLoading] = useState(false);
  const [k8sDeployLoading, setK8sDeployLoading] = useState(false);
  const [k8sStopLoading, setK8sStopLoading] = useState(false);
  const [k8sHealth, setK8sHealth] = useState<DeployHealthResponse | null>(null);
  const [k8sVersionDialogOpen, setK8sVersionDialogOpen] = useState(false);
  const [k8sDialogVersions, setK8sDialogVersions] = useState<AgentVersionSummary[]>([]);
  const [k8sDialogSelectedVersion, setK8sDialogSelectedVersion] = useState<string>("draft");
  const buildPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const k8sPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Internal HTTP_REQUEST config keys managed by dedicated UI controls
  const HTTP_INTERNAL_KEYS = new Set(["awaitResponse", "holdPhrases", "holdPhraseIntervalMs"]);

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
      // Filter out internal HTTP_REQUEST keys from JSON view
      const visibleFields = toolForm.type === "HTTP_REQUEST"
        ? configFields.filter((f) => !HTTP_INTERNAL_KEYS.has(f.key))
        : configFields;
      setToolForm((p) => ({ ...p, config: configFieldsToJson(visibleFields) }));
    }
    setConfigMode(mode);
  };

  const getExampleParamRow = (type: ToolType): ParamRow => {
    switch (type) {
      case "HTTP_REQUEST":
        return { key: "param_name", type: "string", description: "Describe what this parameter is for", required: true, values: "" };
      case "PRE_CALL":
      case "POST_CALL":
        return { key: "", type: "string", description: "", required: false, values: "" };
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
      case "PRE_CALL":
      case "POST_CALL":
        return [];
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
          { key: "channel", value: "{{channel}}" },
          { key: "from_number", value: "{{from_number}}" },
          { key: "room_name", value: "{{room_name}}" },
        ];
      case "PRE_CALL":
        return [
          { key: "url", value: "https://api.example.com/pre-call" },
          { key: "method", value: "POST" },
          { key: "headers", value: '{"Authorization":"Bearer token","Content-Type":"application/json"}' },
          { key: "from_number", value: "{{from_number}}" },
          { key: "agent_name", value: "{{agent_name}}" },
          { key: "room_name", value: "{{room_name}}" },
        ];
      case "POST_CALL":
        return [
          { key: "url", value: "https://api.example.com/post-call" },
          { key: "method", value: "POST" },
          { key: "headers", value: '{"Authorization":"Bearer token","Content-Type":"application/json"}' },
          { key: "from_number", value: "{{from_number}}" },
          { key: "phone_number", value: "{{phone_number}}" },
          { key: "summary", value: "{{summary}}" },
          { key: "room_name", value: "{{room_name}}" },
        ];
      default:
        return [{ key: "", value: "" }];
    }
  };

  const loadAgents = useCallback(async () => {
    try {
      const list = await agentConfigApi.listAgents();
      if (list.length > 0) {
        setAgents(list);
        setSelectedAgent((prev) => {
          if (prev) return prev;
          const urlAgent = searchParams.get("agent");
          if (urlAgent && list.includes(urlAgent)) return urlAgent;
          const stored = localStorage.getItem(LAST_AGENT_KEY);
          if (stored && list.includes(stored)) return stored;
          return list[0];
        });
      } else {
        setAgents([]);
      }
    } catch {
      setAgents([]);
    }
  }, []);

  const loadConfig = useCallback(
    async (agentName: string) => {
      setLoading(true);
      try {
        const config = await agentConfigApi.get(agentName);
        const rawInstructionsStr = config.raw_instructions ?? config.instructions;
        setRawInstructions(rawInstructionsStr ?? "");
        setRuntimeConfig({ ...DEFAULT_RUNTIME_CONFIG, ...config.runtime_config });
        setLastUpdated(config.updated_at);
      } catch {
      setRawInstructions("");
        setLastUpdated(null);
        toast.error(t("loadConfigError"));
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

  const loadVersions = useCallback(async (agentName: string) => {
    setLoadingVersions(true);
    try {
      const items = await agentVersionApi.list(agentName);
      setVersions(items);
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  }, []);

  const loadDeployData = useCallback(async (agentName: string) => {
    setLoadingDeploy(true);
    try {
      const [deployment, health] = await Promise.allSettled([
        deployApi.getLatestDeployment(agentName),
        deployApi.getHealth(agentName),
      ]);
      if (deployment.status === "fulfilled") setLatestDeployment(deployment.value);
      if (health.status === "fulfilled") setK8sHealth(health.value);
    } finally {
      setLoadingDeploy(false);
    }
  }, []);

  // Poll build progress while a deploy is in-flight
  const startBuildPoll = useCallback((agentName: string, deploymentId: string) => {
    if (buildPollRef.current) clearInterval(buildPollRef.current);
    buildPollRef.current = setInterval(async () => {
      try {
        const d = await deployApi.getDeploymentById(deploymentId);
        setLatestDeployment(d);
        const inProgress: DeploymentStatus[] = ["BUILDING", "PUSHING", "DEPLOYING"];
        if (!inProgress.includes(d.status)) {
          clearInterval(buildPollRef.current!);
          buildPollRef.current = null;
          // Also refresh k8s health
          deployApi.getHealth(agentName).then(setK8sHealth).catch(() => {});
        }
      } catch {
        clearInterval(buildPollRef.current!);
        buildPollRef.current = null;
      }
    }, 2000);
  }, []);

  // Poll K8s health every 10s
  const startK8sPoll = useCallback((agentName: string) => {
    if (k8sPollRef.current) clearInterval(k8sPollRef.current);
    k8sPollRef.current = setInterval(() => {
      deployApi.getHealth(agentName).then(setK8sHealth).catch(() => {});
    }, 10000);
  }, []);

  useEffect(() => {
    return () => {
      if (buildPollRef.current) clearInterval(buildPollRef.current);
      if (k8sPollRef.current) clearInterval(k8sPollRef.current);
    };
  }, []);

  useEffect(() => {
    loadAgents();
    // Load prebuilt image config once on mount
    deployApi.getPrebuiltImage().then((r) => setPrebuiltImage(r.image)).catch(() => {});
  }, [loadAgents]);

  useEffect(() => {
    if (!selectedAgent) return;
    loadConfig(selectedAgent);
    loadKnowledge(selectedAgent);
    loadTools(selectedAgent);
    loadVersions(selectedAgent);
    loadDeployData(selectedAgent);
    startK8sPoll(selectedAgent);
  }, [selectedAgent, loadConfig, loadKnowledge, loadTools, loadVersions, loadDeployData, startK8sPoll]);

  const handleAgentChange = (value: string) => {
    if (value === "__new__") {
      setShowNewAgentInput(true);
      return;
    }
    setShowNewAgentInput(false);
    setSelectedAgent(value);
    localStorage.setItem(LAST_AGENT_KEY, value);
    // Reset deploy state on agent switch
    setLatestDeployment(null);
    setK8sHealth(null);
    if (buildPollRef.current) { clearInterval(buildPollRef.current); buildPollRef.current = null; }
    if (k8sPollRef.current) { clearInterval(k8sPollRef.current); k8sPollRef.current = null; }
    // Sync URL
    const params = new URLSearchParams(searchParams.toString());
    params.set("agent", value);
    router.replace(`${pathname}?${params.toString()}` as any, { scroll: false });
  };

  const handleBuildImage = async () => {
    if (!selectedAgent) return;
    setBuildLoading(true);
    try {
      const result = await deployApi.triggerDeploy(selectedAgent);
      toast.success(t("deployBuildStarted", { version: result.version }));
      setLatestDeployment((prev) => prev ? { ...prev, status: "BUILDING", build_logs: null } : {
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
      startBuildPoll(selectedAgent, result.deploymentId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("deployBuildError"));
    } finally {
      setBuildLoading(false);
    }
  };

  const handleUsePrebuilt = async () => {
    if (!selectedAgent) return;
    setPrebuiltLoading(true);
    try {
      const result = await deployApi.usePrebuiltImage(selectedAgent);
      toast.success(t("deployPrebuiltSet", { image: result.image_tag }));
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
      toast.error(err instanceof Error ? err.message : t("deployPrebuiltError"));
    } finally {
      setPrebuiltLoading(false);
    }
  };

  const openK8sVersionDialog = async () => {
    if (!selectedAgent) return;
    try {
      const versions = await agentVersionApi.list(selectedAgent);
      setK8sDialogVersions(versions);
    } catch {
      setK8sDialogVersions([]);
    }
    setK8sDialogSelectedVersion("draft");
    setK8sVersionDialogOpen(true);
  };

  const handleDeployToK8s = async (configVersion?: number) => {
    if (!selectedAgent) return;
    setK8sVersionDialogOpen(false);
    setK8sDeployLoading(true);
    try {
      await deployApi.deployToK8s(selectedAgent, configVersion);
      toast.success(t("deployK8sDeployed", { name: selectedAgent }));
      deployApi.getHealth(selectedAgent).then(setK8sHealth).catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("deployK8sError"));
    } finally {
      setK8sDeployLoading(false);
    }
  };

  const handleStopK8s = async () => {
    if (!selectedAgent) return;
    setK8sStopLoading(true);
    try {
      await deployApi.stopDeployment(selectedAgent);
      toast.success(t("deployK8sStopped", { name: selectedAgent }));
      setK8sHealth((prev) => prev ? { ...prev, k8s: undefined, status: "STOPPED" } : { healthy: false, status: "STOPPED" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("deployK8sStopError"));
    } finally {
      setK8sStopLoading(false);
    }
  };

  const handleDeleteDeployment = async () => {
    if (!selectedAgent) return;
    setDeleteDeployLoading(true);
    try {
      await deployApi.deleteDeployment(selectedAgent);
      toast.success(t("deployDeleted", { name: selectedAgent }));
      setLatestDeployment(null);
      setK8sHealth(null);
      if (buildPollRef.current) { clearInterval(buildPollRef.current); buildPollRef.current = null; }
      if (k8sPollRef.current) { clearInterval(k8sPollRef.current); k8sPollRef.current = null; }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("deployDeleteError"));
    } finally {
      setDeleteDeployLoading(false);
    }
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
    localStorage.setItem(LAST_AGENT_KEY, name);
  };

  const handleDeleteAgent = async () => {
    setDeletingAgent(true);
    try {
      await agentConfigApi.delete(selectedAgent);
      toast.success(t("agentDeleted", { name: selectedAgent }));
      const updatedAgents = agents.filter((a) => a !== selectedAgent);
      setAgents(updatedAgents);
      setDeleteAgentConfirm(false);
      if (updatedAgents.length > 0) {
        setSelectedAgent(updatedAgents[0]);
        localStorage.setItem(LAST_AGENT_KEY, updatedAgents[0]);
      } else {
        setSelectedAgent("");
        localStorage.removeItem(LAST_AGENT_KEY);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("deleteAgentError"));
    } finally {
      setDeletingAgent(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const instructions = rawInstructions;
      const sanitizedConfig = {
        ...runtimeConfig,
        extractionFields: (runtimeConfig.extractionFields ?? []).map(({ _optionsText, ...f }) => ({
          ...f,
          options: (_optionsText != null
            ? _optionsText.split(",").map((s) => s.trim())
            : f.options
          )?.filter(Boolean),
        })),
      };
      const config = await agentConfigApi.update(instructions, selectedAgent, {
        runtime_config: sanitizedConfig,
      });
      setLastUpdated(config.updated_at);
      toast.success(t("configSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("configSaveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "txt" && ext !== "pdf") {
      toast.error(t("unsupportedFile"));
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
        err instanceof Error ? err.message : t("uploadError")
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    setDeletingId(id);
    setPendingDeleteKnowledgeId(null);
    try {
      await agentKnowledgeApi.delete(id);
      toast.success(t("knowledgeRemoved"));
      setKnowledgeItems((prev) => prev.filter((k) => k.id !== id));
    } catch {
      toast.error(t("knowledgeRemoveError"));
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Tool handlers ──────────────────────────────────────────
  const resetToolForm = () => {
    setToolForm({
      name: "",
      type: "HTTP_REQUEST",
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
        toast.error(t("invalidJsonParams"));
        setSavingTool(false);
        return;
      }
      try {
        parsedConfig = JSON.parse(configJson || "{}");
      } catch {
        toast.error(t("invalidJsonConfig"));
        setSavingTool(false);
        return;
      }

      // Merge internal HTTP_REQUEST fields from dedicated controls when in JSON mode
      if (toolForm.type === "HTTP_REQUEST" && configMode === "json") {
        for (const f of configFields) {
          if (HTTP_INTERNAL_KEYS.has(f.key) && f.value !== undefined) {
            try {
              parsedConfig[f.key] = JSON.parse(f.value);
            } catch {
              parsedConfig[f.key] = f.value;
            }
          }
        }
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
        toast.success(t("toolUpdated", { name: toolForm.name }));
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
        toast.success(t("toolCreated", { name: toolForm.name }));
      }
      setToolDialogOpen(false);
      resetToolForm();
      await loadTools(selectedAgent);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toolSaveError"));
    } finally {
      setSavingTool(false);
    }
  };

  const handleDeleteTool = async (id: string) => {
    setDeletingToolId(id);
    setPendingDeleteToolId(null);
    try {
      await agentToolsApi.delete(id);
      toast.success(t("toolRemoved"));
      setAgentTools((prev) => prev.filter((t) => t.id !== id));
    } catch {
      toast.error(t("toolRemoveError"));
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
      toast.success(t(tool.enabled ? "toolDisabled" : "toolEnabled", { name: tool.name }));
    } catch {
      toast.error(t("toolToggleError"));
    }
  };

  const handleSeedTools = async () => {
    setSeedingTools(true);
    try {
      const result = await agentToolsApi.seed(selectedAgent);
      if (result.seeded > 0) {
        toast.success(t("defaultToolsCreated", { count: result.seeded }));
      } else {
        toast.info(t("defaultToolsExist"));
      }
      await loadTools(selectedAgent);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toolSeedError"));
    } finally {
      setSeedingTools(false);
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
      {/* ─── Page Header + Agent Selector ───────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("description")}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {showNewAgentInput ? (
            <div className="flex items-center gap-2">
              <Input
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder={t("agentNamePlaceholder")}
                className="h-8 w-[180px] text-xs"
                onKeyDown={(e) => e.key === "Enter" && handleCreateAgent()}
              />
              <Button size="sm" className="h-8 text-xs" onClick={handleCreateAgent}>
                {tc("create")}
              </Button>
              <button
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={() => { setShowNewAgentInput(false); setNewAgentName(""); }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <Select value={selectedAgent} onValueChange={handleAgentChange}>
                <SelectTrigger className="h-8 min-w-[160px] text-xs">
                  <SelectValue placeholder={t("selectAnAgent")} />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                  <SelectItem value="__new__">
                    <span className="flex items-center gap-2">
                      <Plus className="h-3 w-3" />
                      {t("createNewAgent")}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <button
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-violet-200 bg-card text-xs text-violet-600 hover:bg-violet-50 hover:border-violet-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => router.push(`/agent/test?agent=${encodeURIComponent(selectedAgent)}`)}
                title={t("testAgent")}
                disabled={!selectedAgent}
              >
                <FlaskConical className="h-3.5 w-3.5" />
                {t("testAgent")}
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-blue-200 bg-card text-xs text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => setSwitchAgentDialogOpen(true)}
                title="Trocar agent nas dispatch rules"
                disabled={!selectedAgent}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Trocar Agent
              </button>
              <button
                className="p-1.5 rounded-md border bg-card text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
                onClick={() => setDeleteAgentConfirm(true)}
                title={t("deleteAgent")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── Tabs ───────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="border-b">
          <TabsList className="h-auto p-0 bg-transparent rounded-none w-full justify-start gap-0">
            <TabsTrigger value="config" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 pt-2 text-xs font-medium gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              {t("tabConfiguration")}
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 pt-2 text-xs font-medium gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              {t("tabKnowledge")}
            </TabsTrigger>
            <TabsTrigger value="tools" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 pt-2 text-xs font-medium gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              {t("tabTools")}
            </TabsTrigger>
            <TabsTrigger value="versions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 pt-2 text-xs font-medium gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              {t("tabVersions")}
              {versions.length > 0 && (
                <span className="ml-1 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">{versions.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="deploy" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 pt-2 text-xs font-medium gap-1.5">
              <CloudUpload className="h-3.5 w-3.5" />
              {t("tabDeploy")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="config" className="pt-5 pb-20">
          <div className="flex gap-6">
            {/* ─── Left Sidebar Navigation ─── */}
            <div className="w-48 flex-shrink-0 hidden md:block">
              <nav className="sticky top-6 space-y-0.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Sections</p>
                {CONFIG_SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setConfigSection(section.id)}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      configSection === section.id
                        ? "text-foreground bg-muted"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <section.icon className="h-3.5 w-3.5" />
                    {section.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* ─── Right Content ─── */}
            <div className="flex-1 min-w-0">

              {/* ════ INSTRUCTIONS SECTION ════ */}
              {configSection === "instructions" && (
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="px-5 py-4 border-b bg-muted/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          {t("instructions")}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{t("instructionsDescription")}</p>
                      </div>
                      {lastUpdated && (
                        <span className="text-[10px] text-muted-foreground">
                          {t("lastUpdated", { date: new Date(lastUpdated).toLocaleString() })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-5">
                    <ExpandableTextarea
                      value={rawInstructions}
                      onChange={(e) => setRawInstructions(e.target.value)}
                      placeholder="Define como o agente deve se comportar. Use linguagem natural ou markdown estruturado."
                      className="font-mono text-sm min-h-[160px]"
                      spellCheck={false}
                      expandLabel="Expandir instruções"
                      collapseLabel="Recolher"
                    />
                  </div>
                </div>
              )}

              {/* ════ MODEL & VOICE SECTION ════ */}
              {configSection === "model-voice" && (
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="px-5 py-4 border-b bg-muted/40">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <Mic className="h-4 w-4 text-muted-foreground" />
                      {t("modelAndVoice")}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("modelAndVoiceDescription")}</p>
                  </div>
                  <div className="p-5 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Selector 1 — LLM Model */}
                    <div className="space-y-1">
                      <Label htmlFor="rt-model" className="text-xs text-muted-foreground">
                        LLM Model
                      </Label>
                      <Select
                        value={runtimeConfig.model ?? "gpt-4o-mini-realtime-preview"}
                        onValueChange={(newModel) => {
                          const newIsPipeline = !newModel.includes("realtime");
                          const wasRealtime = (runtimeConfig.model ?? "").includes("realtime");
                          const currentProvider = runtimeConfig.tts?.provider ?? "openai_realtime";
                          let newProvider = currentProvider;
                          if (wasRealtime && !newIsPipeline) {
                            if (currentProvider === "openai_realtime") newProvider = "elevenlabs";
                          } else if (!wasRealtime && !newIsPipeline === false) {
                            if (currentProvider === "openai_tts" || currentProvider === "cartesia") newProvider = "openai_realtime";
                          }
                          if (newProvider !== currentProvider) setIsCustomVoiceMode(false);
                          setRuntimeConfig((prev) => ({
                            ...prev,
                            model: newModel,
                            tts: newProvider !== currentProvider
                              ? (TTS_DEFAULTS[newProvider] ?? { provider: newProvider })
                              : prev.tts,
                            stt: newIsPipeline && !prev.stt
                              ? { provider: "deepgram" as const, model: "nova-3-general", language: "pt", detectLanguage: false }
                              : newIsPipeline ? prev.stt : null,
                            sessionTurnDetection: newIsPipeline
                              ? (prev.sessionTurnDetection ?? "stt")
                              : null,
                          }));
                        }}
                      >
                        <SelectTrigger id="rt-model">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {openAIModels ? (
                            <>
                              {openAIModels.realtime.length > 0 && (
                                <SelectGroup>
                                  <SelectLabel>OpenAI Realtime</SelectLabel>
                                  {openAIModels.realtime.map((m) => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                  ))}
                                </SelectGroup>
                              )}
                              {openAIModels.pipeline_llm.length > 0 && (
                                <SelectGroup>
                                  <SelectLabel>Pipeline — LLM</SelectLabel>
                                  {openAIModels.pipeline_llm.map((m) => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                  ))}
                                </SelectGroup>
                              )}
                            </>
                          ) : (
                            <>
                              <SelectGroup>
                                <SelectLabel>OpenAI Realtime</SelectLabel>
                                <SelectItem value="gpt-4o-mini-realtime-preview">gpt-4o-mini-realtime-preview</SelectItem>
                                <SelectItem value="gpt-4o-realtime-preview">gpt-4o-realtime-preview</SelectItem>
                              </SelectGroup>
                              <SelectGroup>
                                <SelectLabel>Pipeline — GPT-4.1</SelectLabel>
                                <SelectItem value="gpt-4.1">gpt-4.1</SelectItem>
                                <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
                                <SelectItem value="gpt-4.1-nano">gpt-4.1-nano</SelectItem>
                              </SelectGroup>
                              <SelectGroup>
                                <SelectLabel>Pipeline — GPT-4o</SelectLabel>
                                <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                                <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                              </SelectGroup>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Selector 2 — TTS Engine */}
                    <div className="space-y-1">
                      <Label htmlFor="rt-tts-engine" className="text-xs text-muted-foreground">
                        TTS Engine
                      </Label>
                      <Select
                        value={runtimeConfig.tts?.provider ?? (isPipelineMode ? "elevenlabs" : "openai_realtime")}
                        onValueChange={(v) => {
                          setIsCustomVoiceMode(false);
                          setRuntimeConfig((prev) => ({
                            ...prev,
                            tts: TTS_DEFAULTS[v] ?? { provider: v },
                          }));
                        }}
                      >
                        <SelectTrigger id="rt-tts-engine">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {!isPipelineMode && (
                            <SelectItem value="openai_realtime">OpenAI Voice (Realtime)</SelectItem>
                          )}
                          <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                          {isPipelineMode && (
                            <>
                              <SelectItem value="openai_tts">OpenAI TTS</SelectItem>
                              <SelectItem value="cartesia">Cartesia</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        {isPipelineMode
                          ? "Provedor de síntese de voz para pipeline mode."
                          : "Realtime: voz nativa OpenAI ou ElevenLabs via text-mode."}
                      </p>
                    </div>
                  </div>

                  {runtimeConfig.tts?.provider === "elevenlabs" ? (
                    <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          ElevenLabs TTS Settings
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isPipelineMode
                            ? "Pipeline mode: agent uses the selected STT for transcription and ElevenLabs for speech output."
                            : "The agent uses OpenAI Realtime for STT & reasoning and ElevenLabs for speech output."}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor="rt-11l-voice" className="text-xs text-muted-foreground">
                            Voice
                          </Label>
                          <Select
                            value={
                              showCustomVoiceInput
                                ? "__custom__"
                                : (runtimeConfig.tts?.voiceId || "ODq5zmih8GrVes37Dizd")
                            }
                            onValueChange={(v) => {
                              if (v === "__custom__") {
                                setIsCustomVoiceMode(true);
                                setRuntimeConfig((prev) => ({
                                  ...prev,
                                  tts: { ...prev.tts, voiceId: "" },
                                }));
                              } else {
                                setIsCustomVoiceMode(false);
                                setRuntimeConfig((prev) => ({
                                  ...prev,
                                  tts: { ...prev.tts, voiceId: v },
                                }));
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

                      {showCustomVoiceInput && (
                        <div className="space-y-1">
                          <Label htmlFor="rt-11l-custom-voice" className="text-xs text-muted-foreground">
                            Custom Voice ID
                          </Label>
                          <Input
                            id="rt-11l-custom-voice"
                            type="text"
                            placeholder={t("voiceIdPlaceholder")}
                            value={runtimeConfig.tts?.voiceId ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
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
                            {t("stability")} ({runtimeConfig.tts?.stability?.toFixed(2) ?? "0.50"})
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
                            <span>{t("moreExpressive")}</span>
                            <span>{t("moreConsistent")}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="rt-11l-similarity" className="text-xs text-muted-foreground">
                            {t("similarity")} ({runtimeConfig.tts?.similarityBoost?.toFixed(2) ?? "0.75"})
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
                            <span>{t("moreVaried")}</span>
                            <span>{t("moreFaithful")}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="rt-11l-speed" className="text-xs text-muted-foreground">
                            {t("speed")} ({runtimeConfig.tts?.speed?.toFixed(2) ?? "1.00"})
                          </Label>
                          <input
                            id="rt-11l-speed"
                            type="range"
                            min={0.5}
                            max={2}
                            step={0.05}
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
                  ) : runtimeConfig.tts?.provider === "openai_tts" ? (
                    /* OpenAI TTS settings for pipeline mode */
                    <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          OpenAI TTS Settings
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Pipeline mode using OpenAI TTS for speech synthesis.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor="rt-oai-tts-voice" className="text-xs text-muted-foreground">
                            Voice
                          </Label>
                          <Select
                            value={runtimeConfig.tts?.voiceId ?? "coral"}
                            onValueChange={(v) =>
                              setRuntimeConfig((prev) => ({
                                ...prev,
                                tts: { ...prev.tts, voiceId: v },
                              }))
                            }
                          >
                            <SelectTrigger id="rt-oai-tts-voice">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"].map((v) => (
                                <SelectItem key={v} value={v}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="rt-oai-tts-model" className="text-xs text-muted-foreground">
                            TTS Model
                          </Label>
                          <Select
                            value={runtimeConfig.tts?.model ?? "tts-1"}
                            onValueChange={(v) =>
                              setRuntimeConfig((prev) => ({
                                ...prev,
                                tts: { ...prev.tts, model: v },
                              }))
                            }
                          >
                            <SelectTrigger id="rt-oai-tts-model">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tts-1">tts-1 (rápido)</SelectItem>
                              <SelectItem value="tts-1-hd">tts-1-hd (alta qualidade)</SelectItem>
                              <SelectItem value="gpt-4o-mini-tts">gpt-4o-mini-tts</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ) : runtimeConfig.tts?.provider === "cartesia" ? (
                    /* Cartesia TTS settings for pipeline mode */
                    <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Cartesia TTS Settings
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Pipeline mode usando Cartesia para síntese de voz. Requer <code>CARTESIA_API_KEY</code>.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor="rt-cartesia-model" className="text-xs text-muted-foreground">
                            Modelo
                          </Label>
                          <Select
                            value={runtimeConfig.tts?.model ?? "sonic-2"}
                            onValueChange={(v) =>
                              setRuntimeConfig((prev) => ({
                                ...prev,
                                tts: { ...prev.tts, model: v },
                              }))
                            }
                          >
                            <SelectTrigger id="rt-cartesia-model">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CARTESIA_MODELS.map((m) => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="rt-cartesia-lang" className="text-xs text-muted-foreground">
                            Idioma
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
                            <SelectTrigger id="rt-cartesia-lang">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pt">Português</SelectItem>
                              <SelectItem value="en">English</SelectItem>
                              <SelectItem value="es">Español</SelectItem>
                              <SelectItem value="fr">Français</SelectItem>
                              <SelectItem value="de">Deutsch</SelectItem>
                              <SelectItem value="zh">中文</SelectItem>
                              <SelectItem value="ja">日本語</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label htmlFor="rt-cartesia-voice" className="text-xs text-muted-foreground">
                            Voice ID
                          </Label>
                          <Input
                            id="rt-cartesia-voice"
                            placeholder="ex: f786b574-daa5-4673-aa0c-cbe3e8534c02"
                            value={runtimeConfig.tts?.voiceId ?? ""}
                            onChange={(e) =>
                              setRuntimeConfig((prev) => ({
                                ...prev,
                                tts: { ...prev.tts, voiceId: e.target.value },
                              }))
                            }
                          />
                          <p className="text-[11px] text-muted-foreground">
                            ID da voz no Cartesia Voice Library. Deixe vazio para usar a voz padrão.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* OpenAI Realtime voice selector */
                    <div className="space-y-1">
                      <Label htmlFor="rt-voice" className="text-xs text-muted-foreground">
                        Voice (OpenAI Realtime)
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
                </div>
              )}

              {/* ════ STT SECTION ════ */}
              {configSection === "stt" && (
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="px-5 py-4 border-b bg-muted/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                          <Headphones className="h-4 w-4 text-muted-foreground" />
                          STT — Speech-to-Text
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Configure speech recognition for voice input</p>
                      </div>
                      {isPipelineMode && (
                        <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">Pipeline Only</span>
                      )}
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                {isPipelineMode && (
                  <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor="rt-stt-provider" className="text-xs text-muted-foreground">
                            STT Provider
                          </Label>
                          <Select
                            value={runtimeConfig.stt?.provider ?? "deepgram"}
                            onValueChange={(v) => {
                              const provider = v as "openai_whisper" | "deepgram";
                              const defaultModel =
                                provider === "deepgram" ? "nova-3-general" : "whisper-1";
                              setRuntimeConfig((prev) => ({
                                ...prev,
                                stt: { ...prev.stt, provider, model: defaultModel },
                              }));
                            }}
                          >
                            <SelectTrigger id="rt-stt-provider">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="deepgram">Deepgram (Recomendado)</SelectItem>
                              <SelectItem value="openai_whisper">OpenAI Whisper</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">
                            Deepgram = melhor para tempo real. OpenAI = mais preciso.
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="rt-stt-model" className="text-xs text-muted-foreground">
                            STT Model
                          </Label>
                          <Select
                            value={runtimeConfig.stt?.model ?? "nova-3-general"}
                            onValueChange={(v) =>
                              setRuntimeConfig((prev) => ({
                                ...prev,
                                stt: { ...prev.stt, model: v },
                              }))
                            }
                          >
                            <SelectTrigger id="rt-stt-model">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(runtimeConfig.stt?.provider === "deepgram"
                                ? DEEPGRAM_STT_MODELS
                                : OPENAI_WHISPER_MODELS
                              ).map((m) => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor="rt-stt-lang" className="text-xs text-muted-foreground">
                            Idioma STT
                          </Label>
                          <Select
                            value={runtimeConfig.stt?.language ?? "pt"}
                            onValueChange={(v) =>
                              setRuntimeConfig((prev) => ({
                                ...prev,
                                stt: { ...prev.stt, language: v },
                              }))
                            }
                          >
                            <SelectTrigger id="rt-stt-lang">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pt">Português (pt)</SelectItem>
                              <SelectItem value="pt-BR">Português BR (pt-BR)</SelectItem>
                              <SelectItem value="en">English (en)</SelectItem>
                              <SelectItem value="en-US">English US (en-US)</SelectItem>
                              <SelectItem value="es">Español (es)</SelectItem>
                              <SelectItem value="fr">Français (fr)</SelectItem>
                              <SelectItem value="de">Deutsch (de)</SelectItem>
                              <SelectItem value="it">Italiano (it)</SelectItem>
                              <SelectItem value="ja">日本語 (ja)</SelectItem>
                              <SelectItem value="ko">한국어 (ko)</SelectItem>
                              <SelectItem value="zh">中文 (zh)</SelectItem>
                              <SelectItem value="multi">Multi-idioma (auto)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 flex flex-col justify-end">
                          <div className="flex items-center gap-2 pt-5">
                            <input
                              type="checkbox"
                              id="rt-stt-detect-lang"
                              checked={runtimeConfig.stt?.detectLanguage ?? false}
                              onChange={(e) =>
                                setRuntimeConfig((prev) => ({
                                  ...prev,
                                  stt: { ...prev.stt, detectLanguage: e.target.checked },
                                }))
                              }
                              className="rounded border-input accent-primary"
                            />
                            <Label htmlFor="rt-stt-detect-lang" className="text-xs text-muted-foreground cursor-pointer">
                              Auto-detectar idioma
                            </Label>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Ignora o idioma selecionado e detecta automaticamente.
                          </p>
                        </div>
                      </div>

                      {/* Endpointing + Advanced options (Deepgram only) */}
                      {runtimeConfig.stt?.provider === 'deepgram' && (
                        <>
                          <div className="space-y-1">
                            <Label htmlFor="rt-stt-endpointing" className="text-xs text-muted-foreground">
                              Endpointing (ms)
                            </Label>
                            <Input
                              id="rt-stt-endpointing"
                              type="number"
                              min={10}
                              max={5000}
                              step={10}
                              placeholder="200"
                              value={runtimeConfig.stt?.endpointing ?? ''}
                              onChange={(e) =>
                                setRuntimeConfig((prev) => ({
                                  ...prev,
                                  stt: {
                                    ...prev.stt,
                                    endpointing: e.target.value ? Number(e.target.value) : undefined,
                                  },
                                }))
                              }
                              className="h-8 text-xs"
                            />
                            <p className="text-[11px] text-muted-foreground">
                              Tempo de silêncio para considerar fim de fala. Menor = mais rápido, maior = mais paciência para pausas. Padrão: 200ms.
                            </p>
                          </div>

                          {/* Deepgram advanced options */}
                          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 space-y-4">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Opções avançadas Deepgram</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="space-y-1">
                                <Label htmlFor="rt-stt-samplerate" className="text-xs text-muted-foreground">Sample Rate (Hz)</Label>
                                <Input
                                  id="rt-stt-samplerate"
                                  type="number"
                                  min={8000}
                                  max={48000}
                                  step={1000}
                                  placeholder="16000"
                                  value={runtimeConfig.stt?.sampleRate ?? ''}
                                  onChange={(e) =>
                                    setRuntimeConfig((prev) => ({
                                      ...prev,
                                      stt: { ...prev.stt, sampleRate: e.target.value ? Number(e.target.value) : undefined },
                                    }))
                                  }
                                  className="h-8 text-xs"
                                />
                                <p className="text-[11px] text-muted-foreground">Taxa de amostragem do áudio. Padrão: 16000.</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {(
                                [
                                  { id: "rt-stt-interim", key: "interimResults", label: "Interim Results", desc: "Retorna transcrições parciais em tempo real antes do final da frase.", defaultVal: true },
                                  { id: "rt-stt-punctuate", key: "punctuate", label: "Punctuate", desc: "Adiciona pontuação automática na transcrição.", defaultVal: true },
                                  { id: "rt-stt-smartformat", key: "smartFormat", label: "Smart Format", desc: "Formata datas, horas e números automaticamente.", defaultVal: false },
                                  { id: "rt-stt-numerals", key: "numerals", label: "Numerals", desc: "Converte números por extenso (\"dois\") para algarismos (\"2\").", defaultVal: true },
                                ] as { id: string; key: keyof NonNullable<typeof runtimeConfig.stt>; label: string; desc: string; defaultVal: boolean }[]
                              ).map(({ id, key, label, desc, defaultVal }) => (
                                <label key={id} htmlFor={id} className="flex items-start gap-2 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
                                  <input
                                    type="checkbox"
                                    id={id}
                                    checked={(runtimeConfig.stt?.[key] as boolean | undefined) ?? defaultVal}
                                    onChange={(e) =>
                                      setRuntimeConfig((prev) => ({
                                        ...prev,
                                        stt: { ...prev.stt, [key]: e.target.checked },
                                      }))
                                    }
                                    className="mt-0.5 rounded border-input accent-primary flex-shrink-0"
                                  />
                                  <div>
                                    <span className="text-xs font-medium block">{label}</span>
                                    <span className="text-[11px] text-muted-foreground">{desc}</span>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                  </div>
                )}
                  </div>
                </div>
              )}
              {configSection === "advanced" && (
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="px-5 py-4 border-b bg-muted/40">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                      Advanced Settings
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Temperature, tokens, persona, and other advanced options</p>
                  </div>
                  <div className="p-5 space-y-5">

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

                {/* Noise Cancellation & Inject Session Context */}
                <div className="border-t pt-4 space-y-3">
                  <label className="flex items-center justify-between rounded-lg border px-3 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div>
                      <span className="text-xs font-medium">Noise Cancellation</span>
                      <p className="text-[11px] text-muted-foreground">
                        Filters background noise from the caller&apos;s audio for clearer speech recognition.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={runtimeConfig.noiseCancellation ?? true}
                      onChange={(e) =>
                        setRuntimeConfig((prev) => ({
                          ...prev,
                          noiseCancellation: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-border ml-4 flex-shrink-0"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border px-3 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div>
                      <span className="text-xs font-medium">Inject Session Context</span>
                      <p className="text-[11px] text-muted-foreground">
                        Append room metadata (channel, from_number, customer_name, etc.) to the agent&apos;s instructions.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={runtimeConfig.injectSessionContext ?? false}
                      onChange={(e) =>
                        setRuntimeConfig((prev) => ({
                          ...prev,
                          injectSessionContext: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-border ml-4 flex-shrink-0"
                    />
                  </label>
                </div>

                  </div>
                </div>
              )}

              {/* ════ GREETING SECTION ════ */}
              {configSection === "greeting" && (
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="px-5 py-4 border-b bg-muted/40">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      Greeting Message
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">The first message the agent speaks when a call starts</p>
                  </div>
                  <div className="p-5 space-y-4">
                <div className="space-y-2">
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
                    placeholder={t("greetingPlaceholder")}
                  />

                  {/* Greeting Mode */}
                  <div className="space-y-1 pt-1">
                    <Label htmlFor="rt-greeting-mode" className="text-xs text-muted-foreground">
                      {t("greetingMode")}
                    </Label>
                    <Select
                      value={runtimeConfig.greetingMode ?? "auto"}
                      onValueChange={(v) =>
                        setRuntimeConfig((prev) => ({
                          ...prev,
                          greetingMode: v === "auto" ? null : (v as "say" | "generateReply"),
                        }))
                      }
                    >
                      <SelectTrigger id="rt-greeting-mode" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">
                          {t("greetingModeAuto")}
                        </SelectItem>
                        <SelectItem value="say">
                          {t("greetingModeSay")}
                        </SelectItem>
                        <SelectItem value="generateReply">
                          {t("greetingModeGenerate")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      {t("greetingModeHelp")}
                    </p>
                  </div>

                  {/* Greeting Delay */}
                  <div className="space-y-1 pt-1">
                    <Label htmlFor="rt-greeting-delay" className="text-xs text-muted-foreground">
                      Delay antes da saudação (ms)
                    </Label>
                    <Input
                      id="rt-greeting-delay"
                      type="number"
                      min={0}
                      max={10000}
                      step={100}
                      placeholder="0 (sem delay)"
                      value={runtimeConfig.greetingDelayMs ?? ""}
                      onChange={(e) =>
                        setRuntimeConfig((prev) => ({
                          ...prev,
                          greetingDelayMs: e.target.value ? Number(e.target.value) : null,
                        }))
                      }
                      className="h-8 text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Aguarda N ms após conectar antes de iniciar a saudação. Útil para evitar corte das primeiras palavras.
                    </p>
                  </div>
                </div>

                  </div>
                </div>
              )}

              {/* ════ TURN DETECTION SECTION ════ */}
              {configSection === "turn-detection" && (
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="px-5 py-4 border-b bg-muted/40">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      {t("turnDetection")}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isPipelineMode
                        ? t("turnDetectionPipelineDescription")
                        : t("turnDetectionDescription")}
                    </p>
                  </div>
                  <div className="p-5 space-y-5">

                {/* Pipeline mode panel */}
                {isPipelineMode && (
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pipeline Mode</span>
                      <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">Pipeline Only</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">
                          {t("turnDetector")}
                        </label>
                        <Select
                          value={runtimeConfig.pipelineTurnDetector ?? "turn_detector_model"}
                          onValueChange={(v) =>
                            setRuntimeConfig((prev) => ({
                              ...prev,
                              pipelineTurnDetector: v as "turn_detector_model" | "vad" | "stt" | "manual",
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="turn_detector_model">{t("turnDetectorModel")}</SelectItem>
                            <SelectItem value="stt">{t("turnDetectorStt")}</SelectItem>
                            <SelectItem value="vad">{t("turnDetectorVad")}</SelectItem>
                            <SelectItem value="manual">{t("turnDetectorManual")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <label className="flex items-center justify-between rounded-lg border px-3 py-3 cursor-pointer hover:bg-muted/30 transition-colors col-span-1 sm:col-span-2">
                        <div>
                          <span className="text-xs font-medium">Silero VAD</span>
                          <p className="text-[11px] text-muted-foreground">Detecção de atividade vocal — recomendado para interrupções responsivas</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={runtimeConfig.useSileroVad ?? true}
                          onChange={(e) =>
                            setRuntimeConfig((prev) => ({
                              ...prev,
                              useSileroVad: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-border ml-4 flex-shrink-0"
                        />
                      </label>
                    </div>

                    {/* Silero VAD advanced config */}
                    {(runtimeConfig.useSileroVad ?? true) && (
                      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 space-y-4">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Configuração Silero VAD</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {(
                            [
                              { id: "silero-min-speech", key: "minSpeechDuration", label: "Min Speech (ms)", desc: "Duração mínima de fala para ativar o VAD. Padrão: 50ms.", step: 10, min: 10, max: 500, defaultVal: 50 },
                              { id: "silero-min-silence", key: "minSilenceDuration", label: "Min Silence (ms)", desc: "Silêncio mínimo para considerar fim de fala. Padrão: 550ms.", step: 50, min: 100, max: 2000, defaultVal: 550 },
                              { id: "silero-prefix-pad", key: "prefixPaddingDuration", label: "Prefix Padding (ms)", desc: "Áudio antes da fala incluído no chunk. Padrão: 500ms.", step: 50, min: 0, max: 2000, defaultVal: 500 },
                              { id: "silero-max-buf", key: "maxBufferedSpeech", label: "Max Buffered (ms)", desc: "Máximo de fala em buffer antes de forçar o turno. Padrão: 60000ms.", step: 1000, min: 5000, max: 120000, defaultVal: 60000 },
                              { id: "silero-threshold", key: "activationThreshold", label: "Activation Threshold", desc: "Sensibilidade de detecção de voz (0.0–1.0). Padrão: 0.5.", step: 0.05, min: 0, max: 1, defaultVal: 0.5 },
                              { id: "silero-samplerate", key: "sampleRate", label: "Sample Rate (Hz)", desc: "Taxa de amostragem do modelo VAD. Padrão: 16000.", step: 1000, min: 8000, max: 48000, defaultVal: 16000 },
                            ] as { id: string; key: keyof SileroVadConfig; label: string; desc: string; step: number; min: number; max: number; defaultVal: number }[]
                          ).map(({ id, key, label, desc, step, min, max, defaultVal }) => (
                            <div key={id} className="space-y-1">
                              <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
                              <Input
                                id={id}
                                type="number"
                                step={step}
                                min={min}
                                max={max}
                                placeholder={String(defaultVal)}
                                value={runtimeConfig.sileroVad?.[key] ?? ''}
                                onChange={(e) =>
                                  setRuntimeConfig((prev) => ({
                                    ...prev,
                                    sileroVad: {
                                      ...prev.sileroVad,
                                      [key]: e.target.value ? Number(e.target.value) : undefined,
                                    },
                                  }))
                                }
                                className="h-8 text-xs"
                              />
                              <p className="text-[11px] text-muted-foreground">{desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                  {/* Realtime mode panel */}
                  {!isPipelineMode && (
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Realtime Mode</span>
                      <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">Realtime Only</span>
                    </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Type selector */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Type</label>
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
                        <SelectTrigger>
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
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Threshold</label>
                          <Input
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
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Prefix Padding (ms)</label>
                          <Input
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
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Silence (ms)</label>
                          <Input
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
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Eagerness</label>
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
                          <SelectTrigger>
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

                  {/* Shared toggles */}
                  <div className="space-y-3 pt-1">
                    <label className="flex items-center justify-between rounded-lg border px-3 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                      <div>
                        <span className="text-xs font-medium">Create Response</span>
                        <p className="text-[11px] text-muted-foreground">Gera resposta automaticamente quando detecta fim do turno</p>
                      </div>
                      <input
                        type="checkbox"
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
                        className="h-4 w-4 rounded border-border ml-4 flex-shrink-0"
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border px-3 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                      <div>
                        <span className="text-xs font-medium">Interrupt Response</span>
                        <p className="text-[11px] text-muted-foreground">Permite que fala do usuário interrompa a resposta do agente</p>
                      </div>
                      <input
                        type="checkbox"
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
                        className="h-4 w-4 rounded border-border ml-4 flex-shrink-0"
                      />
                    </label>
                  </div>

                  {/* Input Audio Transcription */}
                  <div className="border-t pt-4 space-y-3">
                    <div>
                      <span className="text-xs font-semibold">Input Audio Transcription</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Modelo usado para transcrição do áudio de entrada em sessões realtime.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Transcription Model</label>
                        <Select
                          value={runtimeConfig.inputAudioTranscription?.model ?? "gpt-4o-mini-transcribe"}
                          onValueChange={(v) =>
                            setRuntimeConfig((prev) => ({
                              ...prev,
                              inputAudioTranscription: {
                                ...prev.inputAudioTranscription,
                                model: v,
                              },
                            }))
                          }
                        >
                          <SelectTrigger id="rt-iat-model">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-4o-mini-transcribe">gpt-4o-mini-transcribe (Recomendado)</SelectItem>
                            <SelectItem value="gpt-4o-transcribe">gpt-4o-transcribe</SelectItem>
                            <SelectItem value="whisper-1">whisper-1</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                          gpt-4o-mini = rápido e barato. gpt-4o = mais preciso. whisper-1 = legacy.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Idioma Transcrição</label>
                        <Select
                          value={runtimeConfig.inputAudioTranscription?.language ?? "pt"}
                          onValueChange={(v) =>
                            setRuntimeConfig((prev) => ({
                              ...prev,
                              inputAudioTranscription: {
                                ...prev.inputAudioTranscription,
                                language: v,
                              },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pt">Português (pt)</SelectItem>
                            <SelectItem value="en">English (en)</SelectItem>
                            <SelectItem value="en-US">English US (en-US)</SelectItem>
                            <SelectItem value="es">Español (es)</SelectItem>
                            <SelectItem value="fr">Français (fr)</SelectItem>
                            <SelectItem value="de">Deutsch (de)</SelectItem>
                            <SelectItem value="it">Italiano (it)</SelectItem>
                            <SelectItem value="ja">日本語 (ja)</SelectItem>
                            <SelectItem value="ko">한국어 (ko)</SelectItem>
                            <SelectItem value="zh">中文 (zh)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  </div> )} {/* end !isPipelineMode / realtime panel */}

                {/* Endpointing — Pipeline Only */}
                {isPipelineMode && (
                <div className="border-t pt-4 space-y-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">Endpointing</span>
                      <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">Pipeline Only</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Controla quanto tempo o agente espera após o silêncio antes de considerar que o turno do usuário acabou.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Min Delay (ms)</label>
                      <Input
                        type="number"
                        step={100}
                        min={100}
                        max={5000}
                        value={runtimeConfig.endpointing?.minDelay ?? 500}
                        onChange={(e) =>
                          setRuntimeConfig((prev) => ({
                            ...prev,
                            endpointing: {
                              ...prev.endpointing,
                              minDelay: Number(e.target.value),
                            },
                          }))
                        }
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Tempo mínimo de silêncio para encerrar o turno. (default: 500ms)
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Max Delay (ms)</label>
                      <Input
                        type="number"
                        step={100}
                        min={500}
                        max={10000}
                        value={runtimeConfig.endpointing?.maxDelay ?? 3000}
                        onChange={(e) =>
                          setRuntimeConfig((prev) => ({
                            ...prev,
                            endpointing: {
                              ...prev.endpointing,
                              maxDelay: Number(e.target.value),
                            },
                          }))
                        }
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Tempo máximo antes de encerrar o turno automaticamente. (default: 3000ms)
                      </p>
                    </div>
                  </div>
                </div>
                )}

                </div>
                </div>
              )}

              {/* ════ INTERRUPTION SECTION ════ */}
              {configSection === "interruption" && (
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="px-5 py-4 border-b bg-muted/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                          <Zap className="h-4 w-4 text-muted-foreground" />
                          Interruption Handling
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Configure how the agent reacts when users interrupt</p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={runtimeConfig.interruption?.enabled ?? true}
                          onChange={(e) =>
                            setRuntimeConfig((prev) => ({
                              ...prev,
                              interruption: {
                                ...prev.interruption,
                                enabled: e.target.checked,
                              },
                            }))
                          }
                          className="h-4 w-4 rounded border-border"
                        />
                        <span className="text-xs font-medium">Enabled</span>
                      </label>
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    {(runtimeConfig.interruption?.enabled ?? true) && (
                      <>
                        {/* Detection Mode — card selector */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium mb-1 block">Modo de Detecção</label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setRuntimeConfig((prev) => ({
                                  ...prev,
                                  interruption: { ...prev.interruption, mode: "adaptive" as const },
                                }))
                              }
                              className={`rounded-lg p-3 text-left transition-colors ${
                                (runtimeConfig.interruption?.mode ?? "adaptive") === "adaptive"
                                  ? "border-2 border-foreground bg-muted/50"
                                  : "border bg-card hover:border-foreground/20"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Brain className="h-3.5 w-3.5" />
                                <span className="text-xs font-semibold">Adaptive</span>
                                <span className="ml-auto text-[10px] text-emerald-600 font-medium">Recomendado</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">Distingue interrupções reais de backchannel usando ML. Requer credenciais LiveKit Cloud (LIVEKIT_INFERENCE_API_KEY).</p>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setRuntimeConfig((prev) => ({
                                  ...prev,
                                  interruption: { ...prev.interruption, mode: "vad" as const },
                                }))
                              }
                              className={`rounded-lg p-3 text-left transition-colors ${
                                (runtimeConfig.interruption?.mode ?? "adaptive") === "vad"
                                  ? "border-2 border-foreground bg-muted/50"
                                  : "border bg-card hover:border-foreground/20"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Activity className="h-3.5 w-3.5" />
                                <span className="text-xs font-semibold">VAD</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">Qualquer fala detectada interrompe o agente. Fallback para self-hosted sem credenciais Cloud.</p>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium">Min Duration (ms)</label>
                            <Input
                              type="number"
                              step={100}
                              min={0}
                              max={5000}
                              value={runtimeConfig.interruption?.minDuration ?? 500}
                              onChange={(e) =>
                                setRuntimeConfig((prev) => ({
                                  ...prev,
                                  interruption: {
                                    ...prev.interruption,
                                    minDuration: Number(e.target.value),
                                  },
                                }))
                              }
                            />
                            <p className="text-[11px] text-muted-foreground">
                              Duração mínima de fala para ser considerada interrupção.
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium">Min Words</label>
                            <Input
                              type="number"
                              step={1}
                              min={0}
                              max={10}
                              value={runtimeConfig.interruption?.minWords ?? 1}
                              onChange={(e) =>
                                setRuntimeConfig((prev) => ({
                                  ...prev,
                                  interruption: {
                                    ...prev.interruption,
                                    minWords: Number(e.target.value),
                                  },
                                }))
                              }
                            />
                            <p className="text-[11px] text-muted-foreground">
                              Mínimo de palavras transcritas para considerar interrupção.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium">False Interruption Timeout (ms)</label>
                            <Input
                              type="number"
                              step={500}
                              min={500}
                              max={10000}
                              value={runtimeConfig.interruption?.falseInterruptionTimeout ?? 2000}
                              onChange={(e) =>
                                setRuntimeConfig((prev) => ({
                                  ...prev,
                                  interruption: {
                                    ...prev.interruption,
                                    falseInterruptionTimeout: Number(e.target.value),
                                  },
                                }))
                              }
                            />
                            <p className="text-[11px] text-muted-foreground">
                              Tempo de silêncio após interrupção para considerar falso positivo.
                            </p>
                          </div>
                          <div className="flex items-center gap-3 self-end pb-1">
                            <input
                              type="checkbox"
                              id="rt-int-resume"
                              checked={runtimeConfig.interruption?.resumeFalseInterruption ?? true}
                              onChange={(e) =>
                                setRuntimeConfig((prev) => ({
                                  ...prev,
                                  interruption: {
                                    ...prev.interruption,
                                    resumeFalseInterruption: e.target.checked,
                                  },
                                }))
                              }
                              className="h-4 w-4 rounded border-border"
                            />
                            <div>
                              <span className="text-xs font-medium">Retomar fala após falsa interrupção</span>
                              <p className="text-[11px] text-muted-foreground">Continue previous speech if interruption was false</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ════ HUMANIZATION SECTION ════ */}
              {configSection === "humanization" && (
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="px-5 py-4 border-b bg-muted/40">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <Heart className="h-4 w-4 text-muted-foreground" />
                      Humanization
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("humanizationDescription")}</p>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Fillers card */}
                      <label className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors cursor-pointer block">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                            <MessageCircle className="h-4 w-4 text-amber-600" />
                          </div>
                          <input
                            type="checkbox"
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
                        </div>
                        <h3 className="text-xs font-semibold mb-0.5">{t("fillers")}</h3>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{t("fillersHint")}</p>
                      </label>
                      {/* Typing Sounds card */}
                      <label className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors cursor-pointer block">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                            <Keyboard className="h-4 w-4 text-blue-600" />
                          </div>
                          <input
                            type="checkbox"
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
                        </div>
                        <h3 className="text-xs font-semibold mb-0.5">{t("typingSounds")}</h3>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{t("typingSoundsHint")}</p>
                        {runtimeConfig.humanization?.typingSounds && (
                          <div className="mt-3 pt-3 border-t" onClick={(e) => e.preventDefault()}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-muted-foreground">{t("volume")}</span>
                              <span className="text-[11px] font-medium tabular-nums">
                                {Math.round((runtimeConfig.humanization?.typingVolume ?? 0.4) * 100)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={runtimeConfig.humanization?.typingVolume ?? 0.4}
                              onChange={(e) =>
                                setRuntimeConfig((prev) => ({
                                  ...prev,
                                  humanization: {
                                    ...prev.humanization,
                                    typingVolume: parseFloat(e.target.value),
                                  },
                                }))
                              }
                              className="w-full h-1 accent-blue-600"
                            />
                          </div>
                        )}
                      </label>
                      {/* Office Ambience card */}
                      <label className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors cursor-pointer block">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                            <Volume2 className="h-4 w-4 text-emerald-600" />
                          </div>
                          <input
                            type="checkbox"
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
                        </div>
                        <h3 className="text-xs font-semibold mb-0.5">{t("officeAmbience")}</h3>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{t("officeAmbienceHint")}</p>
                        {runtimeConfig.humanization?.ambience && (
                          <div className="mt-3 pt-3 border-t space-y-3" onClick={(e) => e.preventDefault()}>
                            <div>
                              <span className="text-[11px] text-muted-foreground block mb-1">{t("ambienceSource")}</span>
                              <select
                                value={runtimeConfig.humanization?.ambienceSource ?? "office_ambience_1"}
                                onChange={(e) =>
                                  setRuntimeConfig((prev) => ({
                                    ...prev,
                                    humanization: {
                                      ...prev.humanization,
                                      ambienceSource: e.target.value,
                                    },
                                  }))
                                }
                                className="w-full text-[11px] rounded border border-border bg-background px-2 py-1"
                              >
                                <option value="office_ambience_1">{t("officeAmbience1")}</option>
                                <option value="office_ambience_2">{t("officeAmbience2")}</option>
                                <option value="crowded_room">{t("crowdedRoom")}</option>
                              </select>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] text-muted-foreground">{t("volume")}</span>
                                <span className="text-[11px] font-medium tabular-nums">
                                  {Math.round((runtimeConfig.humanization?.ambienceVolume ?? 0.5) * 100)}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={runtimeConfig.humanization?.ambienceVolume ?? 0.5}
                                onChange={(e) =>
                                  setRuntimeConfig((prev) => ({
                                    ...prev,
                                    humanization: {
                                      ...prev.humanization,
                                      ambienceVolume: parseFloat(e.target.value),
                                    },
                                  }))
                                }
                                className="w-full h-1 accent-emerald-600"
                              />
                            </div>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* ════ TIMEOUTS SECTION ════ */}
              {configSection === "timeouts" && (
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="px-5 py-4 border-b bg-muted/40">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <Timer className="h-4 w-4 text-muted-foreground" />
                      {t("timeouts")}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("timeoutsDescription")}</p>
                  </div>
                  <div className="p-5 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label
                        htmlFor="rt-timeout"
                        className="text-xs text-muted-foreground"
                      >
                        {t("inactivityTimeout")}
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
                        placeholder={t("disabledPlaceholder")}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="rt-maxduration"
                        className="text-xs text-muted-foreground"
                      >
                        {t("maxCallDuration")}
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
                        placeholder={t("disabledPlaceholder")}
                      />
                    </div>
                    {/* [DISABLED] STT final timeout — UI field commented out
                    <div className="space-y-1">
                      <Label
                        htmlFor="rt-stt-final-timeout"
                        className="text-xs text-muted-foreground"
                      >
                        {t("sttFinalTimeout")}
                      </Label>
                      <Input
                        id="rt-stt-final-timeout"
                        type="number"
                        min={100}
                        max={30000}
                        step={100}
                        value={runtimeConfig.sttFinalTimeoutMs ?? ""}
                        onChange={(e) =>
                          setRuntimeConfig((prev) => ({
                            ...prev,
                            sttFinalTimeoutMs: e.target.value
                              ? parseInt(e.target.value)
                              : null,
                          }))
                        }
                        placeholder={t("disabledPlaceholder")}
                      />
                    </div>
                    */}
                  </div>
                  {/* ═══ Follow-up sub-section ═══ */}
                  <div className="border-t pt-4">
                    <div className="mb-3">
                      <h3 className="text-xs font-semibold flex items-center gap-1.5">
                        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        Reengajamento por Follow-up
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Envia uma mensagem quando o usuário fica em silêncio. Deixe o <strong>Timeout</strong> vazio para desativar.
                      </p>
                    </div>

                    {/* Timeline visual */}
                    <div className="flex items-center flex-wrap gap-1.5 text-[10px] bg-muted/30 rounded-lg px-3 py-2.5 mb-4">
                      <span className="bg-background border rounded px-1.5 py-0.5 font-medium text-foreground/70">Agente termina de falar</span>
                      <span className="text-muted-foreground/50">→</span>
                      <span className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-1.5 py-0.5 font-medium text-amber-700 dark:text-amber-400">Grace Period</span>
                      <span className="text-muted-foreground/50">→</span>
                      <span className="bg-background border rounded px-1.5 py-0.5 font-medium text-foreground/70">usuário fica mudo</span>
                      <span className="text-muted-foreground/50">→</span>
                      <span className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded px-1.5 py-0.5 font-medium text-blue-700 dark:text-blue-400">Timer (timeout s)</span>
                      <span className="text-muted-foreground/50">→</span>
                      <span className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded px-1.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">Agente fala mensagem</span>
                      <span className="text-muted-foreground/50">↻</span>
                      <span className="bg-background border rounded px-1.5 py-0.5 font-medium text-foreground/70">até max N×</span>
                    </div>

                    {/* Mode selector */}
                    <div className="space-y-1.5 mb-4">
                      <label className="text-xs font-medium block">Modo de Resposta</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setRuntimeConfig((prev) => ({
                              ...prev,
                              followUpMode: "say",
                            }))
                          }
                          className={`rounded-lg p-3 text-left transition-colors ${
                            (runtimeConfig.followUpMode ?? "say") === "say"
                              ? "border-2 border-foreground bg-muted/50"
                              : "border bg-card hover:border-foreground/20"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold">Say (Literal)</span>
                            <span className="ml-auto text-[10px] text-emerald-600 font-medium">Recomendado</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">TTS lê o texto abaixo exatamente como escrito. Consistente e sem variações entre tentativas.</p>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRuntimeConfig((prev) => ({
                              ...prev,
                              followUpMode: "generateReply",
                            }))
                          }
                          className={`rounded-lg p-3 text-left transition-colors ${
                            (runtimeConfig.followUpMode ?? "say") === "generateReply"
                              ? "border-2 border-foreground bg-muted/50"
                              : "border bg-card hover:border-foreground/20"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Brain className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold">Generate Reply</span>
                            <span className="ml-auto text-[10px] text-amber-600 font-medium">⚠ pode variar</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">LLM gera resposta contextual. A mensagem abaixo serve como instrução/contexto para o LLM.</p>
                        </button>
                      </div>
                    </div>

                    {/* Parameters */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="rt-followup-timeout" className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Timeout de Silêncio (s)
                        </Label>
                        <Input
                          id="rt-followup-timeout"
                          type="number"
                          min={5}
                          max={300}
                          value={runtimeConfig.followUpTimeoutSeconds ?? ""}
                          onChange={(e) =>
                            setRuntimeConfig((prev) => ({
                              ...prev,
                              followUpTimeoutSeconds: e.target.value
                                ? parseInt(e.target.value)
                                : null,
                            }))
                          }
                          placeholder={t("disabledPlaceholder")}
                        />
                        <p className="text-[11px] text-muted-foreground">Segundos de silêncio do usuário até disparar. <span className="font-medium text-foreground/60">Vazio = desativado.</span></p>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="rt-followup-grace" className="text-xs text-muted-foreground flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          Grace Period (ms)
                        </Label>
                        <Input
                          id="rt-followup-grace"
                          type="number"
                          min={0}
                          max={10000}
                          step={100}
                          value={runtimeConfig.followUpGracePeriodMs ?? ""}
                          onChange={(e) =>
                            setRuntimeConfig((prev) => ({
                              ...prev,
                              followUpGracePeriodMs: e.target.value
                                ? Number(e.target.value)
                                : null,
                            }))
                          }
                          placeholder="0 ms"
                        />
                        <p className="text-[11px] text-muted-foreground">Espera após Agente terminar de falar antes de armar o timer. Evita disparos logo após a fala.</p>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="rt-max-followups" className="text-xs text-muted-foreground flex items-center gap-1">
                          <RotateCcw className="h-3 w-3" />
                          Máximo de Tentativas
                        </Label>
                        <Input
                          id="rt-max-followups"
                          type="number"
                          min={0}
                          max={10}
                          value={runtimeConfig.maxFollowUps ?? ""}
                          onChange={(e) =>
                            setRuntimeConfig((prev) => ({
                              ...prev,
                              maxFollowUps: e.target.value
                                ? parseInt(e.target.value)
                                : null,
                            }))
                          }
                          placeholder={t("unlimitedDefault")}
                        />
                        <p className="text-[11px] text-muted-foreground">Quantas vezes reengaja antes de desistir. Cada ciclo aguarda um novo timeout. <span className="font-medium text-foreground/60">Vazio = ilimitado.</span></p>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1">
                      <Label htmlFor="rt-followup-message" className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <MessageSquare className="h-3 w-3" />
                        {(runtimeConfig.followUpMode ?? "say") === "say" ? "Mensagem Falada" : "Instrução para o LLM"}
                      </Label>
                      <Input
                        id="rt-followup-message"
                        type="text"
                        value={runtimeConfig.followUpMessage ?? ""}
                        onChange={(e) =>
                          setRuntimeConfig((prev) => ({
                            ...prev,
                            followUpMessage: e.target.value || null,
                          }))
                        }
                        placeholder={t("defaultFallback")}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {(runtimeConfig.followUpMode ?? "say") === "say"
                          ? 'Texto exato que o Agente vai falar. Ex: "Olá, ainda está por aí?"'
                          : 'Instrução para o LLM gerar a mensagem. Ex: "Pergunte educadamente se o usuário ainda está presente."'}
                      </p>
                    </div>
                  </div>
                </div>

                </div>
              )}

              {/* ════ EXTRACTION SECTION ════ */}
              {configSection === "extraction" && (
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="px-5 py-4 border-b bg-muted/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                          <FileOutput className="h-4 w-4 text-muted-foreground" />
                          Campos de Extração (Ticket)
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Campos extraídos automaticamente da conversa ao final da chamada</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() =>
                          setRuntimeConfig((prev) => ({
                            ...prev,
                            extractionFields: [
                              ...(prev.extractionFields ?? []),
                              {
                                key: "",
                                label: "",
                                type: "string" as const,
                                description: "",
                              },
                            ],
                        }))
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar Campo
                    </Button>
                    </div>
                  </div>
                  <div className="p-5 space-y-3">

                  {(runtimeConfig.extractionFields ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground italic text-center py-6">
                      Nenhum campo de extração configurado. Adicione campos para gerar tickets automaticamente.
                    </p>
                  )}

                  {(runtimeConfig.extractionFields ?? []).map((field, idx) => {
                    const typeColorMap: Record<string, { bg: string; text: string; label: string }> = {
                      string: { bg: "bg-blue-50", text: "text-blue-700", label: "Texto" },
                      enum: { bg: "bg-amber-50", text: "text-amber-700", label: "Enum" },
                      number: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Número" },
                      boolean: { bg: "bg-purple-50", text: "text-purple-700", label: "Sim/Não" },
                    };
                    const typeInfo = typeColorMap[field.type] ?? typeColorMap.string;
                    return (
                    <div
                      key={idx}
                      className="group rounded-lg border p-3 hover:border-foreground/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Top row: type badge + key + required */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${typeInfo.bg} ${typeInfo.text}`}>
                              {typeInfo.label}
                            </span>
                            {field.key ? (
                              <span className="text-xs font-semibold font-mono">{field.key}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Campo sem nome</span>
                            )}
                            {field.required && (
                              <span className="inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">Obrigatório</span>
                            )}
                          </div>
                          {/* Label + description */}
                          {field.label && <p className="text-xs text-foreground">{field.label}</p>}
                          {field.description && <p className="text-[11px] text-muted-foreground">{field.description}</p>}
                          {/* Enum options as chips */}
                          {field.type === "enum" && (field.options ?? []).length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {(field.options ?? []).map((opt, oi) => (
                                <span key={oi} className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                                  {opt}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Edit / Delete — hover only */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditExtractionIdx(idx)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() =>
                              setRuntimeConfig((prev) => ({
                                ...prev,
                                extractionFields: (prev.extractionFields ?? []).filter(
                                  (_, i) => i !== idx
                                ),
                              }))
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Inline edit form when editing */}
                      {editExtractionIdx === idx && (
                        <div className="mt-3 pt-3 border-t space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Key</label>
                              <Input
                                value={field.key}
                                onChange={(e) =>
                                  setRuntimeConfig((prev) => {
                                    const fields = [...(prev.extractionFields ?? [])];
                                    fields[idx] = { ...fields[idx], key: e.target.value };
                                    return { ...prev, extractionFields: fields };
                                  })
                                }
                                placeholder="ex: customer_name"
                                className="h-8 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Label</label>
                              <Input
                                value={field.label}
                                onChange={(e) =>
                                  setRuntimeConfig((prev) => {
                                    const fields = [...(prev.extractionFields ?? [])];
                                    fields[idx] = { ...fields[idx], label: e.target.value };
                                    return { ...prev, extractionFields: fields };
                                  })
                                }
                                placeholder="ex: Nome do Cliente"
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tipo</label>
                              <select
                                value={field.type}
                                onChange={(e) =>
                                  setRuntimeConfig((prev) => {
                                    const fields = [...(prev.extractionFields ?? [])];
                                    fields[idx] = {
                                      ...fields[idx],
                                      type: e.target.value as ExtractionField["type"],
                                      options: e.target.value === "enum" ? (fields[idx].options ?? []) : undefined,
                                    };
                                    return { ...prev, extractionFields: fields };
                                  })
                                }
                                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                              >
                                <option value="string">Texto</option>
                                <option value="enum">Enum (Opções)</option>
                                <option value="number">Número</option>
                                <option value="boolean">Sim/Não</option>
                              </select>
                            </div>
                            <div className="flex items-end gap-2 pb-1">
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={field.required ?? false}
                                  onChange={(e) =>
                                    setRuntimeConfig((prev) => {
                                      const fields = [...(prev.extractionFields ?? [])];
                                      fields[idx] = { ...fields[idx], required: e.target.checked };
                                      return { ...prev, extractionFields: fields };
                                    })
                                  }
                                  className="rounded"
                                />
                                Obrigatório
                              </label>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Descrição (usada no prompt)</label>
                            <Input
                              value={field.description}
                              onChange={(e) =>
                                setRuntimeConfig((prev) => {
                                  const fields = [...(prev.extractionFields ?? [])];
                                  fields[idx] = { ...fields[idx], description: e.target.value };
                                  return { ...prev, extractionFields: fields };
                                })
                              }
                              placeholder="ex: Nome completo do cliente que está ligando"
                              className="h-8 text-xs"
                            />
                          </div>
                          {field.type === "enum" && (
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Opções (separadas por vírgula)</label>
                              <Input
                                value={field._optionsText ?? (field.options ?? []).join(", ")}
                                onChange={(e) =>
                                  setRuntimeConfig((prev) => {
                                    const fields = [...(prev.extractionFields ?? [])];
                                    fields[idx] = {
                                      ...fields[idx],
                                      _optionsText: e.target.value,
                                    };
                                    return { ...prev, extractionFields: fields };
                                  })
                                }
                                onBlur={(e) =>
                                  setRuntimeConfig((prev) => {
                                    const fields = [...(prev.extractionFields ?? [])];
                                    const parsed = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                                    fields[idx] = {
                                      ...fields[idx],
                                      options: parsed,
                                      _optionsText: undefined,
                                    };
                                    return { ...prev, extractionFields: fields };
                                  })
                                }
                                placeholder="ex: satisfeito, neutro, insatisfeito"
                                className="h-8 text-xs"
                              />
                            </div>
                          )}
                          <div className="flex justify-end">
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditExtractionIdx(null)}>
                              Fechar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )})}
                </div>

                </div>
              )}

            </div>
          </div>
        </TabsContent>

        <TabsContent value="knowledge" className="pt-5 pb-20">
          <div className="space-y-5">
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b bg-muted/40">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      {t("knowledgeBase")}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("knowledgeBaseDescription")}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {knowledgeItems.length} {knowledgeItems.length === 1 ? t("file") : t("files")}
                  </span>
                </div>
              </div>
              <div className="p-5 space-y-5">
                {/* Upload Area */}
                <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/20 p-6 text-center hover:border-muted-foreground/30 transition-colors cursor-pointer">
                  <div className="flex justify-center mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                      <Upload className="h-5 w-5 text-blue-500" />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-3">
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
                        className="cursor-pointer inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        {uploading ? t("uploading") : t("chooseFile")}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">PDF, TXT — Max 10MB per file</p>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="checkbox"
                        id="summarize"
                        checked={summarize}
                        onChange={(e) => setSummarize(e.target.checked)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <Label htmlFor="summarize" className="text-xs cursor-pointer text-muted-foreground">
                        {t("summarizeBeforeSaving")}
                      </Label>
                    </div>
                  </div>
                </div>

                {summarize && (
                  <div className="flex items-start gap-2 rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3 text-sm text-yellow-700">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{t("summarizeWarning")}</span>
                  </div>
                )}

                {/* Files Table */}
                {knowledgeItems.length > 0 ? (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="text-xs font-medium">{t("fileHeader")}</TableHead>
                          <TableHead className="w-[100px] text-xs font-medium">{t("size")}</TableHead>
                          <TableHead className="w-[100px] text-xs font-medium">{t("type")}</TableHead>
                          <TableHead className="w-[140px] text-xs font-medium">{t("date")}</TableHead>
                          <TableHead className="w-[50px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {knowledgeItems.map((item) => (
                          <TableRow key={item.id} className="group">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="truncate max-w-[200px] text-xs font-medium">
                                  {item.file_name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {item.char_count.toLocaleString()} {t("chars")}
                            </TableCell>
                            <TableCell>
                              {item.summarized ? (
                                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                  {t("summarized")}
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  {t("original")}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {new Date(item.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setPendingDeleteKnowledgeId(item.id)}
                                  disabled={deletingId === item.id}
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-red-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="border-t px-4 py-2.5 bg-muted/20 text-xs text-muted-foreground">
                      {knowledgeItems.length} {knowledgeItems.length === 1 ? t("file") : t("files")}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BookOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">{t("noKnowledge")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── Tools Tab ──────────────────────────────────────── */}
        <TabsContent value="tools" className="pt-5 pb-20">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">{t("agentTools")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("agentToolsDescription")}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={handleSeedTools}
                  disabled={seedingTools}
                >
                  {seedingTools ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  {t("seedDefaults")}
                </Button>
                <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={openToolDialogForCreate}>
                  <Plus className="h-3 w-3" />
                  {t("addTool")}
                </Button>
              </div>
            </div>

            {loadingTools ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : agentTools.length === 0 ? (
              <div className="text-center py-16">
                <Wrench className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t("noToolsConfigured")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("noToolsHint")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {agentTools.map((tool) => {
                  const typeColors: Record<string, { bg: string; icon: string; border: string; text: string }> = {
                    HTTP_REQUEST: { bg: "bg-blue-50", icon: "text-blue-600", border: "border-blue-200", text: "text-blue-700" },
                    TRANSFER_CALL: { bg: "bg-amber-50", icon: "text-amber-600", border: "border-amber-200", text: "text-amber-700" },
                    END_CALL: { bg: "bg-red-50", icon: "text-red-600", border: "border-red-200", text: "text-red-700" },
                    PRE_CALL: { bg: "bg-violet-50", icon: "text-violet-600", border: "border-violet-200", text: "text-violet-700" },
                    POST_CALL: { bg: "bg-emerald-50", icon: "text-emerald-600", border: "border-emerald-200", text: "text-emerald-700" },
                  };
                  const colors = typeColors[tool.type] ?? typeColors.HTTP_REQUEST;
                  return (
                    <div key={tool.id} className="rounded-lg border bg-card p-4 group hover:border-foreground/20 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors.bg} flex-shrink-0 mt-0.5`}>
                            <Globe className={`h-4 w-4 ${colors.icon}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold font-mono">{tool.name}</span>
                              <span className={`inline-flex items-center rounded-full border ${colors.border} ${colors.bg} px-2 py-0.5 text-[10px] font-medium ${colors.text}`}>
                                {tool.type === "TRANSFER_CALL" && "Transfer"}
                                {tool.type === "END_CALL" && "End Call"}
                                {tool.type === "HTTP_REQUEST" && "HTTP"}
                                {tool.type === "PRE_CALL" && "Pre-Call"}
                                {tool.type === "POST_CALL" && "Post-Call"}
                              </span>
                              {!tool.enabled && (
                                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  Disabled
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{tool.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
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
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-red-50"
                              onClick={() => setPendingDeleteToolId(tool.id)}
                              disabled={deletingToolId === tool.id}
                            >
                              {deletingToolId === tool.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {agentTools.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {agentTools.length} {agentTools.length === 1 ? "tool" : "tools"} configured
              </p>
            )}
          </div>

          {/* Tool Create/Edit Dialog */}
          <Dialog open={toolDialogOpen} onOpenChange={(open) => { setToolDialogOpen(open); if (!open) resetToolForm(); }}>
            <DialogContent className="p-0 gap-0 sm:max-w-2xl" showCloseButton={false}>
              <DialogHeader className="border-b px-5 py-4">
                <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
                    <Wrench className="h-3.5 w-3.5 text-violet-600" />
                  </span>
                  {editingTool ? t("editTool") : t("addTool")}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  {editingTool
                    ? "Update the tool configuration."
                    : "Define a new tool that the agent can call during conversations."}
                </DialogDescription>
              </DialogHeader>
              <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">
                {/* Identity section */}
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Identity</div>
                <div>
                  <label htmlFor="tool-name" className="text-xs font-medium mb-1 block">{t("name")}</label>
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
                    className="h-8 font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Only letters, numbers, underscores and hyphens allowed (pattern: ^[a-zA-Z0-9_-]+$).
                  </p>
                </div>

                <div>
                  <label htmlFor="tool-type" className="text-xs font-medium mb-1 block">{t("type")}</label>
                  <Select
                    value={toolForm.type}
                    onValueChange={(v) => setToolForm((p) => ({ ...p, type: v as ToolType }))}
                  >
                    <SelectTrigger id="tool-type" className="h-8 text-xs">
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

                <div>
                  <label htmlFor="tool-desc" className="text-xs font-medium mb-1 block">{t("descriptionLabel")}</label>
                  <Textarea
                    id="tool-desc"
                    value={toolForm.description}
                    onChange={(e) => setToolForm((p) => ({ ...p, description: e.target.value }))}
                    rows={2}
                    placeholder={t("toolDescriptionPlaceholder")}
                  />
                </div>

                {toolForm.type !== "PRE_CALL" && toolForm.type !== "POST_CALL" && (
                <div className="space-y-2">
                  <div className="border-t" />
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t("parameters")}</div>
                  <div className="flex items-center justify-end">
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
                              toast.error(t("invalidJsonFormat"));
                            }
                          }}
                        >
                          <Braces className="mr-1 h-3 w-3" />
                          {t("formatJson")}
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
                              placeholder={t("descriptionLabel")}
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
                        {t("addParameter")}
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
                  </div>
                </div>
                )}

                <div className="space-y-2">
                  <div className="border-t" />
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t("config")}</div>
                  <div className="flex items-center justify-end">
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
                              toast.error(t("invalidJsonFormat"));
                            }
                          }}
                        >
                          <Braces className="mr-1 h-3 w-3" />
                          {t("formatJson")}
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
                      placeholder={toolForm.type === "HTTP_REQUEST" || toolForm.type === "PRE_CALL" || toolForm.type === "POST_CALL"
                        ? '{"url": "https://api.example.com/endpoint", "method": "POST"}'
                        : toolForm.type === "TRANSFER_CALL"
                        ? '{"waitMessage": "One moment...", "transferMessage": "Transferring..."}'
                        : '{}'}
                    />
                  ) : (
                    <div className="space-y-2 rounded-md border p-3">
                      {/* HTTP_REQUEST dedicated controls */}
                      {toolForm.type === "HTTP_REQUEST" && (
                        <div className="space-y-3 pb-3 mb-2 border-b border-dashed">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="awaitResponse"
                              checked={configFields.find((f) => f.key === "awaitResponse")?.value !== "false"}
                              onChange={(e) => {
                                setConfigFields((prev) => {
                                  const idx = prev.findIndex((f) => f.key === "awaitResponse");
                                  const val = { key: "awaitResponse", value: String(e.target.checked) };
                                  if (idx >= 0) {
                                    const next = [...prev];
                                    next[idx] = val;
                                    return next;
                                  }
                                  return [...prev, val];
                                });
                              }}
                              className="h-4 w-4 rounded border-border"
                            />
                            <label htmlFor="awaitResponse" className="text-xs font-medium cursor-pointer">
                              Aguardar resposta HTTP antes de continuar
                            </label>
                          </div>
                          <p className="text-[11px] text-muted-foreground -mt-1 ml-6">
                            {configFields.find((f) => f.key === "awaitResponse")?.value === "false"
                              ? "O agente continua a conversa e recebe o resultado em background."
                              : "O agente aguarda a resposta antes de continuar. Configure frases de espera abaixo para manter o usuário engajado."}
                          </p>

                          {configFields.find((f) => f.key === "awaitResponse")?.value !== "false" && (
                            <>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground font-medium">
                                  Frases de espera (uma por linha)
                                </label>
                                <Textarea
                                  rows={3}
                                  className="text-xs"
                                  placeholder={t("waitMessagePlaceholder")}
                                  value={configFields.find((f) => f.key === "holdPhrases")?.value ?? ""}
                                  onChange={(e) => {
                                    setConfigFields((prev) => {
                                      const idx = prev.findIndex((f) => f.key === "holdPhrases");
                                      const val = { key: "holdPhrases", value: e.target.value };
                                      if (idx >= 0) {
                                        const next = [...prev];
                                        next[idx] = val;
                                        return next;
                                      }
                                      return [...prev, val];
                                    });
                                  }}
                                />
                                <p className="text-[11px] text-muted-foreground">
                                  O agente fala frases aleatórias desta lista enquanto aguarda. Sons de typing/ambience são controlados pelo runtime config (humanização).
                                </p>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground font-medium">
                                  Intervalo entre frases (ms)
                                </label>
                                <Input
                                  type="number"
                                  className="h-8 text-xs w-36"
                                  placeholder="6000"
                                  min={2000}
                                  value={configFields.find((f) => f.key === "holdPhraseIntervalMs")?.value ?? ""}
                                  onChange={(e) => {
                                    setConfigFields((prev) => {
                                      const idx = prev.findIndex((f) => f.key === "holdPhraseIntervalMs");
                                      const val = { key: "holdPhraseIntervalMs", value: e.target.value };
                                      if (idx >= 0) {
                                        const next = [...prev];
                                        next[idx] = val;
                                        return next;
                                      }
                                      return [...prev, val];
                                    });
                                  }}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      {configFields.filter((f) => !HTTP_INTERNAL_KEYS.has(f.key)).length === 0 && (
                        <div className="text-center py-2 space-y-1.5">
                          <p className="text-xs text-muted-foreground">No config fields yet.</p>
                          {(toolForm.type === "HTTP_REQUEST" || toolForm.type === "TRANSFER_CALL" || toolForm.type === "PRE_CALL" || toolForm.type === "POST_CALL") && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-3 text-xs"
                              onClick={() => setConfigFields(getExampleConfigFields(toolForm.type))}
                            >
                              Load Example for {toolForm.type === "HTTP_REQUEST" ? "HTTP Request" : toolForm.type === "TRANSFER_CALL" ? "Transfer Call" : toolForm.type === "PRE_CALL" ? "Pre-Call Hook" : "Post-Call Hook"}
                            </Button>
                          )}
                        </div>
                      )}
                      {configFields.map((field, idx) => (
                        HTTP_INTERNAL_KEYS.has(field.key) ? null : (
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
                        )
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
                          <li><code className="text-[11px] bg-muted px-1 rounded">url</code> — External API URL (required). Supports <code className="text-[11px] bg-muted px-1 rounded">{`{{template}}`}</code> placeholders.</li>
                          <li><code className="text-[11px] bg-muted px-1 rounded">method</code> — <code className="text-[11px] bg-muted px-1 rounded">GET</code>, <code className="text-[11px] bg-muted px-1 rounded">POST</code>, <code className="text-[11px] bg-muted px-1 rounded">PUT</code>, <code className="text-[11px] bg-muted px-1 rounded">DELETE</code> (default: POST)</li>
                          <li><code className="text-[11px] bg-muted px-1 rounded">headers</code> — Object with additional HTTP headers. Values support <code className="text-[11px] bg-muted px-1 rounded">{`{{template}}`}</code> placeholders.</li>
                          <li><code className="text-[11px] bg-muted px-1 rounded">waitMessage</code> — Phrase the agent speaks while waiting for the response</li>
                        </ul>
                        <div className="mt-2 rounded-md border border-dashed border-muted-foreground/30 p-2 space-y-1">
                          <p className="font-medium">📎 Variáveis de template disponíveis</p>
                          <p>Use <code className="text-[11px] bg-muted px-1 rounded">{`{{variavel}}`}</code> na URL, headers ou body para injetar dados da sessão em tempo de execução:</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <code className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{`{{phone_number}}`}</code>
                            <code className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{`{{from_number}}`}</code>
                            <code className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{`{{room_name}}`}</code>
                            <code className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{`{{customer_name}}`}</code>
                            <code className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{`{{agent_name}}`}</code>
                            <code className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{`{{to_number}}`}</code>
                            <code className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{`{{channel}}`}</code>
                            <code className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{`{{direction}}`}</code>
                          </div>
                          <p className="mt-1 text-[10px]">Além dos campos acima, qualquer campo extra passado no metadata da room também fica disponível como template.</p>
                          <p className="mt-1 text-[10px]">Exemplo de URL: <code className="text-[10px] bg-muted px-1 rounded">{`https://api.example.com/customers/{{phone_number}}`}</code></p>
                        </div>
                      </>
                    )}
                    {(toolForm.type === "PRE_CALL" || toolForm.type === "POST_CALL") && (
                      <>
                        <p>Available fields for <strong>{toolForm.type === "PRE_CALL" ? "Pre-Call Hook" : "Post-Call Hook"}</strong>:</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          <li><code className="text-[11px] bg-muted px-1 rounded">url</code> — Webhook URL (required). Supports <code className="text-[11px] bg-muted px-1 rounded">{`{{template}}`}</code> placeholders.</li>
                          <li><code className="text-[11px] bg-muted px-1 rounded">method</code> — <code className="text-[11px] bg-muted px-1 rounded">GET</code>, <code className="text-[11px] bg-muted px-1 rounded">POST</code>, <code className="text-[11px] bg-muted px-1 rounded">PUT</code>, <code className="text-[11px] bg-muted px-1 rounded">DELETE</code> (default: POST)</li>
                          <li><code className="text-[11px] bg-muted px-1 rounded">headers</code> — Object with HTTP headers. Values support <code className="text-[11px] bg-muted px-1 rounded">{`{{template}}`}</code> placeholders.</li>
                        </ul>
                        <div className="mt-2 rounded-md border border-dashed border-muted-foreground/30 p-2 space-y-1">
                          <p className="font-medium">📎 Variáveis de template disponíveis</p>
                          <p>Use <code className="text-[11px] bg-muted px-1 rounded">{`{{variavel}}`}</code> na URL, headers ou body:</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <code className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{`{{phone_number}}`}</code>
                            <code className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{`{{from_number}}`}</code>
                            <code className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{`{{room_name}}`}</code>
                            <code className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{`{{customer_name}}`}</code>
                            <code className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{`{{agent_name}}`}</code>
                            <code className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{`{{to_number}}`}</code>
                            <code className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{`{{channel}}`}</code>
                            <code className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{`{{direction}}`}</code>
                            {toolForm.type === "POST_CALL" && (
                              <>
                                <code className="text-[11px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded">{`{{summary}}`}</code>
                                <code className="text-[11px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded">{`{{ticket}}`}</code>
                              </>
                            )}
                          </div>
                          {toolForm.type === "PRE_CALL" && (
                            <p className="mt-1 text-[10px]">Pre-Call hooks executam antes da sessão iniciar. A resposta é injetada nas instruções do agente como contexto.</p>
                          )}
                          {toolForm.type === "POST_CALL" && (
                            <p className="mt-1 text-[10px]">Post-Call hooks executam após a sessão encerrar. As variáveis <code className="text-[10px] bg-muted px-1 rounded">{`{{summary}}`}</code> e <code className="text-[10px] bg-muted px-1 rounded">{`{{ticket}}`}</code> contêm o resumo e ticket gerados.</p>
                          )}
                          <p className="mt-1 text-[10px]">Qualquer campo extra do metadata da room também fica disponível como template.</p>
                        </div>
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
                  </div>
                </div>

                <div className="border-t" />
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Options</div>
                <div className="flex items-center gap-4">
                  <label htmlFor="tool-enabled" className="flex items-center justify-between rounded-lg border px-3 py-3 cursor-pointer hover:bg-muted/30 transition-colors flex-1">
                    <div>
                      <span className="text-xs font-medium">{t("enabled")}</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Tool is available for the agent to use</p>
                    </div>
                    <input
                      id="tool-enabled"
                      type="checkbox"
                      checked={toolForm.enabled}
                      onChange={(e) => setToolForm((p) => ({ ...p, enabled: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 accent-foreground"
                    />
                  </label>
                  <div className="shrink-0">
                    <label htmlFor="tool-order" className="text-xs font-medium mb-1 block">{t("order")}</label>
                    <Input
                      id="tool-order"
                      type="number"
                      min={0}
                      value={toolForm.sort_order}
                      onChange={(e) => setToolForm((p) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                      className="w-20 h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="border-t px-5 py-3">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setToolDialogOpen(false); resetToolForm(); }}>
                  {tc("cancel")}
                </Button>
                <Button size="sm" className="h-8 text-xs" onClick={handleSaveTool} disabled={savingTool || !toolForm.name || !toolForm.description}>
                  {savingTool ? (
                    <>
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      {t("savingTool")}
                    </>
                  ) : editingTool ? (
                    t("updateTool")
                  ) : (
                    t("createTool")
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ─── Versions Tab ─────────────────────────────────────────────── */}
        <TabsContent value="versions" className="pt-5 pb-20">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">{t("publishedVersions")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("publishedVersionsDescription")}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => loadVersions(selectedAgent)}
                  disabled={loadingVersions}
                >
                  <RefreshCw className={`h-3 w-3 ${loadingVersions ? "animate-spin" : ""}`} />
                  {tc("refresh")}
                </Button>
                <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setPublishDescription(""); setPublishDialogOpen(true); }}>
                  <Tag className="h-3 w-3" />
                  {t("publishVersion")}
                </Button>
              </div>
            </div>

            {loadingVersions ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-16">
                <Tag className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t("noVersions")}</p>
              </div>
            ) : (
              <div className="rounded-lg border bg-card overflow-hidden">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-[80px] text-xs font-medium">{t("versionHeader")}</TableHead>
                      <TableHead className="text-xs font-medium">{t("descriptionLabel")}</TableHead>
                      <TableHead className="w-[180px] text-xs font-medium">{t("published")}</TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((v, idx) => (
                      <TableRow key={v.id} className="group">
                        <TableCell>
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-mono font-medium ${idx === 0 ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
                            v{v.version}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {v.description || <span className="italic">{t("noDescription")}</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(v.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title={t("viewDetails")}
                              onClick={async () => {
                                try {
                                  const detail = await agentVersionApi.get(selectedAgent, v.version);
                                  setViewingVersion(detail);
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : t("failedToLoadVersion"));
                                }
                              }}
                            >
                              <Code className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:bg-blue-50"
                              title={t("restoreToDraft")}
                              onClick={() => setRestoreConfirmVersion(v)}
                            >
                              <RotateCcw className="h-3.5 w-3.5 text-blue-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-red-50"
                              title={t("deleteVersion")}
                              disabled={deletingVersionNum === v.version}
                              onClick={async () => {
                                setDeletingVersionNum(v.version);
                                try {
                                  await agentVersionApi.delete(selectedAgent, v.version);
                                  toast.success(t("versionDeleted", { version: v.version }));
                                  loadVersions(selectedAgent);
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : t("failedToDeleteVersion"));
                                } finally {
                                  setDeletingVersionNum(null);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="border-t px-4 py-2.5 bg-muted/20 text-xs text-muted-foreground">
                  {versions.length} {versions.length === 1 ? "version" : "versions"}
                </div>
              </div>
            )}
          </div>

          {/* Version detail dialog */}
          <Dialog open={!!viewingVersion} onOpenChange={(open) => { if (!open) setViewingVersion(null); }}>
            <DialogContent className="p-0 gap-0 sm:max-w-2xl" showCloseButton={false}>
              <DialogHeader className="border-b px-5 py-4">
                <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                    <Tag className="h-3.5 w-3.5 text-blue-600" />
                  </span>
                  Version v{viewingVersion?.version}
                  {viewingVersion?.description && (
                    <span className="text-xs font-normal text-muted-foreground">— {viewingVersion.description}</span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  {t("published")} {viewingVersion?.created_at ? new Date(viewingVersion.created_at).toLocaleString() : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t("instructionsLabel")}</div>
                <pre className="p-3 bg-muted/50 rounded-lg text-xs whitespace-pre-wrap max-h-[200px] overflow-y-auto border">
                  {viewingVersion?.instructions || t("empty")}
                </pre>

                <div className="border-t" />
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t("runtimeConfigLabel")}</div>
                <pre className="p-3 bg-muted/50 rounded-lg text-xs whitespace-pre-wrap max-h-[200px] overflow-y-auto font-mono border">
                  {viewingVersion?.runtime_config
                    ? JSON.stringify(
                        typeof viewingVersion.runtime_config === "string"
                          ? JSON.parse(viewingVersion.runtime_config)
                          : viewingVersion.runtime_config,
                        null,
                        2
                      )
                    : t("default")}
                </pre>

                <div className="border-t" />
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {t("toolsCount", { count: viewingVersion?.tools_snapshot?.length ?? 0 })}
                </div>
                {viewingVersion?.tools_snapshot?.length > 0 ? (
                  <div className="space-y-2">
                    {viewingVersion.tools_snapshot.map((tool: any, i: number) => (
                      <div key={i} className="rounded-lg border px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{tool.name}</span>
                          <Badge variant="outline" className="text-[10px] h-4">{tool.type}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{tool.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("noTools")}</p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Restore confirmation dialog */}
          <Dialog open={!!restoreConfirmVersion} onOpenChange={(open) => { if (!open) setRestoreConfirmVersion(null); }}>
            <DialogContent className="p-0 gap-0 sm:max-w-sm" showCloseButton={false}>
              <DialogHeader className="border-b px-5 py-4">
                <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  </span>
                  {t("restoreVersionTitle", { version: restoreConfirmVersion?.version ?? 0 })}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  {t("restoreDescription")}
                  <strong> v{restoreConfirmVersion?.version}</strong>
                  {restoreConfirmVersion?.description && (
                    <> ({restoreConfirmVersion.description})</>
                  )}.
                </DialogDescription>
              </DialogHeader>
              <div className="p-5">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <strong>{t("warning")}</strong> {t("restoreWarning")}
                </div>
              </div>
              <DialogFooter className="border-t px-5 py-3">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setRestoreConfirmVersion(null)}>
                  {tc("cancel")}
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={restoring}
                  onClick={async () => {
                    if (!restoreConfirmVersion) return;
                    setRestoring(true);
                    try {
                      await agentVersionApi.restore(selectedAgent, restoreConfirmVersion.version);
                      toast.success(t("draftRestored", { version: restoreConfirmVersion.version }));
                      setRestoreConfirmVersion(null);
                      loadConfig(selectedAgent);
                      loadTools(selectedAgent);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : t("failedToRestoreVersion"));
                    } finally {
                      setRestoring(false);
                    }
                  }}
                >
                  {restoring ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      {t("restoring")}
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-3 w-3 mr-1" />
                      {t("restoreVersion", { version: restoreConfirmVersion?.version ?? 0 })}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ─── Deploy Tab ──────────────────────────────────────────── */}
        <TabsContent value="deploy" className="pt-5 pb-20">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-semibold">{t("deployTitle")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("deployDescription")}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => selectedAgent && loadDeployData(selectedAgent)}
                disabled={loadingDeploy}
              >
                <RefreshCw className={`h-3 w-3 ${loadingDeploy ? "animate-spin" : ""}`} />
                {tc("refresh")}
              </Button>
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">{t("deployImageNote")}</p>
            </div>

            {/* Step 1 — Image */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background text-[10px] font-bold flex-shrink-0">1</span>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Image</h3>
                <div className="flex-1 border-t" />
              </div>

              <div className="rounded-lg border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t("deployBuildSection")}</p>
                      <p className="text-xs text-muted-foreground">
                        {prebuiltImage
                          ? t("deployPrebuiltConfigured", { image: prebuiltImage })
                          : t("deployPrebuiltNotConfigured")}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={handleUsePrebuilt}
                    disabled={prebuiltLoading || !prebuiltImage || !!latestDeployment}
                  >
                    {prebuiltLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <HardDrive className="h-3 w-3" />
                    )}
                    {t("deployPrebuiltBtn")}
                  </Button>
                </div>

                {/* Current deployment status */}
                {latestDeployment && (
                  <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DeployStatusBadge status={latestDeployment.status} />
                        <span className="text-xs font-mono text-muted-foreground">
                          {latestDeployment.image_tag.split("/").pop()}
                        </span>
                        <span className="text-[10px] text-muted-foreground">v{latestDeployment.version}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(latestDeployment.updated_at).toLocaleString()}
                        </span>
                        {latestDeployment && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                            onClick={handleDeleteDeployment}
                            disabled={deleteDeployLoading || k8sStopLoading || k8sDeployLoading || buildLoading}
                            title={t("deployDelete")}
                          >
                            {deleteDeployLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          </Button>
                        )}
                      </div>
                    </div>

                    {latestDeployment.build_logs && (
                      <div className="rounded-md bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed overflow-auto max-h-72">
                        <div className="flex items-center gap-1.5 mb-2 text-zinc-500">
                          <Terminal className="h-3 w-3" />
                          <span>build log</span>
                          {["BUILDING", "PUSHING", "DEPLOYING"].includes(latestDeployment.status) && (
                            <span className="flex items-center gap-1 ml-1 text-amber-400">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              live
                            </span>
                          )}
                        </div>
                        <pre className="whitespace-pre-wrap text-zinc-300 text-[10px]">{latestDeployment.build_logs}</pre>
                      </div>
                    )}

                    {latestDeployment.error_message && (
                      <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                        <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-red-700">{latestDeployment.error_message}</p>
                      </div>
                    )}
                  </div>
                )}

                {!latestDeployment && !loadingDeploy && (
                  <div className="rounded-md border-2 border-dashed p-8 flex flex-col items-center justify-center text-center">
                    <HardDrive className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">{t("deployNoBuilds")}</p>
                  </div>
                )}
                {loadingDeploy && !latestDeployment && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            {/* Step 2 — Kubernetes */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0 ${latestDeployment?.status === "RUNNING" || k8sHealth ? "bg-foreground text-background" : "bg-muted text-muted-foreground border"}`}>2</span>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kubernetes</h3>
                <div className="flex-1 border-t" />
              </div>

              {/* K8s: RUNNING state */}
              {k8sHealth?.k8s ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                        <Server className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-emerald-800">{t("deployK8sSection")}</p>
                        <p className="text-xs text-emerald-700/70">{t("deployK8sSectionDesc")}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs text-red-600 hover:text-red-600 hover:border-red-200 border-red-200 bg-white"
                      onClick={handleStopK8s}
                      disabled={k8sStopLoading || deleteDeployLoading}
                    >
                      {k8sStopLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
                      {t("deployK8sStop")}
                    </Button>
                  </div>
                  <div className="rounded-md border border-emerald-200 bg-white/60 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const s = k8sHealth.k8s.status ?? "deployed";
                          const isRunning = s === "running";
                          const isPending = s === "pending";
                          return (
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                              isRunning
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : isPending
                                ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                                : "border-blue-200 bg-blue-50 text-blue-700"
                            }`}>
                              {isRunning && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                              {s}
                            </span>
                          );
                        })()}
                        <span className="text-xs font-mono text-muted-foreground">{k8sHealth.k8s.id}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{t("deployPolling")}</span>
                    </div>
                    {k8sHealth.k8s.image && (
                      <p className="text-[11px] font-mono text-muted-foreground truncate" title={k8sHealth.k8s.image}>
                        {k8sHealth.k8s.image}
                      </p>
                    )}
                  </div>
                </div>
              ) : k8sHealth?.status === "STOPPED" ? (
                /* K8s: STOPPED state */
                <div className="rounded-lg border border-orange-200 bg-orange-50/30 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
                        <CircleStop className="h-4 w-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-orange-800">{t("deployK8sStopped2")}</p>
                        <p className="text-xs text-orange-700/70">{t("deployK8sStoppedDesc")}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white border-none"
                      onClick={openK8sVersionDialog}
                      disabled={k8sDeployLoading || deleteDeployLoading}
                    >
                      {k8sDeployLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudUpload className="h-3 w-3" />}
                      {t("deployK8sRedeploy")}
                    </Button>
                  </div>
                </div>
              ) : (
                /* K8s: NEVER DEPLOYED state */
                <div className={`rounded-lg border-2 ${latestDeployment?.status === "RUNNING" ? "border-dashed border-foreground/20 bg-card" : "border-dashed border-muted"} p-8 flex flex-col items-center justify-center text-center space-y-3`}>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${latestDeployment?.status === "RUNNING" ? "bg-muted" : "bg-muted/40"}`}>
                    <Server className={`h-6 w-6 ${latestDeployment?.status === "RUNNING" ? "text-foreground/50" : "text-muted-foreground/30"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t("deployNotDeployed")}</p>
                    {(!latestDeployment || latestDeployment.status !== "RUNNING") && (
                      <p className="mt-1 text-xs text-muted-foreground/60">{t("deployNeedsBuild")}</p>
                    )}
                  </div>
                  {latestDeployment?.status === "RUNNING" && (
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-xs mt-1"
                      onClick={openK8sVersionDialog}
                      disabled={k8sDeployLoading || deleteDeployLoading}
                    >
                      {k8sDeployLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudUpload className="h-3 w-3" />}
                      {t("deployK8sBtn")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Floating Action Bar (config tab only) ──────────────── */}
      {selectedAgent && activeTab === "config" && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 z-50 border-t bg-background/80 backdrop-blur-md">
          <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              <span>Editing <strong className="text-foreground">{selectedAgent}</strong> — unsaved changes</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => { setPublishDescription(""); setPublishDialogOpen(true); }}
                disabled={publishing}
              >
                <Tag className="h-3 w-3" />
                {t("publishVersion")}
              </Button>
              <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSave} disabled={saving}>
                <Save className="h-3 w-3" />
                {saving ? tc("saving") : tc("save")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Publish Version Dialog ────────────────────────────────────── */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                <Tag className="h-3.5 w-3.5 text-emerald-600" />
              </span>
              {t("publishNewVersion")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {t("publishNewVersionDescription", { version: (versions[0]?.version ?? 0) + 1 })}
            </DialogDescription>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div>
              <label htmlFor="version-desc" className="text-xs font-medium mb-1 block">
                {t("descriptionOptional")}
              </label>
              <Textarea
                id="version-desc"
                placeholder={t("publishPlaceholder")}
                value={publishDescription}
                onChange={(e) => setPublishDescription(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPublishDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={async () => {
                setPublishing(true);
                try {
                  const result = await agentVersionApi.publish(
                    selectedAgent,
                    publishDescription.trim() || undefined,
                  );
                  toast.success(t("versionPublished", { version: result.version }));
                  setPublishDialogOpen(false);
                  loadVersions(selectedAgent);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : t("publishError"));
                } finally {
                  setPublishing(false);
                }
              }}
              disabled={publishing}
            >
              {publishing ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("publishing")}
                </>
              ) : (
                <>
                  <Tag className="h-3 w-3" />
                  {t("publishVersionNumber", { version: (versions[0]?.version ?? 0) + 1 })}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Agent Confirmation ─────────────────────────────── */}
      <Dialog open={deleteAgentConfirm} onOpenChange={setDeleteAgentConfirm}>
        <DialogContent className="p-0 gap-0 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50">
                <Trash2 className="h-3.5 w-3.5 text-red-600" />
              </span>
              {t("deleteAgent")}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5">
            <p className="text-sm text-muted-foreground">
              {t("deleteAgentConfirm", { name: selectedAgent })}
            </p>
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDeleteAgentConfirm(false)} disabled={deletingAgent}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={handleDeleteAgent} disabled={deletingAgent}>
              {deletingAgent ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              {t("deleteAgent")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Switch Dispatch Rules Dialog ───────────────────────────── */}
      {selectedAgent && (
        <SwitchDispatchRulesDialog
          fromAgent={selectedAgent}
          open={switchAgentDialogOpen}
          onClose={() => setSwitchAgentDialogOpen(false)}
        />
      )}

      {/* ─── Delete Knowledge Confirmation ─────────────────────────── */}
      <Dialog open={!!pendingDeleteKnowledgeId} onOpenChange={() => setPendingDeleteKnowledgeId(null)}>
        <DialogContent className="p-0 gap-0 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50">
                <Trash2 className="h-3.5 w-3.5 text-red-600" />
              </span>
              {t("deleteKnowledgeItem")}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5">
            <p className="text-sm text-muted-foreground">
              {t("deleteKnowledgeConfirm")}
            </p>
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPendingDeleteKnowledgeId(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 text-xs"
              onClick={() => pendingDeleteKnowledgeId && handleDeleteKnowledge(pendingDeleteKnowledgeId)}
            >
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Tool Confirmation ───────────────────────────────── */}
      <Dialog open={!!pendingDeleteToolId} onOpenChange={() => setPendingDeleteToolId(null)}>
        <DialogContent className="p-0 gap-0 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50">
                <Trash2 className="h-3.5 w-3.5 text-red-600" />
              </span>
              {t("deleteTool")}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5">
            <p className="text-sm text-muted-foreground">
              {t("deleteToolConfirm")}
            </p>
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPendingDeleteToolId(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 text-xs"
              onClick={() => pendingDeleteToolId && handleDeleteTool(pendingDeleteToolId)}
              disabled={!!deletingToolId}
            >
              {deletingToolId ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* K8s version picker dialog */}
      <Dialog open={k8sVersionDialogOpen} onOpenChange={setK8sVersionDialogOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <CloudUpload className="h-4 w-4 text-muted-foreground" />
              {t("deployK8sVersionTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {t("deployK8sVersionDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4 space-y-3">
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              <label
                key="draft"
                className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors overflow-hidden ${k8sDialogSelectedVersion === "draft" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                onClick={() => setK8sDialogSelectedVersion("draft")}
              >
                <div className={`h-2 w-2 rounded-full border-2 shrink-0 ${k8sDialogSelectedVersion === "draft" ? "border-primary bg-primary" : "border-muted-foreground/40"}`} />
                <div className="min-w-0 overflow-hidden">
                  <p className="text-xs font-medium truncate">Draft (current)</p>
                  <p className="text-[10px] text-muted-foreground truncate">Unsaved changes</p>
                </div>
              </label>
              {k8sDialogVersions.map((v) => (
                <label
                  key={v.version}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors overflow-hidden ${k8sDialogSelectedVersion === String(v.version) ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  onClick={() => setK8sDialogSelectedVersion(String(v.version))}
                >
                  <div className={`h-2 w-2 rounded-full border-2 shrink-0 ${k8sDialogSelectedVersion === String(v.version) ? "border-primary bg-primary" : "border-muted-foreground/40"}`} />
                  <div className="min-w-0 overflow-hidden">
                    <p className="text-xs font-medium">v{v.version}</p>
                    {v.description && (
                      <p className="text-[10px] text-muted-foreground">
                        {truncateText(v.description, 40)}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter className="border-t px-5 py-3 gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setK8sVersionDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => {
                const v = k8sDialogSelectedVersion === "draft" ? undefined : Number(k8sDialogSelectedVersion);
                handleDeployToK8s(v);
              }}
            >
              <CloudUpload className="h-3 w-3" />
              {k8sHealth?.status === "STOPPED" ? t("deployK8sRedeploy") : t("deployK8sBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AgentPage() {
  return (
    <React.Suspense>
      <AgentPageInner />
    </React.Suspense>
  );
}
