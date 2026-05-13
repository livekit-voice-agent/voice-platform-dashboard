export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

let currentProjectId: string | null = null;
let cachedApiToken: string | null = null;
let currentLocale: string = "en";

// Promise that resolves once the session token is available.
let _tokenResolve: (() => void) | null = null;
let _tokenReady: Promise<void> | null = new Promise<void>((r) => {
  _tokenResolve = r;
});

export function setApiToken(token: string | null) {
  cachedApiToken = token;
  if (token && _tokenResolve) {
    _tokenResolve();
    _tokenResolve = null;
    _tokenReady = null;
  }
  // If the token was cleared (logout), prepare a new promise for the next login.
  if (!token && !_tokenReady) {
    _tokenReady = new Promise<void>((r) => {
      _tokenResolve = r;
    });
  }
}

export function getApiToken(): string | null {
  return cachedApiToken;
}

export function setApiLocale(locale: string) {
  currentLocale = locale;
}

export function setCurrentProjectId(projectId: string | null) {
  currentProjectId = projectId;
  if (typeof window !== "undefined") {
    if (projectId) {
      localStorage.setItem("selectedProjectId", projectId);
    } else {
      localStorage.removeItem("selectedProjectId");
    }
  }
}

export function getCurrentProjectId(): string | null {
  if (currentProjectId) return currentProjectId;
  if (typeof window !== "undefined") {
    return localStorage.getItem("selectedProjectId");
  }
  return null;
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  // Wait for the session token if it hasn't arrived yet (max 10 s).
  if (!cachedApiToken && _tokenReady) {
    await Promise.race([
      _tokenReady,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("NO_TOKEN")), 10_000)
      ),
    ]);
  }

  const token = cachedApiToken;
  if (!token) {
    throw new Error("NO_TOKEN");
  }

  const projectId = getCurrentProjectId();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    ...(options?.headers as Record<string, string>),
  };

  if (projectId) {
    headers["x-project-id"] = projectId;
  }

  if (currentLocale) {
    headers["Accept-Language"] = currentLocale;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  if (res.status === 403) {
    const body = await res.json().catch(() => ({ message: "Forbidden" }));
    throw new Error(body.message || "You don't have permission for this action");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message || `API error: ${res.status}`);
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
  typingVolume?: number;
  ambience?: boolean;
  ambienceSource?: string;
  ambienceVolume?: number;
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
  /** Transient: raw text typed by the user in the options input (not persisted) */
  _optionsText?: string;
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

    const token = cachedApiToken;
    const uploadHeaders: Record<string, string> = {};
    if (token) {
      uploadHeaders["Authorization"] = `Bearer ${token}`;
    }
    const projectId = getCurrentProjectId();
    if (projectId) {
      uploadHeaders["x-project-id"] = projectId;
    }
    if (currentLocale) {
      uploadHeaders["Accept-Language"] = currentLocale;
    }

    const res = await fetch(
      `${API_BASE_URL}/agent-knowledge/upload?agentName=${encodeURIComponent(agentName)}&summarize=${summarize}`,
      {
        method: "POST",
        headers: uploadHeaders,
        body: formData,
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
  k8s?: {
    id: string;
    image: string;
    config?: Record<string, string>;
    status?: string;
  };
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

  deleteDeployment: (agentName: string) =>
    request<{ success: boolean; message: string }>(
      `/deploy/${encodeURIComponent(agentName)}`,
      { method: "DELETE" }
    ),

  deployToK8s: (agentName: string, configVersion?: number) =>
    request<{ success: boolean; agent_id: string; image: string; config_version: number }>(
      `/deploy/${encodeURIComponent(agentName)}/k8s`,
      {
        method: "POST",
        body: JSON.stringify({ configVersion }),
      }
    ),

  getDeploymentById: (deploymentId: string) =>
    request<AgentDeployment>(`/deploy/deployment/${encodeURIComponent(deploymentId)}`),

  getConfig: () => request<DeployConfig>("/deploy/config/settings"),

  updateConfig: (data: UpdateDeployConfigRequest) =>
    request<DeployConfig>("/deploy/config/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getPrebuiltImage: () =>
    request<{ image: string | null }>("/deploy/config/prebuilt-image"),

  usePrebuiltImage: (agentName: string) =>
    request<TriggerDeployResponse>(
      `/deploy/${encodeURIComponent(agentName)}/prebuilt`,
      { method: "POST" }
    ),
};

// ─── Test Session ─────────────────────────────────────────────

export interface TestSessionStartResponse {
  roomName: string;
  token: string;
  wsUrl: string;
}

export interface TestSessionStatus {
  active: boolean;
  roomName?: string;
  startedAt?: string;
}

export const testSessionApi = {
  start: (agentName: string, version?: string) =>
    request<TestSessionStartResponse>(
      `/test-session/${encodeURIComponent(agentName)}/start`,
      {
        method: "POST",
        body: JSON.stringify({ version }),
      }
    ),

  end: (agentName: string) =>
    request<{ success: boolean }>(
      `/test-session/${encodeURIComponent(agentName)}/end`,
      { method: "DELETE" }
    ),

  status: (agentName: string) =>
    request<TestSessionStatus>(
      `/test-session/${encodeURIComponent(agentName)}/status`
    ),
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
  headersToAttributes?: Record<string, string>;
  createdAt?: number;
}

export interface CreateSipTrunkRequest {
  name: string;
  numbers?: string[];
  allowedNumbers?: string[];
  allowedAddresses?: string[];
  krispEnabled?: boolean;
  metadata?: string;
  headersToAttributes?: Record<string, string>;
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
  recording_path: string | null;
  recording_url: string | null;
}

export interface ListSessionsParams {
  ticketField?: string;
  ticketValue?: string;
  hasTicket?: boolean;
  agentName?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedSessions {
  data: CallSession[];
  total: number;
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
    if (params?.offset !== undefined) searchParams.set("offset", String(params.offset));
    const qs = searchParams.toString();
    return request<PaginatedSessions>(`/rooms${qs ? `?${qs}` : ""}`);
  },

  listLive: () => request<LiveKitRoom[]>("/rooms/live"),

  getSession: (id: string) => request<CallSession>(`/rooms/${encodeURIComponent(id)}`),

  getRecordingUrl: (id: string) =>
    request<{ url: string; expires_in: number } | null>(
      `/rooms/${encodeURIComponent(id)}/recording-url`
    ),

  deleteLive: (roomName: string) =>
    request<{ success: boolean; message: string }>(
      `/rooms/live/${encodeURIComponent(roomName)}`,
      { method: "DELETE" }
    ),
};

// ─── Projects API ────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  created_at: string;
  _count?: { members: number; agents: number };
}

export const projectApi = {
  list: () => request<Project[]>("/projects"),
  getById: (id: string) => request<Project>(`/projects/${id}`),
  create: (data: { name: string; description?: string }) =>
    request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { name?: string; description?: string }) =>
    request<Project>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/projects/${id}`, { method: "DELETE" }),
  listMembers: (id: string) =>
    request<any[]>(`/projects/${id}/members`),
  addMember: (id: string, data: { user_id: string; role?: string }) =>
    request<any>(`/projects/${id}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateMemberRole: (projectId: string, userId: string, role: string) =>
    request<any>(`/projects/${projectId}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  removeMember: (projectId: string, userId: string) =>
    request<{ removed: boolean }>(`/projects/${projectId}/members/${userId}`, {
      method: "DELETE",
    }),
};

// ─── Users API ────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  is_super_admin: boolean;
  memberships?: Array<{
    role: string;
    project: { id: string; name: string; slug: string };
  }>;
}

export const userApi = {
  getMe: () => request<UserProfile>("/users/me"),
  listAll: () => request<UserProfile[]>("/users"),
  create: (data: {
    email: string;
    password: string;
    name?: string;
    is_super_admin?: boolean;
  }) =>
    request<UserProfile>("/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (
    id: string,
    data: { name?: string; avatar_url?: string; is_super_admin?: boolean }
  ) =>
    request<UserProfile>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/users/${id}`, { method: "DELETE" }),
  changePassword: (data: {
    current_password: string;
    new_password: string;
  }) =>
    request<{ updated: boolean }>("/users/me/password", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};
