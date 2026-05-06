"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useChat,
  useLocalParticipant,
  useTranscriptions,
} from "@livekit/components-react";
import "@livekit/components-styles";
import {
  ArrowLeft,
  FlaskConical,
  Loader2,
  Mic,
  MicOff,
  Send,
  Bot,
  User,
  Radio,
  Square,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { testSessionApi, type TestSessionStartResponse } from "@/lib/api";

type SessionState = "idle" | "connecting" | "connected" | "ending";

function VoiceControls() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const t = useTranslations("testSession");

  const toggleMic = async () => {
    await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={toggleMic}
        className={`relative flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all duration-200 ${
          isMicrophoneEnabled
            ? "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-[0_0_0_6px_rgb(16_185_129/0.12)]"
            : "border-border bg-muted text-muted-foreground hover:border-foreground/30 hover:bg-accent"
        }`}
        title={isMicrophoneEnabled ? t("micOn") : t("micOff")}
      >
        {isMicrophoneEnabled ? (
          <Mic className="h-8 w-8" strokeWidth={1.5} />
        ) : (
          <MicOff className="h-8 w-8" strokeWidth={1.5} />
        )}
        {isMicrophoneEnabled && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          </span>
        )}
      </button>
      <span className="text-[11px] font-medium text-muted-foreground">
        {isMicrophoneEnabled ? t("micOn") : t("micOff")}
      </span>
    </div>
  );
}

function TranscriptPanel() {
  const transcriptions = useTranscriptions();
  const { chatMessages } = useChat();
  const { localParticipant } = useLocalParticipant();
  const scrollRef = useRef<HTMLDivElement>(null);

  type Entry = { type: "transcription" | "chat"; key: string; text: string; isLocal: boolean };

  const [entries, setEntries] = useState<Entry[]>([]);
  const seenKeys = useRef<Set<string>>(new Set());

  // Append transcription updates in arrival order, update text if key already exists
  useEffect(() => {
    setEntries((prev) => {
      const updated = [...prev];
      const newItems: Entry[] = [];
      transcriptions.forEach((t) => {
        const key = `t-${t.participantInfo.identity}-${t.streamInfo.id}`;
        const existingIdx = updated.findIndex((e) => e.key === key);
        if (existingIdx !== -1) {
          // update text in place (streaming)
          updated[existingIdx] = { ...updated[existingIdx], text: t.text };
        } else {
          seenKeys.current.add(key);
          newItems.push({
            type: "transcription",
            key,
            text: t.text,
            isLocal: t.participantInfo.identity.startsWith("tester"),
          });
        }
      });
      return newItems.length > 0 ? [...updated, ...newItems] : updated;
    });
  }, [transcriptions]);

  // Append chat messages in arrival order
  useEffect(() => {
    const newItems: Entry[] = [];
    chatMessages.forEach((m) => {
      const key = `c-${m.id}`;
      if (!seenKeys.current.has(key)) {
        seenKeys.current.add(key);
        newItems.push({
          type: "chat",
          key,
          text: m.message,
          isLocal: m.from?.identity === localParticipant?.identity,
        });
      }
    });
    if (newItems.length > 0) setEntries((prev) => [...prev, ...newItems]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.key}
          className={`flex gap-2 ${entry.isLocal ? "flex-row-reverse" : "flex-row"}`}
        >
          <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border mt-0.5 ${entry.isLocal ? "bg-primary border-primary" : "bg-muted border-border"}`}>
            {entry.isLocal
              ? <User className="h-3 w-3 text-primary-foreground" strokeWidth={1.5} />
              : <Bot className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
            }
          </div>
          <div className={`max-w-[75%] space-y-0.5 ${entry.isLocal ? "items-end" : "items-start"} flex flex-col`}>
            <div className={`flex items-center gap-1.5 ${entry.isLocal ? "flex-row-reverse" : ""}`}>
              <span className="text-[10px] font-medium text-muted-foreground">
                {entry.isLocal ? "You" : "Agent"}
              </span>
              {entry.type === "chat" && (
                <span className="text-[9px] text-muted-foreground/50 border rounded px-1">text</span>
              )}
            </div>
            <span className={`inline-block rounded-xl px-3 py-2 text-sm leading-relaxed ${
              entry.isLocal
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-muted text-foreground rounded-tl-sm"
            }`}>
              {entry.text}
            </span>
          </div>
        </div>
      ))}
      {entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
            <Bot className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Ready to listen</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Start speaking — the transcript will appear here</p>
        </div>
      )}
    </div>
  );
}

function ChatInput() {
  const { send } = useChat();
  const [message, setMessage] = useState("");
  const t = useTranslations("testSession");

  const handleSend = async () => {
    if (!message.trim()) return;
    await send(message.trim());
    setMessage("");
  };

  return (
    <div className="flex gap-2 border-t bg-card px-4 py-3">
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t("typeMessage")}
        className="h-9 text-sm bg-muted border-0 focus-visible:ring-1"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void handleSend();
          }
        }}
      />
      <Button
        size="sm"
        className="h-9 w-9 p-0 flex-shrink-0"
        onClick={() => void handleSend()}
        disabled={!message.trim()}
      >
        <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
      </Button>
    </div>
  );
}

function ActiveSession() {
  const t = useTranslations("testSession");

  return (
    <div className="flex h-full gap-4">
      {/* Left: mic + status */}
      <div className="flex w-52 flex-shrink-0 flex-col rounded-xl border bg-card overflow-hidden">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
              <Radio className="h-3 w-3 text-emerald-600" strokeWidth={1.5} />
            </span>
            <span className="text-xs font-medium">Session active</span>
          </div>
        </div>
        <RoomAudioRenderer />
        <div className="flex flex-1 items-center justify-center py-8">
          <VoiceControls />
        </div>
        <div className="border-t px-4 py-3">
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Toggle the mic button or type in the chat panel
          </p>
        </div>
      </div>

      {/* Right: transcript + chat */}
      <div className="flex flex-1 flex-col rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-xs font-semibold">Transcript</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            {t("active")}
          </span>
        </div>
        <TranscriptPanel />
        <ChatInput />
      </div>
    </div>
  );
}

function AgentTestContent() {
  const t = useTranslations("testSession");
  const searchParams = useSearchParams();
  const router = useRouter();
  const agentName = searchParams.get("agent") ?? "";
  const version = searchParams.get("version") ?? undefined;

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [sessionData, setSessionData] = useState<TestSessionStartResponse | null>(null);

  const handleStart = useCallback(async () => {
    if (!agentName) return;
    setSessionState("connecting");
    try {
      const data = await testSessionApi.start(agentName, version);
      setSessionData(data);
      setSessionState("connected");
    } catch {
      toast.error(t("errorStart"));
      setSessionState("idle");
    }
  }, [agentName, version, t]);

  const handleEnd = useCallback(async () => {
    if (!agentName) return;
    setSessionState("ending");
    try {
      await testSessionApi.end(agentName);
    } catch {
      toast.error(t("errorEnd"));
    }
    setSessionData(null);
    setSessionState("idle");
  }, [agentName, t]);

  useEffect(() => {
    if (!agentName) return;
    const checkStatus = async () => {
      try {
        const status = await testSessionApi.status(agentName);
        if (!status.active) return;
        setSessionState("connecting");
        const data = await testSessionApi.start(agentName, version);
        setSessionData(data);
        setSessionState("connected");
      } catch {
        setSessionState("idle");
      }
    };
    void checkStatus();
  }, [agentName, version]);

  if (!agentName) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
          <FlaskConical className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{t("noAgent")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() =>
              router.push(
                `/agent?agent=${encodeURIComponent(agentName)}` as Parameters<typeof router.push>[0]
              )
            }
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            {t("backToAgent")}
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border bg-card">
              <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">{agentName}</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">Voice test session</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sessionState === "idle" && (
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void handleStart()}>
              <Play className="h-3.5 w-3.5 fill-current" strokeWidth={1.5} />
              {t("start")}
            </Button>
          )}
          {sessionState === "connecting" && (
            <Button size="sm" disabled className="h-8 gap-1.5 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
              {t("connecting")}
            </Button>
          )}
          {sessionState === "connected" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => void handleEnd()}
            >
              <Square className="h-3 w-3 fill-current" strokeWidth={1.5} />
              {t("end")}
            </Button>
          )}
          {sessionState === "ending" && (
            <Button size="sm" variant="outline" disabled className="h-8 gap-1.5 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
              {t("ending")}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {sessionState === "idle" && (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-card">
              <FlaskConical className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Ready to test <span className="text-foreground">{agentName}</span></p>
              <p className="text-xs text-muted-foreground mt-1">
                A voice session will be created — you can speak or type to interact
              </p>
            </div>
            <Button size="sm" className="gap-1.5 text-xs h-9 px-5" onClick={() => void handleStart()}>
              <Play className="h-3.5 w-3.5 fill-current" strokeWidth={1.5} />
              {t("start")}
            </Button>
          </div>
        )}
        {(sessionState === "connecting" || sessionState === "ending") && (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" strokeWidth={1.5} />
            <p className="text-xs text-muted-foreground">
              {sessionState === "connecting" ? t("connecting") : t("ending")}…
            </p>
          </div>
        )}
        {sessionState === "connected" && sessionData && (
          <LiveKitRoom
            serverUrl={sessionData.wsUrl}
            token={sessionData.token}
            connect={true}
            audio={true}
            video={false}
          >
            <ActiveSession />
          </LiveKitRoom>
        )}
      </div>
    </div>
  );
}

export default function AgentTestPage() {
  return (
    <Suspense>
      <AgentTestContent />
    </Suspense>
  );
}
