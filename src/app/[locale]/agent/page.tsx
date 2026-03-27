"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  agentConfigApi,
  agentKnowledgeApi,
  agentToolsApi,
  agentVersionApi,
  type AgentKnowledgeItem,
  type AgentTool,
  type ToolType,
  type RuntimeConfig,
  type ExtractionField,
  type AgentVersionSummary,
} from "@/lib/api";
import {
  type InstructionFields,
  EMPTY_FIELDS,
  composeInstructions,
  parseInstructions,
} from "@/lib/instructions-serializer";
import { StructuredInstructionsForm } from "@/components/structured-instructions-form";
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
  Bot,
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
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const LAST_AGENT_KEY = "voice-platform:lastAgent";

export default function AgentPage() {
  const [agents, setAgents] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [newAgentName, setNewAgentName] = useState("");
  const [showNewAgentInput, setShowNewAgentInput] = useState(false);

  const [instructionFields, setInstructionFields] = useState<InstructionFields>({ ...EMPTY_FIELDS, qualification: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [autoStart, setAutoStart] = useState(false);

  const t = useTranslations("agent");
  const tc = useTranslations("common");

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
    { value: "nova-3-general", label: t("sttModelRecommended") },
    { value: "nova-2-conversationalai", label: "Nova 2 ConversationalAI" },
    { value: "nova-2-phonecall", label: "Nova 2 Phonecall" },
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
      ambience: false,
    },
    persona: "sales",
    timeoutSeconds: null,
    maxCallDurationSeconds: null,
    greetingMessage: null,
    greetingMode: null,
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
    sttFinalTimeoutMs: null,
    followUpTimeoutSeconds: null,
    followUpMessage: null,
    followUpMode: null,
    maxFollowUps: null,
  };
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>(DEFAULT_RUNTIME_CONFIG);
  const [runtimeExpanded, setRuntimeExpanded] = useState(true);
  // Tracks when user explicitly chose "Custom Voice ID" in ElevenLabs voice selector
  const [isCustomVoiceMode, setIsCustomVoiceMode] = useState(false);

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Tools state ─────────────────────────────────────────────
  const [agentTools, setAgentTools] = useState<AgentTool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [toolDialogOpen, setToolDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<AgentTool | null>(null);
  const [savingTool, setSavingTool] = useState(false);
  const [deletingToolId, setDeletingToolId] = useState<string | null>(null);
  const [seedingTools, setSeedingTools] = useState(false);  const TOOL_TYPES: { value: ToolType; label: string; desc: string }[] = [
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
  const [activeTab, setActiveTab] = useState("config");

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
        const rawInstructions = config.raw_instructions ?? config.instructions;
        setInstructionFields(parseInstructions(rawInstructions));
        setAutoStart(config.auto_start ?? false);
        setRuntimeConfig({ ...DEFAULT_RUNTIME_CONFIG, ...config.runtime_config });
        setLastUpdated(config.updated_at);
      } catch {
        setInstructionFields({ ...EMPTY_FIELDS, qualification: [] });
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

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    if (!selectedAgent) return;
    loadConfig(selectedAgent);
    loadKnowledge(selectedAgent);
    loadTools(selectedAgent);
    loadVersions(selectedAgent);
  }, [selectedAgent, loadConfig, loadKnowledge, loadTools, loadVersions]);

  const handleAgentChange = (value: string) => {
    if (value === "__new__") {
      setShowNewAgentInput(true);
      return;
    }
    setShowNewAgentInput(false);
    setSelectedAgent(value);
    localStorage.setItem(LAST_AGENT_KEY, value);
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
      toast.success(`Agent "${selectedAgent}" deleted`);
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
      toast.error(err instanceof Error ? err.message : "Failed to delete agent");
    } finally {
      setDeletingAgent(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const instructions = composeInstructions(instructionFields);
      const config = await agentConfigApi.update(instructions, selectedAgent, {
        auto_start: autoStart,
        runtime_config: runtimeConfig,
      });
      setLastUpdated(config.updated_at);
      toast.success(t("configSaved"));
    } catch {
      toast.error(t("configSaveError"));
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
        err instanceof Error ? err.message : "Failed to upload file"
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
      toast.error(err instanceof Error ? err.message : "Failed to save tool");
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
      toast.success(`Tool "${tool.name}" ${tool.enabled ? "disabled" : "enabled"}`);
    } catch {
      toast.error(t("toolToggleError"));
    }
  };

  const handleSeedTools = async () => {
    setSeedingTools(true);
    try {
      const result = await agentToolsApi.seed(selectedAgent);
      if (result.seeded > 0) {
        toast.success(`${result.seeded} default tool(s) created!`);
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
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("description")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("selectAgent")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={selectedAgent} onValueChange={handleAgentChange}>
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue placeholder={t("selectAnAgent")} />
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
                    {t("createNewAgent")}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {showNewAgentInput && (
              <div className="flex items-center gap-2">
                <Input
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder={t("agentNamePlaceholder")}
                  className="w-[200px]"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateAgent()}
                />
                <Button size="sm" onClick={handleCreateAgent}>
                  {tc("create")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowNewAgentInput(false);
                    setNewAgentName("");
                  }}
                >
                  {tc("cancel")}
                </Button>
              </div>
            )}

            {!showNewAgentInput && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive"
                onClick={() => setDeleteAgentConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {t("deleteAgent")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="config">
            <Settings2 className="h-4 w-4" />
            {t("tabConfiguration")}
          </TabsTrigger>
          <TabsTrigger value="knowledge">
            <BookOpen className="h-4 w-4" />
            {t("tabKnowledge")}
          </TabsTrigger>
          <TabsTrigger value="tools">
            <Wrench className="h-4 w-4" />
            {t("tabTools")}
          </TabsTrigger>
          <TabsTrigger value="versions">
            <Tag className="h-4 w-4" />
            {t("tabVersions")}
            {versions.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {versions.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4 pb-16">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{t("instructions")}</CardTitle>
              <CardDescription>
                {t("instructionsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <StructuredInstructionsForm
                value={instructionFields}
                onChange={setInstructionFields}
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  {lastUpdated && (
                    <span>
                      {t("lastUpdated", { date: new Date(lastUpdated).toLocaleString() })}
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
                      {t("autoStartWorker")}
                    </Label>
                  </div>
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
                    {t("runtimeConfig")}
                  </CardTitle>
                  <CardDescription>
                    {t("runtimeConfigDescription")}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRuntimeExpanded((v) => !v)}
                  className="h-7 px-2 text-xs text-muted-foreground"
                >
                  <ChevronsUpDown className="mr-1 h-3 w-3" />
                  {runtimeExpanded ? t("collapse") : t("expand")}
                </Button>
              </div>
            </CardHeader>
            {runtimeExpanded && (
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Mic className="h-4 w-4" /> {t("modelAndVoice")}
                  </Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    {t("modelAndVoiceDescription")}
                  </p>

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
                          <SelectGroup>
                            <SelectLabel>OpenAI Realtime</SelectLabel>
                            <SelectItem value="gpt-4o-mini-realtime-preview">gpt-4o-mini-realtime-preview</SelectItem>
                            <SelectItem value="gpt-4o-realtime-preview">gpt-4o-realtime-preview</SelectItem>
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>Pipeline — GPT-5</SelectLabel>
                            <SelectItem value="gpt-5.4">gpt-5.4</SelectItem>
                            <SelectItem value="gpt-5.2">gpt-5.2</SelectItem>
                            <SelectItem value="gpt-5.1">gpt-5.1</SelectItem>
                            <SelectItem value="gpt-5">gpt-5</SelectItem>
                            <SelectItem value="gpt-5-mini">gpt-5-mini</SelectItem>
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

                {/* STT Configuration - Pipeline Mode Only */}
                {isPipelineMode && (
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      STT — Speech-to-Text
                    </Label>
                    <p className="text-xs text-muted-foreground -mt-1">
                      Em pipeline mode, o agente usa um STT externo para transcrição. Configure o provedor e modelo.
                    </p>
                    <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
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

                      {/* Endpointing (Deepgram only) */}
                      {runtimeConfig.stt?.provider === 'deepgram' && (
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
                      )}
                    </div>
                  </div>
                )}

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

                {/* Inject Session Context */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="rt-inject-session"
                      checked={runtimeConfig.injectSessionContext ?? false}
                      onChange={(e) =>
                        setRuntimeConfig((prev) => ({
                          ...prev,
                          injectSessionContext: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="rt-inject-session" className="text-sm cursor-pointer">
                      Inject Session Context
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    When enabled, room metadata (channel, from_number, customer_name, etc.) is automatically appended to the agent&apos;s instructions so the LLM knows who is calling and from which channel.
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
                    placeholder={t("greetingPlaceholder")}
                  />

                  {/* Greeting Mode */}
                  <div className="space-y-1 pt-1">
                    <Label htmlFor="rt-greeting-mode" className="text-xs text-muted-foreground">
                      Greeting Mode
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
                          Auto (say for ElevenLabs, generateReply for OpenAI)
                        </SelectItem>
                        <SelectItem value="say">
                          Say — TTS reads text literally (low latency)
                        </SelectItem>
                        <SelectItem value="generateReply">
                          Generate Reply — LLM generates natural response
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      <strong>Say</strong> plays the exact greeting text via TTS (fastest). <strong>Generate Reply</strong> sends the text as instructions to the LLM, which generates a natural response (dynamic but slower).
                    </p>
                  </div>
                </div>

                {/* Turn Detection (VAD) */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Turn Detection</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    {isPipelineMode
                      ? "Pipeline mode: controla como o agente detecta que o usuário terminou de falar."
                      : "Voice Activity Detection — controls when the agent detects the user has stopped speaking and can respond."}
                  </p>

                  {/* Pipeline mode: turn detection strategy */}
                  {isPipelineMode && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="rt-pipeline-td" className="text-xs text-muted-foreground">
                          Turn Detector
                        </Label>
                        <Select
                          value={runtimeConfig.pipelineTurnDetector ?? "turn_detector_model"}
                          onValueChange={(v) =>
                            setRuntimeConfig((prev) => ({
                              ...prev,
                              pipelineTurnDetector: v as "turn_detector_model" | "vad" | "stt" | "manual",
                            }))
                          }
                        >
                          <SelectTrigger id="rt-pipeline-td">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="turn_detector_model">Turn Detector Model — Contextual (Recomendado)</SelectItem>
                            <SelectItem value="stt">STT — Baseado em transcrição</SelectItem>
                            <SelectItem value="vad">VAD — Voice Activity Detection</SelectItem>
                            <SelectItem value="manual">Manual — Controle manual</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                          <strong>Turn Detector Model</strong>: modelo que usa contexto da conversa para decidir se o usuário terminou (evita interrupções em pausas naturais).{" "}
                          <strong>STT</strong>: detecta fim pelo endpointing do STT.{" "}
                          <strong>VAD</strong>: usa apenas detecção de voz/silêncio.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="rt-silero-vad"
                          checked={runtimeConfig.useSileroVad ?? true}
                          onChange={(e) =>
                            setRuntimeConfig((prev) => ({
                              ...prev,
                              useSileroVad: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="rt-silero-vad" className="text-xs">
                          Silero VAD — Detecção de atividade vocal (recomendado para interrupções responsivas)
                        </Label>
                      </div>
                    </div>
                  )}

                  {/* Realtime mode: server_vad / semantic_vad */}
                  {!isPipelineMode && (
                  <>
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
                  {/* Input Audio Transcription — Realtime Mode Only */}
                  <div className="space-y-3 pt-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      Input Audio Transcription
                    </Label>
                    <p className="text-xs text-muted-foreground -mt-1">
                      Modelo usado para transcrição do áudio de entrada em sessões realtime.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="rt-iat-model" className="text-xs text-muted-foreground">
                          Transcription Model
                        </Label>
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

                      <div className="space-y-1">
                        <Label htmlFor="rt-iat-lang" className="text-xs text-muted-foreground">
                          Idioma Transcrição
                        </Label>
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
                          <SelectTrigger id="rt-iat-lang">
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
                  </> )} {/* end !isPipelineMode */}
                </div>

                {/* Endpointing */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Endpointing</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Controla quanto tempo o agente espera após o silêncio antes de considerar que o turno do usuário acabou.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="rt-ep-min" className="text-xs text-muted-foreground">
                        Min Delay (ms)
                      </Label>
                      <Input
                        id="rt-ep-min"
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
                    <div className="space-y-1">
                      <Label htmlFor="rt-ep-max" className="text-xs text-muted-foreground">
                        Max Delay (ms)
                      </Label>
                      <Input
                        id="rt-ep-max"
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

                {/* Interruption Handling */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Interruption Handling</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Configura como o agente reage quando o usuário fala enquanto o agente está respondendo.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="rt-int-enabled"
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
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="rt-int-enabled" className="text-xs">
                        Permitir interrupções pelo usuário
                      </Label>
                    </div>

                    {(runtimeConfig.interruption?.enabled ?? true) && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label htmlFor="rt-int-mode" className="text-xs text-muted-foreground">
                              Modo de Detecção
                            </Label>
                            <Select
                              value={runtimeConfig.interruption?.mode ?? "adaptive"}
                              onValueChange={(v) =>
                                setRuntimeConfig((prev) => ({
                                  ...prev,
                                  interruption: {
                                    ...prev.interruption,
                                    mode: v as "adaptive" | "vad",
                                  },
                                }))
                              }
                            >
                              <SelectTrigger id="rt-int-mode">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="adaptive">Adaptive — Distingue interrupção real de &quot;uhum&quot; (Recomendado)</SelectItem>
                                <SelectItem value="vad">VAD — Qualquer fala interrompe</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="rt-int-min-dur" className="text-xs text-muted-foreground">
                              Min Duration (ms)
                            </Label>
                            <Input
                              id="rt-int-min-dur"
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
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label htmlFor="rt-int-min-words" className="text-xs text-muted-foreground">
                              Min Words
                            </Label>
                            <Input
                              id="rt-int-min-words"
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
                              Mínimo de palavras transcritas para considerar interrupção. (0 = qualquer som)
                            </p>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="rt-int-false-timeout" className="text-xs text-muted-foreground">
                              False Interruption Timeout (ms)
                            </Label>
                            <Input
                              id="rt-int-false-timeout"
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
                        </div>
                        <div className="flex items-center gap-2">
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
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <Label htmlFor="rt-int-resume" className="text-xs">
                            Retomar fala após falsa interrupção
                          </Label>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Humanization */}
                <div className="space-y-2">
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                        placeholder={t("disabledPlaceholder")}
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
                        placeholder={t("disabledPlaceholder")}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="rt-stt-final-timeout"
                        className="text-xs text-muted-foreground"
                      >
                        STT final timeout (ms)
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
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-3">
                    <div className="space-y-1">
                      <Label
                        htmlFor="rt-followup-timeout"
                        className="text-xs text-muted-foreground"
                      >
                        Follow-up timeout (seconds)
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
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="rt-followup-message"
                        className="text-xs text-muted-foreground"
                      >
                        Follow-up message
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
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="rt-followup-mode"
                        className="text-xs text-muted-foreground"
                      >
                        Follow-up mode
                      </Label>
                      <Select
                        value={runtimeConfig.followUpMode ?? "generateReply"}
                        onValueChange={(v) =>
                          setRuntimeConfig((prev) => ({
                            ...prev,
                            followUpMode: v as "say" | "generateReply",
                          }))
                        }
                      >
                        <SelectTrigger id="rt-followup-mode" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="say">
                            Say — TTS reads text literally
                          </SelectItem>
                          <SelectItem value="generateReply">
                            Generate Reply — LLM generates natural response
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="rt-max-followups"
                        className="text-xs text-muted-foreground"
                      >
                        Max follow-ups
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
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to disable. Follow-up sends a message after silence
                    asking if the user is still there; Inactivity timeout ends the
                    call after silence; max duration is a hard limit; STT final
                    timeout injects the last partial transcription if no final
                    arrives in time.
                  </p>
                </div>

                {/* ── Extraction Fields (Ticket) ── */}
                <div className="space-y-3 border-t pt-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Campos de Extração (Ticket)</h4>
                      <p className="text-xs text-muted-foreground">
                        Campos extraídos automaticamente da conversa ao final da chamada.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
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
                      + Adicionar Campo
                    </Button>
                  </div>

                  {(runtimeConfig.extractionFields ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      Nenhum campo de extração configurado. Adicione campos para gerar tickets automaticamente.
                    </p>
                  )}

                  {(runtimeConfig.extractionFields ?? []).map((field, idx) => (
                    <div
                      key={idx}
                      className="rounded-md border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Campo {idx + 1}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive"
                          onClick={() =>
                            setRuntimeConfig((prev) => ({
                              ...prev,
                              extractionFields: (prev.extractionFields ?? []).filter(
                                (_, i) => i !== idx
                              ),
                            }))
                          }
                        >
                          ×
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Key</Label>
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
                          <Label className="text-xs">Label</Label>
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
                          <Label className="text-xs">Tipo</Label>
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
                        <div className="flex items-end gap-2">
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
                        <Label className="text-xs">Descrição (usada no prompt)</Label>
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
                          <Label className="text-xs">Opções (separadas por vírgula)</Label>
                          <Input
                            value={(field.options ?? []).join(", ")}
                            onChange={(e) =>
                              setRuntimeConfig((prev) => {
                                const fields = [...(prev.extractionFields ?? [])];
                                fields[idx] = {
                                  ...fields[idx],
                                  options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                                };
                                return { ...prev, extractionFields: fields };
                              })
                            }
                            placeholder="ex: satisfeito, neutro, insatisfeito"
                            className="h-8 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  ))}
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
                              onClick={() => setPendingDeleteKnowledgeId(item.id)}
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
                    Click &quot;Add Tool&quot; to create an HTTP Request, Pre-Call Hook, or Post-Call Hook.
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
                            {tool.type === "PRE_CALL" && (
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" /> Pre-Call
                              </span>
                            )}
                            {tool.type === "POST_CALL" && (
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" /> Post-Call
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
                    placeholder={t("toolDescriptionPlaceholder")}
                  />
                </div>

                {toolForm.type !== "PRE_CALL" && toolForm.type !== "POST_CALL" && (
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
                  </div>
                </div>
                )}

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
                  {tc("cancel")}
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

        {/* ─── Versions Tab ─────────────────────────────────────────────── */}
        <TabsContent value="versions" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    Published Versions
                  </CardTitle>
                  <CardDescription>
                    Publish immutable snapshots of your agent configuration (instructions + runtime config + tools).
                    Use versions to freeze configs that work and spawn workers with specific versions for testing.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadVersions(selectedAgent)}
                    disabled={loadingVersions}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${loadingVersions ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  <Button size="sm" onClick={() => { setPublishDescription(""); setPublishDialogOpen(true); }}>
                    <Tag className="h-4 w-4 mr-1" />
                    Publish Version
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingVersions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No versions published yet. Click &ldquo;Publish Version&rdquo; to create the first snapshot
                  of your agent configuration.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Version</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[180px]">Published</TableHead>
                        <TableHead className="w-[120px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {versions.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell>
                            <Badge variant="secondary" className="font-mono">
                              v{v.version}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {v.description || <span className="italic">No description</span>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(v.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="View details"
                                onClick={async () => {
                                  try {
                                    const detail = await agentVersionApi.get(selectedAgent, v.version);
                                    setViewingVersion(detail);
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Failed to load version");
                                  }
                                }}
                              >
                                <Code className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Restore to draft"
                                onClick={() => setRestoreConfirmVersion(v)}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                title="Delete version"
                                disabled={deletingVersionNum === v.version}
                                onClick={async () => {
                                  setDeletingVersionNum(v.version);
                                  try {
                                    await agentVersionApi.delete(selectedAgent, v.version);
                                    toast.success(`Version v${v.version} deleted`);
                                    loadVersions(selectedAgent);
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Failed to delete version");
                                  } finally {
                                    setDeletingVersionNum(null);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Version detail dialog */}
          <Dialog open={!!viewingVersion} onOpenChange={(open) => { if (!open) setViewingVersion(null); }}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Version v{viewingVersion?.version}
                  {viewingVersion?.description && (
                    <span className="text-sm font-normal text-muted-foreground">— {viewingVersion.description}</span>
                  )}
                </DialogTitle>
                <DialogDescription>
                  Published {viewingVersion?.created_at ? new Date(viewingVersion.created_at).toLocaleString() : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Instructions</Label>
                  <pre className="mt-1 p-3 bg-muted rounded-md text-xs whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                    {viewingVersion?.instructions || "(empty)"}
                  </pre>
                </div>
                <div>
                  <Label className="text-sm font-medium">Runtime Config</Label>
                  <pre className="mt-1 p-3 bg-muted rounded-md text-xs whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                    {viewingVersion?.runtime_config
                      ? JSON.stringify(
                          typeof viewingVersion.runtime_config === "string"
                            ? JSON.parse(viewingVersion.runtime_config)
                            : viewingVersion.runtime_config,
                          null,
                          2
                        )
                      : "(default)"}
                  </pre>
                </div>
                <div>
                  <Label className="text-sm font-medium">
                    Tools ({viewingVersion?.tools_snapshot?.length ?? 0})
                  </Label>
                  {viewingVersion?.tools_snapshot?.length > 0 ? (
                    <div className="mt-1 space-y-2">
                      {viewingVersion.tools_snapshot.map((t: any, i: number) => (
                        <div key={i} className="p-2 bg-muted rounded-md text-xs">
                          <span className="font-medium">{t.name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">{t.type}</Badge>
                          <p className="text-muted-foreground mt-0.5">{t.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">(no tools)</p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Restore confirmation dialog */}
          <Dialog open={!!restoreConfirmVersion} onOpenChange={(open) => { if (!open) setRestoreConfirmVersion(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Restore Version v{restoreConfirmVersion?.version}?
                </DialogTitle>
                <DialogDescription>
                  This will overwrite your current draft with the configuration from
                  <strong> v{restoreConfirmVersion?.version}</strong>
                  {restoreConfirmVersion?.description && (
                    <> ({restoreConfirmVersion.description})</>
                  )}.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">
                <strong>Warning:</strong> Any unsaved changes in your current draft (instructions, runtime config, and tools) will be lost.
                Consider publishing the current draft as a version first if you want to keep it.
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRestoreConfirmVersion(null)}>
                  {tc("cancel")}
                </Button>
                <Button
                  variant="default"
                  disabled={restoring}
                  onClick={async () => {
                    if (!restoreConfirmVersion) return;
                    setRestoring(true);
                    try {
                      await agentVersionApi.restore(selectedAgent, restoreConfirmVersion.version);
                      toast.success(`Draft restored from v${restoreConfirmVersion.version}`);
                      setRestoreConfirmVersion(null);
                      // Reload all agent data to reflect restored config
                      loadConfig(selectedAgent);
                      loadTools(selectedAgent);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to restore version");
                    } finally {
                      setRestoring(false);
                    }
                  }}
                >
                  {restoring ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Restoring...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Restore v{restoreConfirmVersion?.version}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      {/* ─── Floating Action Bar (config tab only) ──────────────── */}
      {selectedAgent && activeTab === "config" && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto max-w-5xl flex items-center justify-end gap-3 px-6 py-3">
            <Button
              variant="outline"
              onClick={() => { setPublishDescription(""); setPublishDialogOpen(true); }}
              disabled={publishing}
            >
              <Tag className="h-4 w-4 mr-2" />
              Publish Version
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : tc("save")}
            </Button>
          </div>
        </div>
      )}

      {/* ─── Publish Version Dialog ────────────────────────────────────── */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish New Version</DialogTitle>
            <DialogDescription>
              This will create an immutable snapshot of the current agent configuration
              (instructions, runtime config, and tools). The version number will be v{(versions[0]?.version ?? 0) + 1}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="version-desc">Description (optional)</Label>
            <Textarea
              id="version-desc"
              placeholder="e.g., Fixed greeting message, added transfer tool..."
              value={publishDescription}
              onChange={(e) => setPublishDescription(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={async () => {
                setPublishing(true);
                try {
                  const result = await agentVersionApi.publish(
                    selectedAgent,
                    publishDescription.trim() || undefined,
                  );
                  toast.success(`Version v${result.version} published!`);
                  setPublishDialogOpen(false);
                  loadVersions(selectedAgent);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to publish version");
                } finally {
                  setPublishing(false);
                }
              }}
              disabled={publishing}
            >
              {publishing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Tag className="h-4 w-4 mr-1" />
                  Publish v{(versions[0]?.version ?? 0) + 1}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Agent Confirmation ─────────────────────────────── */}
      <Dialog open={deleteAgentConfirm} onOpenChange={setDeleteAgentConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteAgent")}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the agent <strong>&quot;{selectedAgent}&quot;</strong>?
              This will permanently remove the agent configuration, all knowledge items, tools, and deployment history.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAgentConfirm(false)} disabled={deletingAgent}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteAgent} disabled={deletingAgent}>
              {deletingAgent ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("deleteAgent")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Knowledge Confirmation ─────────────────────────── */}
      <Dialog open={!!pendingDeleteKnowledgeId} onOpenChange={() => setPendingDeleteKnowledgeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Knowledge Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this knowledge item? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeleteKnowledgeId(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDeleteKnowledgeId && handleDeleteKnowledge(pendingDeleteKnowledgeId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Tool Confirmation ───────────────────────────────── */}
      <Dialog open={!!pendingDeleteToolId} onOpenChange={() => setPendingDeleteToolId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tool</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this tool? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeleteToolId(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDeleteToolId && handleDeleteTool(pendingDeleteToolId)}
              disabled={!!deletingToolId}
            >
              {deletingToolId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
