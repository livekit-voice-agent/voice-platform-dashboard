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

// Types
export interface TurnDetectionConfig {
  type?: string;
  silence_duration_ms?: number;
  interrupt_threshold_ms?: number;
}

export interface HumanizationConfig {
  fillersEnabled?: boolean;
  typingSounds?: boolean;
  ambience?: boolean;
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

// Agent Config API
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

// Knowledge Base API
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

// Worker API
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

// Room API
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

export const roomApi = {
  create: (data: CreateRoomRequest) =>
    request<CreateRoomResponse>("/rooms", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ─── Deploy Types ──────────────────────────────────────────────────────────

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

// ─── Deploy API ────────────────────────────────────────────────────────────

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
