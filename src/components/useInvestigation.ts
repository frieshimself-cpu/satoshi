"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState } from "@/lib/types";

export interface Investigation {
  state: AppState | null;
  /** Text of the analysis currently streaming (replayed + live tokens). */
  liveText: string;
  liveKind: "dossier" | "synthesis" | null;
  liveDossierIndex: number | null;
  isStreaming: boolean;
  connected: boolean;
  lastError: string | null;
  refresh: () => Promise<void>;
}

export function useInvestigation(): Investigation {
  const [state, setState] = useState<AppState | null>(null);
  const [liveText, setLiveText] = useState("");
  const [liveKind, setLiveKind] = useState<"dossier" | "synthesis" | null>(null);
  const [liveDossierIndex, setLiveDossierIndex] = useState<number | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) return;
      const s: AppState = await res.json();
      setState(s);
      // Replay a mid-flight stream after refresh/reconnect.
      if (s.streaming.active) {
        setIsStreaming(true);
        setLiveKind(s.streaming.kind);
        setLiveDossierIndex(s.streaming.dossierIndex);
        setLiveText(s.streaming.text);
      } else {
        setIsStreaming(false);
      }
    } catch {
      // network hiccup; SSE reconnect will trigger another refresh
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const es = new EventSource("/api/stream");
      esRef.current = es;

      es.addEventListener("connected", () => {
        setConnected(true);
        setLastError(null);
        void refresh();
      });

      es.addEventListener("token", (e) => {
        const d = JSON.parse((e as MessageEvent).data);
        setIsStreaming(true);
        setLiveKind(d.kind);
        setLiveDossierIndex(d.dossierIndex);
        setLiveText((prev) => prev + d.text);
      });

      es.addEventListener("dossier_started", (e) => {
        const d = JSON.parse((e as MessageEvent).data);
        setIsStreaming(true);
        setLiveKind("dossier");
        setLiveDossierIndex(d.dossierIndex);
        setLiveText("");
        void refresh();
      });

      es.addEventListener("synthesis_started", () => {
        setIsStreaming(true);
        setLiveKind("synthesis");
        setLiveDossierIndex(null);
        setLiveText("");
      });

      const onComplete = () => {
        setIsStreaming(false);
        void refresh();
      };
      es.addEventListener("dossier_complete", onComplete);
      es.addEventListener("synthesis_complete", onComplete);
      es.addEventListener("leaderboard_update", onComplete);

      es.addEventListener("analysis_error", (e) => {
        const d = JSON.parse((e as MessageEvent).data);
        setIsStreaming(false);
        setLastError(d.message ?? "Analysis failed");
        void refresh();
      });

      es.addEventListener("reset", () => {
        setIsStreaming(false);
        setLiveText("");
        setLiveKind(null);
        setLiveDossierIndex(null);
        setLastError(null);
        void refresh();
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        if (!cancelled) setTimeout(connect, 2500);
      };
    };

    void refresh();
    connect();

    return () => {
      cancelled = true;
      esRef.current?.close();
    };
  }, [refresh]);

  return {
    state,
    liveText,
    liveKind,
    liveDossierIndex,
    isStreaming,
    connected,
    lastError,
    refresh,
  };
}
