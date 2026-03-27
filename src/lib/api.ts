export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API error: ${res.status}`);
  }

  return res.json();
}

export interface TurnDetectionConfig {
  type?: 'server_vad' | 'semantic_vad';
  // semantic_vad
  eagerness?: 'auto' | 'low' | 'medium' | 'high';
  // server_vad
  threshold?: number;
  prefix_padding_ms?: number;
  silence_duration_ms?: number;
  // shared
  create_response?: boolean;
  interrupt_response?: boolean;
}

export interface HumanizationConfig {
  fillersEnabled?: boolean;
  typingSounds?: boolean;
  ambience?: boolean;
}

export interface TTSConfig {
  provider?: string;
  model?: string;
  voiceId?: string;
  language?: string;
  stability?: number;
  similarityBoost?: number;
  speed?: number;
}

export interface STTConfig {
  provider?: 'openai_whisper' | 'deepgram';
  model?: string;
  language?: string;
  detectLanguage?: boolean;
  endpointing?: number;
}

export interface ExtractionField {
  key: string;
  label: string;
  type: 'string' | 'enum' | 'number' | 'boolean';
  description: string;
  options?: string[];
  required?: boolean;
}

export interface EndpointingConfig {
  minDelay?: number;  // ms (default 500)
  maxDelay?: number;  // ms (default 3000)
}

export interface InterruptionConfig {
  enabled?: boolean;
  mode?: 'adaptive' | 'vad';
  minDuration?: number;  // ms (default 500)
  minWords?: number;     // default 1
  falseInterruptionTimeout?: number;  // ms (default 2000)
  resumeFalseInterruption?: boolean;  // default true
}

export interface RuntimeConfig {
  model?: string;
  voice?: string;
  temperature?: number;
  maxTokens?: number;
  turnDetection?: TurnDetectionConfig;
  noiseCancellation?: boolean;
  humanization?: HumanizationConfig;
  persona?: string;
  timeoutSeconds?: number | null;
  maxCallDurationSeconds?: number | null;
  greetingMessage?: string | null;
  greetingMode?: 'say' | 'generateReply' | null;
  tts?: TTSConfig;
  stt?: STTConfig | null;
  injectSessionContext?: boolean;
  sessionTurnDetection?: 'stt' | 'vad' | 'realtime_llm' | 'manual' | null;
  pipelineTurnDetector?: 'turn_detector_model' | 'vad' | 'stt' | 'manual' | null;
  useSileroVad?: boolean;
  endpointing?: EndpointingConfig;
  interruption?: InterruptionConfig;
  extractionFields?: ExtractionField[];
  inputAudioTranscription?: {
    model?: string;
    language?: string;
  };
  // [DISABLED] STT final timeout
  // sttFinalTimeoutMs?: number | null;
  followUpTimeoutSeconds?: number | null;
  followUpMessage?: string | null;
  followUpMode?: 'say' | 'generateReply' | null;
  maxFollowUps?: number | null;
}

export interface AgentConfig {
  id: string;
  name: string;
  instructions: string;
  raw_instructions: string;
  auto_start: boolean;
  tools: any;
  runtime_config: RuntimeConfig | null;
  updated_at: string;
}

export const agentConfigApi = {
  get: (agentName: string) =>
    request<AgentConfig>(`/agent-config?agentName=${encodeURIComponent(agentName)}`),

  update: (
    instructions: string,
    agentName: string,
    options?: { auto_start?: boolean; tools?: any; runtime_config?: RuntimeConfig }
  ) =>
    request<AgentConfig>(`/agent-config?agentName=${encodeURIComponent(agentName)}`, {
      method: "PUT",
      body: JSON.stringify({ instructions, ...options }),
    }),

  listAgents: () => request<string[]>("/agent-config/agents"),

  delete: (agentName: string) =>
    request<AgentConfig>(`/agent-config?agentName=${encodeURIComponent(agentName)}`, {
      method: "DELETE",
    }),
};

export interface AgentKnowledgeItem {
  id: string;
  agent_name: string;
  file_name: string;
  char_count: number;
  summarized: boolean;
  created_at: string;
}

export interface AgentKnowledgeDetail extends AgentKnowledgeItem {
  content: string;
}

export const agentKnowledgeApi = {
  upload: async (file: File, agentName: string, summarize: boolean) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(
      `${API_BASE_URL}/agent-knowledge/upload?agentName=${encodeURIComponent(agentName)}&summarize=${summarize}`,
      {
        method: "POST",
        body: formData,
        // Do NOT set Content-Type — browser sets it with multipart boundary
      }
    );

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(error.message || `API error: ${res.status}`);
    }

    return res.json() as Promise<AgentKnowledgeDetail>;
  },

  list: (agentName: string) =>
    request<AgentKnowledgeItem[]>(
      `/agent-knowledge?agentName=${encodeURIComponent(agentName)}`
    ),

  delete: (id: string) =>
    request<AgentKnowledgeItem>(`/agent-knowledge/${id}`, {
      method: "DELETE",
    }),
};

export interface WorkerStatusEntry {
  running: boolean;
  hasFile: boolean;
  auto_start: boolean;
  version: string | null;
}

export interface WorkerStatus {
  workers: Record<string, WorkerStatusEntry>;
}

export interface WorkerRestartResponse {
  success: boolean;
  message: string;
}

export const agentWorkerApi = {
  status: () => request<WorkerStatus>("/agent-worker/status"),

  available: () => request<string[]>("/agent-worker/available"),

  spawn: (agentName: string, version?: string) => {
    const params = new URLSearchParams({ agentName });
    if (version) params.set("version", version);
    return request<WorkerRestartResponse>(
      `/agent-worker/spawn?${params.toString()}`,
      { method: "POST" }
    );
  },

  restart: (agentName: string) =>
    request<WorkerRestartResponse>(
      `/agent-worker/restart?agentName=${encodeURIComponent(agentName)}`,
      { method: "POST" }
    ),

  kill: (agentName: string) =>
    request<WorkerRestartResponse>(
      `/agent-worker/kill?agentName=${encodeURIComponent(agentName)}`,
      { method: "DELETE" }
    ),
};

// ─── Agent Versions ──────────────────────────────────────────────────────────

export interface AgentVersionSummary {
  id: string;
  version: number;
  description: string | null;
  created_at: string;
}

export interface AgentVersionDetail extends AgentVersionSummary {
  agent_name: string;
  instructions: string;
  runtime_config: string | null;
  tools_snapshot: any[];
}

export const agentVersionApi = {
  publish: (agentName: string, description?: string) =>
    request<AgentVersionDetail>(
      `/agent-version/${encodeURIComponent(agentName)}/publish`,
      {
        method: "POST",
        body: JSON.stringify({ description }),
      }
    ),

  list: (agentName: string) =>
    request<AgentVersionSummary[]>(
      `/agent-version/${encodeURIComponent(agentName)}`
    ),

  get: (agentName: string, version: number) =>
    request<AgentVersionDetail>(
      `/agent-version/${encodeURIComponent(agentName)}/${version}`
    ),

  getLatest: (agentName: string) =>
    request<AgentVersionDetail>(
      `/agent-version/${encodeURIComponent(agentName)}/latest`
    ),

  delete: (agentName: string, version: number) =>
    request<AgentVersionDetail>(
      `/agent-version/${encodeURIComponent(agentName)}/${version}`,
      { method: "DELETE" }
    ),

  restore: (agentName: string, version: number) =>
    request<{ restored: boolean; version: number; description: string | null }>(
      `/agent-version/${encodeURIComponent(agentName)}/${version}/restore`,
      { method: "POST" }
    ),
};


export interface CreateRoomRequest {
  agent_name: string;
  from_number: string;
  to_number: string;
  channel: string;
  direction: string;
  customer_name: string;
  enable_webrtc: boolean;
}

export interface RoomMetadata {
  agent_name: string;
  from_number: string;
  to_number: string;
  channel: string;
  direction: string;
  customer_name: string;
  enable_webrtc: boolean;
}

export interface CreateRoomResponse {
  sessionId: string;
  url: string;
  room_name: string;
  token: string;
  metadata: RoomMetadata;
}

export type DeploymentStatus =
  | "BUILDING"
  | "PUSHING"
  | "DEPLOYING"
  | "RUNNING"
  | "FAILED"
  | "STOPPED";

export interface AgentDeployment {
  id: string;
  agent_name: string;
  version: number;
  image_tag: string;
  status: DeploymentStatus;
  build_logs: string | null;
  pod_name: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface TriggerDeployResponse {
  deploymentId: string;
  agent_name: string;
  version: number;
  image_tag: string;
  status: DeploymentStatus;
}

export interface DeployHealthResponse {
  healthy: boolean;
  status: string;
  pod_name?: string;
  version?: number;
  lastCheck?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface DeployConfig {
  id: string;
  registry_url: string;
  registry_namespace: string;
  deploy_controller_url: string;
  updated_at: string;
}

export interface UpdateDeployConfigRequest {
  registry_url?: string;
  registry_namespace?: string;
  deploy_controller_url?: string;
}

export const deployApi = {
  triggerDeploy: (agentName: string) =>
    request<TriggerDeployResponse>(`/deploy/${encodeURIComponent(agentName)}`, {
      method: "POST",
    }),

  getDeployments: (agentName: string) =>
    request<AgentDeployment[]>(`/deploy/${encodeURIComponent(agentName)}`),

  getLatestDeployment: (agentName: string) =>
    request<AgentDeployment | null>(
      `/deploy/${encodeURIComponent(agentName)}/latest`
    ),

  getDeploymentByVersion: (agentName: string, version: number) =>
    request<AgentDeployment>(
      `/deploy/${encodeURIComponent(agentName)}/version/${version}`
    ),

  getHealth: (agentName: string) =>
    request<DeployHealthResponse>(
      `/deploy/${encodeURIComponent(agentName)}/health`
    ),

  stopDeployment: (agentName: string) =>
    request<{ success: boolean; message: string }>(
      `/deploy/${encodeURIComponent(agentName)}/stop`,
      { method: "POST" }
    ),

  getConfig: () => request<DeployConfig>("/deploy/config/settings"),

  updateConfig: (data: UpdateDeployConfigRequest) =>
    request<DeployConfig>("/deploy/config/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ─── SIP Trunks ──────────────────────────────────────────────

// ─── Agent Tools ─────────────────────────────────────────────

export type ToolType = "TRANSFER_CALL" | "END_CALL" | "HTTP_REQUEST" | "PRE_CALL" | "POST_CALL";

export interface AgentTool {
  id: string;
  agent_name: string;
  name: string;
  type: ToolType;
  description: string;
  parameters: Record<string, any> | null;
  config: Record<string, any> | null;
  enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentToolRequest {
  agent_name: string;
  name: string;
  type: ToolType;
  description: string;
  parameters?: Record<string, any>;
  config?: Record<string, any>;
  enabled?: boolean;
  sort_order?: number;
}

export interface UpdateAgentToolRequest {
  name?: string;
  type?: ToolType;
  description?: string;
  parameters?: Record<string, any>;
  config?: Record<string, any>;
  enabled?: boolean;
  sort_order?: number;
}

export const agentToolsApi = {
  list: (agentName: string) =>
    request<AgentTool[]>(
      `/agent-tools?agentName=${encodeURIComponent(agentName)}`
    ),

  create: (data: CreateAgentToolRequest) =>
    request<AgentTool>("/agent-tools", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateAgentToolRequest) =>
    request<AgentTool>(`/agent-tools/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<AgentTool>(`/agent-tools/${id}`, { method: "DELETE" }),

  seed: (agentName: string) =>
    request<{ seeded: number; tools: AgentTool[] }>(
      `/agent-tools/seed/${encodeURIComponent(agentName)}`,
      { method: "POST" }
    ),
};

// ─── SIP Trunks ──────────────────────────────────────────────

export interface SipInboundTrunk {
  sipTrunkId: string;
  name: string;
  numbers: string[];
  allowedNumbers: string[];
  allowedAddresses: string[];
  krispEnabled: boolean;
  metadata: string;
  createdAt?: number;
}

export interface CreateSipTrunkRequest {
  name: string;
  numbers?: string[];
  allowedNumbers?: string[];
  allowedAddresses?: string[];
  krispEnabled?: boolean;
  metadata?: string;
}

export interface UpdateSipTrunkRequest {
  name?: string;
  numbers?: string[];
  allowedNumbers?: string[];
  allowedAddresses?: string[];
  krispEnabled?: boolean;
  metadata?: string;
}

export const sipTrunkApi = {
  create: (data: CreateSipTrunkRequest) =>
    request<SipInboundTrunk>("/sip-trunks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  list: () => request<SipInboundTrunk[]>("/sip-trunks"),

  getById: (id: string) => request<SipInboundTrunk>(`/sip-trunks/${id}`),

  update: (id: string, data: UpdateSipTrunkRequest) =>
    request<SipInboundTrunk>(`/sip-trunks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<SipInboundTrunk>(`/sip-trunks/${id}`, { method: "DELETE" }),
};

// ─── Dispatch Rules ──────────────────────────────────────────

export interface DispatchRuleInfo {
  sipDispatchRuleId: string;
  name: string;
  rule?: {
    dispatchRuleDirect?: { roomName: string; pin?: string };
    dispatchRuleIndividual?: { roomPrefix: string; pin?: string };
    dispatchRuleCallee?: { roomPrefix: string; randomize?: boolean; pin?: string };
  };
  trunkIds: string[];
  hidePhoneNumber: boolean;
  metadata: string;
  attributes: Record<string, string>;
  roomConfig?: {
    agents?: Array<{ agentName: string; metadata?: string }>;
  };
  createdAt?: number;
}

export interface CreateDispatchRuleRequest {
  name: string;
  ruleType: "individual" | "direct" | "callee";
  roomPrefix?: string;
  roomName?: string;
  pin?: string;
  randomize?: boolean;
  trunkIds?: string[];
  hidePhoneNumber?: boolean;
  metadata?: string;
  attributes?: Record<string, string>;
  agentName?: string;
}

export interface UpdateDispatchRuleRequest {
  name?: string;
  ruleType?: "individual" | "direct" | "callee";
  roomPrefix?: string;
  roomName?: string;
  pin?: string;
  randomize?: boolean;
  trunkIds?: string[];
  hidePhoneNumber?: boolean;
  metadata?: string;
  attributes?: Record<string, string>;
  agentName?: string;
}

export const dispatchRuleApi = {
  create: (data: CreateDispatchRuleRequest) =>
    request<DispatchRuleInfo>("/dispatch-rules", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  list: () => request<DispatchRuleInfo[]>("/dispatch-rules"),

  getById: (id: string) => request<DispatchRuleInfo>(`/dispatch-rules/${id}`),

  update: (id: string, data: UpdateDispatchRuleRequest) =>
    request<DispatchRuleInfo>(`/dispatch-rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<DispatchRuleInfo>(`/dispatch-rules/${id}`, { method: "DELETE" }),
};

// ─── Live Rooms ──────────────────────────────────────────────

export interface LiveKitRoom {
  sid: string;
  name: string;
  emptyTimeout: number;
  maxParticipants: number;
  creationTime: string;
  turnPassword: string;
  numParticipants: number;
  numPublishers: number;
  activeRecording: boolean;
  metadata: string;
}

export interface CallSession {
  id: string;
  room_name: string;
  status: string;
  metadata: string;
  phone_number: string | null;
  agent_name: string | null;
  direction: string | null;
  channel: string | null;
  agent_config_snapshot: AgentConfigSnapshot | null;
  summary: { text: string } | null;
  ticket: Record<string, any> | null;
  duration_seconds: number | null;
  created_at: string;
  ended_at: string | null;
}

export interface ListSessionsParams {
  ticketField?: string;
  ticketValue?: string;
  hasTicket?: boolean;
  agentName?: string;
  status?: string;
  limit?: number;
}

export interface AgentConfigSnapshot {
  model?: string;
  voice?: string;
  temperature?: number;
  maxTokens?: number;
  turnDetection?: Record<string, any>;
  noiseCancellation?: boolean;
  humanization?: Record<string, any>;
  persona?: string;
  timeoutSeconds?: number | null;
  maxCallDurationSeconds?: number | null;
  greetingMessage?: string | null;
  greetingMode?: string | null;
  tts?: Record<string, any> | null;
  stt?: Record<string, any> | null;
  sessionTurnDetection?: string | null;
  tools?: Array<{ name: string; type: string; description: string }>;
}

// ─── Conversation Events ─────────────────────────────────────

export interface SessionEvent {
  id: string;
  session_id: string;
  event_type: string;
  payload: Record<string, any>;
  occurred_at: string;
  created_at: string;
}

export interface GroupedEvents {
  total: number;
  grouped: Record<string, SessionEvent[]>;
}

export const conversationEventsApi = {
  byRoom: (roomName: string) =>
    request<SessionEvent[]>(
      `/conversation-events/room/${encodeURIComponent(roomName)}`
    ),

  bySession: (sessionId: string) =>
    request<SessionEvent[]>(
      `/conversation-events/session/${encodeURIComponent(sessionId)}`
    ),

  bySessionGrouped: (sessionId: string) =>
    request<GroupedEvents>(
      `/conversation-events/session/${encodeURIComponent(sessionId)}/grouped`
    ),
};

export const roomApi = {
  create: (data: CreateRoomRequest) =>
    request<CreateRoomResponse>("/rooms", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listSessions: (params?: ListSessionsParams) => {
    const searchParams = new URLSearchParams();
    if (params?.ticketField) searchParams.set("ticketField", params.ticketField);
    if (params?.ticketValue) searchParams.set("ticketValue", params.ticketValue);
    if (params?.hasTicket) searchParams.set("hasTicket", "true");
    if (params?.agentName) searchParams.set("agentName", params.agentName);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return request<CallSession[]>(`/rooms${qs ? `?${qs}` : ""}`);
  },

  listLive: () => request<LiveKitRoom[]>("/rooms/live"),

  deleteLive: (roomName: string) =>
    request<{ success: boolean; message: string }>(
      `/rooms/live/${encodeURIComponent(roomName)}`,
      { method: "DELETE" }
    ),
};
