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
  type?: string;
  silence_duration_ms?: number;
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
  tts?: TTSConfig;
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

const DEFAULT_AGENT_NAME = "captador-agent";

export const agentConfigApi = {
  get: (agentName: string = DEFAULT_AGENT_NAME) =>
    request<AgentConfig>(`/agent-config?agentName=${encodeURIComponent(agentName)}`),

  update: (
    instructions: string,
    agentName: string = DEFAULT_AGENT_NAME,
    options?: { auto_start?: boolean; tools?: any; runtime_config?: RuntimeConfig }
  ) =>
    request<AgentConfig>(`/agent-config?agentName=${encodeURIComponent(agentName)}`, {
      method: "PUT",
      body: JSON.stringify({ instructions, ...options }),
    }),

  listAgents: () => request<string[]>("/agent-config/agents"),
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

  list: (agentName: string = DEFAULT_AGENT_NAME) =>
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

  spawn: (agentName: string) =>
    request<WorkerRestartResponse>(
      `/agent-worker/spawn?agentName=${encodeURIComponent(agentName)}`,
      { method: "POST" }
    ),

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

export type ToolType = "TRANSFER_CALL" | "END_CALL" | "HTTP_REQUEST";

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
  created_at: string;
  updated_at: string;
}

export const roomApi = {
  create: (data: CreateRoomRequest) =>
    request<CreateRoomResponse>("/rooms", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listSessions: () => request<CallSession[]>("/rooms"),

  listLive: () => request<LiveKitRoom[]>("/rooms/live"),

  deleteLive: (roomName: string) =>
    request<{ success: boolean; message: string }>(
      `/rooms/live/${encodeURIComponent(roomName)}`,
      { method: "DELETE" }
    ),
};
