import {
  Mic,
  Brain,
  AudioLines,
  Radio,
  Video,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Atlassian Statuspage indicator values */
export type StatusIndicator = "none" | "minor" | "major" | "critical";

export type ProviderType = "statuspage" | "self-hosted";

export interface ProviderConfig {
  slug: string;
  name: string;
  type: ProviderType;
  /** /api/v2/status.json — only for statuspage providers */
  statusApiUrl?: string;
  /** /api/v2/summary.json — only for statuspage providers */
  summaryApiUrl?: string;
  /** Human-facing status page link — only for statuspage providers */
  statusPageUrl?: string;
  icon: LucideIcon;
}

/** Shape returned by /api/v2/status.json */
export interface StatuspageStatusResponse {
  page: {
    id: string;
    name: string;
    url: string;
    updated_at: string;
  };
  status: {
    indicator: StatusIndicator;
    description: string;
  };
}

/** Component inside /api/v2/summary.json */
export interface StatuspageComponent {
  id: string;
  name: string;
  status: string;
  description: string | null;
  updated_at: string;
}

/** Shape returned by /api/v2/summary.json */
export interface StatuspageSummaryResponse {
  page: StatuspageStatusResponse["page"];
  status: StatuspageStatusResponse["status"];
  components: StatuspageComponent[];
}

/** Runtime status for a single provider */
export interface ProviderStatus {
  slug: string;
  indicator: StatusIndicator | "unknown";
  description: string;
  updatedAt: string | null;
  /** Latency in ms — only for self-hosted providers */
  latencyMs?: number;
}

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

export const PROVIDERS: ProviderConfig[] = [
  {
    slug: "deepgram",
    name: "Deepgram",
    type: "statuspage",
    statusApiUrl: "https://status.deepgram.com/api/v2/status.json",
    summaryApiUrl: "https://status.deepgram.com/api/v2/summary.json",
    statusPageUrl: "https://status.deepgram.com/",
    icon: Mic,
  },
  {
    slug: "openai",
    name: "OpenAI",
    type: "statuspage",
    statusApiUrl: "https://status.openai.com/api/v2/status.json",
    summaryApiUrl: "https://status.openai.com/api/v2/summary.json",
    statusPageUrl: "https://status.openai.com/",
    icon: Brain,
  },
  {
    slug: "elevenlabs",
    name: "ElevenLabs",
    type: "statuspage",
    statusApiUrl: "https://status.elevenlabs.io/api/v2/status.json",
    summaryApiUrl: "https://status.elevenlabs.io/api/v2/summary.json",
    statusPageUrl: "https://status.elevenlabs.io/",
    icon: AudioLines,
  },
  {
    slug: "cartesia",
    name: "Cartesia",
    type: "statuspage",
    statusApiUrl: "https://status.cartesia.ai/api/v2/status.json",
    summaryApiUrl: "https://status.cartesia.ai/api/v2/summary.json",
    statusPageUrl: "https://status.cartesia.ai/",
    icon: Radio,
  },
  {
    slug: "livekit",
    name: "LiveKit",
    type: "self-hosted",
    icon: Video,
  },
];

// ---------------------------------------------------------------------------
// Visual mapping
// ---------------------------------------------------------------------------

export type VisualStatus = "operational" | "degraded" | "outage" | "unknown";

export const INDICATOR_MAP: Record<
  StatusIndicator | "unknown",
  { visual: VisualStatus; label: string; color: string; dotColor: string }
> = {
  none: {
    visual: "operational",
    label: "Operational",
    color: "text-emerald-500",
    dotColor: "bg-emerald-500",
  },
  minor: {
    visual: "degraded",
    label: "Degraded",
    color: "text-yellow-500",
    dotColor: "bg-yellow-500",
  },
  major: {
    visual: "outage",
    label: "Major Outage",
    color: "text-orange-500",
    dotColor: "bg-orange-500",
  },
  critical: {
    visual: "outage",
    label: "Critical",
    color: "text-red-500",
    dotColor: "bg-red-500",
  },
  unknown: {
    visual: "unknown",
    label: "Unknown",
    color: "text-muted-foreground",
    dotColor: "bg-muted-foreground",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "provider-status-enabled";

export function getMonitoringEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

export function setMonitoringEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

/** Default polling interval: 3 minutes */
export const DEFAULT_POLL_INTERVAL = 3 * 60 * 1000;
